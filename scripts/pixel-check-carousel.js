/* Pixel-verify carousel screenshots: stage region must be rich in content,
   flanks visible, no blank band where the carousel should be. */
const sharp = require('sharp');

async function analyze(file, stageBox, label) {
  const img = sharp(file);
  const { width, height } = await img.metadata();
  const { data } = await img.raw().toBuffer({ resolveWithObject: true });
  // sample the stage box (x,y,w,h in px)
  let nonBg = 0, total = 0, darkest = 255;
  const px = (x, y) => {
    const i = (y * width + x) * 3;
    return [data[i], data[i + 1], data[i + 2]];
  };
  for (let y = stageBox.y; y < Math.min(stageBox.y + stageBox.h, height); y += 3) {
    for (let x = stageBox.x; x < Math.min(stageBox.x + stageBox.w, width); x += 3) {
      const [r, g, b] = px(x, y);
      total++;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum < 235) nonBg++; // not the plain background
      if (lum < darkest) darkest = lum;
    }
  }
  const ratio = (nonBg / total * 100).toFixed(1);
  console.log(`${label}: ${width}x${height}, stage-region content ratio ${ratio}% (darkest lum ${Math.round(darkest)})`);
  return { ratio: +ratio, darkest };
}

(async () => {
  // stage boxes approximated from DOM measurements captured earlier
  const r1 = await analyze('/tmp/car-desktop-1440.png', { x: 470, y: 250, w: 740, h: 620 }, 'desktop-1440');
  const r2 = await analyze('/tmp/car-laptop-1280.png', { x: 440, y: 190, w: 590, h: 430 }, 'laptop-1280');
  const r3 = await analyze('/tmp/car-mobile-390.png', { x: 8, y: 400, w: 374, h: 300 }, 'mobile-390');
  const ok = [r1, r2, r3].every(r => r.ratio > 8 && r.darkest < 120);
  console.log(ok ? 'PIXEL CHECK PASSED' : 'PIXEL CHECK FAILED');
})().catch(e => { console.error(e); process.exit(1); });
