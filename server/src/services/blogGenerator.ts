/**
 * AI Blog Post Generator
 *
 * Uses OpenAI to generate blog posts about trending books, new releases,
 * reading lists, and book recommendations. Posts are created as drafts
 * (or optionally auto-published) and linked to relevant books.
 */

import { v4 as uuidv4 } from 'uuid';
import { chatCompletion, type ChatMessage } from './openai.js';
import { dbGet, dbAll, dbRun } from '../database.js';
import { logger } from '../lib/logger.js';

// ── Topic Templates ─────────────────────────────────────────────────────────

interface TopicTemplate {
  type: string;
  titlePrompt: string;
  contentPrompt: string;
  category: string;
}

const TOPIC_TEMPLATES: TopicTemplate[] = [
  {
    type: 'trending_roundup',
    titlePrompt: 'Create an engaging blog post title about trending books right now.',
    contentPrompt: `Write a blog post about trending books. For each book provided, include:
- A brief engaging description of why it's trending
- What readers love about it
- Who should read it
Use a warm, enthusiastic tone. Include HTML formatting with <h2>, <p>, <ul>, <li>, <strong>, <em> tags.`,
    category: 'Trending',
  },
  {
    type: 'new_releases',
    titlePrompt: 'Create a blog title about exciting new book releases this month.',
    contentPrompt: `Write a blog post highlighting new book releases. For each book:
- Describe the book's premise and why it's exciting
- Mention the author's background if relevant
- Suggest who the ideal reader would be
Use HTML formatting with <h2>, <p>, <ul>, <li>, <strong>, <em> tags. Be enthusiastic and helpful.`,
    category: 'New Releases',
  },
  {
    type: 'top_rated',
    titlePrompt: 'Create a blog post title featuring the highest-rated books on our platform.',
    contentPrompt: `Write a blog post about the highest-rated books. For each book:
- Explain why it's highly rated
- Highlight standout qualities
- Include a brief verdict or recommendation
Use HTML formatting. Maintain an authoritative yet friendly tone.`,
    category: 'Top Rated',
  },
  {
    type: 'category_spotlight',
    titlePrompt: 'Create a blog title spotlighting books in a specific genre or category.',
    contentPrompt: `Write a genre/category spotlight blog post. For each book in the category:
- Describe what makes it a great example of the genre
- Compare briefly with other books in the list
- Give a reading difficulty/mood level
Use HTML formatting. Be knowledgeable and passionate about the genre.`,
    category: 'Genre Spotlight',
  },
  {
    type: 'reading_list',
    titlePrompt: 'Create a curated reading list blog title (e.g., "10 Books to Read This Season").',
    contentPrompt: `Write a curated reading list blog post. For each book:
- A one-paragraph hook that makes the reader want to pick it up
- Include the genre/mood
- A "Perfect for:" one-liner
Use HTML formatting. Make it feel like a personal recommendation from a trusted friend.`,
    category: 'Reading Lists',
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
}

/**
 * Select a random topic template and fetch relevant books for it.
 */
async function selectTopicAndBooks(): Promise<{
  template: TopicTemplate;
  books: any[];
}> {
  // Rotate through templates based on day
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
      (24 * 60 * 60 * 1000),
  );
  const template = TOPIC_TEMPLATES[dayOfYear % TOPIC_TEMPLATES.length];

  let books: any[] = [];

  switch (template.type) {
    case 'trending_roundup':
      books = await dbAll<any>(`
        SELECT b.*, COUNT(ae.id) as recent_views
        FROM books b
        LEFT JOIN analytics_events ae ON ae.entity_id = b.id
          AND ae.event_type = 'view' AND ae.entity_type = 'book'
          AND ae.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        WHERE b.status = 'PUBLISHED' AND b.is_active = 1
        GROUP BY b.id
        ORDER BY recent_views DESC, b.computed_score DESC
        LIMIT 8
      `);
      break;

    case 'new_releases':
      books = await dbAll<any>(`
        SELECT * FROM books
        WHERE status = 'PUBLISHED' AND is_active = 1
        ORDER BY created_at DESC
        LIMIT 8
      `);
      break;

    case 'top_rated':
      books = await dbAll<any>(`
        SELECT * FROM books
        WHERE status = 'PUBLISHED' AND is_active = 1
          AND google_rating IS NOT NULL AND ratings_count >= 5
        ORDER BY google_rating DESC, ratings_count DESC
        LIMIT 8
      `);
      break;

    case 'category_spotlight': {
      // Pick a random category with books
      const cat = await dbGet<any>(`
        SELECT c.* FROM categories c
        WHERE c.book_count > 3
        ORDER BY RAND()
        LIMIT 1
      `);
      if (cat) {
        books = await dbAll<any>(`
          SELECT b.* FROM books b
          JOIN book_categories bc ON bc.book_id = b.id
          WHERE bc.category_id = ? AND b.status = 'PUBLISHED' AND b.is_active = 1
          ORDER BY b.computed_score DESC
          LIMIT 8
        `, [cat.id]);
      }
      break;
    }

    case 'reading_list':
    default:
      books = await dbAll<any>(`
        SELECT * FROM books
        WHERE status = 'PUBLISHED' AND is_active = 1
          AND description IS NOT NULL AND LENGTH(description) > 50
        ORDER BY computed_score DESC
        LIMIT 10
      `);
      // Take a random sample of 6
      books = books.sort(() => Math.random() - 0.5).slice(0, 6);
      break;
  }

  return { template, books };
}

