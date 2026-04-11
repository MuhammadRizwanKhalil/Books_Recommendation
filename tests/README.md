# TheBookTimes — Test Suite

## Structure

```
tests/
├── playwright.config.ts     # Playwright config
├── vitest.config.ts         # API test config
├── package.json             # Test dependencies
│
├── e2e/                     # Playwright E2E tests (live site)
│   ├── homepage.spec.ts     # Homepage layout, sections, SEO
│   ├── book-detail.spec.ts  # Book detail page
│   ├── search.spec.ts       # Search functionality
│   ├── blog.spec.ts         # Blog listing + detail pages
│   ├── auth.spec.ts         # Login/register flows
│   └── responsive.spec.ts   # Mobile/tablet/desktop
│
└── api/                     # Vitest API tests (REST)
    ├── books.test.ts        # Books API endpoints
    ├── blog.test.ts         # Blog API endpoints
    ├── auth.test.ts         # Auth endpoints
    └── settings.test.ts     # Settings, analytics, caching
```

## Setup

```bash
cd tests
npm install
npm run install:browsers   # installs Playwright browsers
```

## Running Tests

```bash
# Run all API tests
npm run test:api

# Run all E2E tests (headless)
npm run test:e2e

# Run E2E with browser UI visible
npm run test:e2e:headed

# Open Playwright interactive UI
npm run test:e2e:ui

# Run everything
npm run test:all
```

## Environment Variables

Create a `.env` file in the `tests/` directory:

```env
API_URL=https://thebooktimes.com/api
BASE_URL=https://thebooktimes.com
ADMIN_EMAIL=rizwankhalil87@gmail.com
ADMIN_PASSWORD=your_admin_password
```

## Test Coverage Summary

### E2E Tests (Playwright)
| File | Coverage |
|------|----------|
| homepage.spec.ts | Title, hero, search, sections, nav, SEO, stats |
| book-detail.spec.ts | Title, author, cover, rating, Amazon link, SEO, navigation |
| search.spec.ts | Input, dropdown, results, navigation |
| blog.spec.ts | Listing, detail, featured image, SEO, navigation |
| auth.spec.ts | Sign in modal, form fields, error states, close |
| responsive.spec.ts | Mobile (375px), tablet (768px), desktop (1440px) |

### API Tests (Vitest)
| File | Coverage |
|------|----------|
| books.test.ts | trending, top-rated, new-releases, :slug, book-of-the-day, authors, categories, rate limiting |
| blog.test.ts | GET list, GET :slug, POST (auth), AI status |
| auth.test.ts | login success/fail, register validation, protected routes |
| settings.test.ts | settings, public-stats, testimonials, caching headers, CORS, error handling |
