#!/usr/bin/env node
/* Regenerates the PWA icon set (icons/) from the brand SVG — the same mark the
   header and favicon use. Renders with headless Chromium for pixel-perfect PNGs:
     icon-192 / icon-512   — rounded-square logo, transparent corners ("any")
     maskable-192 / -512   — full-bleed gradient, glyph inside the safe zone
     apple-touch-icon      — 180px full-bleed square for iOS home screens
   Run:  NODE_PATH=/home/z/.npm-global/lib/node_modules node scripts/make-icons.js  */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ICONS = path.join(ROOT, 'icons');
fs.mkdirSync(ICONS, { recursive: true });

/* brand glyph — same paths as .brand-mark in index.html */
const GLYPH = `
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#3b82f6"/>
  </linearGradient></defs>
  <rect width="48" height="48" rx="12" fill="url(#g)"/>
  <path d="M17.5 8.5h11l8.5 8.5v20a3 3 0 0 1-3 3h-16.5a3 3 0 0 1-3-3v-25.5a3 3 0 0 1 3-3z" fill="#fff"/>
  <rect x="18" y="25" width="13" height="2.8" rx="1.4" fill="#8478f2"/>
  <rect x="18" y="31.5" width="8" height="2.8" rx="1.4" fill="#8478f2"/>
  <path d="M39 1.8l1.4 3.8 3.8 1.4-3.8 1.4-1.4 3.8-1.4-3.8-3.8-1.4 3.8-1.4z" fill="#fff"/>`;

const page = (size, inner, bg) => `<!DOCTYPE html><html><head><style>
  html,body{margin:0;padding:0;background:${bg};}
  svg{display:block;width:${size}px;height:${size}px;}
</style></head><body>${inner}</body></html>`;

function logoSvg(size) {
  return `<svg viewBox="0 0 48 48" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">${GLYPH}</svg>`;
}
/* maskable: gradient bleeds to the edges; glyph shrunk to the 80% safe zone */
function maskableSvg(size) {
  const s = size * 0.78, o = (size - s) / 2;
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#3b82f6"/>
    </linearGradient></defs>
    <rect width="${size}" height="${size}" fill="url(#bg)"/>
    <g transform="translate(${o} ${o})">${GLYPH.replace('<rect width="48" height="48" rx="12" fill="url(#g)"/>', `<rect width="48" height="48" rx="12" fill="#ffffff22"/>`).replace(/fill="#8478f2"/g, 'fill="#6d5fd6"')}</g>
  </svg>`;
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 560, height: 560 }, deviceScaleFactor: 1 });
  const jobs = [
    { file: 'icon-192.png', size: 192, html: () => page(192, logoSvg(192), 'transparent') },
    { file: 'icon-512.png', size: 512, html: () => page(512, logoSvg(512), 'transparent') },
    { file: 'maskable-192.png', size: 192, html: () => page(192, maskableSvg(192), 'transparent') },
    { file: 'maskable-512.png', size: 512, html: () => page(512, maskableSvg(512), 'transparent') },
    { file: 'apple-touch-icon.png', size: 180, html: () => page(180, maskableSvg(180), '#3b82f6') }
  ];
  for (const j of jobs) {
    const p = await ctx.newPage();
    await p.setContent(j.html());
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(ICONS, j.file), omitBackground: true, clip: { x: 0, y: 0, width: j.size, height: j.size } });
    await p.close();
    const kb = (fs.statSync(path.join(ICONS, j.file)).size / 1024).toFixed(1);
    console.log(`  ${j.file}  ${j.size}x${j.size}  ${kb} KB`);
  }
  await browser.close();
  console.log('icons regenerated in', ICONS);
})().catch((e) => { console.error(e); process.exit(1); });