/**
 * Format book data for the AI prompt.
 */
function formatBooksForPrompt(books: any[]): string {
  return books
    .map(
      (b, i) =>
        `${i + 1}. "${b.title}" by ${b.author}${b.google_rating ? ` (${b.google_rating}★, ${b.ratings_count} ratings)` : ''}${b.description ? `\n   ${b.description.substring(0, 200)}...` : ''}`,
    )
    .join('\n\n');
}

/**
 * Generate a slug from a title.
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 120);
}

/**
 * Ensure slug uniqueness.
 */
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
 * Generate a single AI blog post.
 */
export async function generateBlogPost(
  options?: { autoPublish?: boolean },
): Promise<GeneratedPost> {
  const { template, books } = await selectTopicAndBooks();

  if (books.length === 0) {
    throw new Error('No books available to generate blog content from');
  }

  const booksText = formatBooksForPrompt(books);
  let totalTokens = 0;
  let modelUsed = '';

  // Step 1: Generate title
  const titleMessages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You are a book blog editor. Generate ONLY the title, no quotes, no explanation. Make it catchy and SEO-friendly (50-80 chars).',
    },
    {
      role: 'user',
      content: `${template.titlePrompt}\n\nBased on these books:\n${booksText}`,
    },
  ];

  const titleResult = await chatCompletion(titleMessages, {
    temperature: 0.8,
    maxTokens: 100,
  });
  const title = titleResult.content.replace(/^["']|["']$/g, '').trim();
  totalTokens += titleResult.tokensUsed;
  modelUsed = titleResult.model;

  // Step 2: Generate content
  const contentMessages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are a professional book blogger writing for The Book Times. 
Write in a warm, knowledgeable, engaging tone. 
Return ONLY the HTML content (no <html>, <head>, <body> wrapping — just the article content).
Start with an engaging introduction paragraph.
Use semantic HTML: <h2> for book titles, <p> for paragraphs, <strong> for emphasis, <blockquote> for notable quotes.
End with a short conclusion encouraging readers to explore these books.
Aim for 800-1200 words.`,
    },
    {
      role: 'user',
      content: `Blog title: "${title}"\n\n${template.contentPrompt}\n\nBooks to feature:\n${booksText}`,
    },
  ];

  const contentResult = await chatCompletion(contentMessages, {
    temperature: 0.7,
    maxTokens: 2500,
  });
  totalTokens += contentResult.tokensUsed;

  // Step 3: Generate excerpt
  const excerptMessages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'Generate a compelling 1-2 sentence excerpt/meta description for a blog post. Max 160 characters. No quotes.',
    },
    {
      role: 'user',
      content: `Title: "${title}"\nContent preview: ${contentResult.content.substring(0, 300)}`,
    },
  ];

  const excerptResult = await chatCompletion(excerptMessages, {
    temperature: 0.6,
    maxTokens: 80,
  });
  totalTokens += excerptResult.tokensUsed;

  // Create the post
  const slug = await uniqueSlug(generateSlug(title));
  const tags = books
    .slice(0, 5)
    .map((b) => b.author)
    .filter(Boolean)
    .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
    .join(', ');

  const post: GeneratedPost = {
    title,
    slug,
    content: contentResult.content,
    excerpt: excerptResult.content.replace(/^["']|["']$/g, '').trim(),
    category: template.category,
    tags,
    featuredBookIds: books.map((b) => b.id),
    tokensUsed: totalTokens,
    model: modelUsed,
  };

  // Save to database
  const postId = uuidv4();
  const status = options?.autoPublish ? 'PUBLISHED' : 'DRAFT';

  // Use the first book's cover image as the featured image
  const featuredImage = books[0]?.cover_image || null;

  await dbRun(
    `INSERT INTO blog_posts (id, title, slug, content, excerpt, featured_image, meta_title, meta_description, category, tags, status, published_at, generated_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${status === 'PUBLISHED' ? 'NOW()' : 'NULL'}, 'ai', NOW(), NOW())`,
    [
      postId,
      post.title,
      post.slug,
      post.content,
      post.excerpt,
      featuredImage,
      post.title.substring(0, 60),
      post.excerpt.substring(0, 160),
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

  // Log the AI generation
  await dbRun(
    `INSERT INTO ai_email_log (id, prompt, generated_subject, generated_content, model_used, tokens_used, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'generated', NOW())`,
    [
      uuidv4(),
      `Blog: ${template.type}`,
      post.title,
      post.content.substring(0, 1000),
      modelUsed,
      totalTokens,
    ],
  );

  logger.info(
    `✍️  AI blog post generated: "${title}" (${totalTokens} tokens, ${status})`,
  );

  return post;
}
