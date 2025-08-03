const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
require('dotenv').config();

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
    
    if (!amount || amount < 20 || amount > 100) {
      return res.status(400).json({ 
        error: 'Amount must be between $20 and $100' 
      });
    }

    // TODO: Integrate with Strike API or BTCPay
    const invoice = {
      id: 'inv_' + Math.random().toString(36).substr(2, 9),
      amount: amount,
      description: description || 'Lightning payment',
      payment_request: 'lnbc' + amount + 'm1p' + Math.random().toString(36).substr(2, 20),
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      status: 'pending',
      created_at: new Date().toISOString()
    };

    logger.info('Invoice created', { invoice_id: invoice.id, amount });
    res.json(invoice);
  } catch (error) {
    logger.error('Invoice creation failed', error);
    res.status(500).json({ error: 'Failed to create invoice' });
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