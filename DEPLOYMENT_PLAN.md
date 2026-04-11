# The Book Times — Deployment & Rebranding Plan

**Domain:** thebooktimes.com  
**Hosting:** Digital Ocean Droplet (Ubuntu 24.04 LTS)  
**DNS Provider:** GoDaddy  
**SSL:** Let's Encrypt (free, auto-renewing)  
**CI/CD:** GitHub Actions  
**Date:** April 11, 2026

---

## Architecture Overview

```
Internet
  │
  ▼
Host-level Nginx (port 80/443 + Let's Encrypt SSL)
  │
  ├── thebooktimes.com ──► The Book Times Docker Stack
  │     ├── frontend   (Nginx + React, internal port 80)
  │     ├── backend    (Node.js API, internal port 3001)
  │     └── mysql      (MySQL 8, internal port 3306)
  │
  └── [other-domain] ──► Laravel + Next.js Docker Stack
        ├── laravel    (PHP + Laravel)
        ├── nextjs     (Next.js frontend)
        └── database   (MySQL/PostgreSQL)
```

**Key design:** One Docker engine, two separate Docker Compose stacks, one host-level Nginx reverse proxy as the single entry point.

---

## Phase 1: Branding Overhaul — BookDiscovery → The Book Times

### 1.1 HTML Meta Tags & SEO (`app/index.html`)
- [x] Title: `The Book Times - AI-Powered Book Recommendations | Discover Your Next Great Read`
- [x] Meta author, og:title, og:site_name, twitter:title → `The Book Times`
- [x] og:url, canonical, JSON-LD URLs → `https://thebooktimes.com`
- [x] apple-mobile-web-app-title, application-name → `The Book Times`

### 1.2 PWA Manifest (`app/public/manifest.json`)
- [x] name → `The Book Times - AI-Powered Book Recommendations`
- [x] short_name → `The Book Times`
- [x] Screenshot labels updated

### 1.3 Service Worker (`app/public/sw.js`)
- [x] Cache prefix → `thebooktimes-v1`

### 1.4 Frontend Components
- [x] `app/src/sections/Navigation.tsx` — siteName fallback → `The Book Times`
- [x] `app/src/sections/Footer.tsx` — siteName fallback → `The Book Times`
- [x] `app/src/hooks/useSEO.ts` — title, canonical, ogImage defaults
- [x] `app/src/admin/AdminLayout.tsx` — admin branding
- [x] `app/src/admin/AdminLoginPage.tsx` — login branding

### 1.5 Server Config & Defaults
- [x] `server/src/config.ts` — admin email, JWT secret prefix
- [x] `server/src/services/email.ts` — SMTP from name/email
- [x] `server/src/routes/settings.ts` — all site_settings defaults
- [x] `server/src/routes/seo.ts` — robots.txt header, JSON-LD
- [x] `server/src/routes/auth.ts` — auth email fallback
- [x] `server/src/services/googleBooks.ts` — Amazon affiliate tag → `thebooktimes-20`
- [x] `server/src/routes/imageProxy.ts` — User-Agent string

### 1.6 Seed Data (`server/src/seed.ts`)
- [x] site_name, site_description, admin_email, contact_email, SMTP defaults

### 1.7 Docker Configuration
- [x] `docker-compose.dev.yml` — container names, volumes → `thebooktimes-*`
- [x] `docker-compose.prod.yml` — container names, volumes → `thebooktimes-*`
- [x] `app/Dockerfile` — labels
- [x] `server/Dockerfile` — labels

### 1.8 Other Files
- [x] `app/package.json` — name field
- [x] `server/package.json` — name field
- [x] `app/nginx.conf` — server_name → `thebooktimes.com www.thebooktimes.com`
- [x] `server/.env` — admin email, JWT secret

---

## Phase 2: Logo & Visual Assets (Manual)

### Required Assets
| Asset | Size | Purpose | Status |
|-------|------|---------|--------|
| Full logo | SVG or high-res PNG | Navigation bar, footer, emails | ❌ Needed |
| Square icon | 512×512 PNG minimum | Favicon, PWA icons (auto-generates 7 sizes) | ❌ Needed |
| OG image | 1200×630 PNG | Social media sharing (Facebook, Twitter, LinkedIn) | ❌ Needed |
| PWA screenshots | 1280×720 + 750×1334 | PWA install prompt | ❌ Optional |

### Recommended Design Direction
- **Style:** Editorial/newspaper aesthetic with book motif (matches "Times" branding)
- **Colors:** Current `#c2631a` (warm amber) + `#1e293b` (dark slate) — or new palette
- **Tools:** Canva (free), Figma, or commission on Fiverr (~$20-50)

### Integration Steps (after assets are ready)
1. Place square icon source → run `node app/scripts/generate-icons.js` to generate all PWA icon sizes
2. Replace `app/public/icons/*` with generated icons
3. Place `app/public/og-image.png`
4. Upload logo via Admin Panel → Settings → `site_logo_url` (auto-propagates to nav, footer, emails)
5. Replace inline SVG favicon in `app/index.html` with actual `.ico`/`.png` reference

---

## Phase 3: Google Analytics 4

