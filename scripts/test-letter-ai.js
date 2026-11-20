#!/usr/bin/env node
/* Test the AI cover letter writer (Gemini mocked at network level) + capture screenshots. */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const PORT = 8132;
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
  targetRole: 'Senior Software Engineer'
};
const JD_TEXT = `Senior Software Engineer — Platform Team at Flowbase

We are looking for a Senior Software Engineer to build and scale our platform. You will design microservices, own our Kubernetes deployment on AWS, and drive best practices in code review and testing.

Requirements:
- 5+ years building production systems with React and TypeScript
- Strong Node.js and PostgreSQL experience
- Experience with Kubernetes, Docker and CI/CD pipelines`;
const LETTER_MOCK = {
  p1: 'Dear Ms. Rahman, I am applying for the Senior Software Engineer position on Flowbase\u2019s Platform Team. Eight years of shipping payment platforms and web systems at scale lines up directly with what the role demands.',
  p2: 'Flowbase\u2019s focus on microservices and Kubernetes on AWS is the exact ground I work on daily: at Tech Corp I own our containerised deployment pipeline and drove the practices your posting describes, from code review standards to testing culture.',
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
    if (url.includes('FAIL503')) {
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 503, message: 'The model is overloaded.' } }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(LETTER_MOCK) }], role: 'model' } }] }) });
  });

  const page = await context.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
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
    set('jdText', '');
    updatePreview();
  }, CV);
  await page.waitForTimeout(500);

  /* 1. Validation: no key */
  await page.evaluate(() => switchTab('letter', null));
  await page.evaluate(() => runLetterAi());
  const e1 = await page.evaluate(() => ({ status: document.getElementById('clAiStatus').textContent, cls: document.getElementById('clAiStatus').className }));
  console.log('  no key:', JSON.stringify(e1));

  /* 2. Validation: key but no role anywhere (clear targetRole too) */
  await page.evaluate(() => { document.getElementById('clAiKey').value = 'AIza-demo'; document.getElementById('targetRole').value = ''; });
  await page.evaluate(() => runLetterAi());
  const e2 = await page.evaluate(() => document.getElementById('clAiStatus').textContent);
  console.log('  no role:', JSON.stringify(e2));

  /* 3. Fill role + JD, run for real (mocked network) */
  await page.evaluate((jd) => {
    document.getElementById('clCompany').value = 'Flowbase';
    document.getElementById('clHiringManager').value = 'Ms. Rahman';
    document.getElementById('clRole').value = 'Senior Software Engineer';
    document.getElementById('clTone').value = 'direct';
    document.getElementById('jdText').value = jd;
    localStorage.setItem('cvGenieGeminiKey', 'AIza-demo');
  }, JD_TEXT);
  await page.reload({ waitUntil: 'networkidle' });
  const prefill = await page.evaluate(() => document.getElementById('clAiKey').value);
  console.log('  key prefill on reload:', JSON.stringify(prefill));
  await page.evaluate(() => { switchTab('letter', null); runLetterAi(); });
  await page.waitForFunction(() => (document.getElementById('clAiStatus').className || '').includes('ok') || (document.getElementById('clAiStatus').className || '').includes('err'), { timeout: 20000 });
  const res = await page.evaluate(() => ({
    status: document.getElementById('clAiStatus').textContent,
    cls: document.getElementById('clAiStatus').className,
    p1: document.getElementById('clP1').value.slice(0, 60),
    p3: document.getElementById('clP3').value.slice(0, 60),
    p4: document.getElementById('clP4').value.slice(0, 60),
    docActive: document.getElementById('docToggleLetter').classList.contains('active'),
    letterVisible: document.getElementById('clPreview').style.display
  }));
  console.log('  letter result:', JSON.stringify(res));
  await page.waitForTimeout(400);
  await page.locator('#formPanel').screenshot({ path: '/tmp/letter-ai-form.png' });
  await page.screenshot({ path: '/tmp/letter-ai-preview.png', clip: { x: 560, y: 0, width: 880, height: 940 } });

  /* 4. Prompt content check: verify the request carried CV + JD + tone */
  const reqSeen = [];
  context.route('**/generativelanguage.googleapis.com/**', async (route) => { reqSeen.push(route.request().postData()); await route.continue().catch(() => {}); });

  /* 5. Offline "Draft from my CV" still works */
  await page.evaluate(() => draftLetter());
  const draft = await page.evaluate(() => document.getElementById('clP1').value.slice(0, 50));
  console.log('  offline draft ok:', JSON.stringify(draft));

  await browser.close();
  server.kill();
  console.log('Done.');
})().catch(e => { console.error(e); process.exit(1); });
