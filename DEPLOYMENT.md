# The Book Times — Deployment Documentation

> **Site URL**: https://thebooktimes.com  
> **Server IP**: 159.65.189.149  
> **Last Updated**: April 11, 2026

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Server Access](#server-access)
3. [Admin Panel](#admin-panel)
4. [Docker Management](#docker-management)
5. [GitHub Actions CI/CD](#github-actions-cicd)
6. [SSL Certificates](#ssl-certificates)
7. [Domain & DNS](#domain--dns)
8. [Blog System](#blog-system)
9. [Email Configuration](#email-configuration)
10. [Backups](#backups)
11. [Troubleshooting](#troubleshooting)
12. [Security](#security)

---

## Quick Reference

| Item | Value |
|------|-------|
| **Live Site** | https://thebooktimes.com |
| **Admin Panel** | https://thebooktimes.com/admin |
| **Server IP** | 159.65.189.149 |
| **SSH User** | deploy |
| **SSH Key** | `D:\My_Projects\deployKey` |
| **Project Path** | `/opt/thebooktimes` |
| **Database** | MySQL 8.0 (container: thebooktimes-mysql) |
| **SSL Expiry** | July 10, 2026 (auto-renews) |

---

## Server Access

### SSH Connection
```powershell
# From PowerShell (Windows)
ssh -i "D:\My_Projects\deployKey" deploy@159.65.189.149

# Quick command execution
ssh -i "D:\My_Projects\deployKey" deploy@159.65.189.149 "docker ps"
```

### SSH Key Details
- **Location**: `D:\My_Projects\deployKey`
- **Passphrase**: None (empty)
- **Public Key**: `D:\My_Projects\deployKey.pub`

### Server Specs
- **OS**: Ubuntu 24.04.3 LTS
- **vCPU**: 1
- **RAM**: 1 GB
- **Swap**: 2 GB (configured at `/swapfile`)
- **Docker**: 29.4.0
- **Nginx**: 1.24.0 (system-level reverse proxy)

---

## Admin Panel

### Login Credentials
| Field | Value |
|-------|-------|
| **URL** | https://thebooktimes.com/admin |
| **Email** | rizwankhalil87@gmail.com |
| **Password** | o6SNgYdeMih2iwP/F7Lk9zUxfEl3FzrJ |

### Admin Features
- **Dashboard**: Site statistics, recent activity
- **Books**: Add, edit, delete books; import from CSV
- **Categories**: Manage book categories
- **Authors**: Author profiles and management
- **Blog**: Create/edit blog posts, AI generation
- **Users**: User management and roles
- **Reviews**: Moderate user reviews
- **Settings**: Site configuration
- **Analytics**: Traffic and engagement metrics

### Changing Admin Password
```bash
# SSH to server
ssh -i "D:\My_Projects\deployKey" deploy@159.65.189.149

# Access MySQL
docker exec -it thebooktimes-mysql mysql -u thebooktimes -p
# Enter password from .env: MYSQL_PASSWORD

# In MySQL:
USE thebooktimes;
UPDATE users SET password = '$2b$10$NEW_BCRYPT_HASH_HERE' WHERE email = 'rizwankhalil87@gmail.com';
```

To generate a new bcrypt hash, use: `npx bcryptjs "YourNewPassword"`

---

## Docker Management

### Container Status
```bash
ssh -i "D:\My_Projects\deployKey" deploy@159.65.189.149 "docker ps"
```

### Container Names
| Container | Purpose | Port |
|-----------|---------|------|
| thebooktimes-mysql | MySQL 8.0 database | 3306 (internal) |
| thebooktimes-server | Node.js Express API | 3001 (internal) |
| thebooktimes-app | Nginx + React SPA | 8080 → 80 |

### Common Commands
```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f

# Logs for specific service
docker logs thebooktimes-server -f --tail 100

# Restart all services
docker compose -f docker-compose.prod.yml restart

# Rebuild and restart
docker compose -f docker-compose.prod.yml up --build -d

# Stop all services
docker compose -f docker-compose.prod.yml down

# Clean up unused images
docker image prune -f
```

### Health Checks
```bash
# Check container health
docker inspect thebooktimes-server --format '{{.State.Health.Status}}'
docker inspect thebooktimes-mysql --format '{{.State.Health.Status}}'
docker inspect thebooktimes-app --format '{{.State.Health.Status}}'

# API health endpoint
curl http://localhost:3001/api/health
```

---

## GitHub Actions CI/CD

### Workflow Location
`.github/workflows/deploy.yml`

### Trigger
- **Automatic**: Push to `master` branch
- **Manual**: Actions tab → "Run workflow"

### Required Secrets
Go to: https://github.com/MuhammadRizwanKhalil/Books_Recommendation/settings/secrets/actions

| Secret | Value |
|--------|-------|
| `DEPLOY_HOST` | `159.65.189.149` |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_PATH` | `/opt/thebooktimes` |
| `DEPLOY_SSH_KEY` | Full contents of `D:\My_Projects\deployKey` |

### Adding SSH Key Secret
1. Open `D:\My_Projects\deployKey` in notepad
2. Copy **entire contents** including `-----BEGIN OPENSSH PRIVATE KEY-----`
3. Paste into `DEPLOY_SSH_KEY` secret

### Deployment Process
On each push to `master`:
1. GitHub Actions triggers workflow
2. SSH connects to server
3. Pulls latest code via `git pull`
4. Runs `docker compose up --build -d`
5. Prunes old images
6. Reports container status

### Manual Deployment (Alternative)
```bash
ssh -i "D:\My_Projects\deployKey" deploy@159.65.189.149
cd /opt/thebooktimes
git pull origin master
docker compose -f docker-compose.prod.yml up --build -d
```

---

## SSL Certificates

### Current Certificate
- **Issuer**: Let's Encrypt
- **Domains**: thebooktimes.com, www.thebooktimes.com
- **Expires**: July 10, 2026
- **Auto-renewal**: Enabled via systemd timer

### Check Certificate Status
```bash
ssh -i "D:\My_Projects\deployKey" deploy@159.65.189.149 "sudo certbot certificates"
```

### Test Auto-Renewal
```bash
ssh -i "D:\My_Projects\deployKey" deploy@159.65.189.149 "sudo certbot renew --dry-run"
```

### Manual Renewal (if needed)
```bash
sudo certbot renew
sudo systemctl reload nginx
```

### Renewal Timer
```bash
# Check timer status
sudo systemctl list-timers | grep certbot
```

---

## Domain & DNS

### Registrar
Domain registered at GoDaddy (or your registrar)

### Required DNS Records
| Type | Host | Value | TTL |
|------|------|-------|-----|
| A | @ | 159.65.189.149 | 600 |
| CNAME | www | thebooktimes.com | 600 |

### Verify DNS
```bash
nslookup thebooktimes.com
nslookup www.thebooktimes.com
```

---

## Blog System

### Two Modes of Operation

#### 1. Manual Creation (Admin Panel)
- URL: https://thebooktimes.com/admin/blog/new
- Upload featured images via drag-and-drop
- Write HTML content with rich formatting
- Set SEO meta tags, categories, tags
- Save as DRAFT or PUBLISHED

#### 2. AI Blog Generation
Located in `server/src/services/blogGenerator.ts`

**Enable AI Blogs:**
```bash
ssh -i "D:\My_Projects\deployKey" deploy@159.65.189.149
cd /opt/thebooktimes

# Edit .env
nano .env
# Add:
# OPENAI_API_KEY=sk-your-key-here
# AI_BLOG_ENABLED=true

# Restart server
docker compose -f docker-compose.prod.yml restart server
```

**AI Blog Features:**
- 5 topic templates: trending_roundup, new_releases, top_rated, category_spotlight, reading_list
- Generates: title (50-80 chars), content (800-1200 words), excerpt
- Auto-links featured books from database
- Posts saved as DRAFT by default

**Image Note:** AI does NOT generate images. Upload manually via admin panel or paste external URLs (e.g., Unsplash).

---

## Email Configuration

### Current Status
Email sending is disabled (no SMTP configured).

### Recommended Service: Resend
1. Sign up at https://resend.com (3,000 free emails/month)
2. Add domain DNS records for verification
3. Get API key

### Configure SMTP
```bash
ssh -i "D:\My_Projects\deployKey" deploy@159.65.189.149
cd /opt/thebooktimes
nano .env
```

Add:
```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASS=re_your_api_key_here
SMTP_FROM=noreply@thebooktimes.com
```

Restart:
```bash
docker compose -f docker-compose.prod.yml restart server
```

### Alternative Services
| Service | Free Tier |
|---------|-----------|
| Resend | 3,000/month |
| SendGrid | 100/day |
| Mailgun | 5,000/month (3 months) |
| Brevo | 300/day |

---

## Backups

### Database Backup
```bash
# Create backup
ssh -i "D:\My_Projects\deployKey" deploy@159.65.189.149 \
  "docker exec thebooktimes-mysql mysqldump -u root -p\$(grep MYSQL_ROOT_PASSWORD /opt/thebooktimes/.env | cut -d= -f2) thebooktimes > /tmp/backup-\$(date +%Y%m%d).sql"

# Download backup
scp -i "D:\My_Projects\deployKey" deploy@159.65.189.149:/tmp/backup-*.sql .
```

### Restore Database
```bash
# Upload backup
scp -i "D:\My_Projects\deployKey" backup.sql deploy@159.65.189.149:/tmp/

# Restore
ssh -i "D:\My_Projects\deployKey" deploy@159.65.189.149 \
  "docker exec -i thebooktimes-mysql mysql -u root -p\$(grep MYSQL_ROOT_PASSWORD /opt/thebooktimes/.env | cut -d= -f2) thebooktimes < /tmp/backup.sql"
```

### Backup Uploads
```bash
# Download uploads folder
scp -r -i "D:\My_Projects\deployKey" deploy@159.65.189.149:/opt/thebooktimes/server/data/uploads ./uploads-backup
```

### Automated Backups (Recommended)
Add to server crontab:
```bash
# Edit crontab
crontab -e

# Add daily backup at 3 AM
0 3 * * * docker exec thebooktimes-mysql mysqldump -u root -pYOUR_ROOT_PASSWORD thebooktimes | gzip > /opt/backups/db-$(date +\%Y\%m\%d).sql.gz
```

---

## Troubleshooting

### Site Not Loading
```bash
# Check if containers are running
docker ps

# Check container logs
docker logs thebooktimes-app --tail 50
docker logs thebooktimes-server --tail 50

# Check nginx
sudo systemctl status nginx
sudo nginx -t
```

### API Errors (500)
```bash
# Check server logs
docker logs thebooktimes-server -f

# Check database connection
docker exec thebooktimes-mysql mysqladmin -u root -pYOUR_PASSWORD ping
```

### Container Won't Start
```bash
# View detailed error
docker logs thebooktimes-server 2>&1 | head -50

# Check disk space
df -h

# Check memory
free -h
```

### SSL Certificate Issues
```bash
# Check certificate
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

### Database Connection Refused
```bash
# Check if MySQL is running
docker ps | grep mysql

# Restart MySQL
docker compose -f docker-compose.prod.yml restart mysql

# Check MySQL logs
docker logs thebooktimes-mysql --tail 50
```

---

## Security

### Firewall (UFW)
```bash
# Check status
sudo ufw status

# Current rules:
# - 22/tcp (SSH)
# - 80/tcp (HTTP)
# - 443/tcp (HTTPS)
```

### SSH Security
- Password authentication: **Disabled**
- Key-based auth only
- User: `deploy` (passwordless sudo for Docker)

### Fail2ban
```bash
# Check status
sudo systemctl status fail2ban

# View banned IPs
sudo fail2ban-client status sshd
```

### Environment Variables
- Stored in `/opt/thebooktimes/.env`
- Never committed to Git (in .gitignore)
- Contains database passwords, JWT secrets, admin credentials

### Updating Secrets
```bash
ssh -i "D:\My_Projects\deployKey" deploy@159.65.189.149
cd /opt/thebooktimes
nano .env
# Edit as needed
docker compose -f docker-compose.prod.yml restart
```

---

## Quick Commands Cheat Sheet

```bash
# SSH to server
ssh -i "D:\My_Projects\deployKey" deploy@159.65.189.149

# View all containers
docker ps -a

# View logs (follow mode)
docker compose -f docker-compose.prod.yml logs -f

# Restart everything
docker compose -f docker-compose.prod.yml restart

# Full rebuild
docker compose -f docker-compose.prod.yml up --build -d

# Check disk space
df -h

# Check memory usage
free -h

# Check SSL cert
sudo certbot certificates

# Test SSL renewal
sudo certbot renew --dry-run

# Database backup
docker exec thebooktimes-mysql mysqldump -u root -pPASSWORD thebooktimes > backup.sql
```

---

## Support

For issues:
1. Check this documentation's Troubleshooting section
2. Review container logs
3. File issues at: https://github.com/MuhammadRizwanKhalil/Books_Recommendation/issues

---

*Generated by GitHub Copilot — April 11, 2026*
