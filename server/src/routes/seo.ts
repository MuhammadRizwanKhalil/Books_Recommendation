import { Router, Request, Response } from 'express';
import { dbGet, dbAll } from '../database.js';
import { logger } from '../lib/logger.js';
import { config } from '../config.js';

const router = Router();

// ── Robots.txt ──────────────────────────────────────────────────────────────
router.get('/robots.txt', async (_req: Request, res: Response) => {
  try {
  const siteUrl = config.frontendUrl;
  // Read admin URL slug dynamically from settings
  const adminSlug = (await dbGet<any>("SELECT value FROM site_settings WHERE `key` = 'admin_url_slug'", []))?.value || 'ctrl-panel';
  res.type('text/plain').send(`# BookDiscovery Robots.txt
User-agent: *
Allow: /
Disallow: /${adminSlug}
Disallow: /api/admin
Disallow: /api/import
Disallow: /api/auth

# Sitemaps
Sitemap: ${siteUrl}/sitemap.xml
Sitemap: ${siteUrl}/sitemap-books.xml
Sitemap: ${siteUrl}/sitemap-categories.xml
Sitemap: ${siteUrl}/sitemap-authors.xml
Sitemap: ${siteUrl}/sitemap-blog.xml

# Crawl-delay
Crawl-delay: 1
`);
  } catch (err: any) {
    logger.error({ err: err }, 'Robots.txt error');
    res.status(500).type('text/plain').send('User-agent: *\nAllow: /');
  }
});

