const winston = require('winston');
const { createClient } = require('@supabase/supabase-js');

/**
 * BTCPay Server Webhook Handler
 * Processes Lightning payment notifications securely
 */
class BTCPayWebhookHandler {
    constructor(btcpayClient, supabaseConfig) {
        this.btcpayClient = btcpayClient;
        this.supabase = createClient(supabaseConfig.url, supabaseConfig.key);
        
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'webhook.log' }),
                new winston.transports.Console()
            ]
        });
    }

    /**
     * Handle incoming webhook from BTCPay Server
     * 
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async handleWebhook(req, res) {
        try {
            const signature = req.headers['btcpay-sig'];
            const payload = JSON.stringify(req.body);
            
            // Verify webhook signature for security
            if (!this.btcpayClient.verifyWebhookSignature(payload, signature)) {
                this.logger.error('Webhook signature verification failed', {
                    signature: signature,
                    timestamp: new Date().toISOString()
                });
                return res.status(401).json({ error: 'Invalid signature' });
            }

            const webhookData = req.body;
            this.logger.info('Webhook received', {
                type: webhookData.type,
                invoiceId: webhookData.invoiceId,
                deliveryId: webhookData.deliveryId
            });

            // Process different webhook types
            switch (webhookData.type) {
                case 'InvoiceReceivedPayment':
                    await this.handlePaymentReceived(webhookData);
                    break;
                case 'InvoicePaymentSettled':
                    await this.handlePaymentSettled(webhookData);
                    break;
                case 'InvoiceProcessing':
                    await this.handleInvoiceProcessing(webhookData);
                    break;
                case 'InvoiceExpired':
                    await this.handleInvoiceExpired(webhookData);
                    break;
                case 'InvoiceInvalid':
                    await this.handleInvoiceInvalid(webhookData);
                    break;
                default:
                    this.logger.info('Unhandled webhook type', { type: webhookData.type });
            }

            res.status(200).json({ success: true });

        } catch (error) {
            this.logger.error('Webhook processing error', {
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            res.status(500).json({ error: 'Webhook processing failed' });
        }
    }

    /**
     * Handle payment received (may not be confirmed yet)
     * 
     * @param {Object} webhookData - BTCPay webhook payload
     */
    async handlePaymentReceived(webhookData) {
        const processedData = this.btcpayClient.processWebhook(webhookData);
        
        try {
            // Update invoice status to processing
            await this.updateInvoiceStatus(processedData.invoiceId, 'processing', {
                btcpayData: processedData,
                event: 'payment_received',
                timestamp: new Date().toISOString()
            });

            this.logger.info('Payment received', {
                invoiceId: processedData.invoiceId,
                amount: processedData.paidAmount,
                orderId: processedData.orderId
            });

        } catch (error) {
            this.logger.error('Failed to process payment received', {
                error: error.message,
                invoiceId: processedData.invoiceId
            });
        }
    }

    /**
     * Handle payment settled (confirmed and final)
     * 
     * @param {Object} webhookData - BTCPay webhook payload
     */
    async handlePaymentSettled(webhookData) {
        const processedData = this.btcpayClient.processWebhook(webhookData);
        
        try {
            // Update invoice status to paid
            await this.updateInvoiceStatus(processedData.invoiceId, 'paid', {
                btcpayData: processedData,
                event: 'payment_settled',
                paidAt: new Date().toISOString(),
                finalAmount: processedData.paidAmount
            });

            // Record successful payment
            await this.recordPayment(processedData);

            // Trigger order fulfillment
            await this.triggerOrderFulfillment(processedData);

            this.logger.info('Payment settled successfully', {
                invoiceId: processedData.invoiceId,
                amount: processedData.paidAmount,
                orderId: processedData.orderId
            });

        } catch (error) {
            this.logger.error('Failed to process payment settlement', {
                error: error.message,
                invoiceId: processedData.invoiceId
            });
        }
    }

    /**
     * Handle invoice processing status
     * 
     * @param {Object} webhookData - BTCPay webhook payload
     */
    async handleInvoiceProcessing(webhookData) {
        const processedData = this.btcpayClient.processWebhook(webhookData);
        
        await this.updateInvoiceStatus(processedData.invoiceId, 'processing', {
            btcpayData: processedData,
            event: 'invoice_processing'
        });
    }

    /**
     * Handle invoice expiration
     * 
     * @param {Object} webhookData - BTCPay webhook payload
     */
    async handleInvoiceExpired(webhookData) {
        const processedData = this.btcpayClient.processWebhook(webhookData);
        
        await this.updateInvoiceStatus(processedData.invoiceId, 'expired', {
            btcpayData: processedData,
            event: 'invoice_expired',
            expiredAt: new Date().toISOString()
        });

        this.logger.info('Invoice expired', {
            invoiceId: processedData.invoiceId,
            orderId: processedData.orderId
        });
    }

    /**
     * Handle invalid invoice
     * 
     * @param {Object} webhookData - BTCPay webhook payload
     */
    async handleInvoiceInvalid(webhookData) {
        const processedData = this.btcpayClient.processWebhook(webhookData);
        
        await this.updateInvoiceStatus(processedData.invoiceId, 'failed', {
            btcpayData: processedData,
            event: 'invoice_invalid',
            failedAt: new Date().toISOString()
        });

        this.logger.error('Invoice marked as invalid', {
            invoiceId: processedData.invoiceId,
            orderId: processedData.orderId
        });
    }

    /**
     * Update invoice status in database
     * 
     * @param {string} invoiceId - Invoice ID
     * @param {string} status - New status
     * @param {Object} metadata - Additional data
     */
    async updateInvoiceStatus(invoiceId, status, metadata = {}) {
        try {
            const { error } = await this.supabase
                .from('lightning_invoices')
                .update({
                    status: status,
                    updated_at: new Date().toISOString(),
                    webhook_data: metadata,
                    ...(status === 'paid' && { paid_at: new Date().toISOString() })
                })
                .eq('id', invoiceId);

            if (error) {
                throw error;
            }

        } catch (error) {
            this.logger.error('Database update failed', {
                error: error.message,
                invoiceId: invoiceId,
                status: status
            });
            throw error;
        }
    }

    /**
     * Record payment in payments table
     * 
     * @param {Object} paymentData - Payment details
     */
    async recordPayment(paymentData) {
        try {
            const payment = {
                id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                invoice_id: paymentData.invoiceId,
                amount: paymentData.paidAmount,
                payment_hash: paymentData.btcpayData?.data?.paymentHash || null,
                status: 'completed',
                completed_at: new Date().toISOString(),
                btcpay_data: paymentData.btcpayData
            };

            const { error } = await this.supabase
                .from('payments')
                .insert([payment]);

            if (error) {
                throw error;
            }

            this.logger.info('Payment recorded', {
                paymentId: payment.id,
                invoiceId: paymentData.invoiceId,
                amount: paymentData.paidAmount
            });

        } catch (error) {
            this.logger.error('Failed to record payment', {
                error: error.message,
                invoiceId: paymentData.invoiceId
            });
            throw error;
        }
    }

    /**
     * Trigger order fulfillment process
     * 
     * @param {Object} paymentData - Payment details
     */
    async triggerOrderFulfillment(paymentData) {
        try {
            // This would integrate with your order fulfillment system
            // For now, we'll just log the successful payment
            
            this.logger.info('Order fulfillment triggered', {
                orderId: paymentData.orderId,
                invoiceId: paymentData.invoiceId,
                amount: paymentData.paidAmount,
                timestamp: new Date().toISOString()
            });

            // TODO: Add actual order fulfillment logic
            // - Send confirmation email
            // - Update order status
            // - Trigger delivery process
            // - Generate receipt

        } catch (error) {
            this.logger.error('Order fulfillment failed', {
                error: error.message,
                orderId: paymentData.orderId,
                invoiceId: paymentData.invoiceId
            });
        }
    }

    /**
     * Get webhook delivery status
     * 
     * @param {string} deliveryId - Webhook delivery ID
     * @returns {Object} Delivery status information
     */
    async getWebhookDeliveryStatus(deliveryId) {
        try {
            // Log webhook delivery for monitoring
            this.logger.info('Webhook delivery processed', {
                deliveryId: deliveryId,
                processedAt: new Date().toISOString()
            });

            return {
                deliveryId: deliveryId,
                status: 'processed',
                processedAt: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to get webhook delivery status', {
                error: error.message,
                deliveryId: deliveryId
            });
            throw error;
        }
    }
}

module.exports = BTCPayWebhookHandler;