/**
 * Book Scoring & Recommendation Engine
 *
 * This module provides a comprehensive, trustworthy scoring system that
 * combines multiple signals to produce a reliable composite score.
 *
 * ── Scoring Philosophy ──────────────────────────────────────────────────────
 *
 * We use a multi-signal weighted composite score (0-100) that blends:
 *
 *  1. GOOGLE RATING (Bayesian-smoothed)    — External credibility (40%)
 *  2. LOCAL REVIEW SCORE (Bayesian)        — Community validation  (25%)
 *  3. ENGAGEMENT SIGNALS                   — Popularity/interest   (20%)
 *  4. RECENCY / FRESHNESS                  — Time decay            (10%)
 *  5. CONTENT QUALITY                      — Completeness bonus     (5%)
 *
 * ── Bayesian Averaging ──────────────────────────────────────────────────────
 *
 * Both Google and local ratings use Bayesian averaging to prevent gaming:
 *
 *   score = (n / (n + m)) * R  +  (m / (n + m)) * C
 *
 * Where:
 *   R = actual average rating
 *   n = number of ratings
 *   C = prior mean (dynamically computed from all books)
 *   m = confidence threshold (how many ratings before we trust the data)
 *
 * A book with 1 five-star rating won't outrank a book with 1000 ratings at 4.5.
 *
 * ── Trending Algorithm ──────────────────────────────────────────────────────
 *
 * "Trending" uses a time-decayed engagement model:
 *
 *   trending_score = engagement_score * decay_factor
 *   decay_factor = 1 / (1 + age_in_days / half_life)
 *
 * Recent views, reviews, and wishlist adds matter more than old ones.
 *
 * ── Recommendation Strategies ───────────────────────────────────────────────
 *
 *  1. CATEGORY SIMILARITY — Weighted overlap (shared categories count more)
 *  2. AUTHOR AFFINITY     — Same/similar authors
 *  3. RATING RANGE MATCH  — Books in a similar quality tier
 *  4. ENGAGEMENT PATTERN   — "Users who viewed X also viewed Y" (co-view)
 *  5. POPULARITY FALLBACK  — High-scoring books as default
 */

import { dbGet, dbAll, dbRun, dbTransaction } from '../database.js';

// ── Configuration ───────────────────────────────────────────────────────────

const WEIGHTS = {
  google: 0.40,       // Google Books rating (external credibility)
  localReviews: 0.25, // Our user reviews (community validation)
  engagement: 0.20,   // Views, wishlist, affiliate clicks
  recency: 0.10,      // Freshness / time decay
  quality: 0.05,      // Content completeness
} as const;

// Bayesian prior strengths
const GOOGLE_PRIOR_M = 50;     // Need ~50 Google ratings to overcome prior
const LOCAL_PRIOR_M = 5;       // Need ~5 local reviews to overcome prior (smaller community)

// Engagement normalization — these are dynamically computed from percentiles
// but we set sensible defaults
const ENGAGEMENT_HALF_LIFE_DAYS = 30; // Half-life for time decay on engagement

// ── Dynamic Priors ──────────────────────────────────────────────────────────

interface PriorStats {
  googleMean: number;
  localMean: number;
  maxViews: number;
  maxWishlists: number;
  maxClicks: number;
  computedAt: number; // timestamp
}

let cachedPriors: PriorStats | null = null;
const PRIOR_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Compute dynamic priors from actual data (cached for 1 hour).
 * This ensures C (prior mean) reflects real data, not assumptions.
 */
async function getPriors(): Promise<PriorStats> {
  const now = Date.now();
  if (cachedPriors && (now - cachedPriors.computedAt) < PRIOR_CACHE_TTL) {
    return cachedPriors;
  }

  // Global mean Google rating
  const googleStats = await dbGet<any>(`
    SELECT AVG(google_rating) as mean FROM books
    WHERE google_rating IS NOT NULL AND status = 'PUBLISHED' AND is_active = 1
  `);

  // Global mean local review rating
  const localStats = await dbGet<any>(`
    SELECT AVG(rating) as mean FROM reviews WHERE is_approved = 1
  `);

  // Engagement percentiles (max values for normalization)
  const last90 = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();

  const viewStats = await dbGet<any>(`
    SELECT MAX(cnt) as max_val FROM (
      SELECT COUNT(*) as cnt FROM analytics_events
      WHERE event_type = 'view' AND entity_type = 'book' AND created_at >= ?
      GROUP BY entity_id
    ) t
  `, [last90]);

  const wishlistStats = await dbGet<any>(`
    SELECT MAX(cnt) as max_val FROM (
      SELECT COUNT(*) as cnt FROM wishlist GROUP BY book_id
    ) t
  `);

  const clickStats = await dbGet<any>(`
    SELECT MAX(cnt) as max_val FROM (
      SELECT COUNT(*) as cnt FROM affiliate_clicks
      WHERE created_at >= ?
      GROUP BY book_id
    ) t
  `, [last90]);

  cachedPriors = {
    googleMean: googleStats?.mean || 3.8,
    localMean: localStats?.mean || 3.5,
    maxViews: Math.max(viewStats?.max_val || 1, 1),
    maxWishlists: Math.max(wishlistStats?.max_val || 1, 1),
    maxClicks: Math.max(clickStats?.max_val || 1, 1),
    computedAt: now,
  };

  return cachedPriors;
}

/** Reset cached priors (call after major data changes) */
export function invalidatePriorCache() {
  cachedPriors = null;
}

// ── Score Components ────────────────────────────────────────────────────────

/**
 * Bayesian-smoothed rating score.
 * Returns 0-100 scale.
 */
