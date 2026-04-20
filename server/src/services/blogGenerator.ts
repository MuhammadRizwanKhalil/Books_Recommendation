/**
 * AI Blog Post Generator — SEO-Optimized, Rich Content with AI Images
 *
 * Generates high-quality, engaging blog posts that:
 *  - Research keywords first, then create content around them
 *  - Feature real books from the database with proper links
 *  - Use a warm, personal, engaging tone (like a real book blogger)
 *  - Include AI-generated featured images (DALL-E 3)
 *  - Are fully SEO-optimized (meta title, description, focus keyword, schema)
 *  - Never repeat topics — checks existing posts before generating
 *  - Produce rich HTML with book cards, pull quotes, CTAs, and affiliate links
 */

import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { chatCompletion, type ChatMessage } from './openai.js';
import { dbGet, dbAll, dbRun } from '../database.js';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { syncBlogBookMentions } from './blogBookMentions.js';

// ── Topic Templates ─────────────────────────────────────────────────────────

interface TopicTemplate {
  type: string;
  category: string;
  bookQuery: string;
  angle: string;
}

const TOPIC_TEMPLATES: TopicTemplate[] = [
  {
    type: 'trending_roundup',
    category: 'Trending',
    bookQuery: `SELECT b.*, COUNT(ae.id) as recent_views
      FROM books b
      LEFT JOIN analytics_events ae ON ae.entity_id = b.id
        AND ae.event_type = 'view' AND ae.entity_type = 'book'
        AND ae.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      WHERE b.status = 'PUBLISHED' AND b.is_active = 1
      GROUP BY b.id ORDER BY recent_views DESC, b.computed_score DESC LIMIT 8`,
    angle: 'trending books everyone is reading right now',
  },
  {
    type: 'new_releases',
    category: 'New Releases',
    bookQuery: `SELECT * FROM books
      WHERE status = 'PUBLISHED' AND is_active = 1
      ORDER BY created_at DESC LIMIT 8`,
    angle: 'exciting new book releases you don\'t want to miss',
  },
  {
    type: 'top_rated',
    category: 'Top Rated',
    bookQuery: `SELECT * FROM books
      WHERE status = 'PUBLISHED' AND is_active = 1
        AND google_rating IS NOT NULL AND ratings_count >= 5
      ORDER BY google_rating DESC, ratings_count DESC LIMIT 8`,
    angle: 'the highest-rated books our readers love most',
  },
  {
    type: 'category_spotlight',
    category: 'Genre Spotlight',
    bookQuery: '', // Dynamic — filled at runtime
    angle: 'a deep dive into a specific genre',
  },
  {
    type: 'reading_list',
    category: 'Reading Lists',
    bookQuery: `SELECT * FROM books
      WHERE status = 'PUBLISHED' AND is_active = 1
        AND description IS NOT NULL AND LENGTH(description) > 50
      ORDER BY computed_score DESC LIMIT 12`,
    angle: 'a curated reading list for a specific mood or season',
  },
  {
    type: 'hidden_gems',
    category: 'Hidden Gems',
    bookQuery: `SELECT * FROM books
      WHERE status = 'PUBLISHED' AND is_active = 1
        AND google_rating >= 4.0 AND ratings_count BETWEEN 5 AND 500
      ORDER BY google_rating DESC, RAND() LIMIT 8`,
    angle: 'underrated books that deserve more attention',
  },
  {
    type: 'author_spotlight',
    category: 'Author Spotlight',
    bookQuery: '', // Dynamic
    angle: 'a deep dive into a prolific author and their best works',
  },
  {
    type: 'comparison',
    category: 'Book Comparisons',
    bookQuery: `SELECT * FROM books
      WHERE status = 'PUBLISHED' AND is_active = 1
        AND google_rating >= 4.0 AND ratings_count >= 20
      ORDER BY RAND() LIMIT 4`,
    angle: 'comparing similar books to help readers choose their next read',
  },
];

// ── Blog Generation ─────────────────────────────────────────────────────────

export interface GeneratedPost {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  category: string;
  tags: string;
  featuredBookIds: string[];
  tokensUsed: number;
  model: string;
  focusKeyword?: string;
  featuredImage?: string;
}

/**
 * Step 1: Check for duplicate topics — never repeat a blog angle.
 */
