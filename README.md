# Lightning Payment System with Strike Integration ⚡

A production-ready payment system that accepts $20-100 payments with **ZERO KYB** for merchants using Strike API for fiat-to-Lightning conversion.

## 🛡️ NO-KYB FOR MERCHANTS

- ✅ **Strike API** - No KYB required for merchants receiving Bitcoin
- ✅ **Fiat payments** - Customers pay with card/bank via Strike
- ✅ **Instant conversion** - USD automatically converted to Lightning
- ✅ **Zero crypto knowledge** - Customers don't need to know Bitcoin
- ✅ **Self-custody** - You receive Bitcoin directly to your wallet
- ❌ **No payment processor fees** - Only Strike's minimal conversion fee
- ❌ **No chargebacks** - Lightning payments are final

## 🚀 Features

- 💳 **Fiat Payments** - Accept credit cards, debit cards, and bank transfers
- ⚡ **Strike Integration** - Automatic fiat-to-Lightning conversion
- 🔒 **No KYB for Merchants** - Receive Bitcoin without business verification
- 💰 **$20-100 payment range** - Perfect for digital products and services
- 🎯 **Three payment options**:
  - Strike (recommended) - Fiat to Lightning
  - Direct Lightning - For crypto-native users
  - Get Bitcoin - Educational resources
- 🛡️ **Production security** - Helmet, CORS, rate limiting
- 🔄 **DigitalOcean App Platform** - Automated deployment
- 📱 **Mobile responsive** - Works on all devices

## 🏃 Quick Start

### Automated Deployment (Recommended)

1. Fork this repository
2. Connect your Supabase project to GitHub
3. Push to trigger automatic deployment

### Manual Deployment

1. Clone the repository:
```bash
git clone https://github.com/your-username/lightning-payment-auto.git
cd lightning-payment-auto
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. Run migrations in Supabase:
```bash
supabase db push
```

5. Deploy Edge Functions:
```bash
supabase functions deploy lightning-payment
```

6. Start the server:
```bash
npm start
```

## 📡 API Endpoints

### Create Strike Invoice (Fiat → Lightning)
```bash
POST /api/strike/invoice
{
  "amount": 25.00,
  "description": "Product purchase"
}

# Response:
{
  "invoiceId": "strike_abc123",
  "paymentUrl": "https://strike.me/pay/abc123",
  "amount": 25.00
}
```

### Create Lightning Invoice (Direct)
```bash
POST /api/lightning/invoice
{
  "amount": 25.00,
  "description": "Product purchase"
}
```

### Check Payment Status
```bash
GET /api/strike/invoice/:id
GET /api/lightning/invoice/:id
```

### Health Check
```bash
GET /health
```

## 🔧 Configuration

### Environment Variables

- `STRIKE_API_KEY` - Your Strike API key (get from strike.me/developer)
- `STRIKE_WEBHOOK_SECRET` - Strike webhook secret for payment confirmations
- `SUPABASE_URL` - Your Supabase project URL (optional)
- `SUPABASE_ANON_KEY` - Supabase anonymous key (optional)
- `PORT` - Server port (default: 3000)
- `PUBLIC_URL` - Your app's public URL for webhooks

### Database Schema

The system automatically creates:
- `lightning_invoices` - Stores payment requests
- `payments` - Tracks payment status

## 🛡️ Security

- Helmet.js for security headers
- CORS protection
- Rate limiting (100 requests per 15 minutes)
- Input validation
- SQL injection protection via Supabase

## 🚀 Deployment Options

### DigitalOcean App Platform (Recommended)

1. Fork this repository
2. Create app in DigitalOcean:
```bash
doctl apps create --spec .do/app.yaml
```
3. Set environment variables:
   - `STRIKE_API_KEY`
   - `STRIKE_WEBHOOK_SECRET`
4. Deploy automatically from GitHub

### Manual Deployment

1. Clone and configure:
```bash
git clone <your-repo>
cd lightning-payment-auto
npm install
cp .env.example .env
# Edit .env with your Strike API credentials
```

2. Start the server:
```bash
npm start
```

### Strike API Setup

1. Sign up at [strike.me/developer](https://strike.me/developer)
2. Create API key (no KYB required for receiving)
3. Configure webhook URL: `https://your-app.com/api/webhooks/strike`
4. Add credentials to environment

## 📊 Monitoring

- Health endpoint: `/health`
- Structured logging with Winston
- Database connection monitoring
- Payment success/failure tracking

## 💳 Payment Flow

### Option 1: Strike Payment (Recommended)
1. Customer selects Strike payment at checkout
2. Redirected to Strike's secure payment page
3. Customer pays with:
   - Credit/debit card
   - Bank account (ACH)
   - Existing Strike balance
4. Strike converts USD to Bitcoin Lightning
5. You receive Bitcoin instantly to your wallet
6. Customer redirected to success page

### Option 2: Direct Lightning
1. Customer generates Lightning invoice
2. Scans QR code with any Lightning wallet
3. Pays directly with Bitcoin
4. Instant confirmation

### Option 3: Get Bitcoin
1. Customer learns how to acquire Bitcoin
2. Various no-KYC options presented
3. Returns to pay with Lightning

## 🤝 Contributing

Pull requests welcome! Please ensure:
- All tests pass
- Code follows existing style
- Security best practices maintained

## 📄 License

MIT License - feel free to use commercially!

## 🚨 Support

- GitHub Issues: [Report a bug](https://github.com/blinds123/lightning-payment-auto/issues)
- Documentation: [View full docs](https://github.com/blinds123/lightning-payment-auto/wiki)