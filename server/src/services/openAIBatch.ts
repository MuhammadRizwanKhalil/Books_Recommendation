/**
 * OpenAI Batch API Service — Cost-Effective Bulk Processing
 *
 * Uses the OpenAI Batch API to process multiple chat completion requests
 * at 50% cost compared to individual API calls.
 *
 * How it works:
 *  1. Collect multiple requests into a JSONL file
 *  2. Upload the file to OpenAI
 *  3. Create a batch job (processes within 24 hours)
 *  4. Poll for completion
 *  5. Download and return results
 *
 * @see https://platform.openai.com/docs/api-reference/batch
 */

import OpenAI from 'openai';
import { Readable } from 'stream';
import { config } from '../config.js';

// ── Types ───────────────────────────────────────────────────────────────────

export interface BatchRequest {
  /** Unique identifier for correlating results back to inputs */
  customId: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
}

export interface BatchResult {
  customId: string;
  success: boolean;
  content?: string;
  model?: string;
  tokensUsed?: number;
  error?: string;
}

export interface BatchJobStatus {
  batchId: string;
  status: 'validating' | 'in_progress' | 'finalizing' | 'completed' | 'failed' | 'expired' | 'cancelling' | 'cancelled';
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  createdAt: string;
  completedAt?: string;
  outputFileId?: string;
  errorFileId?: string;
}

// ── Client Singleton ────────────────────────────────────────────────────────

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    if (!config.openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    client = new OpenAI({
      apiKey: config.openaiApiKey,
      timeout: 120_000, // Longer timeout for batch file operations
      maxRetries: 3,
    });
  }
  return client;
}

// ── Batch API Core ──────────────────────────────────────────────────────────

/**
 * Build a JSONL string from batch requests.
 * Each line is a single JSON object representing one chat completion request.
 */
function buildJSONL(requests: BatchRequest[], model: string): string {
  return requests
    .map((req) =>
      JSON.stringify({
        custom_id: req.customId,
        method: 'POST',
        url: '/v1/chat/completions',
        body: {
          model,
          messages: req.messages,
          temperature: req.temperature ?? 0.7,
          max_tokens: req.maxTokens ?? 2500,
        },
      }),
    )
    .join('\n');
}

/**
 * Submit a batch of chat completion requests to OpenAI Batch API.
 * Returns a batch ID that can be polled for status and results.
 *
 * Cost: 50% of standard API pricing.
 * Completion: Within 24 hours (usually much faster).
 */
export async function submitBatch(
  requests: BatchRequest[],
  metadata?: Record<string, string>,
): Promise<string> {
  if (requests.length === 0) {
    throw new Error('Cannot submit an empty batch');
  }

  if (requests.length > 50_000) {
    throw new Error('Batch API supports up to 50,000 requests per batch');
  }

  const openai = getClient();
  const model = config.openaiModel;
  const jsonl = buildJSONL(requests, model);

  // Upload JSONL as a file
  const file = await openai.files.create({
    file: new File([jsonl], 'batch_requests.jsonl', { type: 'application/jsonl' }),
    purpose: 'batch',
  });

  // Create batch job
  const batch = await openai.batches.create({
    input_file_id: file.id,
    endpoint: '/v1/chat/completions',
    completion_window: '24h',
    metadata: metadata || undefined,
  });

  return batch.id;
}

/**
 * Check the status of a batch job.
 */
export async function getBatchStatus(batchId: string): Promise<BatchJobStatus> {
  const openai = getClient();
  const batch = await openai.batches.retrieve(batchId);

  return {
    batchId: batch.id,
    status: batch.status as BatchJobStatus['status'],
    totalRequests: batch.request_counts?.total ?? 0,
    completedRequests: batch.request_counts?.completed ?? 0,
    failedRequests: batch.request_counts?.failed ?? 0,
    createdAt: new Date((batch.created_at ?? 0) * 1000).toISOString(),
    completedAt: batch.completed_at ? new Date(batch.completed_at * 1000).toISOString() : undefined,
    outputFileId: batch.output_file_id ?? undefined,
    errorFileId: batch.error_file_id ?? undefined,
  };
}

/**
 * Download and parse batch results from a completed batch job.
 */
