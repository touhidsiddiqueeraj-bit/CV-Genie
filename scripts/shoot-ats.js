#!/usr/bin/env node
/* CV-Genie docs screenshots for the ATS engine v2.
 * Produces: docs/images/ats.png (score + checks), ats-jd.png (job description
 * match) and ats-ai.png (AI Coach, Gemini network mocked).
 * Usage: NODE_PATH=/home/z/.npm-global/lib/node_modules node scripts/shoot-ats.js */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const PORT = 8126;
const BASE = `http://127.0.0.1:${PORT}`;

const STRONG_CV = {
  fullName: 'Touhid Siddiquee', title: 'Senior Software Engineer', email: 'touhid@example.com',
  phone: '+880 1712-345678', linkedin: 'linkedin.com/in/touhid', location: 'Dhaka, Bangladesh',
  summary: 'Senior Software Engineer with 8 years of experience building scalable web platforms and payment systems. Specialised in React, Node.js and AWS, with a record of leading teams of up to 12 engineers and cutting infrastructure costs by double digits. Now targeting a Senior Software Engineer role on a product-driven team.',
  skills: 'JavaScript, React, Node.js, AWS, Docker, TypeScript, SQL, Git',
  experiences: [
    { title: 'Senior Software Engineer', company: 'Tech Corp', dates: 'Mar 2021 – Present', description: 'Led a team of 8 engineers delivering the payments platform.\nReduced API latency by 42% through caching and query optimisation.\nBuilt CI/CD pipelines that cut deploy time from 40 to 6 minutes.\nMentored 5 junior developers.' },
    { title: 'Software Engineer', company: 'StartupCo', dates: 'Jan 2018 – Feb 2021', description: 'Developed the customer dashboard used by 20,000 users.\nAutomated weekly reporting, saving 15 hours of manual work.' }],
  education: [{ degree: 'B.Sc. Computer Science', institution: 'University of Dhaka', year: '2014 – 2018' }],
  targetRole: 'Software Engineer'
};
const JD_TEXT = `Senior Software Engineer — Platform Team

We are looking for a Senior Software Engineer to build and scale our platform. You will design microservices, own our Kubernetes deployment on AWS, and drive best practices in code review and testing.

Requirements:
- 5+ years building production systems with React and TypeScript
- Strong Node.js and PostgreSQL experience
- Experience with Kubernetes, Docker and CI/CD pipelines
- GraphQL or REST API design at scale
- Mentoring junior engineers and leading technical decisions
- Bonus: Terraform, observability tooling, payment systems experience`;
const AI_MOCK = {
  verdict: 'Solid CV — the experience section carries it, but a few bullets can be sharpened.',
  quickWins: [{ title: 'Quantify the dashboard bullet', detail: 'Add the number of users or the revenue impact of the dashboard you built.' }],
  summaryRewrite: 'Senior Software Engineer with 8 years building scalable platforms and payment systems. Led teams of up to 12 engineers; cut infra costs by double digits. Targeting senior product-team roles.',
  bulletRewrites: [{ experience: 0, bullet: 1, original: 'Reduced API latency by 42% through caching and query optimisation.', improved: 'Reduced API latency by 42% by introducing Redis caching and rewriting the five slowest queries.', why: 'Shows the how, not just the what.' }],
  keywordsToAdd: ['Kubernetes', 'GraphQL', 'PostgreSQL'],
  tips: ['Keep every bullet under 25 words.', 'Mirror the posting\u2019s exact skill names.']
};

async function fillCv(page, cv) {
  await page.evaluate((cv) => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('fullName', cv.fullName || ''); set('title', cv.title || ''); set('email', cv.email || '');
    set('phone', cv.phone || ''); set('linkedin', cv.linkedin || ''); set('location', cv.location || '');
    set('summary', cv.summary || ''); set('skills', cv.skills || ''); set('targetRole', cv.targetRole || '');
    document.getElementById('experienceList').innerHTML = '';
    (cv.experiences || []).forEach(e => {
      addExpSilent();
      const is = document.querySelectorAll('#experienceList .dynamic-item'); const l = is[is.length - 1];
      l.querySelectorAll('input')[0].value = e.title || ''; l.querySelectorAll('input')[1].value = e.company || '';
      l.querySelectorAll('input')[2].value = e.dates || ''; l.querySelector('textarea').value = e.description || '';
    });
    document.getElementById('educationList').innerHTML = '';
    (cv.education || []).forEach(e => {
      addEduSilent();
      const is = document.querySelectorAll('#educationList .dynamic-item'); const l = is[is.length - 1];
      l.querySelectorAll('input')[0].value = e.degree || ''; l.querySelectorAll('input')[1].value = e.institution || '';
      l.querySelectorAll('input')[2].value = e.year || '';
    });
    updatePreview();
  }, cv);
  await page.waitForTimeout(500);
}

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
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(AI_MOCK) }], role: 'model' } }] }) });
  });

  const page = await context.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  /* 1. ATS score + checks */
  await fillCv(page, STRONG_CV);
  await page.evaluate(() => { switchTab('ats', null); runATSAnalysis(); });
  await page.waitForTimeout(700);
  await page.locator('#formPanel').screenshot({ path: 'docs/images/ats.png' });
  console.log('  ✓ docs/images/ats.png');

  /* 2. Job description match */
  await page.fill('#jdText', JD_TEXT);
  await page.click('text=Match against my CV');
  await page.waitForTimeout(600);
  await page.locator('#formPanel').screenshot({ path: 'docs/images/ats-jd.png' });
  console.log('  ✓ docs/images/ats-jd.png');

  /* 3. AI Coach */
  await page.fill('#atsAiKey', 'AIza-demo-key');
  await page.click('#atsAiBtn');
  await page.waitForSelector('#atsAiResults .ai-card', { timeout: 15000 });
  await page.waitForTimeout(400);
  await page.locator('#formPanel').screenshot({ path: 'docs/images/ats-ai.png' });
  console.log('  ✓ docs/images/ats-ai.png');

  await browser.close();
  server.kill();
  console.log('Done.');
})().catch(e => { console.error(e); process.exit(1); });
