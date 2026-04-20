import { v4 as uuidv4 } from 'uuid';
import { chatCompletion } from './openai.js';
import { submitBatch, getBatchStatus, getBatchResults, type BatchRequest, type BatchResult } from './openAIBatch.js';
import { dbRun } from '../database.js';
import { logger } from '../lib/logger.js';

export type PaceValue = 'slow' | 'medium' | 'fast';

export interface AIMoodAnalysisResult {
  mood: { moods: string[]; confidence: number };
  pace: { pace: PaceValue; confidence: number };
  content_warnings: { warnings: string[]; confidence: number };
  themes: { themes: string[]; confidence: number };
  difficulty: { level: 'easy' | 'moderate' | 'challenging'; confidence: number };
}

const ALLOWED_MOODS = [
  'adventurous',
  'dark',
  'emotional',
  'funny',
  'hopeful',
  'informative',
  'inspiring',
  'lighthearted',
  'mysterious',
  'romantic',
  'sad',
  'tense',
] as const;

const PACE_VALUES: PaceValue[] = ['slow', 'medium', 'fast'];
const DIFFICULTY_VALUES = ['easy', 'moderate', 'challenging'] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeMoodList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(ALLOWED_MOODS);
  const normalized = value
    .map((entry) => (typeof entry === 'string' ? entry.trim().toLowerCase() : ''))
    .filter((entry) => allowed.has(entry as any));

  return Array.from(new Set(normalized)).slice(0, 4);
}

function normalizeStringList(value: unknown, maxItems = 5, maxLen = 80): string[] {
  if (!Array.isArray(value)) return [];
  const cleaned = value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean)
    .map((entry) => entry.slice(0, maxLen));

  return Array.from(new Set(cleaned)).slice(0, maxItems);
}

function normalizePace(value: unknown): PaceValue {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (PACE_VALUES.includes(raw as PaceValue)) return raw as PaceValue;
  return 'medium';
}

function normalizeDifficulty(value: unknown): 'easy' | 'moderate' | 'challenging' {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if ((DIFFICULTY_VALUES as readonly string[]).includes(raw)) {
    return raw as 'easy' | 'moderate' | 'challenging';
  }
  return 'moderate';
}

function normalizeConfidence(value: unknown, fallback = 0.65): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(clamp(n, 0, 1) * 100) / 100;
}

function heuristicFallback(description: string, categories: string[]): AIMoodAnalysisResult {
  const text = `${description} ${categories.join(' ')}`.toLowerCase();

  const moods: string[] = [];
  const addMood = (m: string, keys: string[]) => {
    if (keys.some((k) => text.includes(k))) moods.push(m);
  };

  addMood('mysterious', ['mystery', 'mysterious', 'secret', 'crime']);
  addMood('dark', ['dark', 'horror', 'violent', 'grim']);
  addMood('hopeful', ['hope', 'healing', 'uplifting']);
  addMood('inspiring', ['inspiring', 'inspiration', 'motivational']);
  addMood('romantic', ['romance', 'love', 'heart']);
  addMood('funny', ['funny', 'comedy', 'humor']);
  addMood('informative', ['history', 'science', 'guide', 'memoir', 'biography']);
  addMood('tense', ['thriller', 'suspense', 'danger']);
  addMood('adventurous', ['adventure', 'journey', 'quest']);
  addMood('emotional', ['grief', 'loss', 'emotion']);
  addMood('lighthearted', ['cozy', 'feel-good', 'lighthearted']);

  const finalMoods = Array.from(new Set(moods)).slice(0, 3);
  if (finalMoods.length === 0) finalMoods.push('mysterious');

  const pace: PaceValue = text.includes('fast-paced') || text.includes('thriller')
    ? 'fast'
    : text.includes('slow burn') || text.includes('literary')
      ? 'slow'
      : 'medium';

  const warnings = normalizeStringList([
    text.includes('violence') ? 'violence' : '',
    text.includes('abuse') ? 'abuse' : '',
    text.includes('death') ? 'death' : '',
  ]);

  const themes = normalizeStringList([
    text.includes('friendship') ? 'friendship' : '',
    text.includes('family') ? 'family' : '',
    text.includes('power') ? 'power' : '',
    text.includes('identity') ? 'identity' : '',
    text.includes('survival') ? 'survival' : '',
  ]);

  return {
    mood: {
      moods: finalMoods,
      confidence: 0.62,
    },
    pace: {
      pace,
      confidence: 0.58,
    },
    content_warnings: {
      warnings,
      confidence: warnings.length > 0 ? 0.56 : 0.48,
    },
    themes: {
      themes: themes.length > 0 ? themes : ['personal growth'],
      confidence: 0.55,
    },
    difficulty: {
      level: text.includes('academic') || text.includes('dense') ? 'challenging' : 'moderate',
      confidence: 0.53,
    },
  };
}

