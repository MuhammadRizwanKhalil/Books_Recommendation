#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# The Book Times — Fresh Server Setup Script
# ══════════════════════════════════════════════════════════════════════════════
#
# Run this on a fresh Ubuntu 24.04 LTS Digital Ocean droplet.
# Execute as root:
#   curl -sSL https://raw.githubusercontent.com/YOUR_USERNAME/Books_Recommendation/main/deploy/setup-server.sh | bash
#   — or —
#   bash deploy/setup-server.sh
#
# What this script does:
#   1. Creates a 'deploy' user with sudo + SSH access
#   2. Configures UFW firewall (SSH, HTTP, HTTPS)
#   3. Installs Docker and Docker Compose
#   4. Installs Nginx and Certbot
#   5. Sets up swap space (for small droplets)
#   6. Clones the repo and prepares for first deployment
#   7. Sets up SSH deploy key for GitHub Actions
#
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Colors for output ────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── Pre-checks ───────────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && error "This script must be run as root (sudo)"
[[ ! -f /etc/lsb-release ]] && error "This script is designed for Ubuntu"

DEPLOY_USER="deploy"
APP_DIR="/opt/thebooktimes"
DOMAIN="thebooktimes.com"

info "Starting server setup for ${DOMAIN}..."

# ══════════════════════════════════════════════════════════════════════════════
# STEP 1: System Updates
# ══════════════════════════════════════════════════════════════════════════════
info "Updating system packages..."
apt update && apt upgrade -y
apt install -y curl wget git unzip software-properties-common \
    apt-transport-https ca-certificates gnupg lsb-release fail2ban

# ══════════════════════════════════════════════════════════════════════════════
# STEP 2: Create Deploy User
# ══════════════════════════════════════════════════════════════════════════════
if ! id "$DEPLOY_USER" &>/dev/null; then
    info "Creating user '${DEPLOY_USER}'..."
    adduser --disabled-password --gecos "" "$DEPLOY_USER"
    usermod -aG sudo "$DEPLOY_USER"
    # Allow sudo without password for deploy user
    echo "${DEPLOY_USER} ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/${DEPLOY_USER}
    chmod 440 /etc/sudoers.d/${DEPLOY_USER}

    # Copy root SSH keys to deploy user
    mkdir -p /home/${DEPLOY_USER}/.ssh
    if [ -f /root/.ssh/authorized_keys ]; then
        cp /root/.ssh/authorized_keys /home/${DEPLOY_USER}/.ssh/
    fi
    chown -R ${DEPLOY_USER}:${DEPLOY_USER} /home/${DEPLOY_USER}/.ssh
    chmod 700 /home/${DEPLOY_USER}/.ssh
    chmod 600 /home/${DEPLOY_USER}/.ssh/authorized_keys 2>/dev/null || true
    info "User '${DEPLOY_USER}' created with sudo and SSH access"
else
    info "User '${DEPLOY_USER}' already exists, skipping..."
fi

# ══════════════════════════════════════════════════════════════════════════════
# STEP 3: Configure Firewall
# ══════════════════════════════════════════════════════════════════════════════
info "Configuring UFW firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
info "Firewall configured — SSH, HTTP, HTTPS allowed"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 4: Install Docker
# ══════════════════════════════════════════════════════════════════════════════
if ! command -v docker &>/dev/null; then
    info "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    usermod -aG docker "$DEPLOY_USER"
    systemctl enable docker
    systemctl start docker
    info "Docker installed: $(docker --version)"
else
    info "Docker already installed: $(docker --version)"
fi

# Verify Docker Compose
if docker compose version &>/dev/null; then
    info "Docker Compose: $(docker compose version)"
else
    error "Docker Compose not found — should be included with modern Docker"
fi

# ══════════════════════════════════════════════════════════════════════════════
# STEP 5: Install Nginx
# ══════════════════════════════════════════════════════════════════════════════
if ! command -v nginx &>/dev/null; then
    info "Installing Nginx..."
    apt install -y nginx
    systemctl enable nginx
    systemctl start nginx
    # Remove default site
    rm -f /etc/nginx/sites-enabled/default
    info "Nginx installed: $(nginx -v 2>&1)"
else
    info "Nginx already installed: $(nginx -v 2>&1)"
fi

