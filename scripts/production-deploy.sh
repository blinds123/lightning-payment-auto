#!/bin/bash
set -e

echo "🚀 Lightning Payment System - Production Deployment"
echo "================================================"

# Configuration
DOMAIN=${1:-""}
EMAIL=${2:-"admin@example.com"}
BTCPAY_INSTALL=${3:-"yes"}

if [ -z "$DOMAIN" ]; then
    echo "Usage: ./production-deploy.sh <domain> [email] [install-btcpay:yes/no]"
    echo "Example: ./production-deploy.sh payments.example.com admin@example.com yes"
    exit 1
fi

# Update system
echo "📦 Updating system packages..."
apt-get update -y
apt-get upgrade -y
apt-get install -y curl git nginx certbot python3-certbot-nginx nodejs npm docker.io docker-compose

# Clone repository
echo "📥 Cloning Lightning payment repository..."
cd /opt
if [ -d "lightning-payment-auto" ]; then
    cd lightning-payment-auto
    git pull
else
    git clone https://github.com/blinds123/lightning-payment-auto.git
    cd lightning-payment-auto
fi

# Install BTCPay Server (if requested)
if [ "$BTCPAY_INSTALL" = "yes" ]; then
    echo "⚡ Installing BTCPay Server..."
    
    # BTCPay Server installation
    cd /opt
    if [ ! -d "btcpayserver-docker" ]; then
        git clone https://github.com/btcpayserver/btcpayserver-docker
        cd btcpayserver-docker
        
        # Configure BTCPay
        export BTCPAY_HOST="$DOMAIN"
        export NBITCOIN_NETWORK="mainnet"
        export BTCPAYGEN_CRYPTO1="btc"
        export BTCPAYGEN_LIGHTNING="clightning"
        export BTCPAYGEN_ADDITIONAL_FRAGMENTS="opt-save-storage-xs"
        export BTCPAY_ENABLE_SSH=false
        export REVERSEPROXY_HTTP_PORT=8080
        export REVERSEPROXY_HTTPS_PORT=8443
        
        # Run BTCPay setup
        . ./btcpay-setup.sh -i
        
        echo "✅ BTCPay Server installed!"
        echo "Access BTCPay at: https://$DOMAIN:8443"
    else
        echo "BTCPay Server already installed"
    fi
fi

# Install Node.js application
echo "📦 Installing Lightning payment application..."
cd /opt/lightning-payment-auto

# Create .env file
cat > .env << EOF
# Server Configuration
PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=https://$DOMAIN

# BTCPay Configuration
BTCPAY_URL=https://$DOMAIN:8443
BTCPAY_API_KEY=YOUR_BTCPAY_API_KEY
BTCPAY_STORE_ID=YOUR_BTCPAY_STORE_ID
BTCPAY_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET

# Frontend URL
FRONTEND_URL=https://$DOMAIN

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000
EOF

# Install dependencies
npm install --production

# Update package.json to use production server
mv server-production.js server.js

# Create systemd service
echo "🔧 Creating systemd service..."
cat > /etc/systemd/system/lightning-payment.service << EOF
[Unit]
Description=Lightning Payment API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/lightning-payment-auto
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/lightning-payment.log
StandardError=append:/var/log/lightning-payment-error.log
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Configure Nginx
echo "🌐 Configuring Nginx..."
cat > /etc/nginx/sites-available/lightning-payment << EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/lightning-payment /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
nginx -t
systemctl reload nginx

# Get SSL certificate
echo "🔒 Setting up SSL certificate..."
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect

# Start services
echo "🚀 Starting services..."
systemctl daemon-reload
systemctl enable lightning-payment
systemctl start lightning-payment

# Configure firewall
echo "🛡️ Configuring firewall..."
ufw --force enable
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8443/tcp
ufw reload

# Create helper scripts
echo "📝 Creating helper scripts..."
cat > /opt/lightning-payment-auto/check-status.sh << 'EOF'
#!/bin/bash
echo "Lightning Payment System Status"
echo "=============================="
echo ""
echo "API Service:"
systemctl status lightning-payment --no-pager | head -10
echo ""
echo "Recent Logs:"
tail -20 /var/log/lightning-payment.log
echo ""
echo "Endpoints:"
curl -s http://localhost:3000/health | jq .
EOF

chmod +x /opt/lightning-payment-auto/check-status.sh

# Final instructions
echo ""
echo "✅ Lightning Payment System Deployed!"
echo "===================================="
echo ""
echo "🌐 Frontend: https://$DOMAIN"
echo "📡 API Health: https://$DOMAIN/health"
echo "⚡ BTCPay Server: https://$DOMAIN:8443"
echo ""
echo "🔧 Next Steps:"
echo "1. Access BTCPay Server and create a store"
echo "2. Generate API keys in BTCPay Server"
echo "3. Update /opt/lightning-payment-auto/.env with your keys"
echo "4. Restart service: systemctl restart lightning-payment"
echo ""
echo "📊 Check status: /opt/lightning-payment-auto/check-status.sh"
echo "📋 View logs: journalctl -u lightning-payment -f"
echo ""
echo "🎉 Your Zero-KYB Lightning payment system is ready!"