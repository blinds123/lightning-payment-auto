const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory storage for demo
const invoices = new Map();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API status
app.get('/api/status', (req, res) => {
  res.json({
    operational: true,
    version: '1.0.0',
    payment_provider: 'Lightning Demo Mode',
    features: ['Lightning Payments', 'Zero-KYB', '$20-100 Range']
  });
});

// Create Lightning invoice
app.post('/api/lightning/invoice', async (req, res) => {
  try {
    const { amount, description, email } = req.body;
    
    // Validate amount
    if (!amount || amount < 20 || amount > 100) {
      return res.status(400).json({ 
        error: 'Amount must be between $20 and $100' 
      });
    }

    // Generate mock Lightning invoice for demo
    const invoiceId = 'inv_' + crypto.randomBytes(8).toString('hex');
    const bolt11 = 'lnbc' + Math.floor(amount * 10) + 'm1p' + crypto.randomBytes(32).toString('hex');
    
    const invoice = {
      id: invoiceId,
      amount: amount,
      description: description || `Payment of $${amount}`,
      paymentRequest: bolt11,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(bolt11)}`
    };
    
    // Store invoice
    invoices.set(invoiceId, invoice);
    
    // Auto-mark as paid after 5 seconds for demo
    setTimeout(() => {
      const inv = invoices.get(invoiceId);
      if (inv && inv.status === 'pending') {
        inv.status = 'paid';
        inv.paidAt = new Date().toISOString();
      }
    }, 5000);
    
    res.json({
      success: true,
      invoice: invoice
    });
  } catch (error) {
    console.error('Invoice creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create invoice',
      message: error.message 
    });
  }
});

// Get invoice status
app.get('/api/lightning/invoice/:id', (req, res) => {
  const invoice = invoices.get(req.params.id);
  
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }
  
  res.json({
    id: invoice.id,
    status: invoice.status,
    amount: invoice.amount,
    paidAt: invoice.paidAt || null,
    expiresAt: invoice.expiresAt
  });
});

// Fallback to serve index.html for SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Lightning payment server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});