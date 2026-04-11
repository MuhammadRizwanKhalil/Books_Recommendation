/**
 * Image Validator — checks that book cover images from Google Books API
 * are valid, clear, and not placeholder/broken images.
 *
 * Validation checks:
 *  1. HTTP HEAD → status 200, content-type is image/*
 *  2. Content-Length > minimum threshold (avoid tiny placeholders)
 *  3. Full GET download → verify actual bytes received
 *  4. Dimension check via lightweight JPEG/PNG header parsing
 */

import https from 'https';
import http from 'http';

// ── Configuration ───────────────────────────────────────────────────────────

const MIN_IMAGE_BYTES = 5_000;        // Images under 5 KB are likely placeholders
const MAX_IMAGE_BYTES = 10_000_000;   // Skip images over 10 MB (corrupt / not a cover)
const MIN_WIDTH = 80;                 // Minimum pixel width
const MIN_HEIGHT = 100;               // Minimum pixel height
const REQUEST_TIMEOUT_MS = 10_000;    // 10 second timeout per image request

// Known Google Books placeholder / "no cover" image patterns
const PLACEHOLDER_PATTERNS = [
  'no_cover',
  'no-cover',
  'nothumbnail',
  'default_cover',
  'blank.gif',
  'pixel.gif',
];

// ── Public API ──────────────────────────────────────────────────────────────

export interface ImageValidationResult {
  valid: boolean;
  url: string;
  reason?: string;
  contentType?: string;
  contentLength?: number;
  width?: number;
  height?: number;
}

/**
 * Validate a single image URL.
 * Returns { valid: true, url } if the image is good, or { valid: false, reason } otherwise.
 */
export async function validateImageUrl(url: string): Promise<ImageValidationResult> {
  if (!url || typeof url !== 'string') {
    return { valid: false, url: url || '', reason: 'Empty or missing URL' };
  }

  // Quick pattern check for known placeholders
  const lowerUrl = url.toLowerCase();
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (lowerUrl.includes(pattern)) {
      return { valid: false, url, reason: `URL matches placeholder pattern: ${pattern}` };
    }
  }

  try {
    // Step 1: HEAD request to check content type and size
    const headResult = await headRequest(url);
    if (!headResult.ok) {
      return { valid: false, url, reason: `HEAD request failed: HTTP ${headResult.status}` };
    }

    const contentType = headResult.contentType || '';
    if (!contentType.startsWith('image/')) {
      return { valid: false, url, reason: `Not an image content type: ${contentType}` };
    }

    // Check declared content-length if available
    if (headResult.contentLength !== undefined) {
      if (headResult.contentLength < MIN_IMAGE_BYTES) {
        return { valid: false, url, reason: `Image too small: ${headResult.contentLength} bytes (min ${MIN_IMAGE_BYTES})` };
      }
      if (headResult.contentLength > MAX_IMAGE_BYTES) {
        return { valid: false, url, reason: `Image too large: ${headResult.contentLength} bytes` };
      }
    }

    // Step 2: Download the image and validate its content
    const downloadResult = await downloadImage(url);
    if (!downloadResult.ok) {
      return { valid: false, url, reason: `Download failed: ${downloadResult.error}` };
    }

    const buffer = downloadResult.buffer!;

    // Size check on actual downloaded bytes
    if (buffer.length < MIN_IMAGE_BYTES) {
      return { valid: false, url, reason: `Actual image too small: ${buffer.length} bytes` };
    }

    // Step 3: Parse image dimensions from headers
    const dimensions = parseImageDimensions(buffer);
    if (dimensions) {
      if (dimensions.width < MIN_WIDTH || dimensions.height < MIN_HEIGHT) {
        return {
          valid: false,
          url,
          reason: `Image too small: ${dimensions.width}x${dimensions.height} (min ${MIN_WIDTH}x${MIN_HEIGHT})`,
          width: dimensions.width,
          height: dimensions.height,
        };
      }
    }

    // Step 4: Check for solid color / blank image (sample pixel variance)
    if (isSolidColor(buffer, contentType)) {
      return { valid: false, url, reason: 'Image appears to be a solid color (blank/placeholder)' };
    }

    return {
      valid: true,
      url,
      contentType,
      contentLength: buffer.length,
      width: dimensions?.width,
      height: dimensions?.height,
    };
  } catch (err: any) {
    return { valid: false, url, reason: `Validation error: ${err.message}` };
  }
}

/**
 * Validate multiple image URLs, return the first valid one.
 * Google Books provides thumbnail, smallThumbnail, and sometimes other sizes.
 */
export async function findBestValidImage(urls: string[]): Promise<ImageValidationResult | null> {
  for (const url of urls) {
    if (!url) continue;
    const result = await validateImageUrl(url);
    if (result.valid) return result;
  }
  return null;
}

// ── HTTP Helpers ────────────────────────────────────────────────────────────

interface HeadResult {
  ok: boolean;
  status?: number;
  contentType?: string;
  contentLength?: number;
}

const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; TheBookTimes/1.0; +https://thebooktimes.com)',
};

