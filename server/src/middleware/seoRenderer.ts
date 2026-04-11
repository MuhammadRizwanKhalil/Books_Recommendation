/**
 * SEO Renderer Middleware
 * 
 * Intercepts page requests in production and injects dynamic meta tags,
 * Open Graph data, Twitter cards, and JSON-LD structured data into the
 * HTML template before serving it. This ensures that:
 * 
 * 1. Social media crawlers (Facebook, Twitter, LinkedIn) see correct
 *    titles, descriptions, and images for every page
 * 2. Search engine crawlers get proper meta tags on first load
 * 3. Google rich snippets work via JSON-LD structured data
 * 
 * Works in tandem with the client-side `useSEO` hook which handles
 * dynamic updates during SPA navigation.
 */

import { Request, Response, NextFunction } from 'express';
import path from 'path';
import { logger } from '../lib/logger.js';
import fs from 'fs';
import { dbGet, dbAll } from '../database.js';
import { config } from '../config.js';

// ── Types ──────────────────────────────────────────────────────────────────

interface PageMeta {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogType: string;
  ogUrl: string;
  canonical: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  extraTags?: string;
}

// ── Defaults ───────────────────────────────────────────────────────────────

const SITE_NAME = 'The Book Times';
const DEFAULT_DESCRIPTION = 'Discover your next great read with AI-powered book recommendations. Explore 50,000+ books across every genre with personalized suggestions, ratings, and reviews.';
const DEFAULT_OG_IMAGE = '/og-image.png';

function getSiteUrl(): string {
  return config.frontendUrl.replace(/\/$/, '');
}

// ── Escape helpers ─────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function truncate(str: string, len: number): string {
  if (!str) return '';
  if (str.length <= len) return str;
  return str.slice(0, len - 3).trim() + '...';
}

// ── Page-specific meta fetchers ────────────────────────────────────────────

async function getHomeMeta(): Promise<PageMeta> {
  const siteUrl = getSiteUrl();
  let siteName = SITE_NAME;
  let siteDesc = DEFAULT_DESCRIPTION;
  try {
    const settings = await dbAll<any>("SELECT `key`, value FROM site_settings WHERE `key` IN ('site_name', 'site_description')", []);
    for (const s of settings) {
      if (s.key === 'site_name' && s.value) siteName = s.value;
      if (s.key === 'site_description' && s.value) siteDesc = s.value;
    }
  } catch {}

  let bookCount = 0;
  try {
    bookCount = (await dbGet<any>("SELECT COUNT(*) as c FROM books WHERE status='PUBLISHED' AND is_active=1", []))?.c || 0;
  } catch {}

  return {
    title: `${siteName} - AI-Powered Book Recommendations | Discover Your Next Great Read`,
    description: siteDesc,
    ogTitle: `${siteName} - AI-Powered Book Recommendations`,
    ogDescription: siteDesc,
    ogImage: `${siteUrl}${DEFAULT_OG_IMAGE}`,
    ogType: 'website',
    ogUrl: siteUrl,
    canonical: siteUrl,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: siteName,
        url: siteUrl,
        description: siteDesc,
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${siteUrl}/search?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: siteName,
        url: siteUrl,
        description: 'AI-powered book discovery and recommendation platform',
      },
      ...(bookCount > 0 ? [{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `${siteName} - Book Catalog`,
        description: `Discover from ${bookCount.toLocaleString()} curated books`,
        url: siteUrl,
      }] : []),
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'How does The Book Times recommend books?',
            acceptedAnswer: { '@type': 'Answer', text: 'The Book Times uses AI-powered algorithms that analyze your reading preferences, ratings, and browsing behavior to suggest personalized book recommendations across 50,000+ titles.' },
          },
          {
            '@type': 'Question',
            name: 'Is The Book Times free to use?',
            acceptedAnswer: { '@type': 'Answer', text: 'Yes! The Book Times is completely free to browse, search, and get book recommendations. You can create an account to save wishlists, write reviews, and get personalized suggestions.' },
          },
          {
            '@type': 'Question',
            name: 'What genres are available on The Book Times?',
            acceptedAnswer: { '@type': 'Answer', text: 'The Book Times covers every major genre including Fiction, Non-Fiction, Science Fiction, Fantasy, Mystery, Romance, Self-Help, Technology, Biography, History, and many more.' },
          },
          {
            '@type': 'Question',
            name: 'How can I write a book review?',
            acceptedAnswer: { '@type': 'Answer', text: 'Create a free account on The Book Times, navigate to any book page, and click the Write a Review button. You can rate the book from 1-5 stars and share your thoughts.' },
          },
          {
            '@type': 'Question',
            name: 'Can I buy books through The Book Times?',
            acceptedAnswer: { '@type': 'Answer', text: 'The Book Times provides convenient links to purchase books on Amazon. When you find a book you love, simply click the Buy on Amazon button to purchase it.' },
          },
        ],
      },
    ],
  };
}

