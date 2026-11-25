// Live smoke test: verify the deployed modular app boots and serves all 30 templates.
const { chromium } = require('playwright');
const BASE = 'https://touhidsiddiqueeraj-bit.github.io/CV-Genie/';
let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log('  PASS ' + m); };
const bad = (m) => { fail++; console.log('  FAIL ' + m); };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // 1. modules loaded
  const modCount = await page.evaluate(() =>
    performance.getEntriesByType('resource').filter(r => r.name.endsWith('.js') && r.name.includes('/js/')).length);
  modCount >= 20 ? ok(`all JS modules fetched from CDN path (${modCount} requests)`) : bad(`module fetch count ${modCount}`);

  // 2. app booted (window bridge: live state bindings exposed by js/globals.js)
  const booted = await page.evaluate(() =>
    typeof window.currentTemplate === 'string' && !!window.activeDoc &&
    typeof window.renderLetter === 'function' && typeof window.cviCallGemini === 'function');
  booted ? ok('app booted, public API exposed') : bad('app did not boot');

  // 3. template count on live site
  const count = await page.evaluate(() => (window.CVG?.templates || window.TEMPLATES || []).length);
  count === 30 ? ok('30 templates on live site') : bad(`template count = ${count}`);

  // 4. carousel cards
  const cards = await page.evaluate(() => document.querySelectorAll('.tpl-card, .carousel-card, [data-tpl]').length);
  (cards === 30 || cards === 0) ? (cards === 30 ? ok('30 carousel cards rendered') : bad('carousel cards not found')) : bad(`carousel cards = ${cards}`);

  // 5. new templates render HTML
  for (const t of ['harvard', 'cascade', 'functional', 'pastel', 'vogue', 'tech']) {
    const len = await page.evaluate((id) => {
      const el = document.querySelector(`[data-tpl="${id}"], .tpl-${id}`);
      return el ? el.innerHTML.length : (window.renderTemplate ? String(window.renderTemplate(id, { name: 'Test' }) || '').length : 0);
    }, t);
    len > 100 ? ok(`template "${t}" renders (${len} chars)`) : bad(`template "${t}" weak render (${len})`);
  }

  // 6. no JS errors
  errors.length === 0 ? ok('zero console/page errors on live boot') : bad('errors: ' + errors.slice(0, 3).join(' | '));

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed (live smoke)`);
  process.exit(fail ? 1 : 0);
})();
