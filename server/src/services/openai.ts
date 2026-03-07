import OpenAI from 'openai';
import { config } from '../config.js';

let client: OpenAI | null = null;

// Daily token usage tracking for cost control
let dailyTokens = 0;
let dailyTokensResetDate = new Date().toDateString();
const MAX_DAILY_TOKENS = parseInt(process.env.OPENAI_MAX_DAILY_TOKENS || '100000', 10);

function getClient(): OpenAI {
  if (!client) {
    if (!config.openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    client = new OpenAI({
      apiKey: config.openaiApiKey,
      timeout: 60_000,       // 60s request timeout
      maxRetries: 3,         // Retry transient 5xx errors
    });
  }
  return client;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerationResult {
  content: string;
  model: string;
  tokensUsed: number;
}

/**
 * Send a chat completion request to OpenAI.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<GenerationResult> {
  // Reset daily counter at midnight
  const today = new Date().toDateString();
  if (today !== dailyTokensResetDate) {
    dailyTokens = 0;
    dailyTokensResetDate = today;
  }

  // Cost control: refuse if daily budget exceeded
  if (dailyTokens >= MAX_DAILY_TOKENS) {
    throw new Error(`Daily OpenAI token budget exhausted (${MAX_DAILY_TOKENS} tokens). Resets at midnight.`);
  }

  const openai = getClient();

  const response = await openai.chat.completions.create({
    model: config.openaiModel,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2500,
  });

  const choice = response.choices[0];
  if (!choice?.message?.content) {
    throw new Error('OpenAI returned empty response');
  }

  const tokensUsed = response.usage?.total_tokens ?? 0;
  dailyTokens += tokensUsed;

  return {
    content: choice.message.content,
    model: response.model,
    tokensUsed,
  };
}

/**
 * Check if OpenAI API key is configured and working.
 */
export async function testOpenAIConnection(): Promise<{ success: boolean; error?: string }> {
  if (!config.openaiApiKey) {
    return { success: false, error: 'OPENAI_API_KEY not configured' };
  }
  try {
    const openai = getClient();
    await openai.models.list();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