async function getBookMeta(slug: string): Promise<PageMeta | null> {
  const siteUrl = getSiteUrl();
  try {
    const book = await dbGet<any>(`
      SELECT b.*, GROUP_CONCAT(c.name SEPARATOR ', ') as category_names
      FROM books b 
      LEFT JOIN book_categories bc ON bc.book_id = b.id
      LEFT JOIN categories c ON c.id = bc.category_id
      WHERE b.slug = ? AND b.status = 'PUBLISHED'
      GROUP BY b.id
    `, [slug]);

    if (!book) return null;

    const title = book.meta_title || `${book.title} by ${book.author} | ${SITE_NAME}`;
    const description = book.meta_description || truncate(
      `Read ${book.title} by ${book.author}. ${book.description || ''}`, 160
    );
    const pageUrl = `${siteUrl}/book/${slug}`;
    const ogImageUrl = book.og_image || book.cover_image || `${siteUrl}${DEFAULT_OG_IMAGE}`;
    const canonicalUrl = book.canonical_url || pageUrl;
    const robots = book.seo_robots || 'index, follow';

    const meta: any = {
      title,
      description,
      ogTitle: book.title,
      ogDescription: `${book.title} by ${book.author}${book.google_rating ? ` — Rating: ${book.google_rating}/5` : ''}`,
      ogImage: ogImageUrl,
      ogType: 'book',
      ogUrl: pageUrl,
      canonical: canonicalUrl,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Book',
        name: book.title,
        ...(book.subtitle && { alternativeHeadline: book.subtitle }),
        author: { '@type': 'Person', name: book.author },
        description: book.description || description,
        image: book.cover_image,
        url: pageUrl,
        ...(book.isbn13 && { isbn: book.isbn13 }),
        ...(book.publisher && { publisher: { '@type': 'Organization', name: book.publisher } }),
        ...(book.published_date && { datePublished: book.published_date }),
        ...(book.page_count && { numberOfPages: book.page_count }),
        inLanguage: book.language || 'en',
        ...(book.category_names && { genre: book.category_names.split(', ') }),
        ...(book.google_rating && {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: book.google_rating,
            bestRating: 5,
            worstRating: 1,
            ratingCount: book.ratings_count || 0,
          },
        }),
        ...(book.price && {
          offers: {
            '@type': 'Offer',
            price: book.price,
            priceCurrency: book.currency || 'USD',
            availability: 'https://schema.org/InStock',
            ...(book.amazon_url && { url: book.amazon_url }),
          },
        }),
      },
      extraTags: [
        robots !== 'index, follow' ? `<meta name="robots" content="${escapeHtml(robots)}" />` : '',
        book.isbn13 ? `<meta property="book:isbn" content="${escapeHtml(book.isbn13)}" />` : '',
        book.author ? `<meta property="book:author" content="${escapeHtml(book.author)}" />` : '',
      ].filter(Boolean).join('\n    '),
    };

    // Enrich with user review structured data
    try {
      const reviews = await dbAll<any>(`
        SELECT r.rating, r.title, r.content, r.created_at, u.name as user_name
        FROM reviews r
        LEFT JOIN users u ON u.id = r.user_id
        WHERE r.book_id = ? AND r.is_approved = 1
        ORDER BY r.helpful_count DESC, r.created_at DESC
        LIMIT 10
      `, [book.id]);

      if (reviews.length > 0) {
        meta.jsonLd.review = reviews.map((r: any) => ({
          '@type': 'Review',
          author: { '@type': 'Person', name: r.user_name || 'Anonymous' },
          reviewRating: {
            '@type': 'Rating',
            ratingValue: r.rating,
            bestRating: 5,
            worstRating: 1,
          },
          name: r.title || `Review of ${book.title}`,
          reviewBody: truncate(r.content, 500),
          datePublished: r.created_at,
        }));

        // Also include user review stats in aggregateRating if present
        const reviewStats = await dbGet<any>(`
          SELECT AVG(rating) as avg_rating, COUNT(*) as total
          FROM reviews WHERE book_id = ? AND is_approved = 1
        `, [book.id]);

        if (reviewStats?.total > 0 && meta.jsonLd.aggregateRating) {
          meta.jsonLd.aggregateRating.reviewCount = reviewStats.total;
        }
      }
    } catch {
      // Reviews enrichment is best-effort
    }

    // Add BreadcrumbList schema alongside the Book schema
    const breadcrumbJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        ...(book.category_names ? [{
          '@type': 'ListItem',
          position: 2,
          name: book.category_names.split(', ')[0],
          item: `${siteUrl}/category/${book.category_names.split(', ')[0].toLowerCase().replace(/\s+/g, '-')}`,
        }] : []),
        {
          '@type': 'ListItem',
          position: book.category_names ? 3 : 2,
          name: book.title,
        },
      ],
    };

    meta.jsonLd = [meta.jsonLd, breadcrumbJsonLd];

    return meta;
  } catch (err) {
    logger.error({ err: err }, 'SEO: Error fetching book meta');
    return null;
  }
}

