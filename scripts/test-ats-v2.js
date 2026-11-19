#!/usr/bin/env node
/* CV-Genie ATS Engine v2 E2E tests.
 * Covers: empty state, weak vs strong CV scoring, category bars & check list,
 * role-keyword cloud + click-to-add, job-description match mode, add-all-missing,
 * and the Gemini AI Coach flow (network mocked — CI cannot reach Google).
 * Usage: NODE_PATH=/home/z/.npm-global/lib/node_modules node scripts/test-ats-v2.js */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const PORT = 8124;
const BASE = `http://127.0.0.1:${PORT}`;

let failures = 0, passes = 0;
const ok = (m) => { passes++; console.log('  ✓ ' + m); };
const fail = (m) => { failures++; console.error('  ✗ ' + m); };
function assert(cond, msg) { cond ? ok(msg) : fail(msg); }

const WEAK_CV = {
  fullName: 'Test Person', email: 'not-an-email', skills: 'Excel',
  summary: 'I am a hard worker and a team player.',
  experiences: [{ title: 'Assistant', company: 'Acme Ltd', dates: '', description: 'Responsible for filing.\nHelped with meetings.\nIn charge of supplies.' }],
  education: [], targetRole: ''
};
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
    if (!(cv.experiences || []).length) addExpSilent();
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
  const context = await browser.newContext({ viewport: { width: 1440, height: 940 } });

  /* Mock the Gemini API endpoints before any AI test runs */
  await context.route('**/generativelanguage.googleapis.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/models') && route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ models: [{ name: 'models/gemini-flash-latest', supportedGenerationMethods: ['generateContent'] }] }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(AI_MOCK) }], role: 'model' } }] }) });
  });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  /* ── 1. Empty state ── */
  console.log('\n[1] Empty state');
  await page.evaluate(() => runATSAnalysis());
  const emptyScore = await page.textContent('#atsScoreNum');
  assert(emptyScore.trim() === '\u2014', 'empty CV shows \u2014 as the score');
  assert(await page.evaluate(() => atsLastReport === null), 'no report cached for empty CV');

  /* ── 2. Weak CV ── */
  console.log('\n[2] Weak CV');
  await fillCv(page, WEAK_CV);
  await page.evaluate(() => runATSAnalysis());
  const weak = await page.evaluate(() => atsLastReport);
  assert(weak && typeof weak.score === 'number', 'weak CV produces a numeric score (' + (weak && weak.score) + ')');
  assert(weak.score < 60, 'weak CV scores below 60 (' + weak.score + ')');
  const weakProbs = weak.checks.filter(c => c.status === 'fail' || c.status === 'warn');
  assert(weakProbs.length >= 8, 'weak CV triggers many checks (' + weakProbs.length + ' problems)');
  assert(weak.checks.some(c => c.label === 'Duty phrasing' && c.status !== 'pass'), 'duty phrasing detected');
  assert(weak.checks.some(c => c.label === 'Buzzword-free' && c.status !== 'pass'), 'buzzwords detected');
  assert(weak.checks.some(c => c.label === 'Email address' && c.status === 'fail'), 'invalid email detected');
  assert(weak.checks.some(c => c.label === 'No first-person pronouns' && c.status === 'warn'), 'first-person summary detected');
  const domCats = await page.locator('.ats-cat').count();
  assert(domCats === weak.cats.length, 'category bars rendered (' + domCats + ')');
  const domChecks = await page.locator('#tab-ats .ats-check').count();
  assert(domChecks === Math.min(weakProbs.length, 10), 'check rows rendered (' + domChecks + ')');
  const gradeTxt = (await page.textContent('#atsGrade')).trim();
  assert(gradeTxt === weak.grade.t + ' \u2014 ' + weak.score + '/100', 'grade chip matches report: ' + gradeTxt);
  const sidebarNum = (await page.textContent('#atsPreviewNum')).trim();
  assert(sidebarNum === String(weak.score), 'sidebar widget mirrors the score');

  /* ── 3. Strong CV + role keywords ── */
  console.log('\n[3] Strong CV + role keyword mode');
  await fillCv(page, STRONG_CV);
  await page.evaluate(() => { switchTab('ats', null); runATSAnalysis(); });
  const strong = await page.evaluate(() => atsLastReport);
  assert(strong.score > weak.score, 'strong CV outscores weak (' + strong.score + ' vs ' + weak.score + ')');
  assert(strong.score >= 70, 'strong CV reaches a Good grade (' + strong.score + ')');
  assert(strong.mode === 'role', 'role-keyword mode active');
  assert(strong.cats.some(c => c.label === 'Keywords'), 'keywords category present');
  assert(strong.checks.some(c => c.label === 'Quantified achievements' && c.status === 'pass'), 'quantified bullets pass');
  assert(strong.checks.some(c => c.label === 'Action-verb bullets' && c.status === 'pass'), 'action verbs pass');
  const chips = await page.locator('#keywordCloud .kw-chip').count();
  assert(chips > 5, 'keyword cloud rendered (' + chips + ' chips)');
  const clickable = await page.locator('#keywordCloud .kw-click').count();
  assert(clickable >= 1, 'missing role keywords are clickable (' + clickable + ')');
  if (clickable) {
    const kw = await page.locator('#keywordCloud .kw-click').first().textContent();
    await page.locator('#keywordCloud .kw-click').first().click();
    await page.waitForTimeout(400);
    const skillsVal = await page.inputValue('#skills');
    assert(skillsVal.toLowerCase().includes(kw.trim().toLowerCase().replace(/ \+$/, '')), 'clicking a chip adds it to skills');
  }

  /* ── 4. Job description match mode ── */
  console.log('\n[4] Job description match');
  await fillCv(page, STRONG_CV);
  await page.fill('#jdText', JD_TEXT);
  await page.click('text=Match against my CV');
  await page.waitForTimeout(300);
  const jd = await page.evaluate(() => atsLastReport);
  assert(jd.mode === 'jd', 'JD mode active');
  assert(jd.cats.some(c => c.label === 'Job match'), 'job match category present');
  const scoreRow = await page.locator('#jdResults .jd-score-row').count();
  assert(scoreRow === 1, 'JD match score bar rendered');
  const addAll = await page.locator('#jdResults .jd-actions button').count();
  assert(addAll === 1, 'add-all-missing button rendered');
  const kwBefore = await page.evaluate(() => customKWList.length);
  await page.click('#jdResults .jd-actions button');
  await page.waitForTimeout(300);
  const kwAfter = await page.evaluate(() => customKWList.length);
  assert(kwAfter > kwBefore, 'add-all-missing populates custom keywords (' + kwBefore + ' \u2192 ' + kwAfter + ')');

  /* ── 5. AI Coach (mocked Gemini) ── */
  console.log('\n[5] AI Coach (mocked Gemini)');
  await page.fill('#atsAiKey', 'AIza-test-key-123');
  await page.click('#atsAiBtn');
  await page.waitForSelector('#atsAiResults .ai-card', { timeout: 15000 });
  const verdict = await page.textContent('.ats-ai-verdict');
  assert(verdict.includes('Solid CV'), 'AI verdict rendered');
  const statusTxt = await page.textContent('#atsAiStatus');
  assert(statusTxt.includes('gemini-flash-latest'), 'status names the model used');
  assert((await page.getAttribute('#atsAiStatus', 'class')).includes('ok'), 'status is success-styled');
  await page.click('.btn-ai-apply >> nth=0'); /* Apply summary (first button) */
  await page.waitForTimeout(400);
  const newSummary = await page.inputValue('#summary');
  assert(newSummary === AI_MOCK.summaryRewrite, 'Apply swaps the summary');
  const applyBtns = await page.locator('.btn-ai-apply').count();
  assert(applyBtns >= 3, 'summary + bullet + keywords apply buttons rendered');
  /* Apply the bullet rewrite (second button = first bullet rewrite) */
  await page.click('.btn-ai-apply >> nth=1');
  await page.waitForTimeout(400);
  const ta = await page.evaluate(() => document.querySelector('#experienceList .dynamic-item textarea').value);
  assert(ta.includes('introducing Redis caching'), 'Apply rewrites the bullet in place');
  /* Add all suggested keywords */
  await page.click('.btn-ai-apply >> nth=2');
  await page.waitForTimeout(400);
  const skillsAfter = await page.inputValue('#skills');
  assert(/kubernetes/i.test(skillsAfter) && /graphql/i.test(skillsAfter), 'AI keywords merged into skills');
  /* Re-analysis after applies: score object still healthy */
  const post = await page.evaluate(() => atsLastReport && atsLastReport.score);
  assert(typeof post === 'number', 'engine re-ran cleanly after applies');

  /* ── 6. Error path: Gemini 503 ── */
  console.log('\n[6] AI Coach error path');
  await context.unroute('**/generativelanguage.googleapis.com/**');
  await context.route('**/generativelanguage.googleapis.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/models') && route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ models: [{ name: 'models/gemini-flash-latest', supportedGenerationMethods: ['generateContent'] }] }) });
    }
    return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 503, message: 'The model is overloaded.' } }) });
  });
  await page.click('#atsAiBtn');
  await page.waitForFunction(() => {
    const st = document.getElementById('atsAiStatus');
    return st && st.className.includes('err');
  }, { timeout: 30000 });
  const errTxt = await page.textContent('#atsAiStatus');
  assert(errTxt.length > 10, '503 surfaces an error message, not a stuck spinner: ' + errTxt.trim().slice(0, 70) + '\u2026');
  assert(!(await page.getAttribute('#atsAiBtn', 'disabled')), 'button re-enabled after failure');

  /* ── 7. Page errors ── */
  console.log('\n[7] Console health');
  assert(errors.length === 0, 'no page errors during the whole run' + (errors.length ? ' — ' + errors[0] : ''));

  await browser.close();
  server.kill();
  console.log('\n' + (failures === 0 ? '\u2714 All ' + passes + ' ATS-v2 checks passed.' : '\u2718 ' + failures + ' check(s) failed.'));
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