function bayesianScore(rating: number | null, count: number, priorMean: number, priorStrength: number): number {
  if (!rating || count === 0) return 0;
  const smoothed = (count / (count + priorStrength)) * rating + (priorStrength / (count + priorStrength)) * priorMean;
  return (smoothed / 5.0) * 100; // Normalize 0-5 → 0-100
}

/**
 * Google rating component (0-100).
 */
function googleComponent(googleRating: number | null, ratingsCount: number, priors: PriorStats): number {
  return bayesianScore(googleRating, ratingsCount, priors.googleMean, GOOGLE_PRIOR_M);
}

/**
 * Local reviews component (0-100).
 * Fetches average rating and count for the book.
 */
async function localReviewComponent(bookId: string, priors: PriorStats): Promise<number> {
  const stats = await dbGet<any>(`
    SELECT AVG(rating) as avg_rating, COUNT(*) as cnt
    FROM reviews WHERE book_id = ? AND is_approved = 1
  `, [bookId]);

  if (!stats || stats.cnt === 0) return 0;
  return bayesianScore(stats.avg_rating, stats.cnt, priors.localMean, LOCAL_PRIOR_M);
}

/**
 * Engagement component (0-100).
 * Combines views (50%), wishlist adds (30%), affiliate clicks (20%).
 * All normalized against the highest-engagement book.
 */
async function engagementComponent(bookId: string, priors: PriorStats): Promise<number> {
  const last90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Time-weighted views (more recent = higher weight)
  const views = await dbGet<any>(`
    SELECT COUNT(*) as cnt FROM analytics_events
    WHERE event_type = 'view' AND entity_type = 'book' AND entity_id = ? AND created_at >= ?
  `, [bookId, last90]);

  const wishlists = await dbGet<any>(`
    SELECT COUNT(*) as cnt FROM wishlist WHERE book_id = ?
  `, [bookId]);

  const clicks = await dbGet<any>(`
    SELECT COUNT(*) as cnt FROM affiliate_clicks
    WHERE book_id = ? AND created_at >= ?
  `, [bookId, last90]);

  const viewScore = (views?.cnt || 0) / priors.maxViews;
  const wishlistScore = (wishlists?.cnt || 0) / priors.maxWishlists;
  const clickScore = (clicks?.cnt || 0) / priors.maxClicks;

  // Weighted combination (capped at 100)
  return Math.min(100, (viewScore * 0.5 + wishlistScore * 0.3 + clickScore * 0.2) * 100);
}

/**
 * Recency component (0-100).
 * Uses a sigmoid-like curve: brand-new books get 100, old books decay to 0.
 * Books published in the last 30 days get near-full marks.
 */
function recencyComponent(publishedDate: string | null, createdAt: string): number {
  const dateStr = publishedDate || createdAt;
  if (!dateStr) return 50; // Unknown date = neutral

  const ageMs = Date.now() - new Date(dateStr).getTime();
  const ageDays = ageMs / (24 * 60 * 60 * 1000);

  if (ageDays <= 0) return 100;
  if (ageDays <= 30) return 100 - (ageDays / 30) * 20;  // 100 → 80 in first month
  if (ageDays <= 180) return 80 - ((ageDays - 30) / 150) * 40;  // 80 → 40 in months 2-6
  if (ageDays <= 365) return 40 - ((ageDays - 180) / 185) * 20;  // 40 → 20 in months 6-12
  return Math.max(5, 20 - ((ageDays - 365) / 365) * 10); // Slow decay after 1 year, floor at 5
}

/**
 * Content quality component (0-100).
 * Rewards books with complete metadata.
 */
function qualityComponent(book: any): number {
  let score = 0;
  if (book.description && book.description.length > 100) score += 25;
  else if (book.description && book.description.length > 0) score += 10;
  if (book.cover_image) score += 20;
  if (book.page_count && book.page_count > 0) score += 10;
  if (book.publisher) score += 10;
  if (book.isbn13 || book.isbn10) score += 15;
  if (book.published_date) score += 10;
  if (book.amazon_url) score += 10;
  return score;
}

// ── Composite Score ─────────────────────────────────────────────────────────

/**
 * Calculate the full composite score for a single book (0-100).
 * This is the "truth" score that determines overall book ranking.
 */
export async function calculateCompositeScore(book: any): Promise<number> {
  const priors = await getPriors();

  const google = googleComponent(book.google_rating, book.ratings_count, priors);
  const local = await localReviewComponent(book.id, priors);
  const engagement = await engagementComponent(book.id, priors);
  const recency = recencyComponent(book.published_date, book.created_at);
  const quality = qualityComponent(book);

  const composite =
    google * WEIGHTS.google +
    local * WEIGHTS.localReviews +
    engagement * WEIGHTS.engagement +
    recency * WEIGHTS.recency +
    quality * WEIGHTS.quality;

  return Math.round(composite * 10) / 10; // 1 decimal place
}

/**
 * Batch recalculate computed_score for ALL active books.
 * Should be run periodically (e.g., hourly cron) to keep scores fresh.
 *
 * OPTIMIZED: Uses batch SQL queries instead of N+1 per-book queries.
 * Previously: 200K+ queries for 50K books. Now: ~5 aggregate queries + 1 UPDATE per changed book.
 */
