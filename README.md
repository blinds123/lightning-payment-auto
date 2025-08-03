# Lightning Payment System - Zero KYB ⚡

A production-ready Lightning Network payment system that accepts $20-100 payments with **ABSOLUTE ZERO KYB** requirements using BTCPay Server.

## 🛡️ ZERO-KYB GUARANTEE

- ❌ **NO identity verification for merchants**
- ❌ **NO customer account creation required**
- ❌ **NO app downloads needed**
- ❌ **NO ID uploads or selfies**
- ✅ **Complete financial sovereignty**
- ✅ **Anonymous customer payments**
- ✅ **Self-hosted infrastructure**

## 🚀 Features

- ⚡ Lightning Network payments via BTCPay Server (NOT Strike)
- 🔒 Zero KYB/KYC requirements (confirmed)
- 💰 $20-100 payment range enforcement
- 🛡️ Production security (Helmet, CORS, rate limiting)
- 📊 Supabase database integration
- 🔄 Automated deployment via GitHub Actions
- 🎯 RESTful API with comprehensive error handling
- 📱 QR code payments with any Lightning wallet
- 🌍 Global accessibility without restrictions

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

### Create Lightning Invoice
```bash
POST /api/lightning/invoice
{
  "amount": 25.00,
  "description": "Product purchase",
  "customer_email": "customer@example.com"
}
```

### Check Payment Status
```bash
GET /api/lightning/invoice/:id
```

### Health Check
```bash
GET /health
```

## 🔧 Configuration

### Environment Variables

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `STRIKE_API_KEY` - Strike API key (for Lightning payments)
- `PORT` - Server port (default: 3000)

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

### Option 1: Supabase + GitHub (Recommended)
- Push to GitHub triggers automatic deployment
- Supabase handles database and edge functions
- Zero configuration needed

### Option 2: DigitalOcean
- Use the provided GitHub Actions workflow
- Deploys to your droplet automatically
- Includes PM2 for process management

### Option 3: Docker
```bash
docker build -t lightning-payment .
docker run -p 3000:3000 --env-file .env lightning-payment
```

## 📊 Monitoring

- Health endpoint: `/health`
- Structured logging with Winston
- Database connection monitoring
- Payment success/failure tracking

## 💳 Payment Flow

1. Customer requests invoice via API
2. System generates Lightning invoice
3. Customer pays via Lightning wallet
4. System verifies payment
5. Order fulfilled automatically

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