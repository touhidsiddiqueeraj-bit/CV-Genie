#!/usr/bin/env node
/* Smoke-test the 3D template carousel: open gallery, screenshot, rotate, screenshot, apply. */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const PORT = 8131;
const BASE = `http://127.0.0.1:${PORT}`;

const CV = {
  fullName: 'Touhid Siddiquee', title: 'Senior Software Engineer', email: 'touhid@example.com',
  phone: '+880 1712-345678', linkedin: 'linkedin.com/in/touhid', location: 'Dhaka, Bangladesh',
  summary: 'Senior Software Engineer with 8 years of experience building scalable web platforms and payment systems. Specialised in React, Node.js and AWS, with a record of leading teams of up to 12 engineers.',
  skills: 'JavaScript, React, Node.js, AWS, Docker, TypeScript, SQL, Git',
  experiences: [
    { title: 'Senior Software Engineer', company: 'Tech Corp', dates: 'Mar 2021 – Present', description: 'Led a team of 8 engineers delivering the payments platform.\nReduced API latency by 42% through caching and query optimisation.' },
    { title: 'Software Engineer', company: 'StartupCo', dates: 'Jan 2018 – Feb 2021', description: 'Developed the customer dashboard used by 20,000 users.' }],
  education: [{ degree: 'B.Sc. Computer Science', institution: 'University of Dhaka', year: '2014 – 2018' }],
  targetRole: 'Software Engineer'
};

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', REPO], { stdio: 'pipe' });
  await new Promise((res) => {
    const t = setInterval(async () => {
      try { await fetch(BASE + '/'); clearInterval(t); res(); } catch (e) { /* retry */ }
    }, 200);
  });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 940 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  page.on('console', (m) => { if (m.type() === 'error') console.log('  console.error:', m.text().slice(0, 200)); });
  page.on('pageerror', (e) => console.log('  PAGE ERROR:', String(e).slice(0, 300)));
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });

  await page.evaluate((cv) => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('fullName', cv.fullName); set('title', cv.title); set('email', cv.email); set('phone', cv.phone);
    set('linkedin', cv.linkedin); set('location', cv.location); set('summary', cv.summary);
    set('skills', cv.skills); set('targetRole', cv.targetRole);
    document.getElementById('experienceList').innerHTML = '';
    cv.experiences.forEach(e => {
      addExpSilent();
      const is = document.querySelectorAll('#experienceList .dynamic-item'); const l = is[is.length - 1];
      l.querySelectorAll('input')[0].value = e.title; l.querySelectorAll('input')[1].value = e.company;
      l.querySelectorAll('input')[2].value = e.dates; l.querySelector('textarea').value = e.description;
    });
    document.getElementById('educationList').innerHTML = '';
    cv.education.forEach(e => {
      addEduSilent();
      const is = document.querySelectorAll('#educationList .dynamic-item'); const l = is[is.length - 1];
      l.querySelectorAll('input')[0].value = e.degree; l.querySelectorAll('input')[1].value = e.institution;
      l.querySelectorAll('input')[2].value = e.year;
    });
    changeTemplate('modern');
    updatePreview();
  }, CV);
  await page.waitForTimeout(600);

  /* 1. Open the gallery */
  await page.evaluate(() => openTemplateGallery());
  await page.waitForTimeout(900);
  const info1 = await page.evaluate(() => ({
    count: document.getElementById('tpl3dCount').textContent,
    name: document.getElementById('tpl3dName').textContent,
    cards: document.querySelectorAll('#tpl3dTrack .tpl3d-card').length,
    activeBadge: !!document.querySelector('#tpl3dTrack .tpl3d-card.is-active .tpl3d-badge')
  }));
  console.log('  gallery:', JSON.stringify(info1));
  await page.locator('#templateGalleryModal .modal').screenshot({ path: '/tmp/tpl3d-open.png' });

  /* 2. Rotate right twice */
  await page.evaluate(() => tpl3dNext());
  await page.waitForTimeout(750);
  await page.evaluate(() => tpl3dNext());
  await page.waitForTimeout(900);
  const info2 = await page.evaluate(() => ({
    count: document.getElementById('tpl3dCount').textContent,
    name: document.getElementById('tpl3dName').textContent,
    useBtn: document.getElementById('tpl3dUseBtn').textContent
  }));
  console.log('  after 2x next:', JSON.stringify(info2));
  await page.locator('#templateGalleryModal .modal').screenshot({ path: '/tmp/tpl3d-rotated.png' });

  /* 3. Swipe drag on the stage */
  const box = await page.locator('#tpl3dStage').boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.5, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(900);
    const info3 = await page.evaluate(() => ({ count: document.getElementById('tpl3dCount').textContent, name: document.getElementById('tpl3dName').textContent }));
    console.log('  after drag:', JSON.stringify(info3));
  }

  /* 4. Apply via button */
  await page.evaluate(() => tpl3dApply());
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({
    galleryOpen: document.getElementById('templateGalleryModal').style.display,
    tpl: currentTemplate,
    previewClass: document.getElementById('cvPreview').className
  }));
  console.log('  after apply:', JSON.stringify(after));
  await page.screenshot({ path: '/tmp/tpl3d-applied.png', clip: { x: 520, y: 0, width: 920, height: 940 } });

  /* 5. Keyboard: reopen, arrow keys */
  await page.evaluate(() => openTemplateGallery());
  await page.waitForTimeout(500);
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(700);
  const kb = await page.evaluate(() => document.getElementById('tpl3dCount').textContent);
  console.log('  after ArrowLeft:', kb);
  await page.keyboard.press('Escape');
  const esc = await page.evaluate(() => document.getElementById('templateGalleryModal').style.display);
  console.log('  after Escape:', esc);

  await browser.close();
  server.kill();
  console.log('Done.');
})().catch(e => { console.error(e); process.exit(1); });