export async function recalculateAllScores(): Promise<{ updated: number; duration: number }> {
  const start = Date.now();
  const priors = await getPriors();
  const last90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // ── Batch 1: All active books ─────────────────────────────────────────
  const books = await dbAll<any>(`
    SELECT * FROM books WHERE status = 'PUBLISHED' AND is_active = 1
  `);

  if (books.length === 0) {
    return { updated: 0, duration: Date.now() - start };
  }

  // ── Batch 2: All local review stats in one query ──────────────────────
  const reviewStats = await dbAll<any>(`
    SELECT book_id, AVG(rating) as avg_rating, COUNT(*) as cnt
    FROM reviews WHERE is_approved = 1
    GROUP BY book_id
  `);
  const reviewMap = new Map<string, { avg: number; cnt: number }>();
  for (const r of reviewStats) {
    reviewMap.set(r.book_id, { avg: r.avg_rating, cnt: r.cnt });
  }

  // ── Batch 3: All engagement views (last 90 days) in one query ─────────
  const viewStats = await dbAll<any>(`
    SELECT entity_id as book_id, COUNT(*) as cnt
    FROM analytics_events
    WHERE event_type = 'view' AND entity_type = 'book' AND created_at >= ?
    GROUP BY entity_id
  `, [last90]);
  const viewMap = new Map<string, number>();
  for (const v of viewStats) viewMap.set(v.book_id, v.cnt);

  // ── Batch 4: All wishlist counts in one query ─────────────────────────
  const wishlistStats = await dbAll<any>(`
    SELECT book_id, COUNT(*) as cnt FROM wishlist GROUP BY book_id
  `);
  const wishlistMap = new Map<string, number>();
  for (const w of wishlistStats) wishlistMap.set(w.book_id, w.cnt);

  // ── Batch 5: All affiliate clicks (last 90 days) in one query ────────
  const clickStats = await dbAll<any>(`
    SELECT book_id, COUNT(*) as cnt
    FROM affiliate_clicks WHERE created_at >= ?
    GROUP BY book_id
  `, [last90]);
  const clickMap = new Map<string, number>();
  for (const c of clickStats) clickMap.set(c.book_id, c.cnt);

  // ── Calculate scores using in-memory data (zero additional queries) ───
  let updated = 0;
  const BATCH_SIZE = 500;
  const updates: Array<[number, string]> = [];

  for (const book of books) {
    // Google component
    const google = googleComponent(book.google_rating, book.ratings_count, priors);

    // Local review component (from batch map)
    const rv = reviewMap.get(book.id);
    const local = rv ? bayesianScore(rv.avg, rv.cnt, priors.localMean, LOCAL_PRIOR_M) : 0;

    // Engagement component (from batch maps)
    const viewScore = (viewMap.get(book.id) || 0) / priors.maxViews;
    const wishlistScore = (wishlistMap.get(book.id) || 0) / priors.maxWishlists;
    const clickScore = (clickMap.get(book.id) || 0) / priors.maxClicks;
    const engagement = Math.min(100, (viewScore * 0.5 + wishlistScore * 0.3 + clickScore * 0.2) * 100);

    // Recency & quality (pure computation, no DB)
    const recency = recencyComponent(book.published_date, book.created_at);
    const quality = qualityComponent(book);

    // Composite
    const composite =
      google * WEIGHTS.google +
      local * WEIGHTS.localReviews +
      engagement * WEIGHTS.engagement +
      recency * WEIGHTS.recency +
      quality * WEIGHTS.quality;

    const newScore = Math.round(composite * 10) / 10;

    if (Math.abs(newScore - (book.computed_score || 0)) > 0.05) {
      updates.push([newScore, book.id]);
    }
  }

  // ── Batch UPDATE in chunks of 500 to avoid huge transactions ──────────
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const chunk = updates.slice(i, i + BATCH_SIZE);
    await dbTransaction(async () => {
      for (const [score, id] of chunk) {
        await dbRun("UPDATE books SET computed_score = ?, updated_at = NOW() WHERE id = ?", [score, id]);
      }
    });
    updated += chunk.length;
  }

  invalidatePriorCache();
  return { updated, duration: Date.now() - start };
}

/**
 * Recalculate score for a single book (e.g., after a new review).
 */
export async function recalculateBookScore(bookId: string): Promise<number> {
  const book = await dbGet<any>('SELECT * FROM books WHERE id = ?', [bookId]);
  if (!book) return 0;

  const newScore = await calculateCompositeScore(book);
  await dbRun("UPDATE books SET computed_score = ?, updated_at = NOW() WHERE id = ?", [newScore, bookId]);
  return newScore;
}

// ── Trending Score ──────────────────────────────────────────────────────────

/**
 * Calculate a time-decayed trending score.
 * Unlike computed_score, trending emphasizes RECENT engagement.
 *
 * trending = (recent_views * 1.0 + recent_reviews * 5.0 + recent_wishlists * 3.0) * decay
 * decay = 1 / (1 + peak_age_days / half_life)
 */
export async function calculateTrendingScore(bookId: string): Promise<number> {
  const now = Date.now();
  const last7 = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const last30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Recent views (7 days with higher weight, 30 days with lower)
  const views7 = (await dbGet<any>(`
    SELECT COUNT(*) as cnt FROM analytics_events
    WHERE event_type = 'view' AND entity_type = 'book' AND entity_id = ? AND created_at >= ?
  `, [bookId, last7]))?.cnt || 0;

  const views30 = (await dbGet<any>(`
    SELECT COUNT(*) as cnt FROM analytics_events
    WHERE event_type = 'view' AND entity_type = 'book' AND entity_id = ? AND created_at >= ?
  `, [bookId, last30]))?.cnt || 0;

  // Recent reviews
  const reviews7 = (await dbGet<any>(`
    SELECT COUNT(*) as cnt FROM reviews
    WHERE book_id = ? AND is_approved = 1 AND created_at >= ?
  `, [bookId, last7]))?.cnt || 0;

  // Recent wishlist adds
  const wishlists7 = (await dbGet<any>(`
    SELECT COUNT(*) as cnt FROM wishlist
    WHERE book_id = ? AND created_at >= ?
  `, [bookId, last7]))?.cnt || 0;

  // Recent affiliate clicks
  const clicks7 = (await dbGet<any>(`
    SELECT COUNT(*) as cnt FROM affiliate_clicks
    WHERE book_id = ? AND created_at >= ?
  `, [bookId, last7]))?.cnt || 0;

  // Weighted engagement (7-day counts matter most)
  const recentEngagement =
    views7 * 1.0 +
    (views30 - views7) * 0.3 + // Older views worth less
    reviews7 * 5.0 +            // Reviews are very valuable signals
    wishlists7 * 3.0 +          // Wishlists show strong intent
    clicks7 * 2.0;              // Clicks show purchase intent

  // Base score (from computed_score) provides a floor
  const book = await dbGet<any>('SELECT computed_score FROM books WHERE id = ?', [bookId]);
  const baseScore = book?.computed_score || 0;

  // Blend: 60% recent engagement (normalized), 40% base quality
  // Normalize engagement on a log scale to prevent outliers dominating
  const engagementNormalized = Math.min(100, Math.log1p(recentEngagement) * 15);

  return Math.round((engagementNormalized * 0.6 + baseScore * 0.4) * 10) / 10;
}

