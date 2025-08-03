#!/bin/bash

# BTCPay Server Setup Script for DigitalOcean Droplet
# This script sets up BTCPay Server with Lightning Network for zero-KYB payments

set -e

echo "🚀 Setting up BTCPay Server for Lightning Payments (Zero-KYB)"
echo "Droplet IP: 138.197.83.231"
echo "=================================================="

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install Docker and Docker Compose
echo "🐳 Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker $USER

# Install Docker Compose
echo "🔧 Installing Docker Compose..."
curl -L "https://github.com/docker/compose/releases/download/v2.20.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create BTCPay directory
echo "📁 Creating BTCPay Server directory..."
mkdir -p /opt/btcpay
cd /opt/btcpay

# Set environment variables
echo "⚙️ Setting up environment variables..."
export BTCPAY_HOST="btcpay.yourdomain.com"
export REVERSEPROXY_DEFAULT_HOST="$BTCPAY_HOST"
export NBITCOIN_NETWORK="mainnet"
export BTCPAYGEN_CRYPTO1="btc"
export BTCPAYGEN_ADDITIONAL_FRAGMENTS="opt-save-storage-s"
export BTCPAYGEN_REVERSEPROXY="nginx"
export BTCPAYGEN_LIGHTNING="clightning"
export LETSENCRYPT_EMAIL="your-email@domain.com"

# Download BTCPay Server
echo "📥 Downloading BTCPay Server..."
git clone https://github.com/btcpayserver/btcpayserver-docker
cd btcpayserver-docker

# Configure for production with Lightning
echo "⚡ Configuring BTCPay Server with Lightning Network..."
cat > .env << EOF
# BTCPay Server Configuration
BTCPAY_HOST=$BTCPAY_HOST
REVERSEPROXY_DEFAULT_HOST=$BTCPAY_HOST
NBITCOIN_NETWORK=$NBITCOIN_NETWORK
BTCPAYGEN_CRYPTO1=$BTCPAYGEN_CRYPTO1
BTCPAYGEN_ADDITIONAL_FRAGMENTS=$BTCPAYGEN_ADDITIONAL_FRAGMENTS
BTCPAYGEN_REVERSEPROXY=$BTCPAYGEN_REVERSEPROXY
BTCPAYGEN_LIGHTNING=$BTCPAYGEN_LIGHTNING
LETSENCRYPT_EMAIL=$LETSENCRYPT_EMAIL

# Lightning Network Configuration
BTCPAYGEN_EXCLUDE_FRAGMENTS=""
BTCPAY_ENABLE_SSH=false

# Storage optimization for VPS
BTCPAYGEN_BITCOIN_PRUNING=550
BTCPAYGEN_BITCOIN_DBCACHE=100
BTCPAYGEN_BITCOIN_RPCTHREADS=4

# Memory optimization
BTCPAYGEN_BITCOIN_MAXMEMPOOL=50
BTCPAYGEN_BITCOIN_MAXCONNECTIONS=40
EOF

# Generate docker-compose configuration
echo "🔨 Generating BTCPay Server configuration..."
./btcpay-setup.sh --install-only

# Create systemd service for BTCPay Server
echo "🛠️ Creating systemd service..."
cat > /etc/systemd/system/btcpayserver.service << EOF
[Unit]
Description=BTCPay Server
Requires=docker.service
After=docker.service

[Service]
Type=forking
Restart=unless-stopped
RestartSec=5s
TimeoutStartSec=0
User=root
WorkingDirectory=/opt/btcpay/btcpayserver-docker
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down

[Install]
WantedBy=multi-user.target
EOF

# Enable and start BTCPay Server
echo "🔄 Starting BTCPay Server..."
systemctl daemon-reload
systemctl enable btcpayserver
systemctl start btcpayserver

# Install Nginx for reverse proxy
echo "🌐 Installing Nginx..."
apt install nginx -y

# Configure Nginx for BTCPay Server
echo "📝 Configuring Nginx..."
cat > /etc/nginx/sites-available/btcpay << EOF
server {
    listen 80;
    server_name $BTCPAY_HOST;
    
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name $BTCPAY_HOST;
    
    ssl_certificate /etc/letsencrypt/live/$BTCPAY_HOST/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$BTCPAY_HOST/privkey.pem;
    
    location / {
        proxy_pass http://127.0.0.1:23000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/btcpay /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Install Certbot for SSL
echo "🔒 Installing SSL certificates..."
apt install certbot python3-certbot-nginx -y

# Configure firewall
echo "🔥 Configuring firewall..."
ufw allow ssh
ufw allow http
ufw allow https
ufw allow 9735/tcp  # Lightning Network
ufw --force enable

# Create monitoring script
echo "📊 Creating monitoring script..."
cat > /opt/btcpay/monitor.sh << 'EOF'
#!/bin/bash

# BTCPay Server Monitoring Script
LOG_FILE="/var/log/btcpay-monitor.log"

check_service() {
    if systemctl is-active --quiet btcpayserver; then
        echo "$(date): BTCPay Server is running" >> $LOG_FILE
    else
        echo "$(date): BTCPay Server is down, attempting restart" >> $LOG_FILE
        systemctl restart btcpayserver
    fi
}

check_lightning() {
    if docker exec btcpayserver_clightning_bitcoin_1 lightning-cli getinfo > /dev/null 2>&1; then
        echo "$(date): Lightning node is responding" >> $LOG_FILE
    else
        echo "$(date): Lightning node is not responding" >> $LOG_FILE
    fi
}

check_disk_space() {
    DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ $DISK_USAGE -gt 85 ]; then
        echo "$(date): WARNING - Disk usage is ${DISK_USAGE}%" >> $LOG_FILE
    fi
}

check_service
check_lightning
check_disk_space
EOF

chmod +x /opt/btcpay/monitor.sh

# Add monitoring to crontab
echo "⏰ Setting up monitoring cron job..."
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/btcpay/monitor.sh") | crontab -

echo ""
echo "✅ BTCPay Server setup completed!"
echo ""
echo "📋 Next Steps:"
echo "1. Point your domain ($BTCPAY_HOST) to this server (138.197.83.231)"
echo "2. Run: certbot --nginx -d $BTCPAY_HOST"
echo "3. Visit https://$BTCPAY_HOST to complete BTCPay Server setup"
echo "4. Create your first store and enable Lightning payments"
echo "5. Generate API key for your application"
echo ""
echo "🔧 Useful Commands:"
echo "- Check BTCPay status: systemctl status btcpayserver"
echo "- View logs: docker-compose -f /opt/btcpay/btcpayserver-docker/docker-compose.yml logs"
echo "- Lightning CLI: docker exec btcpayserver_clightning_bitcoin_1 lightning-cli getinfo"
echo ""
echo "📚 Documentation: https://docs.btcpayserver.org/"
echo ""
echo "⚡ Your Lightning payment system is ready for zero-KYB payments!"