### Setup Steps
1. Go to [analytics.google.com](https://analytics.google.com) → Create property for `thebooktimes.com`
2. Get **Measurement ID** (format: `G-XXXXXXXXXX`)
3. For server-side analytics reporting:
   - Create GCP service account
   - Download `ga-credentials.json`
   - Note **Property ID** (format: `properties/XXXXXXXXX`)
4. Configure in production `.env`:
   ```
   GA_MEASUREMENT_ID=G-XXXXXXXXXX
   GA_PROPERTY_ID=properties/XXXXXXXXX
   ```
5. Place `ga-credentials.json` in server directory on droplet
6. Verify in Admin Settings panel → set `google_analytics_id`

**Note:** The app already has full GA infrastructure built in — just needs credentials.

---

## Phase 4: Digital Ocean Droplet Setup

### 4.1 Create Droplet
- **Plan:** $24/mo (2 vCPU, 4GB RAM) — recommended for 2 Docker projects
- **OS:** Ubuntu 24.04 LTS
- **Region:** Closest to target audience
- **Auth:** SSH key (NOT password)
- **Extras:** Enable backups ($4.80/mo), enable monitoring

### 4.2 Initial Server Setup
```bash
# 1. SSH in as root
ssh root@DROPLET_IP

# 2. Create deploy user
adduser deploy
usermod -aG sudo deploy

# 3. Copy SSH key to deploy user
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# 4. Configure firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# 5. Install Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy

# 6. Install Docker Compose (included with modern Docker)
docker compose version

# 7. Install Nginx
apt install nginx -y

# 8. Install Certbot
apt install certbot python3-certbot-nginx -y
```

### 4.3 DNS Configuration (GoDaddy)
1. Log into GoDaddy → DNS Management for thebooktimes.com
2. Add/edit records:
   | Type | Name | Value | TTL |
   |------|------|-------|-----|
   | A | @ | `DROPLET_IP` | 600 |
   | A | www | `DROPLET_IP` | 600 |
3. Remove any conflicting A/CNAME records
4. After verification, change TTL to 3600

### 4.4 Deploy The Book Times
```bash
# As deploy user
sudo mkdir -p /opt/thebooktimes
sudo chown deploy:deploy /opt/thebooktimes
cd /opt/thebooktimes
git clone git@github.com:YOUR_USERNAME/Books_Recommendation.git .

# Create production .env
cp server/.env server/.env.production
nano server/.env.production
# Set: strong MySQL password, JWT secret, FRONTEND_URL=https://thebooktimes.com, GA IDs

# Start the stack
docker compose -f docker-compose.prod.yml up -d

# Verify
docker compose -f docker-compose.prod.yml ps
curl http://localhost:FRONTEND_PORT
```

### 4.5 Host Nginx Configuration
Create `/etc/nginx/sites-available/thebooktimes.com`:
```nginx
server {
    listen 80;
    server_name thebooktimes.com www.thebooktimes.com;

    location / {
        proxy_pass http://127.0.0.1:FRONTEND_PORT;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
```bash
ln -s /etc/nginx/sites-available/thebooktimes.com /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 4.6 SSL with Let's Encrypt
```bash
certbot --nginx -d thebooktimes.com -d www.thebooktimes.com
# Auto-configures SSL, HTTP→HTTPS redirect, and auto-renewal cron
```

### 4.7 Deploy Second Project (Laravel + Next.js)
Same pattern in `/opt/secondproject/` with its own domain and Nginx server block.

---

## Phase 5: CI/CD — GitHub Actions Auto-Deploy

### 5.1 Setup Deploy Key on Droplet
```bash
# As deploy user on droplet
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/github_deploy  # Copy this private key
```

### 5.2 GitHub Repository Secrets
Go to GitHub → Repo → Settings → Secrets and Variables → Actions:
| Secret | Value |
|--------|-------|
| `DEPLOY_SSH_KEY` | Private key from step above |
| `DEPLOY_HOST` | Droplet IP address |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_PATH` | `/opt/thebooktimes` |

### 5.3 Workflow File (`.github/workflows/deploy.yml`)
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            cd ${{ secrets.DEPLOY_PATH }}
            git pull origin main
            docker compose -f docker-compose.prod.yml up --build -d
            docker compose -f docker-compose.prod.yml ps
```

### 5.4 Branch Protection
- Protect `main` branch → require PR reviews
- Feature branches → merge to main = auto-deploy

---

## Verification Checklist

| # | Check | How |
|---|-------|-----|
| 1 | No "BookDiscovery" references remain | `grep -ri "bookdiscovery" .` |
| 2 | Navigation shows "The Book Times" | Visual check |
| 3 | Page title correct | Check browser tab |
| 4 | Admin login shows new brand | Visit /ctrl-panel |
| 5 | Meta tags correct | View page source |
| 6 | JSON-LD structured data correct | Google Rich Results Test |
| 7 | PWA installable with correct name | Chrome → Install |
| 8 | SSL working | ssllabs.com/ssltest |
| 9 | DNS propagated | dnschecker.org |
| 10 | GA4 receiving data | analytics.google.com → Realtime |
| 11 | Email branding correct | Admin → Send test email |
| 12 | Auto-deploy works | Push to main → verify |

---

## User Action Items (Cannot Be Automated)

1. **Create Digital Ocean droplet** with specs above
2. **Configure GoDaddy DNS** A records → droplet IP
3. **Design logo** (or commission) — full logo + square icon + OG image
4. **Create GA4 property** at analytics.google.com
5. **Register Amazon affiliate tag** `thebooktimes-20` in Amazon Associates (if using affiliate links)
6. **Choose email provider** for transactional emails (Gmail SMTP, Resend, SendGrid, etc.)