# ══════════════════════════════════════════════════════════════════════════════
# STEP 6: Install Certbot
# ══════════════════════════════════════════════════════════════════════════════
if ! command -v certbot &>/dev/null; then
    info "Installing Certbot..."
    apt install -y certbot python3-certbot-nginx
    info "Certbot installed: $(certbot --version)"
else
    info "Certbot already installed: $(certbot --version)"
fi

# ══════════════════════════════════════════════════════════════════════════════
# STEP 7: Setup Swap (2GB — essential for 2GB/4GB droplets)
# ══════════════════════════════════════════════════════════════════════════════
if [ ! -f /swapfile ]; then
    info "Creating 2GB swap file..."
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    # Tune swap behavior
    sysctl vm.swappiness=10
    echo 'vm.swappiness=10' >> /etc/sysctl.conf
    info "Swap configured: 2GB"
else
    info "Swap already exists, skipping..."
fi

# ══════════════════════════════════════════════════════════════════════════════
# STEP 8: Create App Directory
# ══════════════════════════════════════════════════════════════════════════════
info "Setting up application directory..."
mkdir -p "$APP_DIR"
chown ${DEPLOY_USER}:${DEPLOY_USER} "$APP_DIR"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 9: Generate GitHub Actions Deploy Key
# ══════════════════════════════════════════════════════════════════════════════
DEPLOY_KEY="/home/${DEPLOY_USER}/.ssh/github_deploy"
if [ ! -f "$DEPLOY_KEY" ]; then
    info "Generating SSH deploy key for GitHub Actions..."
    sudo -u "$DEPLOY_USER" ssh-keygen -t ed25519 -C "github-actions-deploy" -f "$DEPLOY_KEY" -N ""
    cat "${DEPLOY_KEY}.pub" >> /home/${DEPLOY_USER}/.ssh/authorized_keys
    info "Deploy key generated"
else
    info "Deploy key already exists, skipping..."
fi

# ══════════════════════════════════════════════════════════════════════════════
# STEP 10: Docker Log Rotation
# ══════════════════════════════════════════════════════════════════════════════
info "Configuring Docker log rotation..."
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
systemctl restart docker

# ══════════════════════════════════════════════════════════════════════════════
# STEP 11: Configure fail2ban
# ══════════════════════════════════════════════════════════════════════════════
info "Configuring fail2ban..."
cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log

[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
EOF
systemctl enable fail2ban
systemctl restart fail2ban

# ══════════════════════════════════════════════════════════════════════════════
# DONE — Print summary
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN} Server Setup Complete!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Deploy user:    ${YELLOW}${DEPLOY_USER}${NC}"
echo -e "  App directory:  ${YELLOW}${APP_DIR}${NC}"
echo -e "  Domain:         ${YELLOW}${DOMAIN}${NC}"
echo ""
echo -e "${YELLOW} NEXT STEPS:${NC}"
echo ""
echo "  1. Configure DNS (GoDaddy):"
echo "     A record: @   → $(curl -s ifconfig.me)"
echo "     A record: www → $(curl -s ifconfig.me)"
echo ""
echo "  2. Clone the repo (as deploy user):"
echo "     su - ${DEPLOY_USER}"
echo "     cd ${APP_DIR}"
echo "     git clone https://github.com/YOUR_USERNAME/Books_Recommendation.git ."
echo ""
echo "  3. Create .env file:"
echo "     cp .env.production .env"
echo "     nano .env   # Fill in all CHANGE_ME values"
echo ""
echo "  4. Copy the Nginx config:"
echo "     sudo cp deploy/nginx-host.conf /etc/nginx/sites-available/${DOMAIN}"
echo "     sudo ln -s /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/"
echo "     sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "  5. Start the application:"
echo "     docker compose -f docker-compose.prod.yml up --build -d"
echo ""
echo "  6. Setup SSL (after DNS propagates):"
echo "     sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
echo ""
echo "  7. GitHub Actions Secrets — add the private deploy key:"
echo "     cat ${DEPLOY_KEY}"
echo "     → Copy to GitHub → Repo → Settings → Secrets → DEPLOY_SSH_KEY"
echo "     Also add: DEPLOY_HOST=$(curl -s ifconfig.me)"
echo "              DEPLOY_USER=${DEPLOY_USER}"
echo "              DEPLOY_PATH=${APP_DIR}"
echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════════════${NC}"