async function getCategoryMeta(slug: string): Promise<PageMeta | null> {
  const siteUrl = getSiteUrl();
  try {
    const cat = await dbGet<any>(`
      SELECT c.*, COUNT(bc.book_id) as book_count 
      FROM categories c 
      LEFT JOIN book_categories bc ON bc.category_id = c.id 
      WHERE c.slug = ?
      GROUP BY c.id
    `, [slug]);

    if (!cat) return null;

    const title = cat.meta_title || `${cat.name} Books | ${SITE_NAME}`;
    const description = cat.meta_description || truncate(
      `Browse ${cat.book_count || ''} ${cat.name} books. ${cat.description || `Discover the best ${cat.name} books with reviews and ratings.`}`, 160
    );
    const pageUrl = `${siteUrl}/category/${slug}`;

    return {
      title,
      description,
      ogTitle: `${cat.name} Books`,
      ogDescription: description,
      ogImage: cat.image_url || `${siteUrl}${DEFAULT_OG_IMAGE}`,
      ogType: 'website',
      ogUrl: pageUrl,
      canonical: pageUrl,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `${cat.name} Books`,
        description,
        url: pageUrl,
        mainEntity: {
          '@type': 'ItemList',
          name: `${cat.name} Books`,
          numberOfItems: cat.book_count || 0,
        },
      },
    };
  } catch (err) {
    logger.error({ err: err }, 'SEO: Error fetching category meta');
    return null;
  }
}

async function getBlogPostMeta(slug: string): Promise<PageMeta | null> {
  const siteUrl = getSiteUrl();
  try {
    const post = await dbGet<any>(`
      SELECT * FROM blog_posts 
      WHERE slug = ? AND status = 'PUBLISHED'
    `, [slug]);

    if (!post) return null;

    const title = post.meta_title || `${post.title} | ${SITE_NAME} Blog`;
    const description = post.meta_description || truncate(post.excerpt || post.content || '', 160);
    const pageUrl = post.canonical_url || `${siteUrl}/blog/${slug}`;
    const ogImage = post.og_image || post.featured_image || `${siteUrl}${DEFAULT_OG_IMAGE}`;

    const extraTagsArr = [
      post.published_at ? `<meta property="article:published_time" content="${escapeHtml(post.published_at)}" />` : '',
      post.updated_at ? `<meta property="article:modified_time" content="${escapeHtml(post.updated_at)}" />` : '',
      `<meta property="article:author" content="${SITE_NAME}" />`,
      `<meta property="article:section" content="${escapeHtml(post.category || 'Books')}" />`,
    ];
    // Add robots directive if non-default
    if (post.seo_robots && post.seo_robots !== 'index, follow') {
      extraTagsArr.push(`<meta name="robots" content="${escapeHtml(post.seo_robots)}" />`);
    }
    // Add focus keyword as meta keywords
    if (post.focus_keyword) {
      extraTagsArr.push(`<meta name="keywords" content="${escapeHtml(post.focus_keyword)}" />`);
    }
    // Add tags as article:tag
    if (post.tags) {
      let tagsStr = post.tags;
      if (typeof tagsStr === 'string' && tagsStr.startsWith('[')) {
        try { const parsed = JSON.parse(tagsStr); if (Array.isArray(parsed)) tagsStr = parsed.join(', '); } catch { /* use as-is */ }
      }
      tagsStr.split(',').filter((t: string) => t.trim()).forEach((tag: string) => {
        extraTagsArr.push(`<meta property="article:tag" content="${escapeHtml(tag.trim())}" />`);
      });
    }

    return {
      title,
      description,
      ogTitle: post.title,
      ogDescription: description,
      ogImage,
      ogType: 'article',
      ogUrl: pageUrl,
      canonical: pageUrl,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description,
        image: ogImage,
        datePublished: post.published_at || post.created_at,
        dateModified: post.updated_at || post.created_at,
        author: { '@type': 'Organization', name: SITE_NAME },
        publisher: { '@type': 'Organization', name: SITE_NAME },
        mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
        ...(post.focus_keyword ? { keywords: post.focus_keyword } : {}),
        ...(post.category ? { articleSection: post.category } : {}),
      },
      extraTags: extraTagsArr.filter(Boolean).join('\n    '),
    };
  } catch (err) {
    logger.error({ err: err }, 'SEO: Error fetching blog post meta');
    return null;
  }
}

