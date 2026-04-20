import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import sharp from 'sharp';
import { authenticate, requireAdmin, rateLimit } from '../middleware.js';
import { dbAll, dbGet, dbRun } from '../database.js';
import { logger } from '../lib/logger.js';

const router = Router();

const VALID_IMAGE_TYPES = new Set(['cover_front', 'cover_back', 'spine', 'sample_page', 'author_signed']);
const UPLOADS_DIR = path.resolve(process.cwd(), 'data', 'uploads', 'covers');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
  },
});

function normalizeText(value: unknown, max = 255) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function mapImage(row: any) {
  return {
    id: row.id,
    url: row.image_url,
    type: row.image_type,
    altText: row.alt_text || null,
    displayOrder: Number(row.display_order || 0),
  };
}

// GET /api/books/:id/images
router.get('/books/:id/images', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const book = await dbGet<any>(
      'SELECT id, title, cover_image FROM books WHERE id = ? OR slug = ? LIMIT 1',
      [id, id],
    );

    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const rows = await dbAll<any>(
      `SELECT id, image_url, image_type, alt_text, display_order
       FROM book_images
       WHERE book_id = ?
       ORDER BY display_order ASC, created_at ASC`,
      [book.id],
    );

    if (rows.length === 0) {
      res.json({
        images: [
          {
            id: 'main-cover',
            url: book.cover_image,
            type: 'cover_front',
            altText: `${book.title} cover`,
            displayOrder: 0,
          },
        ],
      });
      return;
    }

    res.json({ images: rows.map(mapImage) });
  } catch (err: any) {
    logger.error({ err }, 'Get book images error');
    res.status(500).json({ error: 'Failed to fetch book images' });
  }
});

// POST /api/admin/books/:id/images
router.post(
  '/admin/books/:id/images',
  authenticate,
  requireAdmin,
  rateLimit('admin-cover-gallery-upload', 120, 60 * 60 * 1000),
  upload.single('image'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const imageType = normalizeText(req.body?.imageType, 50) || 'cover_front';
      const altText = normalizeText(req.body?.altText, 255);
      const displayOrderRaw = Number(req.body?.displayOrder ?? 0);
      const displayOrder = Number.isFinite(displayOrderRaw) ? Math.max(0, Math.floor(displayOrderRaw)) : 0;
      const imageUrlInput = normalizeText(req.body?.imageUrl, 500);

      if (!VALID_IMAGE_TYPES.has(imageType)) {
        res.status(400).json({ error: 'imageType is invalid' });
        return;
      }

      const book = await dbGet<any>('SELECT id, title FROM books WHERE id = ? OR slug = ? LIMIT 1', [id, id]);
      if (!book) {
        res.status(404).json({ error: 'Book not found' });
        return;
      }

      let imageUrl = imageUrlInput;

      if (req.file) {
        const fileId = uuidv4();
        const filename = `${fileId}_gallery.webp`;
        const outputPath = path.join(UPLOADS_DIR, filename);

        await sharp(req.file.buffer)
          .resize(1400, 2100, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 90 })
          .toFile(outputPath);

        imageUrl = `/uploads/covers/${filename}`;
      }

      if (!imageUrl) {
        res.status(400).json({ error: 'Provide either image file or imageUrl' });
        return;
      }

      if (!/^(https?:\/\/|\/uploads\/)/.test(imageUrl)) {
        res.status(400).json({ error: 'imageUrl must be a valid URL or uploaded path' });
        return;
      }

      const imageId = uuidv4();
      await dbRun(
        `INSERT INTO book_images (id, book_id, image_url, image_type, display_order, alt_text)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [imageId, book.id, imageUrl, imageType, displayOrder, altText || null],
      );

      const created = await dbGet<any>(
        'SELECT id, image_url, image_type, alt_text, display_order FROM book_images WHERE id = ? LIMIT 1',
        [imageId],
      );

      res.status(201).json({ image: mapImage(created) });
    } catch (err: any) {
      logger.error({ err }, 'Upload gallery image error');
      res.status(500).json({ error: 'Failed to upload gallery image' });
    }
  },
);

// DELETE /api/admin/books/:id/images/:imageId
router.delete('/admin/books/:id/images/:imageId', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id, imageId } = req.params;

    const book = await dbGet<any>('SELECT id FROM books WHERE id = ? OR slug = ? LIMIT 1', [id, id]);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const existing = await dbGet<any>(
      'SELECT id, image_url FROM book_images WHERE id = ? AND book_id = ? LIMIT 1',
      [imageId, book.id],
    );
    if (!existing) {
      res.status(404).json({ error: 'Image not found for book' });
      return;
    }

    await dbRun('DELETE FROM book_images WHERE id = ? AND book_id = ?', [imageId, book.id]);

    if (typeof existing.image_url === 'string' && existing.image_url.startsWith('/uploads/covers/')) {
      const localPath = path.resolve(process.cwd(), 'data', existing.image_url.replace(/^\/uploads\//, 'uploads/'));
      if (fs.existsSync(localPath)) {
        try { fs.unlinkSync(localPath); } catch { /* ignore cleanup errors */ }
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, 'Delete gallery image error');
    res.status(500).json({ error: 'Failed to delete gallery image' });
  }
});

export default router;
