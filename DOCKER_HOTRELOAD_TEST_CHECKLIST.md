# Docker Hot-Reload Test Checklist

**Status**: ✅ All containers running and healthy  
**App URL**: http://localhost:53073  
**Server URL**: http://localhost:53001/api  
**Database**: localhost:53308 (MySQL)  

---

## Pre-Flight Checks ✓

- [✓] MySQL container healthy (port 53308)
- [✓] Server container healthy (port 53001)  
- [✓] App container running (port 53073)
- [✓] All volumes mounted (src, public, database)
- [✓] Hot-reload config enabled (CHOKIDAR_USEPOLLING=true)

---

## Recent Feature Testing

### 1. Navigation Redesign (Browse▾ + Community▾)
- [ ] Navigate to http://localhost:53073
- [ ] Hover over "Browse" dropdown
  - [ ] Shows: Trending, Categories, New Releases, Top Rated, Mood Discovery
  - [ ] Each item has icon, title, description
- [ ] Hover over "Community" dropdown
  - [ ] Shows: Activity Feed, Book Clubs, Giveaways, Community Lists
- [ ] Click "Blog" (direct link)
  - [ ] Navigates to /blog

### 2. Search Algorithm (Professional - 3+ chars, 60% fuzzy threshold)
- [ ] Navigate to /search
- [ ] Type "a" → shows "Search term too short" message
- [ ] Type "ab" → blocked (< 3 characters)
- [ ] Type "har" → blocked (< 3 characters)
- [ ] Type "harry" → shows "Harry Potter" results ✓
- [ ] Type "harri" → shows Potter books (fuzzy matching at 60% threshold)
- [ ] Type "hp" → blocked
- [ ] Search dropdown (home page):
  - [ ] Type "z" → no results shown
  - [ ] Type "the" → shows relevant books

### 3. Global Scroll-to-Top on Route Changes
- [ ] Navigate to any blog post (click from blog list)
  - [ ] Page loads → automatically scrolls to top
  - [ ] No manual scroll needed
- [ ] Navigate to book detail → verify scroll to top
- [ ] Navigate to category page → verify scroll to top
- [ ] Click back button → verify scroll behavior
- [ ] Use breadcrumb navigation → verify scroll to top

### 4. Header Padding & No Overlap Issues (12 Pages Fixed)
Check these pages have proper top padding (no content hidden under header):
- [ ] /blog (Blog List Page)
- [ ] /blog/:slug (Blog Post Page)
- [ ] /year-in-books/:year (Year in Books)
- [ ] /search (Search Page)
- [ ] /book/:slug (Book Detail)
- [ ] /category/:slug (Category Page)
- [ ] /author/:slug (Author Page)
- [ ] /trending (Trending Page)
- [ ] /admin/* (Admin Pages)
- [ ] /discover/mood/:mood (Mood Discovery)
- [ ] /reading-lists (Reading Lists)
- [ ] /tbrqueue (TBR Queue)

**Expected**: All page content starts below header, no hidden sections

---

## Hot-Reload Verification

### Live Code Change Test
1. Open browser DevTools Console (F12)
2. Make a visible change:
   - Edit `app/src/sections/Navigation.tsx`
   - Change "Browse" text to "Browse Now" temporarily
3. Save file (Ctrl+S)
4. **Expected**: Browser auto-refreshes within 2-3 seconds
5. Verify change visible without manual refresh
6. Revert the change

### Backend Hot-Reload Test
1. Edit `server/src/routes/books.ts` (small cosmetic change in comment)
2. Save file
3. Check server logs: `docker logs thebooktimes-server-local -f`
4. Server should detect file change and auto-reload (tsx watch mode)

---

## API Endpoints Verification

### Search Endpoints
- [ ] GET `/api/books/search?q=harry` → Returns books (curl or Postman)
- [ ] GET `/api/books/search?q=ab` → Returns 400 or empty (< 3 chars)
- [ ] GET `/api/books/search-suggestions?q=har` → Empty (< 3 chars)
- [ ] GET `/api/books/search-suggestions?q=harry` → Suggests "Harry Potter"

### Health Check
- [ ] GET `http://localhost:53001/api/health` → Returns { ok: true }

---

## Browser DevTools Checks

### Console
- [ ] No critical errors (warnings OK)
- [ ] No "CORS" errors
- [ ] No "404" 404s for static assets

### Network
- [ ] All API calls to `http://localhost:53001/api` successful (200/201)
- [ ] CSS/JS files loading from app container
- [ ] No failed image loads

### Application
- [ ] localStorage/sessionStorage working
- [ ] Cookies set correctly (JWT token visible if logged in)

---

## Mobile Responsiveness (375px viewport)
- [ ] Hamburger menu appears on mobile
- [ ] Navigation dropdowns work on touch
- [ ] Content readable (no horizontal scroll)
- [ ] Buttons/links clickable

---

## Admin Access
1. Navigate to http://localhost:53073/admin/login
2. Login credentials:
   - Email: `admin@thebooktimes.com`
   - Password: `admin123456`
3. [ ] Login successful
4. [ ] Dashboard loads
5. [ ] Can navigate admin pages

---

## Performance Baseline

- [ ] Home page load time < 3 seconds
- [ ] Search response time < 1 second
- [ ] Navigation dropdown hover < 200ms perceived latency
- [ ] No layout shifts during page load (Cumulative Layout Shift)

---

## Troubleshooting

### App shows 404 or can't connect
```bash
docker logs thebooktimes-app-local -f
docker logs thebooktimes-server-local -f
```

### Changes not hot-reloading
```bash
# Verify volume mounts
docker inspect thebooktimes-app-local | grep -A 5 'Mounts'

# Check file permissions
ls -la app/src/
```

### Database not seeded
```bash
# Check migrations ran
docker logs thebooktimes-server-local 2>&1 | grep "Migration"

# Verify admin user exists
docker exec thebooktimes-mysql-local mysql -uthebooktimes -pthebooktimes thebooktimes -e "SELECT COUNT(*) FROM users WHERE email='admin@thebooktimes.com';"
```

---

## Test Results Summary

| Test | Status | Notes |
|------|--------|-------|
| Navigation dropdowns | ⏳ | Pending |
| Search 3-char validation | ⏳ | Pending |
| Scroll-to-top behavior | ⏳ | Pending |
| Header padding (12 pages) | ⏳ | Pending |
| Frontend hot-reload | ⏳ | Pending |
| Backend hot-reload | ⏳ | Pending |
| API endpoints | ⏳ | Pending |
| Admin login | ⏳ | Pending |
| Mobile responsive | ⏳ | Pending |

---

**Generated**: 2026-04-15  
**Containers**: All running and healthy  
**Docker Compose**: `docker-compose.local-noconflict.yml`  
**Next Step**: Run through test checklist manually in browser at http://localhost:53073