function extractJsonObject(content: string): any | null {
  try {
    return JSON.parse(content);
  } catch {
    // try fenced payload or first object
  }

  const fenced = content.match(/```json\s*([\s\S]*?)```/i)?.[1];
  if (fenced) {
    try {
      return JSON.parse(fenced);
    } catch {
      return null;
    }
  }

  const objectMatch = content.match(/\{[\s\S]*\}/);
  if (!objectMatch) return null;

  try {
    return JSON.parse(objectMatch[0]);
  } catch {
    return null;
  }
}

function normalizeAnalysis(payload: any): AIMoodAnalysisResult {
  return {
    mood: {
      moods: normalizeMoodList(payload?.mood?.moods ?? payload?.moods),
      confidence: normalizeConfidence(payload?.mood?.confidence ?? payload?.moodConfidence, 0.65),
    },
    pace: {
      pace: normalizePace(payload?.pace?.pace ?? payload?.pace),
      confidence: normalizeConfidence(payload?.pace?.confidence ?? payload?.paceConfidence, 0.65),
    },
    content_warnings: {
      warnings: normalizeStringList(payload?.content_warnings?.warnings ?? payload?.contentWarnings),
      confidence: normalizeConfidence(payload?.content_warnings?.confidence ?? payload?.contentWarningsConfidence, 0.55),
    },
    themes: {
      themes: normalizeStringList(payload?.themes?.themes ?? payload?.themes),
      confidence: normalizeConfidence(payload?.themes?.confidence ?? payload?.themesConfidence, 0.6),
    },
    difficulty: {
      level: normalizeDifficulty(payload?.difficulty?.level ?? payload?.difficulty),
      confidence: normalizeConfidence(payload?.difficulty?.confidence ?? payload?.difficultyConfidence, 0.58),
    },
  };
}

export async function analyzeBookAIMood(input: {
  title: string;
  author: string;
  description?: string | null;
  categories?: string[];
}): Promise<AIMoodAnalysisResult> {
  const description = (input.description || '').trim().slice(0, 3500);
  const categories = (input.categories || []).slice(0, 8);

  if (!description) {
    return heuristicFallback('', categories);
  }

  try {
    const completion = await chatCompletion([
      {
        role: 'system',
        content: [
          'You are a book-analysis assistant.',
          'Return ONLY a JSON object with this exact shape:',
          '{',
          '  "mood": { "moods": ["hopeful"], "confidence": 0.0-1.0 },',
          '  "pace": { "pace": "slow|medium|fast", "confidence": 0.0-1.0 },',
          '  "content_warnings": { "warnings": ["violence"], "confidence": 0.0-1.0 },',
          '  "themes": { "themes": ["friendship"], "confidence": 0.0-1.0 },',
          '  "difficulty": { "level": "easy|moderate|challenging", "confidence": 0.0-1.0 }',
          '}',
          'Mood values must be selected from: adventurous, dark, emotional, funny, hopeful, informative, inspiring, lighthearted, mysterious, romantic, sad, tense.',
          'Keep outputs concise and safe for general audiences.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `Title: ${input.title}`,
          `Author: ${input.author}`,
          `Categories: ${categories.join(', ') || 'Unknown'}`,
          `Description: ${description}`,
        ].join('\n'),
      },
    ], { temperature: 0.3, maxTokens: 700 });

    const json = extractJsonObject(completion.content);
    if (!json) {
      return heuristicFallback(description, categories);
    }

    const normalized = normalizeAnalysis(json);
    if (normalized.mood.moods.length === 0) {
      return heuristicFallback(description, categories);
    }

    return normalized;
  } catch {
    return heuristicFallback(description, categories);
  }
}

// ── Batch API Mode (50% Cost Savings) ───────────────────────────────────────

/**
 * Get the system prompt for mood analysis.
 */