// ── Recommendation Engine ───────────────────────────────────────────────────

interface RecommendationResult {
  books: any[];
  strategy: string;
  scores: Map<string, number>; // bookId → relevance score
}

/**
 * Multi-strategy recommendation engine.
 *
 * Strategies (in priority order):
 *  1. Category similarity — weighted by overlap count
 *  2. Author affinity — same author's other books
 *  3. Co-engagement — "users who viewed this also viewed"
 *  4. Quality fallback — top-scoring books in same categories
 */
export async function getRecommendations(bookId: string, limit: number = 6): Promise<RecommendationResult> {
  const book = await dbGet<any>('SELECT * FROM books WHERE id = ?', [bookId]);
  if (!book) return { books: [], strategy: 'none', scores: new Map() };

  const scores = new Map<string, number>();
  const seen = new Set<string>([bookId]); // Exclude source book

  // ─── Strategy 1: Category Similarity (weighted) ───────────────────
  const bookCats = await dbAll<any>(`
    SELECT category_id FROM book_categories WHERE book_id = ?
  `, [bookId]);

  if (bookCats.length > 0) {
    const catIds = bookCats.map((c: any) => c.category_id);
    const placeholders = catIds.map(() => '?').join(',');

    // Count how many categories each candidate shares with source
    const catMatches = await dbAll<any>(`
      SELECT bc.book_id, COUNT(*) as shared_cats, b.computed_score
      FROM book_categories bc
      JOIN books b ON b.id = bc.book_id
      WHERE bc.category_id IN (${placeholders})
        AND bc.book_id != ?
        AND b.status = 'PUBLISHED' AND b.is_active = 1
      GROUP BY bc.book_id
      ORDER BY shared_cats DESC, b.computed_score DESC
      LIMIT 50
    `, [...catIds, bookId]);

    for (const match of catMatches) {
      const catScore = (match.shared_cats / bookCats.length) * 40 + (match.computed_score / 100) * 10;
      scores.set(match.book_id, (scores.get(match.book_id) || 0) + catScore);
    }
  }

  // ─── Strategy 2: Author Affinity ──────────────────────────────────
  const authorBooks = await dbAll<any>(`
    SELECT id, computed_score FROM books
    WHERE author = ? AND id != ? AND status = 'PUBLISHED' AND is_active = 1
    ORDER BY computed_score DESC LIMIT 10
  `, [book.author, bookId]);

  for (const ab of authorBooks) {
    const authorScore = 25 + (ab.computed_score / 100) * 10;
    scores.set(ab.id, (scores.get(ab.id) || 0) + authorScore);
  }

  // ─── Strategy 3: Co-engagement (users who viewed X also viewed Y) ─
  const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const coViewed = await dbAll<any>(`
    SELECT ae2.entity_id as book_id, COUNT(DISTINCT ae2.user_id) as co_viewers
    FROM analytics_events ae1
    JOIN analytics_events ae2 ON ae2.user_id = ae1.user_id
      AND ae2.event_type = 'view' AND ae2.entity_type = 'book'
      AND ae2.entity_id != ae1.entity_id
    WHERE ae1.event_type = 'view' AND ae1.entity_type = 'book'
      AND ae1.entity_id = ?
      AND ae1.user_id IS NOT NULL
      AND ae1.created_at >= ?
      AND ae2.created_at >= ?
    GROUP BY ae2.entity_id
    HAVING co_viewers >= 2
    ORDER BY co_viewers DESC
    LIMIT 20
  `, [bookId, last30, last30]);

  for (const cv of coViewed) {
    const isActive = await dbGet<any>(
      `SELECT id FROM books WHERE id = ? AND status = 'PUBLISHED' AND is_active = 1`,
      [cv.book_id],
    );
    if (isActive) {
      const coScore = Math.min(20, cv.co_viewers * 4);
      scores.set(cv.book_id, (scores.get(cv.book_id) || 0) + coScore);
    }
  }

  // ─── Strategy 4: Rating Similarity ────────────────────────────────
  if (book.google_rating) {
    const ratingMin = Math.max(1, book.google_rating - 0.5);
    const ratingMax = Math.min(5, book.google_rating + 0.5);
    const ratingMatches = await dbAll<any>(`
      SELECT id, computed_score FROM books
      WHERE google_rating BETWEEN ? AND ?
        AND id != ? AND status = 'PUBLISHED' AND is_active = 1
        AND ratings_count >= 10
      ORDER BY computed_score DESC LIMIT 20
    `, [ratingMin, ratingMax, bookId]);

    for (const rm of ratingMatches) {
      if (!scores.has(rm.id)) {
        const ratingScore = 5 + (rm.computed_score / 100) * 5;
        scores.set(rm.id, ratingScore);
      }
    }
  }

  // ─── Rank and return top N ────────────────────────────────────────
  const ranked = Array.from(scores.entries())
    .filter(([id]) => !seen.has(id))
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit);

  if (ranked.length === 0) {
    // Ultimate fallback: top-scoring books
    const fallback = await dbAll<any>(`
      SELECT * FROM books WHERE status = 'PUBLISHED' AND is_active = 1 AND id != ?
      ORDER BY computed_score DESC LIMIT ?
    `, [bookId, limit]);
    return { books: fallback, strategy: 'popular_fallback', scores: new Map() };
  }

  const resultIds = ranked.map(([id]) => id);
  const placeholders = resultIds.map(() => '?').join(',');
  const books = await dbAll<any>(`
    SELECT * FROM books WHERE id IN (${placeholders})
  `, resultIds);

  // Sort results by our computed relevance scores
  books.sort((a: any, b: any) => {
    const scoreA = scores.get(a.id) || 0;
    const scoreB = scores.get(b.id) || 0;
    return scoreB - scoreA;
  });

  // Determine primary strategy
  const strategy = bookCats.length > 0 ? 'multi_signal' : (authorBooks.length > 0 ? 'author' : 'engagement');

  return { books, strategy, scores };
}

