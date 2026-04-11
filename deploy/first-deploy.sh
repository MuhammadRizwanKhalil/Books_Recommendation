#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# The Book Times — First Deploy Script
# ══════════════════════════════════════════════════════════════════════════════
#
# Run this AFTER setup-server.sh and AFTER DNS is configured.
# Execute as the deploy user:
#   bash deploy/first-deploy.sh
#
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

DOMAIN="thebooktimes.com"
APP_DIR="/opt/thebooktimes"

# ── Pre-checks ───────────────────────────────────────────────────────────────
cd "$APP_DIR" || error "App directory ${APP_DIR} not found. Clone the repo first."

if [ ! -f ".env" ]; then
    if [ -f ".env.production" ]; then
        warn ".env not found. Copying from .env.production..."
        cp .env.production .env
        echo ""
        error "Please edit .env and fill in all CHANGE_ME values, then run this script again:\n  nano ${APP_DIR}/.env"
    else
        error ".env file not found. Create it from .env.production first."
    fi
fi

# Check for CHANGE_ME values
if grep -q "CHANGE_ME" .env; then
    error ".env still contains CHANGE_ME placeholders. Fill in real values:\n  nano ${APP_DIR}/.env"
fi

# ══════════════════════════════════════════════════════════════════════════════
# STEP 1: Install Nginx site config
# ══════════════════════════════════════════════════════════════════════════════
info "Installing Nginx configuration..."
if [ ! -f "/etc/nginx/sites-available/${DOMAIN}" ]; then
    sudo cp deploy/nginx-host.conf /etc/nginx/sites-available/${DOMAIN}
    sudo ln -sf /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/
    sudo nginx -t || error "Nginx configuration test failed"
    sudo systemctl reload nginx
    info "Nginx site configured for ${DOMAIN}"
else
    info "Nginx site already configured, skipping..."
fi

# ══════════════════════════════════════════════════════════════════════════════
# STEP 2: Build and start Docker containers
# ══════════════════════════════════════════════════════════════════════════════
info "Building and starting Docker containers (this may take a few minutes)..."
docker compose -f docker-compose.prod.yml up --build -d

# ══════════════════════════════════════════════════════════════════════════════
# STEP 3: Wait for services
# ══════════════════════════════════════════════════════════════════════════════
info "Waiting for services to start..."
sleep 20

# ── Check containers ─────────────────────────────────────────────────────────
echo ""
info "Container Status:"
docker compose -f docker-compose.prod.yml ps
echo ""

# ── Health checks ────────────────────────────────────────────────────────────
if curl -sf http://localhost:8080/ > /dev/null 2>&1; then
    info "Frontend: OK"
else
    warn "Frontend not responding yet (may still be starting)"
fi

if curl -sf http://localhost:8080/api/health > /dev/null 2>&1; then
    info "API: OK"
else
    warn "API not responding yet (may still be starting — MySQL might need a moment)"
fi

# ══════════════════════════════════════════════════════════════════════════════
# STEP 4: SSL Setup
# ══════════════════════════════════════════════════════════════════════════════
echo ""
info "Checking DNS for ${DOMAIN}..."
RESOLVED_IP=$(dig +short ${DOMAIN} 2>/dev/null || echo "")
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "unknown")

if [ "$RESOLVED_IP" = "$SERVER_IP" ]; then
    info "DNS is pointing to this server (${SERVER_IP}). Setting up SSL..."
    sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --non-interactive --agree-tos --email admin@${DOMAIN} --redirect
    info "SSL certificate installed!"
else
    warn "DNS not yet pointing here (resolved: ${RESOLVED_IP:-nothing}, server: ${SERVER_IP})"
    echo ""
    echo "  Set these DNS records in GoDaddy:"
    echo "    A record: @   → ${SERVER_IP}"
    echo "    A record: www → ${SERVER_IP}"
    echo ""
    echo "  After DNS propagates, run:"
    echo "    sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
fi

# ══════════════════════════════════════════════════════════════════════════════
# DONE
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN} First Deploy Complete!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Site:  http://${DOMAIN} (or https:// if SSL was configured)"
echo "  Admin: http://${DOMAIN}/ctrl-panel"
echo "  API:   http://${DOMAIN}/api/health"
echo ""
echo "  View logs:     docker compose -f docker-compose.prod.yml logs -f"
echo "  Restart:       docker compose -f docker-compose.prod.yml restart"
echo "  Stop:          docker compose -f docker-compose.prod.yml down"
echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════════════${NC}"
