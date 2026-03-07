/**
 * PWA Icon & OG Image Generator
 * 
 * Generates real PNG icons for PWA manifest and an OG image (1200x630)
 * using the Node.js `canvas` package.
 * 
 * Usage: cd app && node scripts/generate-icons.js
 * Requires: npm install canvas --save-dev
 */

import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.resolve(__dirname, '../public/icons');
const publicDir = path.resolve(__dirname, '../public');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

const BRAND_COLOR = '#c2631a';
const BRAND_DARK = '#a8520e';
const BG_GRADIENT_TOP = '#c2631a';
const BG_GRADIENT_BOTTOM = '#8B4513';

// ── PWA Icons ─────────────────────────────────────────────────────────────
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, BG_GRADIENT_TOP);
  grad.addColorStop(1, BG_GRADIENT_BOTTOM);

  // Rounded rectangle background
  const radius = size * 0.125;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Draw book icon (simplified open book shape)
  const cx = size / 2;
  const cy = size * 0.42;
  const bookW = size * 0.55;
  const bookH = size * 0.4;

  ctx.save();
  ctx.translate(cx, cy);

  // Left page
  ctx.beginPath();
  ctx.moveTo(0, -bookH / 2);
  ctx.quadraticCurveTo(-bookW * 0.5, -bookH / 2 + bookH * 0.1, -bookW / 2, -bookH / 2 + bookH * 0.05);
  ctx.lineTo(-bookW / 2, bookH / 2);
  ctx.quadraticCurveTo(-bookW * 0.3, bookH / 2 - bookH * 0.08, 0, bookH / 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fill();

  // Right page
  ctx.beginPath();
  ctx.moveTo(0, -bookH / 2);
  ctx.quadraticCurveTo(bookW * 0.5, -bookH / 2 + bookH * 0.1, bookW / 2, -bookH / 2 + bookH * 0.05);
  ctx.lineTo(bookW / 2, bookH / 2);
  ctx.quadraticCurveTo(bookW * 0.3, bookH / 2 - bookH * 0.08, 0, bookH / 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();

  // Spine line
  ctx.beginPath();
  ctx.moveTo(0, -bookH / 2);
  ctx.lineTo(0, bookH / 2);
  ctx.strokeStyle = BRAND_DARK;
  ctx.lineWidth = Math.max(1, size * 0.015);
  ctx.stroke();

  // Text lines on left page
  ctx.fillStyle = 'rgba(194, 99, 26, 0.3)';
  const lineY = -bookH * 0.2;
  for (let i = 0; i < 3; i++) {
    const y = lineY + i * bookH * 0.15;
    ctx.fillRect(-bookW * 0.38, y, bookW * 0.3, Math.max(1, size * 0.02));
  }

  ctx.restore();

  // "BD" text at bottom
  const fontSize = Math.round(size * 0.16);
  ctx.font = `bold ${fontSize}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillText('BD', cx, size * 0.82);

  return canvas.toBuffer('image/png');
}

console.log('Generating PWA icons...');
for (const size of iconSizes) {
  const buf = drawIcon(size);
  const filePath = path.join(iconsDir, `icon-${size}x${size}.png`);
  fs.writeFileSync(filePath, buf);
  console.log(`  ✓ ${filePath} (${buf.length} bytes)`);
}

// ── OG Image (1200 x 630) ────────────────────────────────────────────────
function drawOgImage() {
  const w = 1200, h = 630;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#1a1a2e');
  grad.addColorStop(0.5, '#16213e');
  grad.addColorStop(1, '#0f3460');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Decorative book shapes
  const drawDecorativeBook = (x, y, width, height, color, rotation) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.fillStyle = color;
    ctx.beginPath();
    const r = 8;
    ctx.moveTo(-width/2 + r, -height/2);
    ctx.lineTo(width/2 - r, -height/2);
    ctx.quadraticCurveTo(width/2, -height/2, width/2, -height/2 + r);
    ctx.lineTo(width/2, height/2 - r);
    ctx.quadraticCurveTo(width/2, height/2, width/2 - r, height/2);
    ctx.lineTo(-width/2 + r, height/2);
    ctx.quadraticCurveTo(-width/2, height/2, -width/2, height/2 - r);
    ctx.lineTo(-width/2, -height/2 + r);
    ctx.quadraticCurveTo(-width/2, -height/2, -width/2 + r, -height/2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  // Scatter decorative books
  drawDecorativeBook(100, 120, 60, 80, 'rgba(194,99,26,0.15)', -0.2);
  drawDecorativeBook(1050, 150, 50, 70, 'rgba(194,99,26,0.12)', 0.3);
  drawDecorativeBook(180, 500, 45, 65, 'rgba(139,69,19,0.1)', 0.15);
  drawDecorativeBook(1100, 480, 55, 75, 'rgba(194,99,26,0.1)', -0.1);
  drawDecorativeBook(950, 80, 40, 60, 'rgba(255,255,255,0.05)', 0.4);

  // Brand accent line at top
  ctx.fillStyle = BRAND_COLOR;
  ctx.fillRect(0, 0, w, 6);

  // Center book icon
  const bookCx = w * 0.25;
  const bookCy = h * 0.48;
  const bookW = 160;
  const bookH = 200;

  ctx.save();
  ctx.translate(bookCx, bookCy);

  // Book shadow
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetX = 5;
  ctx.shadowOffsetY = 10;

  // Left page
  ctx.beginPath();
  ctx.moveTo(0, -bookH / 2);
  ctx.quadraticCurveTo(-bookW * 0.55, -bookH * 0.35, -bookW / 2, -bookH * 0.4);
  ctx.lineTo(-bookW / 2, bookH / 2);
  ctx.quadraticCurveTo(-bookW * 0.3, bookH * 0.4, 0, bookH / 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fill();

  ctx.shadowColor = 'transparent';

  // Right page
  ctx.beginPath();
  ctx.moveTo(0, -bookH / 2);
  ctx.quadraticCurveTo(bookW * 0.55, -bookH * 0.35, bookW / 2, -bookH * 0.4);
  ctx.lineTo(bookW / 2, bookH / 2);
  ctx.quadraticCurveTo(bookW * 0.3, bookH * 0.4, 0, bookH / 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();

  // Spine
  ctx.beginPath();
  ctx.moveTo(0, -bookH / 2);
  ctx.lineTo(0, bookH / 2);
  ctx.strokeStyle = BRAND_COLOR;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.restore();

  // Title: "BookDiscovery"
  ctx.font = 'bold 72px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Book', w * 0.42, h * 0.35);
  ctx.fillStyle = BRAND_COLOR;
  ctx.fillText('Discovery', w * 0.42 + ctx.measureText('Book').width + 10, h * 0.35);

  // Tagline
  ctx.font = '28px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('AI-Powered Book Recommendations', w * 0.42, h * 0.50);

  // Features list
  ctx.font = '20px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  const features = ['✦ 50,000+ Books', '✦ Personalized Picks', '✦ Expert Reviews'];
  features.forEach((feat, i) => {
    ctx.fillText(feat, w * 0.42, h * 0.62 + i * 32);
  });

  // URL at bottom
  ctx.font = '18px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = BRAND_COLOR;
  ctx.textAlign = 'center';
  ctx.fillText('bookdiscovery.com', w / 2, h - 30);

  // Bottom accent line
  ctx.fillStyle = BRAND_COLOR;
  ctx.fillRect(0, h - 6, w, 6);

  return canvas.toBuffer('image/png');
}

console.log('Generating OG image...');
const ogBuf = drawOgImage();
const ogPath = path.join(publicDir, 'og-image.png');
fs.writeFileSync(ogPath, ogBuf);
console.log(`  ✓ ${ogPath} (${ogBuf.length} bytes)`);

console.log('\n✅ All assets generated successfully!');
