#!/usr/bin/env node
/* CV-Genie docs screenshots for the 3D template carousel and the AI cover letter.
 * Produces: docs/images/gallery.png (3D carousel, rotated state) and
 * docs/images/letter.png (Letter tab with the Gemini AI writer box; network mocked).
 * Usage: NODE_PATH=/home/z/.npm-global/lib/node_modules node scripts/shoot-gallery-letter.js */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const PORT = 8135;
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
const LETTER_MOCK = {
  p1: 'I am applying for the Senior Software Engineer position on Flowbase\u2019s Platform Team. Eight years of shipping payment platforms and web systems at scale lines up directly with what the role demands.',
  p2: 'Flowbase\u2019s focus on microservices and Kubernetes on AWS is the exact ground I work on daily: at Tech Corp I own the containerised deployment pipeline and drove the practices your posting describes, from code review standards to testing culture.',
  p3: 'Two results that matter for this role: I reduced API latency by 42% through caching and query optimisation on our payments platform, and I lead a team of 8 engineers delivering it — the mentoring and technical-leadership mix your posting calls for.',
  p4: 'I would welcome a conversation about the Platform Team\u2019s roadmap. I am available for an interview any weekday and can start [notice period].'
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
  await context.route('**/generativelanguage.googleapis.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/models') && route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ models: [{ name: 'models/gemini-flash-latest', supportedGenerationMethods: ['generateContent'] }] }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(LETTER_MOCK) }], role: 'model' } }] }) });
  });

  const page = await context.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

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

  /* 1. 3D carousel — it is the default CV view; rotate once so flanking pages show */
  await page.evaluate(() => setPreviewMode('gallery'));
  await page.waitForTimeout(900);
  await page.evaluate(() => tpl3dNext());
  await page.waitForTimeout(800);
  await page.locator('#previewPanel').screenshot({ path: 'docs/images/gallery.png' });
  console.log('  ✓ docs/images/gallery.png');

  /* 2. Letter tab with AI writer (mocked Gemini write already applied) */
  await page.evaluate(() => {
    document.getElementById('clCompany').value = 'Flowbase';
    document.getElementById('clHiringManager').value = 'Ms. Rahman';
    document.getElementById('clRole').value = 'Senior Software Engineer';
    document.getElementById('clTone').value = 'direct';
    document.getElementById('clAiKey').value = 'AIza-demo';
    switchTab('letter', null);
    runLetterAi();
  });
  await page.waitForFunction(() => document.getElementById('clAiStatus').className.includes('ok'), { timeout: 15000 });
  await page.waitForTimeout(500);
  await page.locator('#formPanel').screenshot({ path: 'docs/images/letter.png' });
  console.log('  ✓ docs/images/letter.png');

  await browser.close();
  server.kill();
  console.log('Done.');
})().catch(e => { console.error(e); process.exit(1); });
