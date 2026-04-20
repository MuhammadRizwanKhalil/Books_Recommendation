import { v4 as uuidv4 } from 'uuid';
import { dbRun } from '../database.js';
import { logger } from '../lib/logger.js';

export const VALID_ACTIVITY_TYPES = [
  'review',
  'rating',
  'shelved',
  'started',
  'finished',
  'dnf',
  'progress',
  'list_created',
  'challenge_set',
] as const;

export type ActivityType = typeof VALID_ACTIVITY_TYPES[number];

function sanitizeMetadataValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.slice(0, 20).map(sanitizeMetadataValue);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).slice(0, 20).map(([key, inner]) => [key, sanitizeMetadataValue(inner)]),
    );
  }
  if (typeof value === 'string') return value.trim().slice(0, 500);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value).slice(0, 500);
}

export async function recordUserActivity(params: {
  userId: string;
  type: ActivityType;
  bookId?: string | null;
  referenceId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await dbRun(
      `INSERT INTO user_activities (id, user_id, activity_type, book_id, reference_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        params.userId,
        params.type,
        params.bookId ?? null,
        params.referenceId ?? null,
        params.metadata ? JSON.stringify(sanitizeMetadataValue(params.metadata)) : null,
      ],
    );
  } catch (err) {
    logger.error({ err, activity: params }, 'Failed to record user activity');
  }
}

export function parseActivityMetadata(metadata: unknown): Record<string, unknown> {
  if (!metadata) return {};
  if (typeof metadata === 'string') {
    try {
      return JSON.parse(metadata);
    } catch {
      return {};
    }
  }
  if (typeof metadata === 'object') {
    return metadata as Record<string, unknown>;
  }
  return {};
}
