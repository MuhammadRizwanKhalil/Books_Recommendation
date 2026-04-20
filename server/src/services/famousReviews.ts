/**
 * Famous Reviews Service — AI-powered critic/editorial quote fetcher.
 *
 * Uses OpenAI to find and format well-known critical reviews for books.
 * Stores results in the famous_reviews table for caching.
 *
 * Design:
 *  - Each book can have multiple famous reviews (1 per reviewer/publication pair)
 *  - Reviews are fetched once and cached — not re-fetched unless manually triggered
 *  - Uses structured JSON output from GPT to ensure consistent format
 *  - Includes source attribution for authenticity
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../lib/logger.js';
import { dbAll, dbGet, dbRun } from '../database.js';
import { chatCompletion } from './openai.js';
import { submitAndWaitForBatch, submitBatch, getBatchStatus, getBatchResults, type BatchRequest, type BatchResult } from './openAIBatch.js';

// ── Types ───────────────────────────────────────────────────────────────────

export interface FamousReview {
  id: string;
  book_id: string;
  reviewer_name: string;
  publication: string | null;
  quote_text: string;
  source_url: string | null;
  ai_model: string | null;
  created_at: string;
}

interface AIReviewQuote {
  reviewer_name: string;
  publication: string;
  quote: string;
  source_url: string | null;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Get cached famous reviews for a book.
 */
export async function getFamousReviews(bookId: string): Promise<FamousReview[]> {
  return dbAll<FamousReview>(
    'SELECT * FROM famous_reviews WHERE book_id = ? ORDER BY created_at ASC',
    [bookId],
  );
}

/**
 * Fetch famous reviews for a book using AI, then store them.
 * Skips if reviews already exist (use force=true to re-fetch).
 */
