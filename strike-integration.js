const axios = require('axios');
const crypto = require('crypto');

class StrikePayment {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.strike.me/v1';
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  // Create a payment quote (fiat to Lightning)
  async createQuote({ amount, sourceCurrency = 'USD', targetAsset = 'BTC' }) {
    try {
      const response = await this.client.post('/quotes', {
        amount: {
          amount: amount.toString(),
          currency: sourceCurrency
        },
        targetAsset: targetAsset
      });
      
      return response.data;
    } catch (error) {
      console.error('Strike quote error:', error.response?.data || error);
      throw error;
    }
  }

  // Create an invoice for customer to pay
  async createInvoice({ amount, description, correlationId }) {
    try {
      const response = await this.client.post('/invoices', {
        amount: {
          amount: amount.toString(),
          currency: 'USD'
        },
        description: description || `Payment of $${amount}`,
        correlationId: correlationId || crypto.randomBytes(16).toString('hex')
      });
      
      return {
        invoiceId: response.data.invoiceId,
        amount: response.data.amount,
        state: response.data.state,
        created: response.data.created,
        paymentLink: `https://strike.me/pay/${response.data.invoiceId}`,
        description: response.data.description
      };
    } catch (error) {
      console.error('Strike invoice error:', error.response?.data || error);
      throw error;
    }
  }

  // Get invoice status
  async getInvoice(invoiceId) {
    try {
      const response = await this.client.get(`/invoices/${invoiceId}`);
      return response.data;
    } catch (error) {
      console.error('Strike get invoice error:', error.response?.data || error);
      throw error;
    }
  }

  // Create a payment request (generates Lightning invoice)
  async createPaymentRequest({ amount, description }) {
    try {
      const response = await this.client.post('/payment-requests', {
        amount: {
          amount: amount.toString(),
          currency: 'USD'
        },
        description: description
      });
      
      return {
        paymentRequestId: response.data.paymentRequestId,
        lnInvoice: response.data.lnInvoice,
        amount: response.data.amount,
        state: response.data.state,
        created: response.data.created
      };
    } catch (error) {
      console.error('Strike payment request error:', error.response?.data || error);
      throw error;
    }
  }

  // Handle webhook signature verification
  verifyWebhook(payload, signature, secret) {
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return computedSignature === signature;
  }
}

module.exports = StrikePayment;