// ── Main Sitemap Index ──────────────────────────────────────────────────────
router.get('/sitemap.xml', (_req: Request, res: Response) => {
  const siteUrl = config.frontendUrl;
  const now = new Date().toISOString().split('T')[0];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${siteUrl}/sitemap-pages.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${siteUrl}/sitemap-books.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${siteUrl}/sitemap-categories.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${siteUrl}/sitemap-blog.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${siteUrl}/sitemap-authors.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
</sitemapindex>`;

  res.set('Content-Type', 'application/xml');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(xml);
});

// ── Static Pages Sitemap ────────────────────────────────────────────────────
router.get('/sitemap-pages.xml', (_req: Request, res: Response) => {
  const siteUrl = config.frontendUrl;
  const now = new Date().toISOString().split('T')[0];

  const pages = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    { path: '/#trending', priority: '0.8', changefreq: 'daily' },
    { path: '/#categories', priority: '0.8', changefreq: 'weekly' },
    { path: '/#new-releases', priority: '0.8', changefreq: 'daily' },
    { path: '/#top-rated', priority: '0.8', changefreq: 'weekly' },
    { path: '/#blog', priority: '0.7', changefreq: 'weekly' },
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p => `  <url>
    <loc>${siteUrl}${p.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  res.set('Content-Type', 'application/xml');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(xml);
});

// ── Books Sitemap ───────────────────────────────────────────────────────────
router.get('/sitemap-books.xml', async (_req: Request, res: Response) => {
  try {
    const siteUrl = config.frontendUrl;
    const books = await dbAll<any>(`
      SELECT slug, updated_at, cover_image, title FROM books 
      WHERE status = 'PUBLISHED' AND is_active = 1 
      ORDER BY computed_score DESC 
      LIMIT 5000
    `, []);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${books.map(b => `  <url>
    <loc>${siteUrl}/book/${b.slug}</loc>
    <lastmod>${b.updated_at ? b.updated_at.split('T')[0] : new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>${b.cover_image ? `
    <image:image>
      <image:loc>${escapeXml(b.cover_image)}</image:loc>
      <image:title>${escapeXml(b.title)}</image:title>
    </image:image>` : ''}
  </url>`).join('\n')}
</urlset>`;

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (err) {
    logger.error({ err: err }, 'Sitemap books error');
    res.status(500).send('');
  }
});

// ── Categories Sitemap ──────────────────────────────────────────────────────
router.get('/sitemap-categories.xml', async (_req: Request, res: Response) => {
  try {
    const siteUrl = config.frontendUrl;
    const categories = await dbAll<any>(`
      SELECT slug, updated_at FROM categories WHERE book_count > 0 ORDER BY book_count DESC
    `, []);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${categories.map(c => `  <url>
    <loc>${siteUrl}/categories/${c.slug}</loc>
    <lastmod>${c.updated_at ? c.updated_at.split('T')[0] : new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`).join('\n')}
</urlset>`;

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (err) {
    res.status(500).send('');
  }
});

// ── Blog Sitemap ────────────────────────────────────────────────────────────
router.get('/sitemap-blog.xml', async (_req: Request, res: Response) => {
  try {
    const siteUrl = config.frontendUrl;
    const posts = await dbAll<any>(`
      SELECT slug, updated_at, featured_image, title FROM blog_posts 
      WHERE status = 'PUBLISHED' 
      ORDER BY published_at DESC 
      LIMIT 1000
    `, []);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${posts.map(p => `  <url>
    <loc>${siteUrl}/blog/${p.slug}</loc>
    <lastmod>${p.updated_at ? p.updated_at.split('T')[0] : new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>${p.featured_image ? `
    <image:image>
      <image:loc>${escapeXml(p.featured_image)}</image:loc>
      <image:title>${escapeXml(p.title)}</image:title>
    </image:image>` : ''}
  </url>`).join('\n')}
</urlset>`;

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (err) {
    res.status(500).send('');
  }
});

// ── Authors Sitemap ─────────────────────────────────────────────────────────
router.get('/sitemap-authors.xml', async (_req: Request, res: Response) => {
  try {
    const siteUrl = config.frontendUrl;
    const authors = await dbAll<any>(`
      SELECT a.slug, a.updated_at, a.image_url, a.name
      FROM authors a
      INNER JOIN books b ON b.author_id = a.id AND b.status = 'PUBLISHED' AND b.is_active = 1
      GROUP BY a.id
      HAVING COUNT(b.id) >= 1
      ORDER BY COUNT(b.id) DESC
      LIMIT 2000
    `, []);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${authors.map(a => `  <url>
    <loc>${siteUrl}/author/${a.slug}</loc>
    <lastmod>${a.updated_at ? a.updated_at.split('T')[0] : new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>${a.image_url ? `
    <image:image>
      <image:loc>${escapeXml(a.image_url)}</image:loc>
      <image:title>${escapeXml(a.name)}</image:title>
    </image:image>` : ''}
  </url>`).join('\n')}
</urlset>`;

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (err) {
    logger.error({ err: err }, 'Sitemap authors error');
    res.status(500).send('');
  }
});

// ── JSON-LD Structured Data API ─────────────────────────────────────────────

// Get JSON-LD for a specific author
router.get('/api/seo/author/:slug', async (req: Request, res: Response) => {
  try {
    const author = await dbGet<any>(`
      SELECT a.*, COUNT(b.id) as book_count, ROUND(AVG(b.google_rating), 1) as avg_rating
      FROM authors a
      LEFT JOIN books b ON b.author_id = a.id AND b.status = 'PUBLISHED' AND b.is_active = 1
      WHERE a.slug = ?
      GROUP BY a.id
    `, [req.params.slug]);

    if (!author) {
      res.status(404).json({ error: 'Author not found' });
      return;
    }

    const siteUrl = config.frontendUrl;

    // Get author's books for the JSON-LD
    const books = await dbAll<any>(`
      SELECT title, slug, cover_image, isbn13, published_date
      FROM books WHERE author_id = ? AND status = 'PUBLISHED' AND is_active = 1
      ORDER BY computed_score DESC LIMIT 20
    `, [author.id]);

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: author.name,
      url: `${siteUrl}/author/${author.slug}`,
      ...(author.image_url && { image: author.image_url }),
      ...(author.bio && { description: author.bio }),
      ...(author.website_url && { sameAs: [author.website_url] }),
      ...(books.length > 0 && {
        mainEntityOfPage: {
          '@type': 'CollectionPage',
          name: `Books by ${author.name}`,
          url: `${siteUrl}/author/${author.slug}`,
        },
        workExample: books.map(b => ({
          '@type': 'Book',
          name: b.title,
          url: `${siteUrl}/book/${b.slug}`,
          ...(b.cover_image && { image: b.cover_image }),
          ...(b.isbn13 && { isbn: b.isbn13 }),
          ...(b.published_date && { datePublished: b.published_date }),
        })),
      }),
      ...(author.avg_rating && {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: author.avg_rating,
          bestRating: 5,
          reviewCount: author.book_count,
        },
      }),
    };

    res.set('Cache-Control', 'public, max-age=3600');
    res.json(jsonLd);
  } catch (err) {
    logger.error({ err: err }, 'Author JSON-LD error');
    res.status(500).json({ error: 'Failed to generate structured data' });
  }
});

// Get JSON-LD for a specific book
router.get('/api/seo/book/:slug', async (req: Request, res: Response) => {
  try {
    const book = await dbGet<any>(`
      SELECT b.*, GROUP_CONCAT(c.name SEPARATOR ', ') as category_names
      FROM books b 
      LEFT JOIN book_categories bc ON bc.book_id = b.id
      LEFT JOIN categories c ON c.id = bc.category_id
      WHERE b.slug = ? AND b.status = 'PUBLISHED'
      GROUP BY b.id
    `, [req.params.slug]);

    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const siteUrl = config.frontendUrl;
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Book',
      name: book.title,
      ...(book.subtitle && { alternativeHeadline: book.subtitle }),
      author: {
        '@type': 'Person',
        name: book.author,
      },
      description: book.description || `${book.title} by ${book.author}`,
      image: book.cover_image,
      url: `${siteUrl}/book/${book.slug}`,
      ...(book.isbn13 && { isbn: book.isbn13 }),
      ...(book.isbn10 && { identifier: { '@type': 'PropertyValue', propertyID: 'ISBN-10', value: book.isbn10 } }),
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
    };

    res.set('Cache-Control', 'public, max-age=3600');
    res.json(jsonLd);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate structured data' });
  }
});

// Get JSON-LD for the homepage (WebSite + Organization + SearchAction)
router.get('/api/seo/homepage', async (_req: Request, res: Response) => {
  const siteUrl = config.frontendUrl;
  
  // Load site settings
  let siteName = 'BookDiscovery';
  let siteDescription = 'Discover your next great read with AI-powered book recommendations.';
  let contactEmail = 'hello@bookdiscovery.com';
  
  try {
    const settings = await dbAll<any>('SELECT `key`, value FROM site_settings WHERE `key` IN (?, ?, ?)', ['site_name', 'site_description', 'contact_email']);
    for (const s of settings) {
      if (s.key === 'site_name' && s.value) siteName = s.value;
      if (s.key === 'site_description' && s.value) siteDescription = s.value;
      if (s.key === 'contact_email' && s.value) contactEmail = s.value;
    }
  } catch {}

  // Get total book count for dataset
  let totalBooks = 0;
  try {
    totalBooks = (await dbGet<any>("SELECT COUNT(*) as c FROM books WHERE status='PUBLISHED' AND is_active=1", [])).c;
  } catch {}

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: siteName,
      url: siteUrl,
      description: siteDescription,
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${siteUrl}/?search={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: siteName,
      url: siteUrl,
      description: siteDescription,
      email: contactEmail,
      ...(totalBooks > 0 && {
        dataset: {
          '@type': 'Dataset',
          name: `${siteName} Book Catalog`,
          description: `A curated catalog of ${totalBooks.toLocaleString()} books across multiple genres`,
          size: `${totalBooks} books`,
        },
      }),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `${siteName} - AI-Powered Book Recommendations`,
      description: siteDescription,
      url: siteUrl,
      mainEntity: {
        '@type': 'ItemList',
        name: 'Trending Books',
        numberOfItems: 8,
        itemListOrder: 'https://schema.org/ItemListOrderDescending',
      },
    },
  ];

  res.set('Cache-Control', 'public, max-age=1800');
  res.json(jsonLd);
});

// ── Utility ─────────────────────────────────────────────────────────────────
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default router;
