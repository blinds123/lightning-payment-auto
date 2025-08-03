const axios = require('axios');

class BTCPayClient {
  constructor(url, apiKey, storeId) {
    this.url = url;
    this.apiKey = apiKey;
    this.storeId = storeId;
    this.client = axios.create({
      baseURL: url,
      headers: {
        'Authorization': `token ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async createInvoice({ amount, description, customer_email, orderId }) {
    try {
      const invoiceData = {
        amount: amount.toString(),
        currency: 'USD',
        checkout: {
          speedPolicy: 'MediumSpeed',
          paymentMethods: ['BTC-LightningNetwork'],
          redirectURL: `${process.env.FRONTEND_URL}/success?order=${orderId}`,
          closeURL: `${process.env.FRONTEND_URL}/cancel?order=${orderId}`,
          requiresRefundEmail: false
        },
        metadata: {
          orderId,
          customer_email,
          description
        }
      };

      const response = await this.client.post(
        `/api/v1/stores/${this.storeId}/invoices`,
        invoiceData
      );

      return {
        id: response.data.id,
        checkoutLink: response.data.checkoutLink,
        amount: amount,
        description: description,
        status: response.data.status,
        expirationTime: response.data.expirationTime,
        createdTime: response.data.createdTime,
        lightningPaymentRequest: response.data.paymentCodes?.BTC_LightningLike?.paymentRequestUrl
      };
    } catch (error) {
      console.error('BTCPay invoice creation error:', error.response?.data || error.message);
      throw new Error(`Failed to create invoice: ${error.message}`);
    }
  }

  async getInvoice(invoiceId) {
    try {
      const response = await this.client.get(
        `/api/v1/stores/${this.storeId}/invoices/${invoiceId}`
      );
      return response.data;
    } catch (error) {
      console.error('BTCPay get invoice error:', error.response?.data || error.message);
      throw new Error(`Failed to get invoice: ${error.message}`);
    }
  }

  async getInvoicePaymentMethods(invoiceId) {
    try {
      const response = await this.client.get(
        `/api/v1/stores/${this.storeId}/invoices/${invoiceId}/payment-methods`
      );
      
      const lightning = response.data.find(pm => pm.paymentMethod === 'BTC-LightningNetwork');
      if (lightning) {
        return {
          paymentRequest: lightning.destination,
          amount: lightning.amount
        };
      }
      return null;
    } catch (error) {
      console.error('BTCPay payment methods error:', error.response?.data || error.message);
      throw new Error(`Failed to get payment methods: ${error.message}`);
    }
  }

  verifyWebhookSignature(payload, signature, secret) {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    const expectedSignature = hmac.digest('hex');
    return signature === expectedSignature;
  }
}

module.exports = BTCPayClient;