async function getExistingTopics(): Promise<string[]> {
  const posts = await dbAll<{ title: string; focus_keyword: string | null }>(
    `SELECT title, focus_keyword FROM blog_posts
     WHERE generated_by = 'ai' ORDER BY created_at DESC LIMIT 50`,
  );
  return posts.map(p => `${p.title} ${p.focus_keyword || ''}`);
}

/**
 * Step 2: Select a topic template and fetch relevant books.
 * Avoids repeating recent template types.
 */
async function selectTopicAndBooks(): Promise<{
  template: TopicTemplate;
  books: any[];
}> {
  // Check which template types were used recently
  const recentTypes = await dbAll<{ category: string }>(
    `SELECT category FROM blog_posts WHERE generated_by = 'ai'
     ORDER BY created_at DESC LIMIT ${TOPIC_TEMPLATES.length}`,
  );
  const recentCategories = new Set(recentTypes.map(r => r.category));

  // Pick a template not used recently, or fall back to rotation
  let template = TOPIC_TEMPLATES.find(t => !recentCategories.has(t.category));
  if (!template) {
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (24 * 60 * 60 * 1000),
    );
    template = TOPIC_TEMPLATES[dayOfYear % TOPIC_TEMPLATES.length];
  }

  let books: any[] = [];

  if (template.type === 'category_spotlight') {
    const cat = await dbGet<any>(
      `SELECT c.* FROM categories c WHERE c.book_count > 3 ORDER BY RAND() LIMIT 1`,
    );
    if (cat) {
      books = await dbAll<any>(
        `SELECT b.* FROM books b
         JOIN book_categories bc ON bc.book_id = b.id
         WHERE bc.category_id = ? AND b.status = 'PUBLISHED' AND b.is_active = 1
         ORDER BY b.computed_score DESC LIMIT 8`,
        [cat.id],
      );
      template = { ...template, angle: `a deep dive into ${cat.name} books` };
    }
  } else if (template.type === 'author_spotlight') {
    const author = await dbGet<any>(
      `SELECT a.*, COUNT(b.id) as book_count FROM authors a
       JOIN books b ON b.author_id = a.id
       WHERE b.status = 'PUBLISHED' AND b.is_active = 1
       GROUP BY a.id HAVING book_count >= 3
       ORDER BY RAND() LIMIT 1`,
    );
    if (author) {
      books = await dbAll<any>(
        `SELECT * FROM books WHERE author_id = ? AND status = 'PUBLISHED' AND is_active = 1
         ORDER BY computed_score DESC LIMIT 8`,
        [author.id],
      );
      template = { ...template, angle: `spotlight on ${author.name} and their best books` };
    }
  } else {
    books = await dbAll<any>(template.bookQuery);
  }

  // Shuffle reading lists to get variety
  if (template.type === 'reading_list' || template.type === 'hidden_gems') {
    books = books.sort(() => Math.random() - 0.5).slice(0, 6);
  }

  return { template, books };
}

/**
 * Step 3: Research keywords based on the books and topic.
 */