function getMoodSystemPrompt(): string {
  return [
    'You are a book-analysis assistant.',
    'Return ONLY a JSON object with this exact shape:',
    '{',
    '  "mood": { "moods": ["hopeful"], "confidence": 0.0-1.0 },',
    '  "pace": { "pace": "slow|medium|fast", "confidence": 0.0-1.0 },',
    '  "content_warnings": { "warnings": ["violence"], "confidence": 0.0-1.0 },',
    '  "themes": { "themes": ["friendship"], "confidence": 0.0-1.0 },',
    '  "difficulty": { "level": "easy|moderate|challenging", "confidence": 0.0-1.0 }',
    '}',
    'Mood values must be selected from: adventurous, dark, emotional, funny, hopeful, informative, inspiring, lighthearted, mysterious, romantic, sad, tense.',
    'Keep outputs concise and safe for general audiences.',
  ].join('\n');
}

/**
 * Build a user prompt for a specific book's mood analysis.
 */
function getMoodUserPrompt(input: {
  title: string;
  author: string;
  description?: string | null;
  categories?: string[];
}): string {
  const description = (input.description || '').trim().slice(0, 3500);
  const categories = (input.categories || []).slice(0, 8);
  return [
    `Title: ${input.title}`,
    `Author: ${input.author}`,
    `Categories: ${categories.join(', ') || 'Unknown'}`,
    `Description: ${description}`,
  ].join('\n');
}

export interface BatchMoodInput {
  bookId: string;
  title: string;
  author: string;
  description?: string | null;
  categories?: string[];
}

/**
 * Submit mood analysis for multiple books via OpenAI Batch API (50% cheaper).
 * Returns a batch ID for polling. Books without descriptions get heuristic fallback immediately.
 */
export async function submitBatchMoodAnalysis(
  books: BatchMoodInput[],
): Promise<{ batchId: string; submitted: number; heuristicFallbacks: number }> {
  const requests: BatchRequest[] = [];
  let heuristicFallbacks = 0;

  const systemPrompt = getMoodSystemPrompt();

  for (const book of books) {
    const description = (book.description || '').trim();

    // Books without descriptions can't use AI — use heuristic immediately
    if (!description) {
      heuristicFallbacks++;
      continue;
    }

    requests.push({
      customId: `mood_${book.bookId}`,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: getMoodUserPrompt(book) },
      ],
      temperature: 0.3,
      maxTokens: 700,
    });
  }

  if (requests.length === 0) {
    throw new Error('No books with descriptions to analyze — all used heuristic fallback');
  }

  const batchId = await submitBatch(requests, {
    type: 'mood_analysis',
    book_count: String(requests.length),
  });

  // Store batch job reference for tracking (same as famousReviews)
  await dbRun(
    `INSERT INTO ai_batch_jobs (id, batch_id, job_type, total_requests, status, created_at)
     VALUES (?, ?, 'mood_analysis', ?, 'submitted', NOW())`,
    [uuidv4(), batchId, requests.length],
  ).catch(() => {
    logger.warn('ai_batch_jobs table not found — batch tracking skipped');
  });

  logger.info(`📦 Submitted batch mood analysis: ${requests.length} books (batch: ${batchId}), ${heuristicFallbacks} heuristic fallbacks`);
  return { batchId, submitted: requests.length, heuristicFallbacks };
}

/**
 * Check status of a batch mood analysis job.
 */
export async function getBatchMoodStatus(batchId: string) {
  return getBatchStatus(batchId);
}

/**
 * Process completed batch mood results — parse and return results map.
 */
export async function processBatchMoodResults(
  batchId: string,
): Promise<Map<string, AIMoodAnalysisResult>> {
  const results = await getBatchResults(batchId);
  const analysisMap = new Map<string, AIMoodAnalysisResult>();

  for (const result of results) {
    const bookId = result.customId.replace('mood_', '');

    if (!result.success || !result.content) {
      logger.warn(`Batch mood failed for book ${bookId}: ${result.error}`);
      continue;
    }

    const json = extractJsonObject(result.content);
    if (!json) continue;

    const normalized = normalizeAnalysis(json);
    if (normalized.mood.moods.length === 0) continue;

    analysisMap.set(bookId, normalized);
  }

  logger.info(`📦 Batch mood results: ${analysisMap.size}/${results.length} successfully parsed`);
  return analysisMap;
}
