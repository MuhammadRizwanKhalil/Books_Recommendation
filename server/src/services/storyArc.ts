import { chatCompletion } from './openai.js';

export interface StoryArcPoint {
  position: number;
  intensity: number;
  label?: string | null;
}

const DEFAULT_ARC: StoryArcPoint[] = [
  { position: 0, intensity: 0.2, label: 'Introduction' },
  { position: 15, intensity: 0.4, label: 'Inciting Incident' },
  { position: 50, intensity: 0.62, label: 'Midpoint' },
  { position: 78, intensity: 0.95, label: 'Climax' },
  { position: 95, intensity: 0.35, label: 'Resolution' },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, 100);
  return trimmed || null;
}

function normalizePoint(input: any): StoryArcPoint | null {
  const rawPosition = Number(input?.position ?? input?.positionPercent ?? input?.x);
  const rawIntensity = Number(input?.intensity ?? input?.y);
  if (!Number.isFinite(rawPosition) || !Number.isFinite(rawIntensity)) return null;

  return {
    position: Math.round(clamp(rawPosition, 0, 100) * 100) / 100,
    intensity: Math.round(clamp(rawIntensity, 0, 1) * 100) / 100,
    label: normalizeLabel(input?.label),
  };
}

function normalizeArc(points: StoryArcPoint[]): StoryArcPoint[] {
  const cleaned = points
    .map(normalizePoint)
    .filter((point): point is StoryArcPoint => point !== null)
    .sort((a, b) => a.position - b.position);

  if (cleaned.length < 3) {
    return DEFAULT_ARC;
  }

  const uniqueByPosition = new Map<number, StoryArcPoint>();
  for (const point of cleaned) {
    uniqueByPosition.set(point.position, point);
  }
  const deduped = [...uniqueByPosition.values()].sort((a, b) => a.position - b.position);

  if (deduped[0].position > 0) {
    deduped.unshift({ position: 0, intensity: Math.max(0.1, deduped[0].intensity * 0.7), label: 'Introduction' });
  }

  const last = deduped[deduped.length - 1];
  if (last.position < 95) {
    deduped.push({ position: 95, intensity: Math.min(0.5, last.intensity * 0.6), label: 'Resolution' });
  }

  return deduped.slice(0, 15);
}

function buildFallbackArc(description: string): StoryArcPoint[] {
  const seed = clamp(description.length / 1200, 0, 1);
  return normalizeArc([
    { position: 0, intensity: 0.18 + seed * 0.08, label: 'Introduction' },
    { position: 20, intensity: 0.35 + seed * 0.1, label: 'Inciting Incident' },
    { position: 48, intensity: 0.55 + seed * 0.1, label: 'Midpoint' },
    { position: 72, intensity: 0.82 + seed * 0.12, label: 'Escalation' },
    { position: 86, intensity: 0.92, label: 'Climax' },
    { position: 96, intensity: 0.3 + seed * 0.08, label: 'Resolution' },
  ]);
}

function tryParseJsonPayload(content: string): StoryArcPoint[] | null {
  const direct = (() => {
    try {
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : parsed?.arc;
    } catch {
      return null;
    }
  })();

  if (Array.isArray(direct)) {
    return normalizeArc(direct as StoryArcPoint[]);
  }

  const fenced = content.match(/```json\s*([\s\S]*?)```/i)?.[1] || content.match(/\[\s*\{[\s\S]*\}\s*\]/)?.[0];
  if (!fenced) return null;

  try {
    const parsed = JSON.parse(fenced);
    if (!Array.isArray(parsed)) return null;
    return normalizeArc(parsed as StoryArcPoint[]);
  } catch {
    return null;
  }
}

export async function generateStoryArcPoints(input: {
  title: string;
  author: string;
  description?: string | null;
  categories?: string[];
}): Promise<StoryArcPoint[]> {
  const description = (input.description || '').trim().slice(0, 3000);

  if (!description) {
    return DEFAULT_ARC;
  }

  try {
    const prompt = [
      `Title: ${input.title}`,
      `Author: ${input.author}`,
      `Categories: ${(input.categories || []).join(', ') || 'Unknown'}`,
      `Description: ${description}`,
    ].join('\n');

    const completion = await chatCompletion([
      {
        role: 'system',
        content: 'You extract a spoiler-safe narrative intensity curve from a book description. Respond with ONLY JSON array of 5-10 points. Each point: {"position": 0-100, "intensity": 0-1, "label": "short label"}. Keep labels generic and avoid explicit spoilers.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ], { temperature: 0.4, maxTokens: 600 });

    const parsed = tryParseJsonPayload(completion.content);
    if (parsed && parsed.length >= 3) {
      return parsed;
    }
  } catch {
    // Fallback below ensures deterministic behavior when AI is unavailable.
  }

  return buildFallbackArc(description);
}