async function getBlogMeta(): Promise<PageMeta> {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/blog`;

  let totalPosts = 0;
  try {
    totalPosts = (await dbGet<any>("SELECT COUNT(*) as c FROM blog_posts WHERE status='PUBLISHED'", []))?.c || 0;
  } catch {}

  return {
    title: `Blog | ${SITE_NAME} - Reading Lists, Reviews & Literary Insights`,
    description: `Explore reading lists, book reviews, and literary insights on the ${SITE_NAME} blog.${totalPosts > 0 ? ` Browse ${totalPosts} articles.` : ''}`,
    ogTitle: `${SITE_NAME} Blog - Reading Lists & Literary Insights`,
    ogDescription: `Discover curated reading lists, in-depth book reviews, and literary insights from ${SITE_NAME}.`,
    ogImage: `${siteUrl}${DEFAULT_OG_IMAGE}`,
    ogType: 'website',
    ogUrl: pageUrl,
    canonical: pageUrl,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: `${SITE_NAME} Blog`,
      description: 'Reading lists, book reviews, and literary insights',
      url: pageUrl,
      publisher: { '@type': 'Organization', name: SITE_NAME },
    },
  };
}

function getSearchMeta(query?: string): PageMeta {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/search${query ? `?q=${encodeURIComponent(query)}` : ''}`;

  return {
    title: query ? `Search: "${query}" | ${SITE_NAME}` : `Search Books | ${SITE_NAME}`,
    description: query
      ? `Search results for "${query}" on ${SITE_NAME}. Find books by title, author, or keyword.`
      : `Search 50,000+ books by title, author, or keyword. Filter by category, rating, and more.`,
    ogTitle: query ? `Search: "${query}"` : `Search Books`,
    ogDescription: `Find books on ${SITE_NAME}. Search by title, author, or keyword.`,
    ogImage: `${siteUrl}${DEFAULT_OG_IMAGE}`,
    ogType: 'website',
    ogUrl: pageUrl,
    canonical: pageUrl,
  };
}

// ── HTML Injection ─────────────────────────────────────────────────────────

function injectMeta(html: string, meta: PageMeta): string {
  // Replace <title>
  html = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${escapeHtml(meta.title)}</title>`
  );

  // Replace meta description
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`
  );

  // Replace OG tags
  const ogReplacements: Record<string, string> = {
    'og:title': meta.ogTitle,
    'og:description': meta.ogDescription,
    'og:image': meta.ogImage,
    'og:type': meta.ogType,
    'og:url': meta.ogUrl,
  };

  for (const [prop, content] of Object.entries(ogReplacements)) {
    const regex = new RegExp(`<meta\\s+property="${prop}"\\s+content="[^"]*"\\s*/?>`, 'g');
    html = html.replace(regex, `<meta property="${prop}" content="${escapeHtml(content)}" />`);
  }

  // Replace Twitter card tags
  html = html.replace(
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/,
    `<meta name="twitter:title" content="${escapeHtml(meta.ogTitle)}" />`
  );
  html = html.replace(
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="twitter:description" content="${escapeHtml(meta.ogDescription)}" />`
  );
  html = html.replace(
    /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/,
    `<meta name="twitter:image" content="${escapeHtml(meta.ogImage)}" />`
  );

  // Replace canonical URL
  html = html.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`
  );

  // Replace static JSON-LD with dynamic ones
  // Remove all existing <script type="application/ld+json"> blocks
  html = html.replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/g, '');

  // Inject new JSON-LD + extra tags before </head>
  if (meta.jsonLd) {
    const items = Array.isArray(meta.jsonLd) ? meta.jsonLd : [meta.jsonLd];
    const jsonLdScripts = items.map(item =>
      `<script type="application/ld+json">${JSON.stringify(item)}</script>`
    ).join('\n    ');

    html = html.replace(
      '</head>',
      `    ${jsonLdScripts}\n    ${meta.extraTags || ''}\n  </head>`
    );
  } else if (meta.extraTags) {
    html = html.replace('</head>', `    ${meta.extraTags}\n  </head>`);
  }

  return html;
}

