# Lightning Payment System - Production Deployment Guide

## 🚀 Zero-KYB Lightning Payments on DigitalOcean

This guide walks you through deploying a complete Lightning payment system that accepts $20-100 payments with **zero KYB requirements** using BTCPay Server.

## 📋 Prerequisites

- DigitalOcean Droplet (4GB RAM minimum)
- Domain name pointed to your droplet
- SSH access to the droplet

## 🏗️ Architecture

```
[Internet] → [Nginx + SSL] → [Lightning API] → [BTCPay Server] → [Lightning Node]
                ↓
         [Frontend Checkout] → [Supabase Database]
```

## 🔧 Step-by-Step Deployment

### 1. Initial Server Setup

SSH into your DigitalOcean droplet:
```bash
ssh root@138.197.83.231
```

Update the system:
```bash
apt update && apt upgrade -y
```

### 2. Deploy BTCPay Server

Run the BTCPay Server setup script:
```bash
cd /opt
git clone https://github.com/blinds123/lightning-payment-auto.git
cd lightning-payment-auto
chmod +x scripts/btcpay-setup.sh
./scripts/btcpay-setup.sh
```

**Important:** Edit the script first to set your domain and email:
```bash
nano scripts/btcpay-setup.sh
# Update these variables:
export BTCPAY_HOST="your-domain.com"
export LETSENCRYPT_EMAIL="your-email@domain.com"
```

### 3. Configure DNS

Point your domain to the droplet:
```
A Record: your-domain.com → 138.197.83.231
```

### 4. Setup SSL Certificate

```bash
certbot --nginx -d your-domain.com
```

### 5. Complete BTCPay Server Configuration

1. Visit `https://your-domain.com/btcpay`
2. Create admin account
3. Create your first store
4. Enable Lightning Network (Core Lightning)
5. Wait for Bitcoin sync (can take several hours)

### 6. Generate API Credentials

In BTCPay Server:
1. Go to Account → Manage Account → API Keys
2. Create new API key with these permissions:
   - `btcpay.store.canmodifyinvoices`
   - `btcpay.store.canviewinvoices`
3. Copy the API key and store ID

### 7. Configure Environment Variables

```bash
cd /opt/lightning-payment-auto
cp .env.example .env
nano .env
```

Update these values:
```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# BTCPay Server Configuration
BTCPAY_URL=https://your-domain.com
BTCPAY_API_KEY=your_btcpay_api_key
BTCPAY_STORE_ID=your_btcpay_store_id
BTCPAY_WEBHOOK_SECRET=your_webhook_secret

# App Configuration
APP_URL=https://your-domain.com
```

### 8. Deploy the API Server

```bash
npm install
npm install -g pm2
pm2 start server.js --name lightning-api
pm2 startup
pm2 save
```

### 9. Configure Webhooks

In BTCPay Server:
1. Go to your store → Settings → Webhooks
2. Add webhook URL: `https://your-domain.com/api/btcpay/webhook`
3. Select events:
   - Invoice Settled
   - Invoice Expired
   - Invoice Processing
4. Set the webhook secret (same as in .env)

### 10. Test the System

Create a test payment:
```bash
curl -X POST https://your-domain.com/api/lightning/invoice \
  -H "Content-Type: application/json" \
  -d '{"amount": 25, "description": "Test payment"}'
```

## ⚡ Lightning Node Setup

### Initial Channel Funding

Your Lightning node needs incoming liquidity to receive payments:

1. **Get Node Info:**
   ```bash
   docker exec btcpayserver_clightning_bitcoin_1 lightning-cli getinfo
   ```

2. **Fund Your Node:**
   - Send Bitcoin to your BTCPay wallet
   - Open channels with well-connected nodes
   - Use Lightning Loop or similar services

3. **Recommended Channels:**
   - ACINQ (03864ef025fde8fb587d989186ce6a4a186895ee44a926bfc370e2c366597a3f8f)
   - Bitrefill (030c3f19d742ca294a55c00376b3b355c3c90d61c6b6b39554dbc7ac19b141c14f)
   - OpenNode (02f1a8c87607f415c8f22c00593002775941dea48869ce23096af27b0cfdcc0b69)

### Channel Management

Monitor your channels:
```bash
# List channels
docker exec btcpayserver_clightning_bitcoin_1 lightning-cli listchannels

# Check balance
docker exec btcpayserver_clightning_bitcoin_1 lightning-cli listfunds
```