function headRequest(url: string): Promise<HeadResult> {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.request(url, { method: 'HEAD', timeout: REQUEST_TIMEOUT_MS, headers: HTTP_HEADERS }, (res) => {
      // Follow redirects (up to 3)
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(headRequest(res.headers.location));
        return;
      }
      resolve({
        ok: res.statusCode === 200,
        status: res.statusCode,
        contentType: res.headers['content-type']?.split(';')[0].trim(),
        contentLength: res.headers['content-length'] ? parseInt(res.headers['content-length'], 10) : undefined,
      });
    });
    req.on('error', () => resolve({ ok: false }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false }); });
    req.end();
  });
}

interface DownloadResult {
  ok: boolean;
  buffer?: Buffer;
  error?: string;
}

function downloadImage(url: string, redirectCount = 0): Promise<DownloadResult> {
  if (redirectCount > 3) {
    return Promise.resolve({ ok: false, error: 'Too many redirects' });
  }

  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: REQUEST_TIMEOUT_MS, headers: HTTP_HEADERS }, (res) => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(downloadImage(res.headers.location, redirectCount + 1));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        resolve({ ok: false, error: `HTTP ${res.statusCode}` });
        return;
      }

      const chunks: Buffer[] = [];
      let totalSize = 0;
      res.on('data', (chunk: Buffer) => {
        totalSize += chunk.length;
        if (totalSize > MAX_IMAGE_BYTES) {
          res.destroy();
          resolve({ ok: false, error: 'Image exceeds max size' });
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => resolve({ ok: true, buffer: Buffer.concat(chunks) }));
      res.on('error', (e) => resolve({ ok: false, error: e.message }));
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'Timeout' }); });
  });
}

// ── Image Dimension Parsing ─────────────────────────────────────────────────

interface Dimensions {
  width: number;
  height: number;
}

/**
 * Parse image dimensions from the binary header without a full decoder.
 * Supports JPEG, PNG, GIF, and WebP.
 */
function parseImageDimensions(buffer: Buffer): Dimensions | null {
  if (buffer.length < 24) return null;

  // PNG: bytes 0-3 are 0x89504E47, width at 16, height at 20 (big-endian)
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }

  // GIF: bytes 0-2 are "GIF", width at 6, height at 8 (little-endian 16-bit)
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    const width = buffer.readUInt16LE(6);
    const height = buffer.readUInt16LE(8);
    return { width, height };
  }

  // JPEG: bytes 0-1 are 0xFFD8
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
    return parseJpegDimensions(buffer);
  }

  // WebP: RIFF....WEBP, VP8 header contains dimensions
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return parseWebPDimensions(buffer);
  }

  return null;
}

function parseJpegDimensions(buffer: Buffer): Dimensions | null {
  let offset = 2;
  while (offset < buffer.length - 1) {
    if (buffer[offset] !== 0xFF) return null;
    const marker = buffer[offset + 1];

    // SOF markers (0xC0-0xCF except 0xC4, 0xC8, 0xCC)
    if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
      if (offset + 9 > buffer.length) return null;
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return { width, height };
    }

    // Skip this segment
    if (offset + 3 >= buffer.length) return null;
    const segmentLength = buffer.readUInt16BE(offset + 2);
    offset += 2 + segmentLength;
  }
  return null;
}

function parseWebPDimensions(buffer: Buffer): Dimensions | null {
  // VP8 (lossy)
  if (buffer.length > 27 && buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x20) {
    const width = buffer.readUInt16LE(26) & 0x3FFF;
    const height = buffer.readUInt16LE(28) & 0x3FFF;
    return { width, height };
  }
  // VP8L (lossless)
  if (buffer.length > 25 && buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x4C) {
    const bits = buffer.readUInt32LE(21);
    const width = (bits & 0x3FFF) + 1;
    const height = ((bits >> 14) & 0x3FFF) + 1;
    return { width, height };
  }
  return null;
}

// ── Solid Color Detection ───────────────────────────────────────────────────

/**
 * Rough heuristic: if the image data (after headers) has very low entropy,
 * it's likely a solid-color or near-blank placeholder.
 * We sample bytes and check variance.
 */
function isSolidColor(buffer: Buffer, contentType: string): boolean {
  // Only check for JPEG/PNG (main formats from Google Books)
  if (!contentType.includes('jpeg') && !contentType.includes('png') && !contentType.includes('jpg')) {
    return false;
  }

  // Sample the middle 20% of the buffer (skip headers/metadata)
  const startOffset = Math.floor(buffer.length * 0.4);
  const endOffset = Math.floor(buffer.length * 0.6);
  if (endOffset - startOffset < 100) return false;

  const sample = buffer.subarray(startOffset, endOffset);
  const sampleSize = Math.min(sample.length, 500);

  // Calculate byte variance
  let sum = 0;
  for (let i = 0; i < sampleSize; i++) {
    sum += sample[i];
  }
  const mean = sum / sampleSize;

  let variance = 0;
  for (let i = 0; i < sampleSize; i++) {
    variance += (sample[i] - mean) ** 2;
  }
  variance /= sampleSize;

  // Very low variance = likely solid color
  // Compressed image data normally has high entropy
  return variance < 5;
}