export async function getBatchResults(batchId: string): Promise<BatchResult[]> {
  const openai = getClient();
  const batch = await openai.batches.retrieve(batchId);

  if (batch.status !== 'completed') {
    throw new Error(`Batch ${batchId} is not completed (status: ${batch.status})`);
  }

  if (!batch.output_file_id) {
    throw new Error(`Batch ${batchId} has no output file`);
  }

  // Download the output file
  const response = await openai.files.content(batch.output_file_id);
  const content = await response.text();

  // Parse JSONL results
  const results: BatchResult[] = [];
  const lines = content.split('\n').filter(Boolean);

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      const customId = entry.custom_id;

      if (entry.response?.status_code === 200) {
        const body = entry.response.body;
        const choice = body?.choices?.[0];
        results.push({
          customId,
          success: true,
          content: choice?.message?.content || '',
          model: body?.model,
          tokensUsed: body?.usage?.total_tokens || 0,
        });
      } else {
        results.push({
          customId,
          success: false,
          error: entry.error?.message || `HTTP ${entry.response?.status_code}`,
        });
      }
    } catch {
      // Skip malformed lines
    }
  }

  return results;
}

/**
 * Cancel a batch job (if it hasn't completed yet).
 */
export async function cancelBatch(batchId: string): Promise<BatchJobStatus> {
  const openai = getClient();
  const batch = await openai.batches.cancel(batchId);

  return {
    batchId: batch.id,
    status: batch.status as BatchJobStatus['status'],
    totalRequests: batch.request_counts?.total ?? 0,
    completedRequests: batch.request_counts?.completed ?? 0,
    failedRequests: batch.request_counts?.failed ?? 0,
    createdAt: new Date((batch.created_at ?? 0) * 1000).toISOString(),
  };
}

/**
 * List recent batch jobs.
 */
export async function listBatches(limit: number = 20): Promise<BatchJobStatus[]> {
  const openai = getClient();
  const list = await openai.batches.list({ limit });

  const batches: BatchJobStatus[] = [];
  for await (const batch of list) {
    batches.push({
      batchId: batch.id,
      status: batch.status as BatchJobStatus['status'],
      totalRequests: batch.request_counts?.total ?? 0,
      completedRequests: batch.request_counts?.completed ?? 0,
      failedRequests: batch.request_counts?.failed ?? 0,
      createdAt: new Date((batch.created_at ?? 0) * 1000).toISOString(),
      completedAt: batch.completed_at ? new Date(batch.completed_at * 1000).toISOString() : undefined,
      outputFileId: batch.output_file_id ?? undefined,
      errorFileId: batch.error_file_id ?? undefined,
    });
    if (batches.length >= limit) break;
  }

  return batches;
}

// ── Convenience: Submit + Poll + Return Results ─────────────────────────────

/**
 * Submit a batch and wait for it to complete by polling.
 *
 * @param requests - Array of batch requests
 * @param pollIntervalMs - How often to check status (default: 30s)
 * @param timeoutMs - Maximum wait time (default: 4 hours)
 * @param onProgress - Optional callback for progress updates
 */
export async function submitAndWaitForBatch(
  requests: BatchRequest[],
  options?: {
    pollIntervalMs?: number;
    timeoutMs?: number;
    onProgress?: (status: BatchJobStatus) => void;
    metadata?: Record<string, string>;
  },
): Promise<BatchResult[]> {
  const pollInterval = options?.pollIntervalMs ?? 30_000;
  const timeout = options?.timeoutMs ?? 4 * 60 * 60 * 1000;  // 4 hours
  const startTime = Date.now();

  const batchId = await submitBatch(requests, options?.metadata);

  while (true) {
    const status = await getBatchStatus(batchId);
    options?.onProgress?.(status);

    if (status.status === 'completed') {
      return getBatchResults(batchId);
    }

    if (status.status === 'failed' || status.status === 'expired' || status.status === 'cancelled') {
      throw new Error(`Batch ${batchId} ${status.status}: ${status.failedRequests} failed requests`);
    }

    if (Date.now() - startTime > timeout) {
      throw new Error(`Batch ${batchId} timed out after ${timeout / 1000}s (status: ${status.status})`);
    }

    await new Promise(r => setTimeout(r, pollInterval));
  }
}
