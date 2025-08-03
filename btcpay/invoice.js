const { createClient } = require('@supabase/supabase-js');
const winston = require('winston');

/**
 * Lightning Invoice Management
 * Handles invoice creation, tracking, and validation
 */
class LightningInvoiceManager {
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
                new winston.transports.File({ filename: 'invoice.log' }),
                new winston.transports.Console()
            ]
        });
    }

    /**
     * Create a new Lightning invoice
     * 
     * @param {Object} invoiceRequest - Invoice creation request
     * @param {number} invoiceRequest.amount - Amount in USD ($20-100)
     * @param {string} invoiceRequest.description - Payment description
     * @param {string} invoiceRequest.customer_email - Customer email (optional)
     * @returns {Promise<Object>} Created invoice with Lightning payment details
     */
    async createInvoice(invoiceRequest) {
        try {
            const { amount, description, customer_email } = invoiceRequest;
            
            // Validate amount range
            if (!amount || amount < 20 || amount > 100) {
                throw new Error('Amount must be between $20 and $100');
            }

            // Generate unique order ID
            const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // Create invoice via BTCPay Server
            const btcpayInvoice = await this.btcpayClient.createInvoice({
                amount: amount,
                description: description || 'Lightning payment',
                orderId: orderId,
                customerEmail: customer_email
            });

            // Store invoice in our database
            const invoice = {
                id: btcpayInvoice.id,
                amount: amount,
                description: description || 'Lightning payment',
                payment_request: btcpayInvoice.lightningInvoice,
                checkout_link: btcpayInvoice.checkoutLink,
                expires_at: btcpayInvoice.expiresAt,
                status: 'pending',
                customer_email: customer_email,
                order_id: orderId,
                btcpay_data: {
                    invoiceId: btcpayInvoice.id,
                    checkoutLink: btcpayInvoice.checkoutLink,
                    lightningInvoice: btcpayInvoice.lightningInvoice
                },
                created_at: new Date().toISOString()
            };

            const { data, error } = await this.supabase
                .from('lightning_invoices')
                .insert([invoice])
                .select()
                .single();

            if (error) {
                throw error;
            }

            this.logger.info('Lightning invoice created', {
                invoiceId: invoice.id,
                orderId: orderId,
                amount: amount,
                customerEmail: customer_email
            });

            return {
                id: data.id,
                amount: data.amount,
                description: data.description,
                payment_request: data.payment_request,
                checkout_link: data.checkout_link,
                qr_code_data: data.payment_request, // Lightning invoice for QR code
                expires_at: data.expires_at,
                status: data.status,
                order_id: data.order_id,
                created_at: data.created_at
            };

        } catch (error) {
            this.logger.error('Invoice creation failed', {
                error: error.message,
                invoiceRequest: invoiceRequest
            });
            throw new Error(`Failed to create Lightning invoice: ${error.message}`);
        }
    }

    /**
     * Get invoice by ID with current status
     * 
     * @param {string} invoiceId - Invoice ID
     * @returns {Promise<Object>} Invoice details with current payment status
     */
    async getInvoice(invoiceId) {
        try {
            // Get invoice from our database
            const { data: localInvoice, error: dbError } = await this.supabase
                .from('lightning_invoices')
                .select('*')
                .eq('id', invoiceId)
                .single();

            if (dbError) {
                throw dbError;
            }

            if (!localInvoice) {
                throw new Error('Invoice not found');
            }

            // Get current status from BTCPay Server
            let currentStatus = localInvoice.status;
            let btcpayData = localInvoice.btcpay_data;

            try {
                const btcpayInvoice = await this.btcpayClient.getInvoice(invoiceId);
                currentStatus = this.mapBTCPayStatus(btcpayInvoice.status);
                btcpayData = {
                    ...btcpayData,
                    currentStatus: btcpayInvoice.status,
                    paidAmount: btcpayInvoice.paidAmount,
                    lastUpdated: new Date().toISOString()
                };

                // Update local status if changed
                if (currentStatus !== localInvoice.status) {
                    await this.updateInvoiceStatus(invoiceId, currentStatus, btcpayData);
                }

            } catch (btcpayError) {
                this.logger.warn('Failed to fetch BTCPay status', {
                    invoiceId: invoiceId,
                    error: btcpayError.message
                });
            }

            return {
                id: localInvoice.id,
                amount: localInvoice.amount,
                description: localInvoice.description,
                payment_request: localInvoice.payment_request,
                checkout_link: localInvoice.checkout_link,
                status: currentStatus,
                expires_at: localInvoice.expires_at,
                paid_at: localInvoice.paid_at,
                order_id: localInvoice.order_id,
                customer_email: localInvoice.customer_email,
                created_at: localInvoice.created_at,
                updated_at: localInvoice.updated_at,
                btcpay_data: btcpayData
            };

        } catch (error) {
            this.logger.error('Failed to get invoice', {
                error: error.message,
                invoiceId: invoiceId
            });
            throw new Error(`Failed to retrieve invoice: ${error.message}`);
        }
    }

    /**
     * Update invoice status
     * 
     * @param {string} invoiceId - Invoice ID
     * @param {string} status - New status
     * @param {Object} metadata - Additional data
     */
    async updateInvoiceStatus(invoiceId, status, metadata = {}) {
        try {
            const updateData = {
                status: status,
                updated_at: new Date().toISOString(),
                btcpay_data: metadata
            };

            if (status === 'paid') {
                updateData.paid_at = new Date().toISOString();
            }

            const { error } = await this.supabase
                .from('lightning_invoices')
                .update(updateData)
                .eq('id', invoiceId);

            if (error) {
                throw error;
            }

            this.logger.info('Invoice status updated', {
                invoiceId: invoiceId,
                status: status
            });

        } catch (error) {
            this.logger.error('Failed to update invoice status', {
                error: error.message,
                invoiceId: invoiceId,
                status: status
            });
            throw error;
        }
    }

    /**
     * List invoices with pagination and filtering
     * 
     * @param {Object} options - Query options
     * @param {number} options.page - Page number (default: 1)
     * @param {number} options.limit - Items per page (default: 10)
     * @param {string} options.status - Filter by status
     * @param {string} options.customer_email - Filter by customer email
     * @returns {Promise<Object>} Paginated invoice list
     */
    async listInvoices(options = {}) {
        try {
            const { page = 1, limit = 10, status, customer_email } = options;
            const offset = (page - 1) * limit;

            let query = this.supabase
                .from('lightning_invoices')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (status) {
                query = query.eq('status', status);
            }

            if (customer_email) {
                query = query.eq('customer_email', customer_email);
            }

            const { data, error, count } = await query;

            if (error) {
                throw error;
            }

            return {
                invoices: data,
                pagination: {
                    page: page,
                    limit: limit,
                    total: count,
                    pages: Math.ceil(count / limit)
                }
            };

        } catch (error) {
            this.logger.error('Failed to list invoices', {
                error: error.message,
                options: options
            });
            throw new Error(`Failed to list invoices: ${error.message}`);
        }
    }

    /**
     * Cancel an invoice
     * 
     * @param {string} invoiceId - Invoice ID
     * @returns {Promise<Object>} Cancellation result
     */
    async cancelInvoice(invoiceId) {
        try {
            // Check if invoice can be cancelled
            const invoice = await this.getInvoice(invoiceId);
            
            if (invoice.status === 'paid') {
                throw new Error('Cannot cancel paid invoice');
            }

            if (invoice.status === 'expired' || invoice.status === 'cancelled') {
                throw new Error('Invoice is already expired or cancelled');
            }

            // Update status to cancelled
            await this.updateInvoiceStatus(invoiceId, 'cancelled', {
                cancelledAt: new Date().toISOString(),
                reason: 'Manual cancellation'
            });

            this.logger.info('Invoice cancelled', {
                invoiceId: invoiceId
            });

            return {
                success: true,
                invoiceId: invoiceId,
                status: 'cancelled',
                cancelledAt: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to cancel invoice', {
                error: error.message,
                invoiceId: invoiceId
            });
            throw new Error(`Failed to cancel invoice: ${error.message}`);
        }
    }

    /**
     * Map BTCPay Server status to our system status
     * 
     * @param {string} btcpayStatus - BTCPay Server status
     * @returns {string} Mapped status
     */
    mapBTCPayStatus(btcpayStatus) {
        const statusMap = {
            'New': 'pending',
            'Processing': 'processing',
            'Settled': 'paid',
            'Invalid': 'failed',
            'Expired': 'expired'
        };

        return statusMap[btcpayStatus] || 'unknown';
    }

    /**
     * Get invoice statistics
     * 
     * @param {Object} options - Query options
     * @param {string} options.timeframe - Timeframe (day, week, month)
     * @returns {Promise<Object>} Invoice statistics
     */
    async getInvoiceStats(options = {}) {
        try {
            const { timeframe = 'day' } = options;
            
            let timeFilter = new Date();
            if (timeframe === 'week') {
                timeFilter.setDate(timeFilter.getDate() - 7);
            } else if (timeframe === 'month') {
                timeFilter.setMonth(timeFilter.getMonth() - 1);
            } else {
                timeFilter.setDate(timeFilter.getDate() - 1);
            }

            const { data, error } = await this.supabase
                .from('lightning_invoices')
                .select('status, amount')
                .gte('created_at', timeFilter.toISOString());

            if (error) {
                throw error;
            }

            const stats = {
                total: data.length,
                paid: data.filter(inv => inv.status === 'paid').length,
                pending: data.filter(inv => inv.status === 'pending').length,
                expired: data.filter(inv => inv.status === 'expired').length,
                totalAmount: data.reduce((sum, inv) => sum + parseFloat(inv.amount), 0),
                paidAmount: data
                    .filter(inv => inv.status === 'paid')
                    .reduce((sum, inv) => sum + parseFloat(inv.amount), 0)
            };

            stats.conversionRate = stats.total > 0 ? (stats.paid / stats.total) * 100 : 0;

            return stats;

        } catch (error) {
            this.logger.error('Failed to get invoice stats', {
                error: error.message,
                options: options
            });
            throw new Error(`Failed to get invoice statistics: ${error.message}`);
        }
    }
}

module.exports = LightningInvoiceManager;