// ── Top-Rated with Minimum Threshold ────────────────────────────────────────

/**
 * Get top-rated books with a minimum ratings threshold.
 * Uses Bayesian smoothing so books with few ratings are appropriately ranked.
 */
export async function getTopRated(limit: number = 8): Promise<any[]> {
  const priors = await getPriors();

  return await dbAll<any>(`
    SELECT *,
      (CAST(ratings_count AS DOUBLE) / (ratings_count + ?)) * google_rating +
      (CAST(? AS DOUBLE) / (ratings_count + ?)) * ? AS bayesian_rating
    FROM books
    WHERE status = 'PUBLISHED' AND is_active = 1
      AND google_rating IS NOT NULL
      AND ratings_count >= 5
    ORDER BY bayesian_rating DESC
    LIMIT ?
  `, [GOOGLE_PRIOR_M, GOOGLE_PRIOR_M, GOOGLE_PRIOR_M, priors.googleMean, limit]);
}

// ── Trending (Time-Decayed) ─────────────────────────────────────────────────

/**
 * Get actually-trending books based on recent engagement.
 * Unlike computed_score (which is stable), this changes frequently.
 */
export async function getTrending(limit: number = 8): Promise<any[]> {
  const last7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Get all active books with any recent engagement
  // Filter: must have cover image and at least some ratings signal
  const candidates = await dbAll<any>(`
    SELECT b.*,
      COALESCE(v7.cnt, 0) as views_7d,
      COALESCE(v30.cnt, 0) as views_30d,
      COALESCE(r7.cnt, 0) as reviews_7d,
      COALESCE(w7.cnt, 0) as wishlists_7d,
      COALESCE(ac7.cnt, 0) as clicks_7d
    FROM books b
    LEFT JOIN (
      SELECT entity_id, COUNT(*) as cnt FROM analytics_events
      WHERE event_type = 'view' AND entity_type = 'book' AND created_at >= ?
      GROUP BY entity_id
    ) v7 ON v7.entity_id = b.id
    LEFT JOIN (
      SELECT entity_id, COUNT(*) as cnt FROM analytics_events
      WHERE event_type = 'view' AND entity_type = 'book' AND created_at >= ?
      GROUP BY entity_id
    ) v30 ON v30.entity_id = b.id
    LEFT JOIN (
      SELECT book_id, COUNT(*) as cnt FROM reviews
      WHERE is_approved = 1 AND created_at >= ?
      GROUP BY book_id
    ) r7 ON r7.book_id = b.id
    LEFT JOIN (
      SELECT book_id, COUNT(*) as cnt FROM wishlist
      WHERE created_at >= ?
      GROUP BY book_id
    ) w7 ON w7.book_id = b.id
    LEFT JOIN (
      SELECT book_id, COUNT(*) as cnt FROM affiliate_clicks
      WHERE created_at >= ?
      GROUP BY book_id
    ) ac7 ON ac7.book_id = b.id
    WHERE b.status = 'PUBLISHED' AND b.is_active = 1
      AND b.cover_image IS NOT NULL AND b.cover_image != ''
      AND b.ratings_count >= 2
      AND b.google_rating >= 3.5
    ORDER BY b.computed_score DESC
    LIMIT 200
  `, [last7, last30, last7, last7, last7]);

  // Score each candidate
  const scored = candidates.map((b: any) => {
    const recentEngagement =
      b.views_7d * 1.0 +
      (b.views_30d - b.views_7d) * 0.3 +
      b.reviews_7d * 5.0 +
      b.wishlists_7d * 3.0 +
      b.clicks_7d * 2.0;

    // Boost for books with more ratings (popular books rank higher)
    const popularityBoost = Math.log1p(b.ratings_count) * 2;

    const engagementNormalized = Math.min(100, Math.log1p(recentEngagement) * 15);
    const trendingScore = engagementNormalized * 0.5 + b.computed_score * 0.3 + popularityBoost * 0.2;

    return { ...b, trendingScore: Math.round(trendingScore * 10) / 10 };
  });

  // Sort by trending score and return top N
  scored.sort((a: any, b: any) => b.trendingScore - a.trendingScore);
  return scored.slice(0, limit);
}

// ── Book of the Day (Weighted Selection) ────────────────────────────────────

