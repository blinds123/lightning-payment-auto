#!/bin/bash
set -e

echo "⚡ Lightning Payment System - Droplet Deployment"
echo "=============================================="
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root"
   exit 1
fi

# Get droplet IP
DROPLET_IP=$(curl -s http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address || echo "138.197.83.231")

echo "🌐 Droplet IP: $DROPLET_IP"
echo ""

# Update system
echo "📦 Updating system packages..."
apt-get update -y
apt-get upgrade -y

# Install Node.js 20.x
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs git

# Clone or update repository
echo "📥 Setting up Lightning payment system..."
cd /opt
if [ -d "lightning-payment-auto" ]; then
    cd lightning-payment-auto
    git pull
else
    git clone https://github.com/blinds123/lightning-payment-auto.git
    cd lightning-payment-auto
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Create environment file
echo "🔧 Creating configuration..."
cat > .env << EOF
# Server Configuration
PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=*

# API Configuration  
API_BASE_URL=http://$DROPLET_IP:3000

# Frontend URL
FRONTEND_URL=http://$DROPLET_IP:3000

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000
EOF

# Copy production server
cp server-production.js server.js

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'lightning-payment',
    script: './server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/lightning-payment-error.log',
    out_file: '/var/log/lightning-payment.log',
    log_file: '/var/log/lightning-payment-combined.log',
    time: true
  }]
};
EOF

# Install PM2
echo "📦 Installing PM2..."
npm install -g pm2

# Start application
echo "🚀 Starting Lightning payment system..."
pm2 stop all || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

# Configure firewall
echo "🛡️ Configuring firewall..."
ufw --force enable
ufw allow 22/tcp
ufw allow 3000/tcp
ufw reload

# Create quick test script
cat > /opt/lightning-payment-auto/test-api.sh << 'EOF'
#!/bin/bash
echo "Testing Lightning Payment API..."
echo "================================"
echo ""
echo "1. Health Check:"
curl -s http://localhost:3000/health | jq .
echo ""
echo "2. API Status:"
curl -s http://localhost:3000/api/status | jq .
echo ""
echo "3. Creating test invoice:"
curl -s -X POST http://localhost:3000/api/lightning/invoice \
  -H "Content-Type: application/json" \
  -d '{"amount": 25.00, "description": "Test payment"}' | jq .
EOF

chmod +x /opt/lightning-payment-auto/test-api.sh

# Run tests
echo ""
echo "🧪 Running system tests..."
sleep 5
/opt/lightning-payment-auto/test-api.sh

# Display success message
echo ""
echo "✅ Lightning Payment System Deployed Successfully!"
echo "================================================"
echo ""
echo "🌐 Frontend: http://$DROPLET_IP:3000"
echo "📡 API Health: http://$DROPLET_IP:3000/health"
echo "📊 API Status: http://$DROPLET_IP:3000/api/status"
echo ""
echo "🔧 Management Commands:"
echo "   pm2 status         - Check app status"
echo "   pm2 logs           - View application logs"
echo "   pm2 restart all    - Restart application"
echo "   pm2 monit          - Real-time monitoring"
echo ""
echo "🧪 Test the API:"
echo "   /opt/lightning-payment-auto/test-api.sh"
echo ""
echo "💳 Create a payment from your browser:"
echo "   http://$DROPLET_IP:3000"
echo ""
echo "🎉 Your Zero-KYB Lightning payment system is live!"