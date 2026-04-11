/**
 * Image Proxy & Optimization Route
 * 
 * Proxies external images (Google Books, Unsplash) through our server with:
 * - Width/height resize parameters
 * - Quality control
 * - Format negotiation (WebP, AVIF based on Accept header)
 * - Aggressive caching (1 year for immutable URLs)
 * - Fallback to original if processing fails
 * 
 * Usage: /api/image?url=<encoded_url>&w=400&h=600&q=80
 */

import { Router, Request, Response } from 'express';
import { rateLimit } from '../middleware.js';
import { logger } from '../lib/logger.js';

const router = Router();

// Allowed image source domains (security: prevent SSRF)
const ALLOWED_DOMAINS = [
  'books.google.com',
  'books.googleusercontent.com',
  'images.unsplash.com',
  'images-na.ssl-images-amazon.com',
  'm.media-amazon.com',
  'covers.openlibrary.org',
  'i.gr-assets.com',
];

function isAllowedDomain(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    return ALLOWED_DOMAINS.some(d => u.hostname === d || u.hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

// ── Image proxy endpoint ────────────────────────────────────────────────────
router.get('/image', rateLimit('image-proxy', 60, 60 * 1000), async (req: Request, res: Response) => {
  const imageUrl = req.query.url as string;
  const width = Math.min(Math.max(parseInt(req.query.w as string) || 0, 0), 2400);
  const height = Math.min(Math.max(parseInt(req.query.h as string) || 0, 0), 2400);
  const quality = Math.min(Math.max(parseInt(req.query.q as string) || 80, 10), 100);

  if (!imageUrl) {
    res.status(400).json({ error: 'Missing url parameter' });
    return;
  }

  if (!isAllowedDomain(imageUrl)) {
    res.status(403).json({ error: 'Domain not allowed' });
    return;
  }

  try {
    // Determine best output format from Accept header
    const accept = req.headers.accept || '';
    let format = 'jpeg';
    let contentType = 'image/jpeg';
    
    if (accept.includes('image/avif')) {
      format = 'avif';
      contentType = 'image/avif';
    } else if (accept.includes('image/webp')) {
      format = 'webp';
      contentType = 'image/webp';
    }

    // Fetch the original image
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'TheBookTimes/1.0 Image Proxy',
        'Accept': 'image/*',
      },
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      res.status(response.status).json({ error: 'Failed to fetch image' });
      return;
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Try to use sharp for optimization if available
    let outputBuffer = buffer;
    let outputContentType = response.headers.get('content-type') || contentType;

    try {
      const sharp = (await import('sharp')).default;
      let pipeline = sharp(buffer);

      // Resize if dimensions specified
      if (width > 0 || height > 0) {
        pipeline = pipeline.resize(width || undefined, height || undefined, {
          fit: 'cover',
          withoutEnlargement: true,
        });
      }

      // Convert format
      switch (format) {
        case 'avif':
          pipeline = pipeline.avif({ quality, effort: 4 });
          outputContentType = 'image/avif';
          break;
        case 'webp':
          pipeline = pipeline.webp({ quality, effort: 4 });
          outputContentType = 'image/webp';
          break;
        default:
          pipeline = pipeline.jpeg({ quality, progressive: true });
          outputContentType = 'image/jpeg';
          break;
      }

      outputBuffer = await pipeline.toBuffer();
    } catch {
      // sharp not available — serve original unprocessed
      // This is fine for development; in production, install sharp
    }

    // Set aggressive caching headers
    res.set({
      'Content-Type': outputContentType,
      'Content-Length': String(outputBuffer.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Vary': 'Accept',
      'X-Image-Optimized': format,
    });

    res.send(outputBuffer);
  } catch (err: any) {
    logger.error({ err: err.message }, 'Image proxy error');
    res.status(500).json({ error: 'Image processing failed' });
  }
});

export default router;
