# BookDiscovery — Production Deployment Guide

## Architecture Overview

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│   Nginx      │────▶│  Express API    │────▶│   MySQL 8.0  │
│  (Frontend)  │     │  (Node.js 22)   │     │  (InnoDB)    │
│  Port 80/443 │     │  Port 3001      │     │  Port 3306   │
└──────────────┘     └─────────────────┘     └──────────────┘
                            │
                     ┌──────┴──────┐
                     │  OpenAI API │
                     │ (AI Blogs)  │
                     └─────────────┘
```

**Frontend**: React 19 + Vite + TypeScript + Tailwind CSS + shadcn/ui  
**Backend**: Express.js + TypeScript + MySQL 8.0 + Pino logging  
**AI**: OpenAI GPT-4o-mini for automated blog generation  
**Infrastructure**: Docker Compose + Nginx reverse proxy + GitHub Actions CI/CD

---

## Quick Start (Development)

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env with your values

# 2. Start with Docker
docker compose -f docker-compose.dev.yml up -d

# 3. Seed the database
docker compose -f docker-compose.dev.yml exec server npm run seed

# App: http://localhost:5173
# API: http://localhost:3001
# Admin: http://localhost:5173/ctrl-panel
```

## Production Deployment

### Prerequisites
- Docker + Docker Compose v2
- Domain with DNS configured
- SSL certificate (Let's Encrypt recommended)
- (Optional) OpenAI API key for AI blog generation
- (Optional) Google Books API key for book imports
- (Optional) SMTP credentials for email features

### Step 1: Configure Environment

```bash
cp .env.example .env
```

**Required** variables:
| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Random 64-char string for JWT signing |
| `ADMIN_PASSWORD` | Strong admin password |
| `MYSQL_PASSWORD` | Database password |
| `MYSQL_ROOT_PASSWORD` | MySQL root password |
| `FRONTEND_URL` | Your domain (e.g., `https://bookdiscovery.com`) |

### Step 2: Deploy

```bash
docker compose -f docker-compose.prod.yml up -d
```

### Step 3: Initialize Database

```bash
docker compose -f docker-compose.prod.yml exec server npm run seed
```

### Step 4: Enable SSL

1. Obtain SSL certificates (e.g., via certbot)
2. Mount certificates in `docker-compose.prod.yml`
3. Uncomment SSL lines in `app/nginx.conf`
4. Restart: `docker compose -f docker-compose.prod.yml restart app`

---

## Backup & Recovery

### Automated Backups
```bash
# Add to crontab: daily at 2 AM
0 2 * * * /path/to/scripts/backup.sh >> /var/log/backup.log 2>&1
```

### Manual Backup
```bash
docker compose exec mysql mysqldump -u bookdiscovery -p bookdiscovery | gzip > backup.sql.gz
```

### Restore
```bash
./scripts/restore.sh backup.sql.gz
```

---

## Admin Panel

Access at: `https://your-domain.com/ctrl-panel`  
Default credentials: Set via `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars.

### Admin Features
- **Dashboard**: Overview stats, user management
- **Books**: CRUD, cover upload, category assignment
- **Authors**: Profile management, book linking
- **Categories**: Taxonomy management
- **Blog**: Post editor, AI generation, featured books
- **Reviews**: Moderation, approval queue
- **Analytics**: Traffic, affiliate tracking, Web Vitals
- **Campaigns**: Email marketing, templates, bulk send
- **Newsletter**: Subscriber management
- **Settings**: Site config, SMTP, SEO, maintenance mode
- **Import**: Google Books import, job history

---

## API Endpoints

### Public
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check (includes DB probe) |
| GET | `/api/books` | List books (paginated, filterable) |
| GET | `/api/books/:slug` | Book detail |
| GET | `/api/books/search-suggestions` | Autocomplete search |
| GET | `/api/books/trending` | Trending books |
| GET | `/api/books/top-rated` | Top rated books |
| GET | `/api/books/new-releases` | New releases |
| GET | `/api/categories` | All categories |
| GET | `/api/authors` | All authors |
| GET | `/api/blog` | Blog posts |
| GET | `/api/testimonials` | Testimonials |
| POST | `/api/newsletter/subscribe` | Newsletter signup |
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/login` | User login |

### Authenticated
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/wishlist` | User wishlist |
| POST | `/api/wishlist/:bookId` | Add to wishlist |
| POST | `/api/reviews` | Submit review |

### Admin
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/dashboard` | Admin dashboard data |
| POST | `/api/blog/generate-ai` | Trigger AI blog post |
| GET | `/api/blog/ai-status` | AI configuration status |
| POST | `/api/import/run` | Trigger book import |

---

## Monitoring

### Health Check
```bash
curl http://localhost:3001/api/health
# Returns: { status, services: { database }, uptime, memory }
```

### Logs
Structured JSON logs via Pino. Control verbosity with `LOG_LEVEL` env var.

```bash
# View logs
docker compose logs -f server

# Filter errors only
docker compose logs server | grep '"level":50'
```

### Key Metrics to Monitor
- Health endpoint response (503 = DB down)
- Memory usage (RSS, heap)
- API response times (via pino-http)
- Error rate (level >= 50 in logs)
- MySQL connection pool usage

---

## Data Retention

Analytics data is automatically purged by the data retention cron job:

| Table | Default Retention |
|-------|-------------------|
| `analytics_events` | 90 days |
| `page_views` | 90 days |
| `web_vitals` | 30 days |
| `ai_email_log` | 180 days |

Configure via environment variables: `RETENTION_ANALYTICS_DAYS`, `RETENTION_PAGEVIEWS_DAYS`, etc.

---

## Troubleshooting

### MySQL connection refused on startup
The server retries MySQL connection 10 times with exponential backoff. If it still fails:
```bash
docker compose logs mysql  # Check MySQL is healthy
docker compose restart server
```

### AI blog generation not working
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/blog/ai-status
```
Check: `openai.configured`, `openai.connected`, `cron.enabled`

### Score recalculation slow
Runs every 2 hours automatically. For manual trigger:
```bash
curl -X POST -H "Authorization: Bearer <token>" http://localhost:3001/api/admin/recalculate-scores
```
