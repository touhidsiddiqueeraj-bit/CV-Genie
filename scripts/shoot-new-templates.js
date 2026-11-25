// Screenshot the 6 new v2.6 templates on the live carousel for visual confirmation.
const { chromium } = require('playwright');
const BASE = 'https://touhidsiddiqueeraj-bit.github.io/CV-Genie/';
const NEW = ['harvard', 'cascade', 'functional', 'pastel', 'vogue', 'tech'];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1380, height: 900 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  for (const t of NEW) {
    // rotate carousel to the target template by clicking its card
    const clicked = await page.evaluate((id) => {
      const card = document.querySelector(`[data-tpl="${id}"]`);
      if (card) { card.click(); return true; }
      return false;
    }, t);
    await page.waitForTimeout(900);
    const counter = await page.evaluate(() => document.getElementById('tpl3dCount')?.textContent?.trim() || '');
    await page.screenshot({ path: `/tmp/render/tpl-${t}.png` });
    console.log(`${t}: clicked=${clicked} counter="${counter}"`);
  }
  await browser.close();
  console.log('done');
})();
