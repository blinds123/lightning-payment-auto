const fetch = require('node-fetch');
const crypto = require('crypto');

class StrikeClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://api.strike.me/v1' 
      : 'https://api.strike.me/v1'; // Strike doesn't have a sandbox
  }

  async createInvoice(amount, description, handle = null) {
    try {
      const invoiceData = {
        correlationId: crypto.randomUUID(),
        description: description || `Payment of $${amount}`,
        amount: {
          amount: amount.toString(),
          currency: 'USD'
        }
      };

      // If handle provided, create invoice for specific user
      if (handle) {
        invoiceData.receiver = {
          handle: handle
        };
      }

      const response = await fetch(`${this.baseUrl}/invoices`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(invoiceData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Strike API error: ${error.message || response.statusText}`);
      }

      const invoice = await response.json();
      
      return {
        invoiceId: invoice.invoiceId,
        paymentUrl: `https://strike.me/pay/${invoice.invoiceId}`,
        amount: invoice.amount,
        state: invoice.state,
        created: invoice.created,
        description: invoice.description
      };
    } catch (error) {
      console.error('Strike invoice creation failed:', error);
      throw error;
    }
  }

  async getInvoice(invoiceId) {
    try {
      const response = await fetch(`${this.baseUrl}/invoices/${invoiceId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch invoice: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Strike invoice fetch failed:', error);
      throw error;
    }
  }

  async createPaymentRequest(amount, description) {
    try {
      const response = await fetch(`${this.baseUrl}/payment-requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          amount: {
            amount: amount.toString(),
            currency: 'USD'
          },
          description: description
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Strike API error: ${error.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Strike payment request creation failed:', error);
      throw error;
    }
  }

  verifyWebhookSignature(payload, signature, secret) {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
}

module.exports = StrikeClient;