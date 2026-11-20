#!/usr/bin/env node
/* Smoke-test the 3D template carousel as the DEFAULT CV view:
 * desktop — carousel visible without opening anything, rotation auto-applies,
 *           drag + keyboard, document-mode toggle, letter-mode interplay;
 * mobile  — starts in Edit, the floating Preview pill gates the viewpoint,
 *           tapping it reveals the carousel.
 * Run: NODE_PATH=/home/z/.npm-global/lib/node_modules node scripts/test-carousel.js */
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

const FILL = (cv) => {
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
};

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

  /* ───────────── Desktop ───────────── */
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 940 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  page.on('pageerror', (e) => { console.log('  PAGE ERROR:', String(e).slice(0, 300)); failures++; });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });

  await page.evaluate(FILL, CV);
  await page.evaluate(() => { changeTemplate('modern'); });
  await page.waitForTimeout(700);

  /* 1. Carousel is the default CV view — no click needed */
  const def = await page.evaluate(() => ({
    showGallery: document.getElementById('previewPanel').classList.contains('show-gallery'),
    mainVisible: getComputedStyle(document.getElementById('tpl3dMain')).display !== 'none',
    docHidden: getComputedStyle(document.getElementById('cvWrapper')).display === 'none',
    cards: document.querySelectorAll('#tpl3dTrack .tpl3d-card').length,
    total: TEMPLATES.length,
    centerTpl: document.querySelector('#tpl3dTrack .tpl3d-card.is-center')?.dataset.tpl,
    badgeOnCenter: !!document.querySelector('#tpl3dTrack .tpl3d-card.is-center.is-applied .tpl3d-badge'),
    count: document.getElementById('tpl3dCount').textContent,
    name: document.getElementById('tpl3dName').textContent,
    modeBtnOn: document.getElementById('previewModeBtn').classList.contains('mode-on')
  }));
  check('carousel visible by default', def.showGallery && def.mainVisible && def.docHidden);
  check('all designs rendered as cards', def.cards === def.total && def.total >= 18, def.cards + '/' + def.total + ' cards');
  check('active design centred with badge', def.centerTpl === 'modern' && def.badgeOnCenter, def.centerTpl + ' / ' + def.count + ' / ' + def.name);
  check('mode toggle button reflects gallery mode', def.modeBtnOn);
  await page.screenshot({ path: '/tmp/tpl3d-default.png' });

  /* 2. Rotation auto-applies the centred design */
  const expected = await page.evaluate(() => {
    const i = TEMPLATES.indexOf(currentTemplate); /* 'modern' */
    return { after1: TEMPLATES[(i + 1) % TEMPLATES.length], after2: TEMPLATES[(i + 2) % TEMPLATES.length] };
  });
  await page.evaluate(() => tpl3dNext());
  await page.waitForTimeout(600);
  const mid = await page.evaluate(() => document.getElementById('tpl3dName').textContent);
  await page.evaluate(() => tpl3dNext());
  await page.waitForTimeout(1100); /* wait past the 350ms auto-apply debounce */
  const rot = await page.evaluate(() => ({
    count: document.getElementById('tpl3dCount').textContent,
    name: document.getElementById('tpl3dName').textContent,
    applied: currentTemplate,
    select: document.getElementById('templateSelect').value,
    previewClass: document.getElementById('cvPreview').className,
    badgeOnCenter: !!document.querySelector('#tpl3dTrack .tpl3d-card.is-center.is-applied .tpl3d-badge')
  }));
  check('rotation auto-applies centred design', rot.applied === expected.after2, expected.after1 + ' → ' + expected.after2 + ' | applied: ' + rot.applied + ' | info: ' + mid + ' → ' + rot.name);
  check('toolbar select stays in sync', rot.select === rot.applied, rot.select);
  check('hidden document preview follows template', rot.previewClass.includes('cv-' + rot.applied));
  check('Active badge follows the new centre', rot.badgeOnCenter);
  await page.screenshot({ path: '/tmp/tpl3d-rotated.png' });

  /* 3. Drag swipe on the stage */
  const box = await page.locator('#tpl3dStage').boundingBox();
  if (box) {
    const before = await page.evaluate(() => document.getElementById('tpl3dCount').textContent);
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.5, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(800);
    const after = await page.evaluate(() => ({ count: document.getElementById('tpl3dCount').textContent, applied: currentTemplate }));
    check('drag swipe rotates the ring', before !== after.count, before + ' → ' + after.count + ' (applied: ' + after.applied + ')');
  }

  /* 4. Keyboard arrows */
  const kbBefore = await page.evaluate(() => document.getElementById('tpl3dCount').textContent);
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(900);
  const kbAfter = await page.evaluate(() => document.getElementById('tpl3dCount').textContent);
  check('ArrowLeft rotates', kbBefore !== kbAfter, kbBefore + ' → ' + kbAfter);

  /* 5. Toolbar toggle: gallery ⇄ document */
  await page.evaluate(() => togglePreviewMode());
  await page.waitForTimeout(300);
  const docMode = await page.evaluate(() => ({
    showGallery: document.getElementById('previewPanel').classList.contains('show-gallery'),
    mainVisible: getComputedStyle(document.getElementById('tpl3dMain')).display !== 'none',
    docVisible: getComputedStyle(document.getElementById('cvWrapper')).display !== 'none',
    modeBtnOn: document.getElementById('previewModeBtn').classList.contains('mode-on')
  }));
  check('toggle switches to document view', !docMode.showGallery && !docMode.mainVisible && docMode.docVisible && !docMode.modeBtnOn);
  await page.screenshot({ path: '/tmp/tpl3d-document.png' });
  await page.evaluate(() => togglePreviewMode());
  await page.waitForTimeout(300);
  const backToGallery = await page.evaluate(() => document.getElementById('previewPanel').classList.contains('show-gallery'));
  check('toggle returns to carousel', backToGallery);

  /* 6. Clicking the centred page opens the full view */
  await page.evaluate(() => tpl3dCardClick(document.querySelector('#tpl3dTrack .tpl3d-card.is-center')));
  await page.waitForTimeout(300);
  const centerClick = await page.evaluate(() => ({
    docVisible: getComputedStyle(document.getElementById('cvWrapper')).display !== 'none',
    mode: previewMode
  }));
  check('centred card click → full document view', centerClick.docVisible && centerClick.mode === 'document');
  await page.evaluate(() => setPreviewMode('gallery'));

  /* 7. Letter mode forces the document; back to CV restores the carousel */
  await page.evaluate(() => setActiveDoc('letter'));
  await page.waitForTimeout(400);
  const letterMode = await page.evaluate(() => ({
    showGallery: document.getElementById('previewPanel').classList.contains('show-gallery'),
    letterVisible: getComputedStyle(document.getElementById('clPreview')).display !== 'none',
    wrapVisible: getComputedStyle(document.getElementById('cvWrapper')).display !== 'none'
  }));
  check('letter mode shows document (no carousel)', !letterMode.showGallery && letterMode.letterVisible && letterMode.wrapVisible);
  await page.evaluate(() => setActiveDoc('cv'));
  await page.waitForTimeout(400);
  const cvBack = await page.evaluate(() => document.getElementById('previewPanel').classList.contains('show-gallery'));
  check('back to CV restores carousel', cvBack);

  /* 8. Live refresh: editing the form updates the carousel cards */
  await page.evaluate(() => { document.getElementById('fullName').value = 'Renamed User'; updatePreview(); });
  await page.waitForTimeout(1200);
  const cardText = await page.evaluate(() => document.querySelector('#tpl3dTrack .tpl3d-card.is-center').textContent);
  check('carousel cards live-update on edits', cardText.includes('Renamed User'));

  await context.close();

  /* ───────────── Mobile ───────────── */
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  mp.on('pageerror', (e) => { console.log('  MOBILE PAGE ERROR:', String(e).slice(0, 300)); failures++; });
  await mp.goto(BASE + '/', { waitUntil: 'networkidle' });
  await mp.evaluate(FILL, CV);
  await mp.waitForTimeout(500);

  const mStart = await mp.evaluate(() => ({
    editMode: document.getElementById('formPanel').classList.contains('active'),
    pillShown: getComputedStyle(document.getElementById('editBackBtn')).display !== 'none'
  }));
  check('mobile starts in Edit mode', mStart.editMode);
  check('floating Preview pill is visible (the gate)', mStart.pillShown);
  await mp.screenshot({ path: '/tmp/tpl3d-mobile-edit.png' });

  /* tap the pill → the CV viewpoint (carousel) appears */
  await mp.tap('#editBackBtn');
  await mp.waitForTimeout(900);
  const mPreview = await mp.evaluate(() => ({
    editMode: document.getElementById('formPanel').classList.contains('active'),
    showGallery: document.getElementById('previewPanel').classList.contains('show-gallery'),
    mainVisible: getComputedStyle(document.getElementById('tpl3dMain')).display !== 'none',
    cards: document.querySelectorAll('#tpl3dTrack .tpl3d-card').length,
    total: TEMPLATES.length,
    stageW: document.getElementById('tpl3dStage').clientWidth,
    toolbarVisible: getComputedStyle(document.getElementById('previewToolbar')).display !== 'none'
  }));
  check('Preview pill reveals the carousel viewpoint', !mPreview.editMode && mPreview.showGallery && mPreview.mainVisible, JSON.stringify(mPreview));
  check('mobile carousel renders all cards', mPreview.cards === mPreview.total && mPreview.total >= 18, mPreview.cards + '/' + mPreview.total + ' cards');
  check('preview toolbar visible on mobile preview', mPreview.toolbarVisible);
  await mp.screenshot({ path: '/tmp/tpl3d-mobile-preview.png' });

  /* swipe on mobile */
  const mbox = await mp.locator('#tpl3dStage').boundingBox();
  if (mbox) {
    const before = await mp.evaluate(() => document.getElementById('tpl3dCount').textContent);
    await mp.mouse.move(mbox.x + mbox.width * 0.8, mbox.y + mbox.height * 0.5);
    await mp.mouse.down();
    await mp.mouse.move(mbox.x + mbox.width * 0.2, mbox.y + mbox.height * 0.5, { steps: 10 });
    await mp.mouse.up();
    await mp.waitForTimeout(900);
    const a = await mp.evaluate(() => document.getElementById('tpl3dCount').textContent);
    check('mobile swipe rotates the ring', before !== a, before + ' → ' + a);
  }

  /* back to edit via bottom nav */
  await mp.evaluate(() => mobileNav('edit'));
  await mp.waitForTimeout(400);
  const mBack = await mp.evaluate(() => ({
    editMode: document.getElementById('formPanel').classList.contains('active'),
    pillShown: getComputedStyle(document.getElementById('editBackBtn')).display !== 'none'
  }));
  check('back to Edit, pill re-arms', mBack.editMode && mBack.pillShown);

  await browser.close();
  server.kill();
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed.');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

process.on('exit', () => { try { server.kill(); } catch (e) {} });
