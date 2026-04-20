import { v4 as uuidv4 } from 'uuid';
import { dbAll, dbRun } from '../database.js';
import { logger } from '../lib/logger.js';

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeIsbn(value?: string | null): string {
  return String(value || '').replace(/[^0-9X]/gi, '').toUpperCase();
}

export async function detectMentionedBookIds(content: string): Promise<string[]> {
  const cleanContent = stripHtml(content || '');
  const loweredContent = cleanContent.toLowerCase();
  const compactContent = normalizeIsbn(cleanContent);

  const books = await dbAll<any>(
    `SELECT id, title, isbn10, isbn13
     FROM books
     WHERE status = 'PUBLISHED' AND is_active = 1
       AND (title IS NOT NULL OR isbn10 IS NOT NULL OR isbn13 IS NOT NULL)`,
  );

  const matches: string[] = [];

  for (const book of books) {
    const title = String(book.title || '').trim();
    const isbn10 = normalizeIsbn(book.isbn10);
    const isbn13 = normalizeIsbn(book.isbn13);

    let matched = false;

    if (title.length >= 4) {
      const titlePattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(title.toLowerCase())}([^a-z0-9]|$)`, 'i');
      matched = titlePattern.test(loweredContent);
    }

    if (!matched && isbn10 && compactContent.includes(isbn10)) matched = true;
    if (!matched && isbn13 && compactContent.includes(isbn13)) matched = true;

    if (matched) {
      matches.push(book.id);
      if (matches.length >= 25) break;
    }
  }

  return matches;
}

export async function syncBlogBookMentions(postId: string, content: string, manualBookIds: string[] = [], isPublished = true): Promise<void> {
  try {
    await dbRun('DELETE FROM blog_book_mentions WHERE blog_post_id = ?', [postId]);

    const uniqueManualBookIds = [...new Set((manualBookIds || []).filter(Boolean))];

    for (const bookId of uniqueManualBookIds) {
      await dbRun(
        'INSERT IGNORE INTO blog_book_mentions (id, blog_post_id, book_id, is_auto_detected) VALUES (?, ?, ?, FALSE)',
        [uuidv4(), postId, bookId],
      );
    }

    if (!isPublished || !content?.trim()) {
      return;
    }

    const autoDetectedBookIds = await detectMentionedBookIds(content);
    for (const bookId of autoDetectedBookIds) {
      if (uniqueManualBookIds.includes(bookId)) continue;
      await dbRun(
        'INSERT IGNORE INTO blog_book_mentions (id, blog_post_id, book_id, is_auto_detected) VALUES (?, ?, ?, TRUE)',
        [uuidv4(), postId, bookId],
      );
    }
  } catch (err) {
    logger.error({ err, postId }, 'Failed to sync blog book mentions');
  }
}
