/* Verify carousel maximization: desktop, small laptop, mobile */
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const url = 'http://localhost:8123/index.html';

  async function shot(name, viewport, mobile) {
    const ctx = await browser.newContext({ viewport, ...(mobile ? { hasTouch: true, isMobile: true } : {}) });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    if (mobile) { /* mobile gates the viewpoint behind the Preview pill */
      await page.evaluate(() => mobileNav('preview'));
      await page.waitForTimeout(700);
    }
    const stats = await page.evaluate(() => {
      const stage = document.getElementById('tpl3dStage');
      const card = document.querySelector('.tpl3d-card.is-center');
      const panel = document.getElementById('previewPanel');
      const r = card ? card.getBoundingClientRect() : null;
      const sr = stage.getBoundingClientRect();
      return {
        stageW: Math.round(sr.width), stageH: Math.round(sr.height),
        cardW: r ? Math.round(r.width) : 0, cardH: r ? Math.round(r.height) : 0,
        cardTop: r ? Math.round(r.top) : 0, cardBottom: r ? Math.round(r.bottom) : 0,
        panelScrollH: panel.scrollHeight, panelClientH: panel.clientHeight,
        visible: !!document.querySelector('.preview-panel.show-gallery'),
        centerHasContent: !!(card && card.textContent.trim().length > 50)
      };
    });
    await page.screenshot({ path: path.join('/tmp', name + '.png') });
    console.log(name, JSON.stringify(stats));
    await ctx.close();
    return stats;
  }

  await shot('car-desktop-1440', { width: 1440, height: 900 }, false);
  await shot('car-laptop-1280', { width: 1280, height: 720 }, false);
  await shot('car-mobile-390', { width: 390, height: 844 }, true);
  await browser.close();
  console.log('DONE');
})().catch(e => { console.error(e); process.exit(1); });
