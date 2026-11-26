#!/usr/bin/env node
/* Modular-architecture smoke test: the ES-module graph loads clean,
 * the window bridge exposes the app's public surface, all stylesheets
 * load, every template renders real content, and the service worker
 * precaches the whole graph.
 * Run: NODE_PATH=/home/z/.npm-global/lib/node_modules node scripts/test-modules.js */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const PORT = 8161;
const BASE = `http://127.0.0.1:${PORT}`;

let failures = 0;
const check = (label, ok, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`);
  if (!ok) failures++;
};

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', REPO], { stdio: 'pipe' });
  await new Promise((res) => {
    const t = setInterval(async () => {
      try { await fetch(BASE + '/'); clearInterval(t); res(); } catch (e) { /* retry */ }
    }, 200);
  });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 940 } });
  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));
  page.on('requestfailed', r => failedRequests.push(r.url()));
  page.on('response', r => { if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`); });

  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  console.log('\n[1] module graph loads clean');
  check('zero console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
  check('zero failed requests', failedRequests.length === 0, failedRequests.slice(0, 3).join(' | '));

  console.log('\n[2] stylesheets & scripts');
  const assets = await page.evaluate(() => ({
    sheets: [...document.styleSheets].filter(s => s.href && s.href.includes('/css/')).length,
    sheetHrefs: [...document.styleSheets].filter(s => s.href).map(s => s.href.split('/css/')[1]).filter(Boolean),
    moduleScripts: document.querySelectorAll('script[type="module"]').length,
    bootScript: !!document.querySelector('script[src="js/boot-prepaint.js"]')
  }));
  check('all 10 stylesheets loaded', assets.sheets === 10, assets.sheets + ': ' + assets.sheetHrefs.join(', '));
  check('exactly one module entry (js/main.js)', assets.moduleScripts === 1);
  check('pre-paint bootstrap present', assets.bootScript);

  console.log('\n[3] window bridge (public surface)');
  const bridge = await page.evaluate(() => ({
    fns: ['updatePreview', 'changeTemplate', 'runATSAnalysis', 'renderLetter', 'runLetterAi',
      'exportDocx', 'tpl3dNext', 'mobileNav', 'switchTab', 'setActiveDoc', 'installApp',
      'pushUndo', 'undo', 'redo', 'draftLetter', 'buildLetterRTF', 'parseCVText', 'cviCallGemini',
      'addExperience', 'showToast', 'setColor', 'setFontPair'].every(n => typeof window[n] === 'function'),
    liveState: currentTemplate === 'classic' && activeDoc === 'cv' && previewMode === 'gallery',
    exportSelRef: typeof exportSel === 'object' && exportSel !== null
  }));
  check('22 core APIs on window', bridge.fns);
  check('live state bindings readable (currentTemplate/activeDoc/previewMode)', bridge.liveState);
  check('exportSel object reachable for inline checkboxes', bridge.exportSelRef);

  console.log('\n[4] all 30 templates render real content');
  const render = await page.evaluate(() => {
    const out = [];
    for (const t of TEMPLATES) {
      const html = templateHtml(t, collectPreviewData());
      out.push({ t, len: html.length });
    }
    /* fill once so the second pass has data too */
    document.getElementById('fullName').value = 'Test User';
    document.getElementById('skills').value = 'Alpha, Beta, Gamma';
    document.getElementById('summary').value = 'A summary for rendering checks.';
    updatePreview();
    const filled = TEMPLATES.map(t => ({ t, len: templateHtml(t, collectPreviewData()).length }));
    /* with an empty form every design still renders at least the name block
       (some minimal designs are legitimately tiny — academic ≈ 66 chars) */
    return { empty: out.filter(o => o.len < 30), filledMin: Math.min(...filled.map(o => o.len)), total: TEMPLATES.length };
  });
  await page.waitForTimeout(400);
  check('every template renders its name block with an empty form', render.empty.length === 0,
    render.empty.length ? render.empty.map(o => o.t + '=' + o.len).join(', ') : `${render.total} templates`);
  check('every template renders with sample data', render.filledMin > 200, 'min ' + render.filledMin + ' chars');

  console.log('\n[5] carousel exposes all designs');
  const carousel = await page.evaluate(() => ({
    cards: document.querySelectorAll('#tpl3dTrack .tpl3d-card').length,
    count: document.getElementById('tpl3dCount').textContent,
    liveRender: !!document.querySelector('#tpl3dTrack .tpl3d-card.is-center .cv-preview')
  }));
  check('31 carousel cards', carousel.cards === 31, carousel.cards + ' cards, counter "' + carousel.count + '"');
  check('center card is a live render (not wireframe)', carousel.liveRender);

  console.log('\n[6] service worker precaches the module graph');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(600);
  const sw = await page.evaluate(async () => {
    const c = await caches.open('cv-genie-v2.9');
    const keys = await c.keys();
    const paths = keys.map(r => new URL(r.url).pathname);
    return {
      js: ['main', 'globals', 'config', 'app-state', 'ui', 'gemini', 'cvdata', 'history', 'form',
        'preview', 'render', 'letter', 'letter-engine', 'ats', 'export', 'versions', 'cv-import',
        'state', 'carousel', 'boot-prepaint'].every(m => paths.some(p => p.endsWith('/js/' + m + '.js'))),
      css: ['base', 'layout', 'components', 'preview', 'templates', 'carousel', 'letter', 'ats',
        'overrides', 'motion'].every(m => paths.some(p => p.endsWith('/css/' + m + '.css'))),
      count: keys.length
    };
  });
  check('all 20 modules precached', sw.js);
  check('all 10 stylesheets precached', sw.css, sw.count + ' cache entries');

  console.log('\n[7] undo/redo providers wired');
  const undo = await page.evaluate(async () => {
    document.getElementById('fullName').value = 'Before';
    updatePreview();
    await new Promise(r => setTimeout(r, 400));
    pushUndo();
    document.getElementById('fullName').value = 'After';
    undo();
    await new Promise(r => setTimeout(r, 100));
    return document.getElementById('fullName').value;
  });
  check('undo restores the snapshot (bindHistory ran)', undo === 'Before', 'got "' + undo + '"');

  await browser.close();
  server.kill();
  console.log('\n' + (failures === 0 ? '✔ all module checks passed' : '✘ ' + failures + ' failed'));
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('fatal:', e); process.exit(1); });
