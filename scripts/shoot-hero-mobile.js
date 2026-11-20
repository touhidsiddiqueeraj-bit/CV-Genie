#!/usr/bin/env node
/* Refresh docs screenshots affected by the carousel-as-default-view change:
 * hero-light / hero-dark (full app, preview = 3D carousel),
 * mobile-edit (form + floating Preview pill) / mobile-preview (carousel viewpoint).
 * Usage: NODE_PATH=/home/z/.npm-global/lib/node_modules node scripts/shoot-hero-mobile.js */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const PORT = 8136;
const BASE = `http://127.0.0.1:${PORT}`;

const CV = {
  fullName: 'Touhid Siddiquee', title: 'Senior Software Engineer', email: 'touhid@example.com',
  phone: '+880 1712-345678', linkedin: 'linkedin.com/in/touhid', location: 'Dhaka, Bangladesh',
  summary: 'Senior Software Engineer with 8 years of experience building scalable web platforms and payment systems. Specialised in React, Node.js and AWS, with a record of leading teams of up to 12 engineers and cutting infrastructure costs by double digits.',
  skills: 'JavaScript, React, Node.js, AWS, Docker, TypeScript, SQL, Git',
  experiences: [
    { title: 'Senior Software Engineer', company: 'Tech Corp', dates: 'Mar 2021 – Present', description: 'Led a team of 8 engineers delivering the payments platform.\nReduced API latency by 42% through caching and query optimisation.\nBuilt CI/CD pipelines that cut deploy time from 40 to 6 minutes.\nMentored 5 junior developers.' },
    { title: 'Software Engineer', company: 'StartupCo', dates: 'Jan 2018 – Feb 2021', description: 'Developed the customer dashboard used by 20,000 users.\nAutomated weekly reporting, saving 15 hours of manual work.' }],
  education: [{ degree: 'B.Sc. Computer Science', institution: 'University of Dhaka', year: '2014 – 2018' }],
  targetRole: 'Senior Software Engineer'
};

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', REPO], { stdio: 'pipe' });
  await new Promise((res) => {
    const t = setInterval(async () => {
      try { await fetch(BASE + '/'); clearInterval(t); res(); } catch (e) { /* retry */ }
    }, 200);
  });

  const browser = await chromium.launch();

  /* ── Desktop heroes: light + dark, carousel as the default CV view ── */
  for (const dark of [false, true]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
    const page = await ctx.newPage();
    page.on('dialog', (d) => d.accept().catch(() => {}));
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    if (dark) await page.evaluate(() => { if (!document.documentElement.classList.contains('dark')) toggleDarkMode(); });
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
    await page.waitForTimeout(900);
    await page.evaluate(() => { tpl3dNext(); }); /* flanking pages visible in a rotated state */
    await page.waitForTimeout(950);
    await page.screenshot({ path: dark ? 'docs/images/hero-dark.png' : 'docs/images/hero-light.png' });
    console.log('  ✓ docs/images/' + (dark ? 'hero-dark.png' : 'hero-light.png'));
    await ctx.close();
  }

  /* ── Mobile pair: edit (with Preview pill) + preview (carousel viewpoint) ── */
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  mp.on('dialog', (d) => d.accept().catch(() => {}));
  await mp.goto(BASE + '/', { waitUntil: 'networkidle' });
  await mp.evaluate(() => localStorage.clear());
  await mp.reload({ waitUntil: 'networkidle' });
  await mp.evaluate((cv) => {
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
  await mp.waitForTimeout(1200);
  await mp.screenshot({ path: 'docs/images/mobile-edit.png' });
  console.log('  ✓ docs/images/mobile-edit.png');

  await mp.tap('#editBackBtn');
  await mp.waitForTimeout(1100);
  await mp.screenshot({ path: 'docs/images/mobile-preview.png' });
  console.log('  ✓ docs/images/mobile-preview.png');

  await browser.close();
  server.kill();
  console.log('Done.');
})().catch(e => { console.error(e); process.exit(1); });