async function researchKeywords(
  template: TopicTemplate,
  books: any[],
  existingTopics: string[],
): Promise<{ focusKeyword: string; secondaryKeywords: string[]; title: string; angle: string }> {
  const bookTitles = books.map(b => `"${b.title}" by ${b.author}`).join(', ');
  const existingContext = existingTopics.slice(0, 20).join(' | ');

  const result = await chatCompletion([
    {
      role: 'system',
      content: `You are an SEO keyword researcher for a book recommendation blog called "The Book Times".
Your job is to find a target keyword phrase, suggest secondary keywords, and propose a unique blog title.

Rules:
- The focus keyword should be a phrase people actually search for (3-6 words)
- It should be relevant to books and the topic angle
- The title must include the focus keyword naturally
- The title should be 50-70 characters, engaging, clickable
- DO NOT repeat any of these existing topics: ${existingContext || 'none yet'}
- Return ONLY valid JSON, no markdown

Return format:
{
  "focusKeyword": "best thriller books 2025",
  "secondaryKeywords": ["top suspense novels", "must read thrillers", "crime fiction recommendations"],
  "title": "15 Best Thriller Books of 2025 That Will Keep You Up All Night",
  "angle": "A specific angle/hook for this article"
}`,
    },
    {
      role: 'user',
      content: `Topic type: ${template.type}
Category: ${template.category}
Angle: ${template.angle}
Featured books: ${bookTitles}

Research a keyword and title for a blog post about ${template.angle}.`,
    },
  ], { temperature: 0.6, maxTokens: 400 });

  try {
    let content = result.content.trim();
    if (content.startsWith('```')) {
      content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const parsed = JSON.parse(content);
    return {
      focusKeyword: String(parsed.focusKeyword || '').slice(0, 200),
      secondaryKeywords: Array.isArray(parsed.secondaryKeywords) ? parsed.secondaryKeywords.slice(0, 5) : [],
      title: String(parsed.title || '').replace(/^["']|["']$/g, '').trim().slice(0, 200),
      angle: String(parsed.angle || template.angle),
    };
  } catch {
    return {
      focusKeyword: template.category.toLowerCase() + ' books',
      secondaryKeywords: [],
      title: '',
      angle: template.angle,
    };
  }
}

/**
 * Format books into rich context for the AI content prompt.
 */
function formatBooksForPrompt(books: any[]): string {
  return books
    .map((b, i) => {
      const parts = [
        `${i + 1}. "${b.title}" by ${b.author}`,
        b.google_rating ? `Rating: ${b.google_rating}★ (${b.ratings_count} ratings)` : null,
        b.page_count ? `${b.page_count} pages` : null,
        b.published_date ? `Published: ${b.published_date}` : null,
        b.slug ? `Link: /books/${b.slug}` : null,
        b.amazon_url ? `Amazon: ${b.amazon_url}` : null,
        b.description ? `Synopsis: ${b.description.replace(/<[^>]*>/g, '').substring(0, 300)}...` : null,
      ];
      return parts.filter(Boolean).join('\n   ');
    })
    .join('\n\n');
}

/**
 * Slug generation.
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 120);
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let counter = 0;
  while (true) {
    const existing = await dbGet<any>('SELECT id FROM blog_posts WHERE slug = ?', [slug]);
    if (!existing) return slug;
    counter++;
    slug = `${base}-${counter}`;
  }
}

/**
 * Step 4: Generate the actual blog content — rich, engaging, SEO-optimized.
 */
async function generateContent(
  title: string,
  angle: string,
  focusKeyword: string,
  secondaryKeywords: string[],
  books: any[],
  template: TopicTemplate,
): Promise<{ content: string; tokensUsed: number; model: string }> {
  const booksText = formatBooksForPrompt(books);
  const keywordsNote = secondaryKeywords.length > 0
    ? `Secondary keywords to weave in naturally: ${secondaryKeywords.join(', ')}`
    : '';

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are Sarah, a passionate book blogger writing for The Book Times — a popular book discovery website. You write like a real person: warm, opinionated, sometimes funny, always honest. Your readers trust you because you give genuine recommendations.

WRITING STYLE:
- Write in FIRST PERSON ("I couldn't put this one down", "My favorite pick is...")
- Be conversational but knowledgeable — like chatting with a well-read friend
- Share personal reading experiences and reactions
- Use vivid language — don't just describe plots, convey the FEELING of reading
- Include occasional humor, rhetorical questions, and direct reader address ("Trust me on this one")
- Vary sentence length — mix punchy one-liners with flowing descriptions
- Add emotional hooks ("This book broke me", "I stayed up until 3am finishing this")

SEO REQUIREMENTS:
- Use the focus keyword "${focusKeyword}" in the first paragraph, at least one <h2>, and naturally throughout (3-5 times total)
- ${keywordsNote}
- Use <h2> and <h3> headings with descriptive, keyword-rich text
- Write 1500-2500 words (long-form for SEO value)
- Include internal links to our book pages using: <a href="/books/SLUG">Book Title</a>
- Include Amazon affiliate links where appropriate: <a href="AMAZON_URL" target="_blank" rel="nofollow sponsored noopener noreferrer">Buy on Amazon</a>

HTML FORMATTING — Use RICH, visually engaging HTML:
- <h2> for main sections, <h3> for sub-sections
- <p> for paragraphs with good spacing
- <blockquote> for memorable book quotes or your own pull quotes
- <strong> and <em> for emphasis
- Use styled book recommendation cards like this:
  <div style="background:#f8f9fa;border-left:4px solid #6366f1;padding:16px 20px;margin:24px 0;border-radius:8px">
    <h3 style="margin:0 0 8px">📖 Book Title by Author</h3>
    <p style="margin:0 0 8px">Your recommendation text...</p>
    <p style="margin:0;font-size:0.875em;color:#6b7280">⭐ Rating · Genre · Page count</p>
  </div>
- Use <hr> between major sections
- End with a "What should I read next?" CTA section

STRUCTURE:
1. Hook — An engaging 2-3 sentence opening that pulls readers in
2. Introduction — Set the context, mention the focus keyword
3. Book sections — Each book gets its own section with your personal take
4. For each book include: your recommendation, who it's for, a brief "Why read it" pitch
5. Conclusion — Wrap up with your top pick and encourage reader interaction
6. Reader engagement CTA — "What are you reading right now? Drop a comment below!"

Return ONLY the HTML article content. No <html>, <head>, <body> tags.`,
    },
    {
      role: 'user',
      content: `Blog title: "${title}"
Topic: ${angle}
Focus keyword: "${focusKeyword}"

Books to feature (include internal links and Amazon links for each):
${booksText}

Write an engaging, SEO-optimized blog post. Remember to include internal links to each book's page (/books/slug) and Amazon affiliate links.`,
    },
  ];

  const result = await chatCompletion(messages, {
    temperature: 0.75,
    maxTokens: 4000,
  });

  return {
    content: result.content,
    tokensUsed: result.tokensUsed,
    model: result.model,
  };
}

/**
 * Step 5: Generate SEO excerpt / meta description.
 */
async function generateExcerpt(
  title: string,
  content: string,
  focusKeyword: string,
): Promise<{ excerpt: string; tokensUsed: number }> {
  const result = await chatCompletion([
    {
      role: 'system',
      content: `Generate a compelling meta description for a blog post. Rules:
- Must be 140-160 characters
- Must include the focus keyword "${focusKeyword}"
- Must be engaging and encourage clicks
- No quotes around the text
- Return ONLY the description text`,
    },
    {
      role: 'user',
      content: `Title: "${title}"\nContent preview: ${content.replace(/<[^>]*>/g, '').substring(0, 400)}`,
    },
  ], { temperature: 0.5, maxTokens: 80 });

  return {
    excerpt: result.content.replace(/^["']|["']$/g, '').trim(),
    tokensUsed: result.tokensUsed,
  };
}

/**
 * Step 6: Generate a featured image using DALL-E 3.
 * Falls back to the first book's cover if DALL-E is unavailable.
 */
async function generateFeaturedImage(
  title: string,
  category: string,
  books: any[],
): Promise<string | null> {
  // Only attempt DALL-E if OpenAI key is configured
  if (!config.openaiApiKey) {
    return books[0]?.cover_image || null;
  }

  try {
    const openai = new OpenAI({
      apiKey: config.openaiApiKey,
      timeout: 60_000,
    });

    const bookTitles = books.slice(0, 3).map(b => b.title).join(', ');
    const prompt = `A beautiful, editorial-style blog header image for a book recommendation article titled "${title}". The image should feature an aesthetically arranged stack of books in a cozy reading setting — warm lighting, wooden table or bookshelf, maybe a cup of coffee or reading glasses nearby. Style: warm editorial photography, soft natural light, depth of field. The mood should be inviting and literary. Category: ${category}. Do NOT include any text or words in the image.`;

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1792x1024',
      quality: 'standard',
    });

    const imageUrl = response.data?.[0]?.url;
    if (imageUrl) {
      logger.info(`🎨 DALL-E image generated for blog: "${title}"`);
      return imageUrl;
    }
  } catch (err: any) {
    logger.warn(`DALL-E image generation failed: ${err.message} — falling back to book cover`);
  }

  // Fallback: use first book's cover image
  return books[0]?.cover_image || null;
}

/**
 * Main entry point: Generate a complete, SEO-optimized blog post.
 */
export async function generateBlogPost(
  options?: { autoPublish?: boolean },
): Promise<GeneratedPost> {
  let totalTokens = 0;
  let modelUsed = '';

  // Step 1: Check existing topics to avoid duplicates
  const existingTopics = await getExistingTopics();

  // Step 2: Select topic and books
  const { template, books } = await selectTopicAndBooks();
  if (books.length === 0) {
    throw new Error('No books available to generate blog content from');
  }

  // Step 3: Research keywords and generate title
  const keywords = await researchKeywords(template, books, existingTopics);
  totalTokens += 400; // Approximate tokens for keyword research

  // Ensure title is unique
  const titleExists = await dbGet<any>(
    'SELECT id FROM blog_posts WHERE title = ? OR slug = ?',
    [keywords.title, generateSlug(keywords.title)],
  );
  if (titleExists && existingTopics.length > 0) {
    // Regenerate with stronger uniqueness constraint
    const retry = await researchKeywords(
      { ...template, angle: `${template.angle} — a fresh perspective` },
      books,
      existingTopics,
    );
    if (retry.title) {
      keywords.title = retry.title;
      keywords.focusKeyword = retry.focusKeyword;
      keywords.secondaryKeywords = retry.secondaryKeywords;
      keywords.angle = retry.angle;
    }
  }

  const title = keywords.title || `${books[0].title}: Why You Need to Read This`;

  // Step 4: Generate rich content
  const contentResult = await generateContent(
    title,
    keywords.angle,
    keywords.focusKeyword,
    keywords.secondaryKeywords,
    books,
    template,
  );
  totalTokens += contentResult.tokensUsed;
  modelUsed = contentResult.model;

  // Step 5: Generate SEO excerpt
  const excerptResult = await generateExcerpt(title, contentResult.content, keywords.focusKeyword);
  totalTokens += excerptResult.tokensUsed;

  // Step 6: Generate featured image
  const featuredImage = await generateFeaturedImage(title, template.category, books);

  // Build post data
  const slug = await uniqueSlug(generateSlug(title));
  const tags = [
    ...books.slice(0, 5).map(b => b.author),
    template.category,
    ...keywords.secondaryKeywords.slice(0, 2),
  ]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(', ');

  const metaTitle = `${title} | The Book Times`.slice(0, 60);
  const canonicalUrl = `/blog/${slug}`;

  const post: GeneratedPost = {
    title,
    slug,
    content: contentResult.content,
    excerpt: excerptResult.excerpt.substring(0, 160),
    category: template.category,
    tags,
    featuredBookIds: books.map(b => b.id),
    tokensUsed: totalTokens,
    model: modelUsed,
    focusKeyword: keywords.focusKeyword,
    featuredImage: featuredImage || undefined,
  };

  // Save to database with full SEO fields
  const postId = uuidv4();
  const status = options?.autoPublish ? 'PUBLISHED' : 'DRAFT';

  await dbRun(
    `INSERT INTO blog_posts (
      id, title, slug, content, excerpt, featured_image, og_image,
      meta_title, meta_description, canonical_url, focus_keyword, seo_robots,
      category, tags, status, published_at, generated_by, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, 'index, follow',
      ?, ?, ?, ${status === 'PUBLISHED' ? 'NOW()' : 'NULL'}, 'ai', NOW(), NOW()
    )`,
    [
      postId,
      post.title,
      post.slug,
      post.content,
      post.excerpt,
      featuredImage,
      featuredImage,
      metaTitle,
      post.excerpt,
      canonicalUrl,
      keywords.focusKeyword,
      post.category,
      post.tags,
      status,
    ],
  );

  // Link featured books
  for (const bookId of post.featuredBookIds) {
    await dbRun(
      'INSERT IGNORE INTO blog_featured_books (blog_id, book_id) VALUES (?, ?)',
      [postId, bookId],
    );
  }

  await syncBlogBookMentions(postId, post.content, post.featuredBookIds, status === 'PUBLISHED');

  // Log the AI generation
  await dbRun(
    `INSERT INTO ai_email_log (id, prompt, generated_subject, generated_content, model_used, tokens_used, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'generated', NOW())`,
    [
      uuidv4(),
      `Blog: ${template.type} | Keyword: ${keywords.focusKeyword}`,
      post.title,
      post.content.substring(0, 1000),
      modelUsed,
      totalTokens,
    ],
  );

  logger.info(
    `✍️  AI blog post generated: "${title}" | Keyword: "${keywords.focusKeyword}" | ${totalTokens} tokens | ${status}`,
  );

  return post;
}