export async function fetchFamousReviews(
  bookId: string,
  options?: { force?: boolean },
): Promise<{ fetched: number; skipped: boolean }> {
  // Check existing
  const existing = await dbAll<FamousReview>(
    'SELECT id FROM famous_reviews WHERE book_id = ?',
    [bookId],
  );

  if (existing.length > 0 && !options?.force) {
    return { fetched: 0, skipped: true };
  }

  // Get book details for the prompt
  const book = await dbGet<{
    id: string;
    title: string;
    author: string;
    isbn10: string | null;
    isbn13: string | null;
    published_date: string | null;
    publisher: string | null;
  }>(
    'SELECT id, title, author, isbn10, isbn13, published_date, publisher FROM books WHERE id = ?',
    [bookId],
  );

  if (!book) {
    throw new Error(`Book not found: ${bookId}`);
  }

  // If force, delete existing reviews first
  if (options?.force && existing.length > 0) {
    await dbRun('DELETE FROM famous_reviews WHERE book_id = ?', [bookId]);
  }

  // Ask AI for famous reviews
  const quotes = await fetchReviewsFromAI(book);

  // Store in database
  let fetched = 0;
  for (const quote of quotes) {
    try {
      await dbRun(
        `INSERT IGNORE INTO famous_reviews (id, book_id, reviewer_name, publication, quote_text, source_url, ai_model)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          bookId,
          quote.reviewer_name,
          quote.publication,
          quote.quote,
          quote.source_url,
          'gpt-4o-mini',
        ],
      );
      fetched++;
    } catch (err: any) {
      // Duplicate key = already exists, skip
      logger.debug(`Skipping duplicate review for ${book.title}: ${quote.reviewer_name}`);
    }
  }

  return { fetched, skipped: false };
}

/**
 * Batch-fetch famous reviews for multiple books.
 * Respects rate limits, processes sequentially.
 */
export async function batchFetchFamousReviews(
  bookIds: string[],
  onProgress?: (msg: string) => void,
): Promise<{ processed: number; fetched: number; skipped: number; errors: number }> {
  let processed = 0;
  let totalFetched = 0;
  let skipped = 0;
  let errors = 0;

  for (const bookId of bookIds) {
    try {
      const result = await fetchFamousReviews(bookId);
      if (result.skipped) {
        skipped++;
      } else {
        totalFetched += result.fetched;
      }
      processed++;
      onProgress?.(`[${processed}/${bookIds.length}] Processed book ${bookId}: ${result.fetched} reviews`);
    } catch (err: any) {
      errors++;
      onProgress?.(`[${processed + 1}/${bookIds.length}] Error for ${bookId}: ${err.message}`);
      processed++;
    }

    // Rate limit: wait between books
    if (processed < bookIds.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return { processed, fetched: totalFetched, skipped, errors };
}

/**
 * Batch-fetch famous reviews for top books that don't have any yet.
 */
export async function fetchReviewsForTopBooks(
  limit: number = 50,
  onProgress?: (msg: string) => void,
): Promise<{ processed: number; fetched: number; skipped: number; errors: number }> {
  const books = await dbAll<{ id: string }>(
    `SELECT b.id FROM books b
     LEFT JOIN famous_reviews fr ON fr.book_id = b.id
     WHERE b.is_active = 1 AND b.status = 'PUBLISHED'
       AND fr.id IS NULL
     ORDER BY b.computed_score DESC, b.ratings_count DESC
     LIMIT ?`,
    [limit],
  );

  onProgress?.(`Found ${books.length} books without famous reviews`);
  return batchFetchFamousReviews(books.map(b => b.id), onProgress);
}

// ── AI Integration ──────────────────────────────────────────────────────────

async function fetchReviewsFromAI(book: {
  title: string;
  author: string;
  isbn10: string | null;
  isbn13: string | null;
  published_date: string | null;
  publisher: string | null;
}): Promise<AIReviewQuote[]> {
  const bookInfo = [
    `Title: ${book.title}`,
    `Author: ${book.author}`,
    book.isbn13 ? `ISBN-13: ${book.isbn13}` : null,
    book.isbn10 ? `ISBN-10: ${book.isbn10}` : null,
    book.published_date ? `Published: ${book.published_date}` : null,
    book.publisher ? `Publisher: ${book.publisher}` : null,
  ].filter(Boolean).join('\n');

  const result = await chatCompletion([
    {
      role: 'system',
      content: `You are a literary research assistant that finds famous critical reviews and editorial quotes about books.

Your task is to find REAL, AUTHENTIC critical reviews from well-known publications and reviewers. 
Only include quotes that you are confident are real and attributable.

Rules:
- Only include quotes from real, verifiable publications (New York Times, Publishers Weekly, Kirkus Reviews, The Guardian, Washington Post, NPR, Library Journal, Booklist, etc.)
- Only include quotes from real, named reviewers when possible
- Each quote should be a direct excerpt — the most memorable or impactful line from the review
- Keep quotes concise (1-3 sentences max)
- If the book is not well-known enough to have famous reviews, return an empty array
- NEVER fabricate quotes. If unsure, return fewer results or an empty array
- Include the source URL if you know it (null if unsure)

Respond with a JSON array only. No markdown, no explanation.`,
    },
    {
      role: 'user',
      content: `Find famous critical reviews for this book:

${bookInfo}

Return a JSON array of objects with these fields:
- reviewer_name: string (Name of the reviewer or "Staff" if a publication editorial)
- publication: string (Name of the publication)
- quote: string (The exact quote excerpt from the review)
- source_url: string | null (URL to the original review, null if unknown)

Return up to 5 quotes. If the book is obscure or you're not confident, return [] (empty array).`,
    },
  ], {
    temperature: 0.3, // Low temperature for factual accuracy
    maxTokens: 1500,
  });

  try {
    // Parse the JSON response, stripping any markdown code fences
    let content = result.content.trim();
    if (content.startsWith('```')) {
      content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const parsed = JSON.parse(content);

    if (!Array.isArray(parsed)) return [];

    // Validate and sanitize each quote
    return parsed
      .filter((q: any) =>
        q &&
        typeof q.reviewer_name === 'string' &&
        typeof q.publication === 'string' &&
        typeof q.quote === 'string' &&
        q.reviewer_name.length > 0 &&
        q.publication.length > 0 &&
        q.quote.length > 10, // Reject very short "quotes"
      )
      .slice(0, 5) // Max 5 per book
      .map((q: any) => ({
        reviewer_name: q.reviewer_name.slice(0, 255),
        publication: q.publication.slice(0, 255),
        quote: q.quote.slice(0, 2000),
        source_url: typeof q.source_url === 'string' && q.source_url.startsWith('http')
          ? q.source_url.slice(0, 500)
          : null,
      }));
  } catch (err) {
    logger.warn(`Failed to parse AI review response for "${book.title}": ${err}`);
    return [];
  }
}

// ── Batch API Mode (50% Cost Savings) ───────────────────────────────────────

/**
 * Build the system prompt used for famous review requests.
 */
function getReviewSystemPrompt(): string {
  return `You are a literary research assistant that finds famous critical reviews and editorial quotes about books.

Your task is to find REAL, AUTHENTIC critical reviews from well-known publications and reviewers. 
Only include quotes that you are confident are real and attributable.

Rules:
- Only include quotes from real, verifiable publications (New York Times, Publishers Weekly, Kirkus Reviews, The Guardian, Washington Post, NPR, Library Journal, Booklist, etc.)
- Only include quotes from real, named reviewers when possible
- Each quote should be a direct excerpt — the most memorable or impactful line from the review
- Keep quotes concise (1-3 sentences max)
- If the book is not well-known enough to have famous reviews, return an empty array
- NEVER fabricate quotes. If unsure, return fewer results or an empty array
- Include the source URL if you know it (null if unsure)

Respond with a JSON array only. No markdown, no explanation.`;
}

/**
 * Build the user prompt for a specific book.
 */
function getReviewUserPrompt(book: {
  title: string;
  author: string;
  isbn10: string | null;
  isbn13: string | null;
  published_date: string | null;
  publisher: string | null;
}): string {
  const bookInfo = [
    `Title: ${book.title}`,
    `Author: ${book.author}`,
    book.isbn13 ? `ISBN-13: ${book.isbn13}` : null,
    book.isbn10 ? `ISBN-10: ${book.isbn10}` : null,
    book.published_date ? `Published: ${book.published_date}` : null,
    book.publisher ? `Publisher: ${book.publisher}` : null,
  ].filter(Boolean).join('\n');

  return `Find famous critical reviews for this book:

${bookInfo}

Return a JSON array of objects with these fields:
- reviewer_name: string (Name of the reviewer or "Staff" if a publication editorial)
- publication: string (Name of the publication)
- quote: string (The exact quote excerpt from the review)
- source_url: string | null (URL to the original review, null if unknown)

Return up to 5 quotes. If the book is obscure or you're not confident, return [] (empty array).`;
}

/**
 * Parse a batch API result into review quotes.
 */
function parseReviewBatchResult(content: string): AIReviewQuote[] {
  try {
    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((q: any) =>
        q &&
        typeof q.reviewer_name === 'string' &&
        typeof q.publication === 'string' &&
        typeof q.quote === 'string' &&
        q.reviewer_name.length > 0 &&
        q.publication.length > 0 &&
        q.quote.length > 10,
      )
      .slice(0, 5)
      .map((q: any) => ({
        reviewer_name: q.reviewer_name.slice(0, 255),
        publication: q.publication.slice(0, 255),
        quote: q.quote.slice(0, 2000),
        source_url: typeof q.source_url === 'string' && q.source_url.startsWith('http')
          ? q.source_url.slice(0, 500)
          : null,
      }));
  } catch {
    return [];
  }
}

/**
 * Submit a batch of famous review requests via OpenAI Batch API.
 * Returns a batch ID for polling. Costs 50% less than individual calls.
 *
 * Use getBatchReviewStatus() to check progress and
 * processBatchReviewResults() to store results when complete.
 */
export async function submitBatchFamousReviews(
  bookIds: string[],
  options?: { force?: boolean },
): Promise<{ batchId: string; submitted: number; skipped: number }> {
  const requests: BatchRequest[] = [];
  let skipped = 0;

  for (const bookId of bookIds) {
    // Skip books that already have reviews (unless force)
    if (!options?.force) {
      const existing = await dbGet<any>(
        'SELECT id FROM famous_reviews WHERE book_id = ? LIMIT 1',
        [bookId],
      );
      if (existing) {
        skipped++;
        continue;
      }
    }

    const book = await dbGet<{
      id: string; title: string; author: string;
      isbn10: string | null; isbn13: string | null;
      published_date: string | null; publisher: string | null;
    }>(
      'SELECT id, title, author, isbn10, isbn13, published_date, publisher FROM books WHERE id = ?',
      [bookId],
    );

    if (!book) continue;

    requests.push({
      customId: `review_${bookId}`,
      messages: [
        { role: 'system', content: getReviewSystemPrompt() },
        { role: 'user', content: getReviewUserPrompt(book) },
      ],
      temperature: 0.3,
      maxTokens: 1500,
    });
  }

  if (requests.length === 0) {
    throw new Error('No books to process — all already have reviews or were not found');
  }

  const batchId = await submitBatch(requests, {
    type: 'famous_reviews',
    book_count: String(requests.length),
  });

  // Store batch job reference for tracking
  await dbRun(
    `INSERT INTO ai_batch_jobs (id, batch_id, job_type, total_requests, status, created_at)
     VALUES (?, ?, 'famous_reviews', ?, 'submitted', NOW())`,
    [uuidv4(), batchId, requests.length],
  ).catch(() => {
    // Table might not exist yet — that's OK, we log it
    logger.warn('ai_batch_jobs table not found — batch tracking skipped');
  });

  logger.info(`📦 Submitted batch famous reviews: ${requests.length} books (batch: ${batchId})`);
  return { batchId, submitted: requests.length, skipped };
}

/**
 * Check status of a batch review job.
 */
export async function getBatchReviewStatus(batchId: string) {
  return getBatchStatus(batchId);
}

/**
 * Process completed batch review results — parse and store in the database.
 */
export async function processBatchReviewResults(
  batchId: string,
): Promise<{ processed: number; stored: number; failed: number }> {
  const results = await getBatchResults(batchId);

  let processed = 0;
  let stored = 0;
  let failed = 0;

  for (const result of results) {
    processed++;
    const bookId = result.customId.replace('review_', '');

    if (!result.success || !result.content) {
      failed++;
      logger.warn(`Batch review failed for book ${bookId}: ${result.error}`);
      continue;
    }

    const quotes = parseReviewBatchResult(result.content);

    // Delete existing reviews if re-fetching
    await dbRun('DELETE FROM famous_reviews WHERE book_id = ?', [bookId]);

    for (const quote of quotes) {
      try {
        await dbRun(
          `INSERT IGNORE INTO famous_reviews (id, book_id, reviewer_name, publication, quote_text, source_url, ai_model)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            bookId,
            quote.reviewer_name,
            quote.publication,
            quote.quote,
            quote.source_url,
            'gpt-4o-mini-batch',
          ],
        );
        stored++;
      } catch {
        // Duplicate — skip
      }
    }
  }

  // Update batch job record
  await dbRun(
    `UPDATE ai_batch_jobs SET status = 'completed', processed = ?, \`stored\` = ?, failed = ?, completed_at = NOW()
     WHERE batch_id = ?`,
    [processed, stored, failed, batchId],
  ).catch(() => {});

  logger.info(`📦 Batch reviews processed: ${processed} books, ${stored} reviews stored, ${failed} failed`);
  return { processed, stored, failed };
}

/**
 * Batch-fetch reviews using Batch API for top books (cost-effective).
 * Submits the batch and optionally waits for completion.
 */
export async function batchFetchFamousReviewsViaBatchAPI(
  limit: number = 50,
  options?: { wait?: boolean; onProgress?: (msg: string) => void },
): Promise<{ batchId: string; submitted: number } | { batchId: string; processed: number; stored: number; failed: number }> {
  const books = await dbAll<{ id: string }>(
    `SELECT b.id FROM books b
     LEFT JOIN famous_reviews fr ON fr.book_id = b.id
     WHERE b.is_active = 1 AND b.status = 'PUBLISHED'
       AND fr.id IS NULL
     ORDER BY b.computed_score DESC, b.ratings_count DESC
     LIMIT ?`,
    [limit],
  );

  if (books.length === 0) {
    throw new Error('No books found without famous reviews');
  }

  options?.onProgress?.(`Found ${books.length} books without reviews — submitting batch`);

  const { batchId, submitted } = await submitBatchFamousReviews(books.map(b => b.id));

  if (!options?.wait) {
    return { batchId, submitted };
  }

  // Wait for completion with polling
  options?.onProgress?.(`Batch ${batchId} submitted (${submitted} requests) — waiting for completion...`);

  const results = await submitAndWaitForBatch(
    [], // Not used — we already submitted
    {
      pollIntervalMs: 30_000,
      timeoutMs: 4 * 60 * 60 * 1000,
      onProgress: (status) => {
        options?.onProgress?.(`Batch ${status.batchId}: ${status.completedRequests}/${status.totalRequests} completed`);
      },
    },
  ).catch(async () => {
    // If submitAndWaitForBatch fails because we passed empty requests,
    // fall back to manual polling
    return null;
  });

  // Process results
  const processResult = await processBatchReviewResults(batchId);
  return { batchId, ...processResult };
}
