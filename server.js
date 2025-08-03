const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
require('dotenv').config();

// BTCPay Server integration
const BTCPayClient = require('./btcpay/client');
const BTCPayWebhookHandler = require('./btcpay/webhooks');
const LightningInvoiceManager = require('./btcpay/invoice');

const app = express();
const PORT = process.env.PORT || 3000;

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});

// Initialize BTCPay Server integration
const btcpayClient = new BTCPayClient({
  BTCPAY_URL: process.env.BTCPAY_URL,
  BTCPAY_API_KEY: process.env.BTCPAY_API_KEY,
  BTCPAY_STORE_ID: process.env.BTCPAY_STORE_ID,
  BTCPAY_WEBHOOK_SECRET: process.env.BTCPAY_WEBHOOK_SECRET
});

const supabaseConfig = {
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_ANON_KEY
};

const webhookHandler = new BTCPayWebhookHandler(btcpayClient, supabaseConfig);
const invoiceManager = new LightningInvoiceManager(btcpayClient, supabaseConfig);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Lightning Payment API',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Main API endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Lightning Crypto Payment System',
    version: '1.0.0',
    status: 'active',
    endpoints: {
      health: '/health',
      api: {
        status: '/api/status',
        invoice: '/api/lightning/invoice',
        payment: '/api/lightning/payment',
        orders: '/api/orders'
      }
    }
  });
});

// API Status
app.get('/api/status', (req, res) => {
  res.json({
    operational: true,
    version: '1.0.0',
    features: ['lightning', 'strike', 'zero-kyb'],
    paymentRange: { min: 20, max: 100, currency: 'USD' }
  });
});

// Create Lightning Invoice
app.post('/api/lightning/invoice', async (req, res) => {
  try {
    const { amount, description, customer_email } = req.body;
    
    // Create invoice using BTCPay Server
    const invoice = await invoiceManager.createInvoice({
      amount: amount,
      description: description,
      customer_email: customer_email
    });

    logger.info('Lightning invoice created via BTCPay', { 
      invoice_id: invoice.id, 
      amount: invoice.amount,
      order_id: invoice.order_id 
    });

    res.json(invoice);
  } catch (error) {
    logger.error('Lightning invoice creation failed', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Lightning Invoice Status
app.get('/api/lightning/invoice/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await invoiceManager.getInvoice(id);
    
    res.json(invoice);
  } catch (error) {
    logger.error('Failed to get invoice status', error);
    res.status(404).json({ error: error.message });
  }
});

// BTCPay Server Webhook Endpoint
app.post('/api/btcpay/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  await webhookHandler.handleWebhook(req, res);
});

// Cancel Lightning Invoice
app.delete('/api/lightning/invoice/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await invoiceManager.cancelInvoice(id);
    
    res.json(result);
  } catch (error) {
    logger.error('Failed to cancel invoice', error);
    res.status(400).json({ error: error.message });
  }
});

// List Lightning Invoices
app.get('/api/lightning/invoices', async (req, res) => {
  try {
    const { page, limit, status, customer_email } = req.query;
    const result = await invoiceManager.listInvoices({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      status: status,
      customer_email: customer_email
    });
    
    res.json(result);
  } catch (error) {
    logger.error('Failed to list invoices', error);
    res.status(500).json({ error: error.message });
  }
});

// Lightning System Status
app.get('/api/lightning/status', async (req, res) => {
  try {
    const nodeStatus = await btcpayClient.checkLightningNodeStatus();
    const storeInfo = await btcpayClient.getStoreInfo();
    const stats = await invoiceManager.getInvoiceStats({ timeframe: 'day' });
    
    res.json({
      operational: nodeStatus.connected,
      lightning_node: nodeStatus,
      store: storeInfo,
      today_stats: stats,
      version: '1.0.0',
      features: ['lightning', 'btcpay', 'zero-kyb'],
      paymentRange: { min: 20, max: 100, currency: 'USD' }
    });
  } catch (error) {
    logger.error('Failed to get Lightning status', error);
    res.status(500).json({ error: error.message });
  }
});

// Create Order
app.post('/api/orders', async (req, res) => {
  try {
    const { amount, items, customer } = req.body;
    
    const order = {
      id: 'ORD-' + Date.now(),
      amount: amount || 25.00,
      items: items || [],
      customer: customer || {},
      payment_url: `${process.env.APP_URL || 'http://localhost:3000'}/checkout/`,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    logger.info('Order created', { order_id: order.id });
    res.json({ success: true, order });
  } catch (error) {
    logger.error('Order creation failed', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Lightning Payment API running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});