## 🔒 Security Hardening

### Firewall Configuration

```bash
# Configure UFW
ufw allow ssh
ufw allow http
ufw allow https
ufw allow 9735/tcp  # Lightning P2P
ufw --force enable
```

### Fail2Ban Setup

```bash
apt install fail2ban -y
systemctl enable fail2ban
systemctl start fail2ban
```

### Regular Updates

Create update script:
```bash
cat > /opt/update-system.sh << 'EOF'
#!/bin/bash
apt update && apt upgrade -y
docker-compose -f /opt/btcpay/btcpayserver-docker/docker-compose.yml pull
docker-compose -f /opt/btcpay/btcpayserver-docker/docker-compose.yml up -d
pm2 reload lightning-api
EOF

chmod +x /opt/update-system.sh
```

## 📊 Monitoring Setup

### Install Monitoring Stack

```bash
cd /opt/lightning-payment-auto
docker-compose --profile monitoring up -d
```

Access monitoring:
- Grafana: `http://your-domain.com:3001` (admin/admin)
- Prometheus: `http://your-domain.com:9090`

### Key Metrics to Monitor

1. **Lightning Node Health**
   - Peer connections
   - Channel status
   - Balance levels

2. **API Performance**
   - Response times
   - Error rates
   - Payment success rate

3. **System Resources**
   - CPU usage
   - Memory usage
   - Disk space

## 🚨 Troubleshooting

### Common Issues

1. **Lightning Node Not Syncing**
   ```bash
   # Check Bitcoin sync status
   docker logs btcpayserver_bitcoind_1
   
   # Restart BTCPay
   cd /opt/btcpay/btcpayserver-docker
   docker-compose restart
   ```

2. **API Errors**
   ```bash
   # Check API logs
   pm2 logs lightning-api
   
   # Restart API
   pm2 restart lightning-api
   ```

3. **SSL Certificate Issues**
   ```bash
   # Renew certificate
   certbot renew
   
   # Test renewal
   certbot renew --dry-run
   ```

### Log Files

- API logs: `/opt/lightning-payment-auto/logs/`
- BTCPay logs: `docker logs btcpayserver_btcpayserver_1`
- Lightning logs: `docker logs btcpayserver_clightning_bitcoin_1`
- Nginx logs: `/var/log/nginx/`

## 🔄 Backup & Recovery

### Database Backup

```bash
# Backup Supabase database
pg_dump $SUPABASE_CONNECTION_STRING > lightning_backup.sql
```

### Lightning Node Backup

```bash
# Backup Lightning wallet
docker exec btcpayserver_clightning_bitcoin_1 \
  lightning-cli stop
cp -r /opt/btcpay/btcpayserver-docker/btcpay_clightning_bitcoin \
  /backup/lightning-wallet-$(date +%Y%m%d)
```

### Recovery Procedure

1. Restore BTCPay Server data
2. Restore Lightning wallet
3. Sync blockchain
4. Restore API configuration

## 📈 Scaling

### Performance Optimization

1. **Database Optimization**
   - Enable connection pooling
   - Add database indexes
   - Use read replicas

2. **API Scaling**
   - Use PM2 cluster mode
   - Add load balancer
   - Implement caching

3. **Lightning Optimization**
   - Increase channel capacity
   - Use multiple Lightning implementations
   - Implement channel rebalancing

## ✅ Production Checklist

- [ ] BTCPay Server running and synced
- [ ] Lightning node connected with channels
- [ ] SSL certificate valid
- [ ] API server responding
- [ ] Webhooks configured and tested
- [ ] Frontend accessible
- [ ] Test payments successful
- [ ] Monitoring alerts configured
- [ ] Backup procedures in place
- [ ] Security hardening complete

## 🎯 Success Metrics

Your system is ready when:
- ✅ API health check returns 200
- ✅ Lightning node has active channels
- ✅ Test payments complete successfully
- ✅ Webhooks deliver notifications
- ✅ Frontend loads and functions
- ✅ SSL certificate valid
- ✅ All services monitored

## 🆘 Support

If you encounter issues:
1. Check the troubleshooting section
2. Review log files
3. Test individual components
4. Verify configuration

Your Lightning payment system is now ready for zero-KYB payments!