// ── Route matcher ──────────────────────────────────────────────────────────

async function getMetaForPath(pathname: string, query?: string): Promise<PageMeta | null> {
  // Homepage
  if (pathname === '/' || pathname === '') {
    return await getHomeMeta();
  }

  // Book detail: /book/:slug
  const bookMatch = pathname.match(/^\/book\/([^/]+)$/);
  if (bookMatch) {
    return await getBookMeta(bookMatch[1]);
  }

  // Category: /category/:slug
  const catMatch = pathname.match(/^\/category\/([^/]+)$/);
  if (catMatch) {
    return await getCategoryMeta(catMatch[1]);
  }

  // Blog post: /blog/:slug
  const blogPostMatch = pathname.match(/^\/blog\/([^/]+)$/);
  if (blogPostMatch) {
    return await getBlogPostMeta(blogPostMatch[1]);
  }

  // Blog listing: /blog
  if (pathname === '/blog') {
    return await getBlogMeta();
  }

  // Search: /search
  if (pathname === '/search') {
    return getSearchMeta(query);
  }

  // Default for other pages (legal, etc.) — use home meta
  return await getHomeMeta();
}

// ── Middleware Factory ──────────────────────────────────────────────────────

/**
 * Creates an Express middleware that:
 * 1. Serves static files from the built frontend directory
 * 2. For page routes (non-API, non-static), reads index.html and injects
 *    route-specific meta tags, OG data, and JSON-LD structured data
 * 
 * @param distPath - Absolute path to the frontend build output (e.g., app/dist)
 */
export function createSeoRenderer(distPath: string) {
  // Read the HTML template once at startup
  const indexPath = path.join(distPath, 'index.html');
  let htmlTemplate = '';

  try {
    htmlTemplate = fs.readFileSync(indexPath, 'utf-8');
    logger.info({ data: indexPath }, '📄 SEO Renderer: HTML template loaded from');
  } catch (err) {
    logger.warn({ data: indexPath }, '⚠️  SEO Renderer: Could not read index.html from');
    logger.warn('   Build the frontend first: cd app && npm run build');
  }

  // ── LRU Cache for rendered HTML (avoids hitting DB on every request) ──
  const SEO_CACHE_MAX = 500;   // max entries
  const SEO_CACHE_TTL = 60_000; // 60 seconds
  const cache = new Map<string, { html: string; expiry: number }>();

  function getCached(key: string): string | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      cache.delete(key);
      return null;
    }
    return entry.html;
  }

  function setCache(key: string, html: string): void {
    // Evict oldest entries if at capacity
    if (cache.size >= SEO_CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, { html, expiry: Date.now() + SEO_CACHE_TTL });
  }

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip API routes and static assets
    if (
      req.path.startsWith('/api/') ||
      req.path === '/robots.txt' ||
      req.path.startsWith('/sitemap') ||
      req.path.includes('.')  // Static file (has extension)
    ) {
      return next();
    }

    // If we don't have the template, fall through
    if (!htmlTemplate) {
      return next();
    }

    try {
      const cacheKey = `${req.path}|${req.query.q || ''}`;

      // Check cache first
      const cached = getCached(cacheKey);
      if (cached) {
        res.set('Content-Type', 'text/html');
        res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
        res.set('X-SEO-Cache', 'HIT');
        res.send(cached);
        return;
      }

      const meta = await getMetaForPath(req.path, req.query.q as string);
      if (!meta) {
        // Page not found — still serve the SPA and let React handle 404
        res.send(htmlTemplate);
        return;
      }

      const html = injectMeta(htmlTemplate, meta);

      // Store in cache
      setCache(cacheKey, html);

      res.set('Content-Type', 'text/html');
      res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      res.set('X-SEO-Cache', 'MISS');
      res.send(html);
    } catch (err) {
      logger.error({ err: err }, 'SEO Renderer error');
      // Fallback: serve unmodified template
      res.set('Content-Type', 'text/html');
      res.send(htmlTemplate);
    }
  };
}
