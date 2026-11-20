#!/usr/bin/env node
/* Refreshes docs/images/export.png — the export modal with its current
   (fully local) format list. Run:
   NODE_PATH=/home/z/.npm-global/lib/node_modules node scripts/shoot-export.js */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const REPO = path.resolve(__dirname, '..');
const PORT = 8142;
(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', REPO], { stdio: 'pipe' });
  await new Promise((res) => { const t = setInterval(async () => { try { await fetch('http://127.0.0.1:'+PORT+'/'); clearInterval(t); res(); } catch (e) {} }, 200); });
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 940 }, deviceScaleFactor: 2 })).newPage();
  await page.goto('http://127.0.0.1:'+PORT+'/', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    document.getElementById('fullName').value = 'Touhid Siddiquee';
    document.getElementById('title').value = 'Senior Software Engineer';
    updatePreview();
    openExportModal();
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(REPO, 'docs/images/export.png') });
  await browser.close(); server.kill();
  console.log('docs/images/export.png refreshed');
})().catch(e => { console.error(e); process.exit(1); });
