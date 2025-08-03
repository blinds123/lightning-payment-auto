const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const { body, validationResult } = require('express-validator');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'lightning-payment' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// BTCPay client setup
let btcpayClient = null;
if (process.env.BTCPAY_URL && process.env.BTCPAY_API_KEY && process.env.BTCPAY_STORE_ID) {
  const BTCPayClient = require('./btcpay/client');
  btcpayClient = new BTCPayClient(
    process.env.BTCPAY_URL,
    process.env.BTCPAY_API_KEY,
    process.env.BTCPAY_STORE_ID
  );
  logger.info('BTCPay Server configured');
}

// In-memory storage (replace with database in production)
const invoices = new Map();
const orders = new Map();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  }
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));

app.use(express.json({ limit: '10kb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'frontend')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    btcpay: btcpayClient ? 'configured' : 'not configured'
  });
});

// Main API status
app.get('/api/status', (req, res) => {
  res.json({
    operational: true,
    version: '1.0.0',
    features: ['lightning', 'zero-kyb', '$20-100 payments'],
    btcpay_ready: !!btcpayClient
  });
});

// Create Lightning invoice
app.post('/api/lightning/invoice', [
  body('amount').isFloat({ min: 20, max: 100 }).withMessage('Amount must be between $20 and $100'),
  body('description').optional().isString().trim(),
  body('customer_email').optional().isEmail()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { amount, description, customer_email } = req.body;
  const orderId = 'ORD-' + crypto.randomBytes(8).toString('hex');

  try {
    if (btcpayClient) {
      // Use real BTCPay Server
      const invoice = await btcpayClient.createInvoice({
        amount,
        description: description || `Payment for order ${orderId}`,
        customer_email,
        orderId
      });

      // Store invoice data
      invoices.set(invoice.id, {
        ...invoice,
        orderId,
        createdAt: new Date()
      });

      orders.set(orderId, {
        invoiceId: invoice.id,
        amount,
        status: 'pending'
      });

      logger.info('BTCPay invoice created', { orderId, invoiceId: invoice.id });

      return res.json({
        success: true,
        orderId,
        invoiceId: invoice.id,
        checkoutUrl: invoice.checkoutLink,
        amount,
        expiresAt: invoice.expirationTime
      });
    } else {
      // Fallback to mock invoice for testing
      const mockInvoiceId = 'inv_' + crypto.randomBytes(8).toString('hex');
      const mockInvoice = {
        id: mockInvoiceId,
        orderId,
        amount,
        description: description || `Payment for order ${orderId}`,
        paymentRequest: `lnbc${amount * 10}m1p` + crypto.randomBytes(20).toString('hex'),
        status: 'pending',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        createdAt: new Date().toISOString()
      };

      invoices.set(mockInvoiceId, mockInvoice);
      orders.set(orderId, {
        invoiceId: mockInvoiceId,
        amount,
        status: 'pending'
      });

      logger.info('Mock invoice created', { orderId, invoiceId: mockInvoiceId });

      return res.json({
        success: true,
        orderId,
        invoiceId: mockInvoiceId,
        paymentRequest: mockInvoice.paymentRequest,
        amount,
        expiresAt: mockInvoice.expiresAt
      });
    }
  } catch (error) {
    logger.error('Invoice creation failed', { error: error.message });
    res.status(500).json({
      error: 'Failed to create invoice',
      message: error.message
    });
  }
});

// Get invoice status
app.get('/api/lightning/invoice/:invoiceId', async (req, res) => {
  const { invoiceId } = req.params;

  try {
    if (btcpayClient) {
      const invoice = await btcpayClient.getInvoice(invoiceId);
      const status = invoice.status === 'Settled' ? 'paid' : 
                    invoice.status === 'Expired' ? 'expired' : 'pending';
      
      return res.json({
        id: invoice.id,
        status,
        amount: invoice.amount,
        paidAt: invoice.paidTime || null,
        expiresAt: invoice.expirationTime
      });
    } else {
      // Mock invoice status
      const invoice = invoices.get(invoiceId);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      // Randomly mark some as paid for testing
      if (invoice.status === 'pending' && Math.random() > 0.7) {
        invoice.status = 'paid';
        invoice.paidAt = new Date().toISOString();
        
        const order = orders.get(invoice.orderId);
        if (order) {
          order.status = 'paid';
        }
      }

      return res.json({
        id: invoice.id,
        status: invoice.status,
        amount: invoice.amount,
        paidAt: invoice.paidAt || null,
        expiresAt: invoice.expiresAt
      });
    }
  } catch (error) {
    logger.error('Failed to get invoice', { error: error.message });
    res.status(500).json({ error: 'Failed to get invoice status' });
  }
});

// Get order status
app.get('/api/orders/:orderId', (req, res) => {
  const { orderId } = req.params;
  const order = orders.get(orderId);

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const invoice = invoices.get(order.invoiceId);
  
  res.json({
    orderId,
    amount: order.amount,
    status: order.status,
    invoiceId: order.invoiceId,
    paymentStatus: invoice?.status || 'unknown',
    createdAt: invoice?.createdAt
  });
});

// BTCPay webhook endpoint
app.post('/api/webhooks/btcpay', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    // Verify webhook signature
    const signature = req.headers['btcpay-sig'];
    const webhookSecret = process.env.BTCPAY_WEBHOOK_SECRET;
    
    if (webhookSecret && btcpayClient) {
      const payload = JSON.parse(req.body.toString());
      const isValid = btcpayClient.verifyWebhookSignature(payload, signature, webhookSecret);
      
      if (!isValid) {
        logger.warn('Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      // Process webhook
      if (payload.type === 'InvoiceSettled') {
        const invoice = invoices.get(payload.invoiceId);
        if (invoice) {
          invoice.status = 'paid';
          invoice.paidAt = new Date().toISOString();
          
          const order = orders.get(invoice.orderId);
          if (order) {
            order.status = 'paid';
            logger.info('Payment completed', { orderId: invoice.orderId, invoiceId: payload.invoiceId });
          }
        }
      }
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Webhook processing failed', { error: error.message });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  logger.info(`Lightning payment server running on port ${port}`);
  console.log(`
🚀 Lightning Payment Server Started
   
   Port: ${port}
   Health: http://localhost:${port}/health
   API Status: http://localhost:${port}/api/status
   Frontend: http://localhost:${port}
   
   BTCPay: ${btcpayClient ? '✅ Connected' : '❌ Not configured (using mock mode)'}
   
   Environment: ${process.env.NODE_ENV || 'development'}
  `);
});

module.exports = app;