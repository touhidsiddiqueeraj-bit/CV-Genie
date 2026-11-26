#!/usr/bin/env node
/* PWA suite: manifest linked and parseable, icons served, service worker
   registers → activates → controls the page, the app shell loads fully
   offline (index.html + CDN libs from the SW cache), Gemini stays uncached,
   and the install button is wired. 127.0.0.1 is a secure context, so the
   service worker runs in the test exactly as it does on GitHub Pages. */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const PORT = 8137;
const BASE = `http://127.0.0.1:${PORT}`;

let pass = 0, fail = 0;
const ok = (cond, label, extra) => { if (cond) { pass++; console.log('  PASS', label); } else { fail++; console.log('  FAIL', label, extra || ''); } };

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', REPO], { stdio: 'pipe' });
  await new Promise((res) => { const t = setInterval(async () => { try { await fetch(BASE + '/'); clearInterval(t); res(); } catch (e) {} }, 200); });

  /* the manifest + sw must be served with sane content */
  const mres = await fetch(BASE + '/manifest.webmanifest');
  ok(mres.status === 200, 'manifest.webmanifest served');
  const manifest = await mres.json();
  ok(manifest.name && manifest.short_name === 'CV Genie', 'manifest name fields');
  ok(manifest.display === 'standalone' && manifest.start_url.includes('index.html'), 'standalone display + start_url');
  ok(manifest.icons.length === 4 && manifest.icons.every(i => i.src.startsWith('icons/')), '4 icons declared');
  for (const i of manifest.icons) {
    const r = await fetch(BASE + '/' + i.src);
    ok(r.status === 200 && (await r.arrayBuffer()).byteLength > 1000, 'icon served: ' + i.src);
  }
  ok((await fetch(BASE + '/.well-known/assetlinks.json')).status === 200, 'assetlinks.json served');

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 940 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => { fail++; console.log('  PAGE ERROR:', String(e).slice(0, 300)); });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });

  ok(await page.evaluate(() => !!document.querySelector('link[rel="manifest"]')), 'manifest <link> present');
  ok(await page.evaluate(() => !!document.querySelector('link[rel="apple-touch-icon"]')), 'apple-touch-icon present');
  ok(await page.evaluate(() => document.getElementById('installBtn') !== null), 'install button in DOM');

  /* service worker: registered → activated → controlling */
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 })
    .then(() => ok(true, 'service worker controls the page'))
    .catch(() => ok(false, 'service worker controls the page'));
  const swState = await page.evaluate(async () => {
    const deadline = Date.now() + 30000;
    do {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.active && reg.active.state === 'activated') return 'activated';
      await new Promise(r => setTimeout(r, 500));
    } while (Date.now() < deadline);
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ? (reg.active && reg.active.state) : 'none';
  });
  ok(swState === 'activated', 'SW state: ' + swState);

  /* caches: app shell precached (+ CDN warm happens right after activation) */
  const cached = await page.evaluate(async () => {
    const deadline = Date.now() + 30000;
    let urls = [];
    do {
      const keys = await caches.keys();
      const c = await caches.open(keys.find(k => k.includes('cv-genie')) || keys[0]);
      urls = (await c.keys()).map(r => r.url);
      if (urls.some(u => u.includes('cdnjs.cloudflare.com'))) break;
      await new Promise(r => setTimeout(r, 500));
    } while (Date.now() < deadline);
    return urls;
  });
  ok(cached.some(u => u.endsWith('index.html')), 'index.html precached');
  ok(cached.some(u => u.endsWith('manifest.webmanifest')), 'manifest precached');
  ok(cached.some(u => u.includes('icon-192')), 'icons precached');
  ok(cached.some(u => u.includes('cdnjs.cloudflare.com')), 'CDN libs warmed into cache');
  ok(cached.some(u => u.includes('fonts.gstatic.com')), 'web fonts warmed into cache');

  /* full offline reload — the app must come up with no network at all */
  await context.setOffline(true);
  const offlineOk = await page.evaluate(() => fetch('./', { cache: 'no-store' }).then(r => r.ok).catch(() => false));
  ok(offlineOk, 'navigation works offline (SW fallback)');
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  const offlineState = await page.evaluate(() => ({
    ready: document.readyState,
    hasApp: !!document.querySelector('.app-header'),
    hasTemplates: typeof TEMPLATES !== 'undefined' && TEMPLATES.length === 31
  })).catch(() => null);
  ok(offlineState && offlineState.hasApp && offlineState.hasTemplates, 'app boots fully offline', JSON.stringify(offlineState));
  await context.setOffline(false);

  /* Gemini API is never cached */
  const geminiCached = cached.some(u => u.includes('generativelanguage'));
  ok(!geminiCached, 'Gemini API not cached');

  await browser.close();
  server.kill();
  console.log('\n' + (fail === 0 ? `✔ all ${pass} pwa checks passed` : `✘ ${fail} failed (${pass} passed)`));
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
