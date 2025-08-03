# Real Payment Integration Guide

## Current Status: Demo Mode Only ⚠️

The current system is a **UI demo** that doesn't actually process payments:
- ❌ Card form collects data but doesn't process it
- ❌ No payment processor integrated
- ❌ No fiat-to-Lightning conversion
- ✅ Only Lightning direct payments work (in mock mode)

## Option 1: Strike API Integration (Recommended)

Strike handles EVERYTHING - card processing, compliance, and Lightning conversion.

### How it works:
1. Customer clicks "Pay with Strike"
2. Redirect to Strike's hosted checkout
3. Customer pays with card/bank on Strike's secure page
4. Strike converts to Lightning automatically
5. You receive Bitcoin instantly

### Implementation:
```javascript
// server.js
const STRIKE_API_KEY = process.env.STRIKE_API_KEY;

app.post('/api/strike/invoice', async (req, res) => {
  const { amount, description } = req.body;
  
  const response = await fetch('https://api.strike.me/v1/invoices', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STRIKE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: { amount: amount.toString(), currency: 'USD' },
      description: description
    })
  });
  
  const invoice = await response.json();
  
  // Redirect customer to Strike's payment page
  res.json({
    paymentUrl: `https://strike.me/pay/${invoice.invoiceId}`,
    invoiceId: invoice.invoiceId
  });
});
```

### Setup:
1. Sign up at https://strike.me/developer
2. Get API key
3. Add to environment: `STRIKE_API_KEY=your-key`
4. Customer pays on Strike's page (they handle compliance)

## Option 2: Stripe + Lightning Integration

Use Stripe for cards, then convert to Lightning yourself.

### How it works:
1. Customer enters card on your page
2. Stripe processes USD payment
3. You use those funds to buy Lightning
4. Send Lightning to your wallet

### Implementation:
```javascript
// Requires more complex setup
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.post('/api/stripe/payment', async (req, res) => {
  const { amount, token } = req.body;
  
  // Process card payment
  const charge = await stripe.charges.create({
    amount: amount * 100, // cents
    currency: 'usd',
    source: token
  });
  
  // Then convert to Lightning (requires exchange API)
  // More complex...
});
```

## Option 3: BTCPay Server Fiat Plugins

BTCPay Server can integrate with payment processors.

### Supported processors:
- Coinbase Commerce
- OpenNode
- Strike (via plugin)

## Recommended Approach: Use Strike

Why Strike is best for your use case:
1. **Zero Setup** - They handle card processing
2. **Instant Lightning** - Automatic fiat→Lightning conversion  
3. **No KYB Required** - For merchants receiving Bitcoin
4. **Lower Fees** - Than traditional processors
5. **Compliance Handled** - They manage PCI, AML, etc.

## To Implement Strike:

1. **Get Strike API Key**
   ```
   https://strike.me/developer
   ```

2. **Update server.js**
   ```javascript
   // Add Strike API integration
   const StrikeClient = require('./strike-integration');
   const strike = new StrikeClient(process.env.STRIKE_API_KEY);
   ```

3. **Update checkout flow**
   - Remove card form (Strike handles it)
   - Redirect to Strike for payment
   - Handle webhook for confirmation

## Security Considerations

**NEVER** collect raw card data without:
- PCI DSS compliance
- SSL certificate
- Secure card tokenization
- Proper data handling

The current demo form should NOT be used in production!