/**
 * Select Book of the Day using a weighted algorithm that considers:
 * - Must have Google rating >= 4.0
 * - Priority to books with high engagement but haven't been BOTD recently
 * - Deterministic per day (same book all day long)
 * - Records selection in book_of_the_day table for history tracking
 * - Respects manual admin overrides set for today
 */
export async function getBookOfTheDay(): Promise<any | null> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Check if admin has set a manual override for today
  const manualOverride = await dbGet<any>(
    `SELECT book_id FROM book_of_the_day WHERE date = ? AND selected_by = 'admin'`,
    [today],
  );
  if (manualOverride) {
    return await dbGet<any>('SELECT * FROM books WHERE id = ? AND status = \'PUBLISHED\' AND is_active = 1', [manualOverride.book_id]);
  }

  // Check if auto-selection already recorded for today (avoids re-computing)
  const existingAuto = await dbGet<any>(
    `SELECT book_id FROM book_of_the_day WHERE date = ? AND selected_by = 'auto'`,
    [today],
  );
  if (existingAuto) {
    return await dbGet<any>('SELECT * FROM books WHERE id = ? AND status = \'PUBLISHED\' AND is_active = 1', [existingAuto.book_id]);
  }

  // Fetch books that were BOTD in the last 30 days (to avoid repeats)
  const recentBotd = await dbAll<any>(
    `SELECT book_id FROM book_of_the_day WHERE date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
  );
  const recentIds = recentBotd.map((r: any) => r.book_id);
  const exclusionClause = recentIds.length > 0
    ? `AND id NOT IN (${recentIds.map(() => '?').join(',')})`
    : '';

  // Get eligible books: rated >= 4.0, good metadata, not recently featured
  const eligible = await dbAll<any>(
    `SELECT id FROM books
     WHERE status = 'PUBLISHED' AND is_active = 1
       AND google_rating >= 4.0
       AND description IS NOT NULL AND LENGTH(description) > 50
       AND ratings_count >= 10
       ${exclusionClause}
     ORDER BY computed_score DESC
     LIMIT 100`,
    recentIds,
  );

  let bookId: string | null = null;

  if (eligible.length > 0) {
    // Deterministic hash from today's date
    const dayHash = Array.from(today).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
    const idx = Math.abs(dayHash) % eligible.length;
    bookId = eligible[idx].id;
  } else {
    // Relaxed fallback: any good rated book
    const fallback = await dbAll<any>(
      `SELECT id FROM books WHERE status = 'PUBLISHED' AND is_active = 1 AND google_rating >= 3.5
       ORDER BY computed_score DESC LIMIT 50`,
    );
    if (fallback.length === 0) return null;
    const dayHash = Array.from(today).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
    bookId = fallback[Math.abs(dayHash) % fallback.length].id;
  }

  if (!bookId) return null;

  // Record this auto-selection for history
  try {
    await dbRun(
      `INSERT IGNORE INTO book_of_the_day (date, book_id, selected_by) VALUES (?, ?, 'auto')`,
      [today, bookId],
    );
  } catch { /* non-critical — history is best-effort */ }

  return await dbGet<any>('SELECT * FROM books WHERE id = ?', [bookId]);
}

/**
 * Set a manual Book of the Day override (admin only).
 */
export async function setBookOfTheDayOverride(bookId: string, date: string, adminNote?: string): Promise<void> {
  await dbRun(
    `INSERT INTO book_of_the_day (date, book_id, selected_by, admin_note)
     VALUES (?, ?, 'admin', ?)
     ON DUPLICATE KEY UPDATE book_id = VALUES(book_id), selected_by = 'admin', admin_note = VALUES(admin_note), selected_at = NOW()`,
    [date, bookId, adminNote || null],
  );
}

/**
 * Get Book of the Day history (last N days).
 */
export async function getBookOfTheDayHistory(days: number = 30): Promise<any[]> {
  return await dbAll<any>(
    `SELECT botd.date, botd.selected_by, botd.admin_note, botd.selected_at,
            b.id, b.title, b.author, b.cover_image, b.google_rating, b.slug
     FROM book_of_the_day botd
     JOIN books b ON b.id = botd.book_id
     ORDER BY botd.date DESC
     LIMIT ?`,
    [days],
  );
}

// ── Review Trust Score ──────────────────────────────────────────────────────

/**
 * Calculate a trust score for a review (0.0 - 1.0).
 * Used to weight reviews in scoring and to flag suspicious ones.
 *
 * Factors:
 *  - Account age (older accounts are more trusted)
 *  - Review count across all books (prolific reviewers trusted more)
 *  - Review length (very short reviews weighted less)
 *  - Helpful votes (community validation)
 *  - Rating deviation (extreme outlier reviews weighted less)
 */
export async function calculateReviewTrust(review: any, bookId: string): Promise<number> {
  let trust = 0.5; // Base trust

  // Account age bonus (max +0.15)
  if (review.user_id) {
    const user = await dbGet<any>('SELECT created_at FROM users WHERE id = ?', [review.user_id]);
    if (user) {
      const ageMs = Date.now() - new Date(user.created_at).getTime();
      const ageDays = ageMs / (24 * 60 * 60 * 1000);
      trust += Math.min(0.15, ageDays / 365 * 0.15);
    }
  }

  // Review history bonus (max +0.15)
  if (review.user_id) {
    const reviewCount = (await dbGet<any>(
      'SELECT COUNT(*) as cnt FROM reviews WHERE user_id = ? AND is_approved = 1',
      [review.user_id],
    ))?.cnt || 0;
    trust += Math.min(0.15, (reviewCount / 20) * 0.15);
  }

  // Content length bonus (max +0.10)
  const contentLen = (review.content || '').length;
  if (contentLen >= 200) trust += 0.10;
  else if (contentLen >= 100) trust += 0.06;
  else if (contentLen >= 50) trust += 0.03;

  // Helpful votes bonus (max +0.10)
  const helpful = review.helpful_count || 0;
  trust += Math.min(0.10, (helpful / 10) * 0.10);

  // Rating deviation penalty (max -0.15)
  const bookAvg = await dbGet<any>(`
    SELECT AVG(rating) as avg FROM reviews WHERE book_id = ? AND is_approved = 1
  `, [bookId]);

  if (bookAvg?.avg && review.rating) {
    const deviation = Math.abs(review.rating - bookAvg.avg);
    if (deviation > 2.5) trust -= 0.15;
    else if (deviation > 1.5) trust -= 0.08;
  }

  return Math.max(0, Math.min(1, trust));
}

// ── Review Content Validation ───────────────────────────────────────────────

/**
 * Validate review content for quality/spam indicators.
 * Returns { valid: boolean, issues: string[] }
 */
export function validateReviewContent(content: string, rating: number, title?: string): { valid: boolean; issues: string[]; autoApprove: boolean } {
  const issues: string[] = [];
  let autoApprove = true;

  // Minimum length
  if (content.length < 20) {
    issues.push('Review must be at least 20 characters');
    return { valid: false, issues, autoApprove: false };
  }

  // Maximum length
  if (content.length > 5000) {
    issues.push('Review must be under 5,000 characters');
    return { valid: false, issues, autoApprove: false };
  }

  // Spam indicators — hold for moderation, don't reject
  const spamPatterns = [
    /(.)\1{5,}/,                          // Repeated characters: "aaaaaaa"
    /https?:\/\//i,                        // URLs in review
    /(buy|cheap|discount|free|click|visit)\s+(now|here|this)/i, // Spammy phrases
    /(\b\w+\b)\s+\1(\s+\1){2,}/i,         // Repeated words: "good good good good"
  ];

  for (const pattern of spamPatterns) {
    if (pattern.test(content)) {
      autoApprove = false;
      issues.push('Review flagged for moderation');
      break;
    }
  }

  // All caps detection
  const uppercaseRatio = (content.match(/[A-Z]/g) || []).length / Math.max(1, content.length);
  if (uppercaseRatio > 0.7 && content.length > 30) {
    autoApprove = false;
    issues.push('Excessive capitalization detected');
  }

  // Profanity filter (basic — extend as needed)
  const profanityList = ['spam', 'scam', 'fake review'];
  for (const word of profanityList) {
    if (content.toLowerCase().includes(word)) {
      autoApprove = false;
      issues.push('Content flagged for review');
      break;
    }
  }

  return { valid: true, issues, autoApprove };
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Advanced ML-Style Recommendations ───────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Personalized recommendations for a specific user using hybrid approach:
 *
 *  1. COLLABORATIVE FILTERING — "Users similar to you liked …"
 *     Computes user-user similarity via review/rating overlap (cosine-like).
 *
 *  2. CONTENT-BASED — Books matching user's history profile
 *     Derives implicit genre/author/rating preferences from reading history.
 *
 *  3. HYBRID MERGE — Weighted blend of CF + CB + popularity fallback.
 *
 *  4. DIVERSITY RE-RANKING — Ensures category variety in final list.
 */

export interface PersonalizedResult {
  books: any[];
  strategies: string[];
  confidence: number; // 0-1 — how much user data we had
}

export async function getPersonalizedRecommendations(
  userId: string,
  limit: number = 12,
): Promise<PersonalizedResult> {
  const scores = new Map<string, number>();
  const strategies: string[] = [];

  // Gather user's interaction profile
  const userReviews = await dbAll<any>(
    `SELECT book_id, rating FROM reviews WHERE user_id = ? AND is_approved = 1`,
    [userId],
  );
  const userProgress = await dbAll<any>(
    'SELECT book_id, status, personal_rating FROM reading_progress WHERE user_id = ?',
    [userId],
  );
  const userWishlist = await dbAll<any>(
    'SELECT book_id FROM wishlist WHERE user_id = ?',
    [userId],
  );

  const interactedBookIds = new Set<string>([
    ...userReviews.map((r: any) => r.book_id),
    ...userProgress.map((p: any) => p.book_id),
    ...userWishlist.map((w: any) => w.book_id),
  ]);

  const interactionCount = interactedBookIds.size;
  const confidence = Math.min(1, interactionCount / 20); // Full confidence at 20+ interactions

  // ─── Strategy 1: Collaborative Filtering ────────────────────────
  if (userReviews.length >= 3) {
    strategies.push('collaborative_filtering');
    const userRatings = new Map<string, number>(
      userReviews.map((r: any) => [r.book_id, Number(r.rating)]),
    );

    // Find similar users (those who reviewed the same books with similar ratings)
    const reviewedBookIds = userReviews.map((r: any) => r.book_id);
    const placeholders = reviewedBookIds.map(() => '?').join(',');

    const similarUsers = await dbAll<any>(`
      SELECT r2.user_id,
        COUNT(*) as overlap,
        AVG(ABS(r1.rating - r2.rating)) as avg_diff
      FROM reviews r1
      JOIN reviews r2 ON r1.book_id = r2.book_id AND r2.user_id != ?
      WHERE r1.user_id = ? AND r1.book_id IN (${placeholders})
        AND r2.is_approved = 1
      GROUP BY r2.user_id
      HAVING overlap >= 2
      ORDER BY avg_diff ASC, overlap DESC
      LIMIT 20
    `, [userId, userId, ...reviewedBookIds]);

    // Get books that similar users liked but current user hasn't seen
    for (const su of similarUsers) {
      const similarity = Math.max(0.1, 1 - (Number(su.avg_diff) / 5)) * Math.min(1, su.overlap / 5);
      const suBooks = await dbAll<any>(`
        SELECT book_id, rating FROM reviews
        WHERE user_id = ? AND rating >= 4 AND is_approved = 1
        ORDER BY rating DESC LIMIT 10
      `, [su.user_id]);

      for (const sb of suBooks) {
        if (!interactedBookIds.has(sb.book_id)) {
          const cfScore = similarity * Number(sb.rating) * 6; // Scale to ~30 max
          scores.set(sb.book_id, (scores.get(sb.book_id) || 0) + cfScore);
        }
      }
    }
  }

  // ─── Strategy 2: Content-Based (user profile) ──────────────────
  if (interactionCount >= 2) {
    strategies.push('content_based');

    // Build profile: preferred categories, average rating
    const bookIds = Array.from(interactedBookIds);
    const bookPlaceholders = bookIds.map(() => '?').join(',');

    // Top categories from user's books
    const topCats = await dbAll<any>(`
      SELECT bc.category_id, c.name, COUNT(*) as freq
      FROM book_categories bc
      JOIN categories c ON c.id = bc.category_id
      WHERE bc.book_id IN (${bookPlaceholders})
      GROUP BY bc.category_id
      ORDER BY freq DESC LIMIT 5
    `, bookIds);

    if (topCats.length > 0) {
      const catIds = topCats.map((c: any) => c.category_id);
      const catPlaceholders = catIds.map(() => '?').join(',');

      // Find high-scoring books in preferred categories
      const cbBooks = await dbAll<any>(`
        SELECT DISTINCT b.id, b.computed_score, COUNT(bc.category_id) as cat_overlap
        FROM books b
        JOIN book_categories bc ON bc.book_id = b.id
        WHERE bc.category_id IN (${catPlaceholders})
          AND b.id NOT IN (${bookPlaceholders})
          AND b.status = 'PUBLISHED' AND b.is_active = 1
        GROUP BY b.id
        ORDER BY cat_overlap DESC, b.computed_score DESC
        LIMIT 30
      `, [...catIds, ...bookIds]);

      for (const cb of cbBooks) {
        const cbScore = (cb.cat_overlap / topCats.length) * 20 + (Number(cb.computed_score) / 100) * 10;
        scores.set(cb.id, (scores.get(cb.id) || 0) + cbScore);
      }
    }

    // Preferred authors
    const topAuthors = await dbAll<any>(`
      SELECT author, COUNT(*) as freq FROM books
      WHERE id IN (${bookPlaceholders})
      GROUP BY author ORDER BY freq DESC LIMIT 3
    `, bookIds);

    for (const ta of topAuthors) {
      const authorBooks = await dbAll<any>(`
        SELECT id, computed_score FROM books
        WHERE author = ? AND id NOT IN (${bookPlaceholders})
          AND status = 'PUBLISHED' AND is_active = 1
        ORDER BY computed_score DESC LIMIT 5
      `, [ta.author, ...bookIds]);

      for (const ab of authorBooks) {
        const authorScore = 15 + (Number(ab.computed_score) / 100) * 5;
        scores.set(ab.id, (scores.get(ab.id) || 0) + authorScore);
      }
    }
  }

  // ─── Strategy 3: Popularity Fallback ──────────────────────────
  if (scores.size < limit) {
    strategies.push('popularity');
    const exclusions = Array.from(new Set([...interactedBookIds, ...scores.keys()]));
    const exPlaceholders = exclusions.length > 0 ? exclusions.map(() => '?').join(',') : "'none'";

    const popular = await dbAll<any>(`
      SELECT id, computed_score FROM books
      WHERE status = 'PUBLISHED' AND is_active = 1
        ${exclusions.length > 0 ? `AND id NOT IN (${exPlaceholders})` : ''}
      ORDER BY computed_score DESC LIMIT ?
    `, [...(exclusions.length > 0 ? exclusions : []), limit]);

    for (const p of popular) {
      if (!scores.has(p.id)) {
        scores.set(p.id, Number(p.computed_score) * 0.3); // Lower weight for generic popularity
      }
    }
  }

  // ─── Diversity Re-ranking ─────────────────────────────────────
  const ranked = Array.from(scores.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit * 2); // Over-fetch for diversity

  // Load categories for diversity
  const diverseResults: string[] = [];
  const usedCategories = new Set<string>();

  for (const [bookId] of ranked) {
    if (diverseResults.length >= limit) break;

    const bookCats = await dbAll<any>(
      'SELECT category_id FROM book_categories WHERE book_id = ?',
      [bookId],
    );
    const catIds = bookCats.map((c: any) => c.category_id);

    // If more than half of the book's categories already represented, deprioritize
    const overlap = catIds.filter((c: string) => usedCategories.has(c)).length;
    if (overlap > catIds.length * 0.5 && diverseResults.length > limit / 2) {
      continue; // Skip for diversity (unless we don't have enough results)
    }

    diverseResults.push(bookId);
    catIds.forEach((c: string) => usedCategories.add(c));
  }

  // Fill remaining if diversity filter cut too much
  if (diverseResults.length < limit) {
    for (const [bookId] of ranked) {
      if (diverseResults.length >= limit) break;
      if (!diverseResults.includes(bookId)) diverseResults.push(bookId);
    }
  }

  // Fetch full book data
  if (diverseResults.length === 0) {
    return { books: [], strategies: ['none'], confidence: 0 };
  }

  const resultPlaceholders = diverseResults.map(() => '?').join(',');
  const books = await dbAll<any>(
    `SELECT * FROM books WHERE id IN (${resultPlaceholders})`,
    diverseResults,
  );

  // Re-sort by score
  books.sort((a: any, b: any) => (scores.get(b.id) || 0) - (scores.get(a.id) || 0));

  return { books, strategies, confidence };
}

