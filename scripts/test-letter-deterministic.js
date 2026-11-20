#!/usr/bin/env node
/* Deterministic letter engine: 3 tones, determinism, JD/no-JD, empty-CV guard,
   Gemini-failure auto-fallback. Gemini network mocked. */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const PORT = 8134;
const BASE = `http://127.0.0.1:${PORT}`;

const CV = {
  fullName: 'Touhid Siddiquee', title: 'Senior Software Engineer',
  skills: 'JavaScript, React, Node.js, AWS, Docker, TypeScript, SQL, Git',
  experiences: [
    { title: 'Senior Software Engineer', company: 'Tech Corp', dates: 'Mar 2021 – Present', description: 'Led a team of 8 engineers delivering the payments platform.\nReduced API latency by 42% through caching and query optimisation.' },
    { title: 'Software Engineer', company: 'StartupCo', dates: 'Jan 2018 – Feb 2021', description: 'Developed the customer dashboard used by 20,000 users.' }],
  targetRole: 'Senior Software Engineer'
};
const JD_TEXT = `Senior Software Engineer — Platform Team at Flowbase

We are looking for a Senior Software Engineer to build and scale our platform. You will design microservices, own our Kubernetes deployment on AWS, and drive best practices in code review and testing.

Requirements:
- 5+ years building production systems with React and TypeScript
- Strong Node.js and PostgreSQL experience
- Experience with Kubernetes, Docker and CI/CD pipelines`;

let pass = 0, fail = 0;
const ok = (cond, label, extra) => { if (cond) { pass++; console.log('  PASS', label); } else { fail++; console.log('  FAIL', label, extra || ''); } };

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', REPO], { stdio: 'pipe' });
  await new Promise((res) => { const t = setInterval(async () => { try { await fetch(BASE + '/'); clearInterval(t); res(); } catch (e) {} }, 200); });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 940 } });
  await context.route('**/generativelanguage.googleapis.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/models') && route.request().method() === 'GET')
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ models: [{ name: 'models/gemini-flash-latest', supportedGenerationMethods: ['generateContent'] }] }) });
    return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 503, message: 'The model is overloaded.' } }) });
  });

  const page = await context.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  page.on('pageerror', (e) => { fail++; console.log('  PAGE ERROR:', String(e).slice(0, 300)); });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });

  await page.evaluate((cv) => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('fullName', cv.fullName); set('title', cv.title); set('skills', cv.skills); set('targetRole', cv.targetRole);
    document.getElementById('experienceList').innerHTML = '';
    cv.experiences.forEach(e => {
      addExpSilent();
      const is = document.querySelectorAll('#experienceList .dynamic-item'); const l = is[is.length - 1];
      l.querySelectorAll('input')[0].value = e.title; l.querySelectorAll('input')[1].value = e.company;
      l.querySelectorAll('input')[2].value = e.dates; l.querySelector('textarea').value = e.description;
    });
    set('jdText', '');
    updatePreview();
  }, CV);
  await page.evaluate(() => switchTab('letter', null));
  await page.evaluate((jd) => {
    document.getElementById('clCompany').value = 'Flowbase';
    document.getElementById('clRole').value = 'Senior Software Engineer';
    document.getElementById('jdText').value = jd;
  }, JD_TEXT);

  /* 1. All three tones with JD */
  for (const tone of ['formal', 'direct', 'warm']) {
    await page.evaluate((t) => { document.getElementById('clTone').value = t; }, tone);
    await page.evaluate(() => draftLetter());
    const r = await page.evaluate(() => {
      const g = id => document.getElementById(id).value;
      const all = [g('clP1'), g('clP2'), g('clP3'), g('clP4')];
      return { p1: all[0], p2: all[1], p3: all[2], p4: all[3], words: all.join(' ').split(/\s+/).filter(Boolean).length,
        status: document.getElementById('clAiStatus').textContent, cls: document.getElementById('clAiStatus').className };
    });
    const all = r.p1 + r.p2 + r.p3 + r.p4;
    ok(r.p1.length > 40 && r.p2.length > 40 && r.p3.length > 40 && r.p4.length > 20, `tone=${tone}: all paragraphs filled`);
    ok(/Senior Software Engineer/.test(r.p1) && /Flowbase/.test(r.p1), `tone=${tone}: p1 names role+company`);
    ok(/42%/.test(r.p3) || /8 engineers/.test(r.p3), `tone=${tone}: p3 cites quantified achievement`, r.p3.slice(0, 120));
    ok(/kubernetes|docker|aws|react|typescript|node/i.test(r.p2), `tone=${tone}: p2 grounded in JD terms`, r.p2.slice(0, 120));
    ok(!/undefined|NaN|\[object/.test(all), `tone=${tone}: no undefined/NaN`);
    ok(r.words >= 90 && r.words <= 340, `tone=${tone}: word count ${r.words} in range`);
    ok(r.cls.includes('ok'), `tone=${tone}: status ok`);
    if (tone === 'formal') {
      console.log('    ── formal letter ──');
      [r.p1, r.p2, r.p3, r.p4].forEach((p, i) => console.log(`    p${i + 1}: ${p}`));
    }
  }

  /* 2. Determinism: same inputs → byte-identical letter */
  const a = await page.evaluate(() => draftLetter() && [1, 2, 3, 4].map(i => document.getElementById('clP' + i).value).join('\n'));
  const b = await page.evaluate(() => draftLetter() && [1, 2, 3, 4].map(i => document.getElementById('clP' + i).value).join('\n'));
  ok(a === b, 'determinism: identical output on re-draft');

  /* 3. No-JD: honest guidance placeholder */
  await page.evaluate(() => { document.getElementById('jdText').value = ''; });
  await page.evaluate(() => draftLetter());
  const nojd = await page.evaluate(() => document.getElementById('clP2').value);
  ok(/\[.*sentence about.*\]|\[Add one sentence/.test(nojd), 'no-JD: p2 carries guidance placeholder', nojd.slice(0, 140));
  await page.evaluate((jd) => { document.getElementById('jdText').value = jd; }, JD_TEXT);

  /* 4. Empty-CV guard */
  const before = await page.evaluate(() => [1, 2, 3, 4].map(i => document.getElementById('clP' + i).value).join(''));
  await page.evaluate(() => {
    ['fullName', 'summary', 'skills', 'targetRole'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('experienceList').innerHTML = '';
    updatePreview();
  });
  await page.evaluate(() => draftLetter());
  const guard = await page.evaluate(() => ({ status: document.getElementById('clAiStatus').textContent, cls: document.getElementById('clAiStatus').className }));
  ok(guard.cls.includes('err') && /Fill in your CV/.test(guard.status), 'empty CV: refused with message');
  const after = await page.evaluate(() => [1, 2, 3, 4].map(i => document.getElementById('clP' + i).value).join(''));
  ok(after === before, 'empty CV: fields untouched');

  /* 5. Gemini failure → auto-fallback to deterministic letter */
  await page.evaluate((cv) => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('fullName', cv.fullName); set('title', cv.title); set('skills', cv.skills); set('targetRole', cv.targetRole);
    document.getElementById('experienceList').innerHTML = '';
    cv.experiences.forEach(e => {
      addExpSilent();
      const is = document.querySelectorAll('#experienceList .dynamic-item'); const l = is[is.length - 1];
      l.querySelectorAll('input')[0].value = e.title; l.querySelectorAll('input')[1].value = e.company;
      l.querySelectorAll('input')[2].value = e.dates; l.querySelector('textarea').value = e.description;
    });
    updatePreview();
  }, CV);
  await page.evaluate(() => { document.getElementById('clAiKey').value = 'AIza-demo'; localStorage.setItem('cvGenieGeminiKey', 'AIza-demo'); });
  await page.evaluate(() => runLetterAi());
  await page.waitForFunction(() => (document.getElementById('clAiStatus').className || '').match(/ok|err|warn/), { timeout: 25000 });
  const fb = await page.evaluate(() => ({
    cls: document.getElementById('clAiStatus').className,
    status: document.getElementById('clAiStatus').textContent,
    p1: document.getElementById('clP1').value, p3: document.getElementById('clP3').value,
    letterActive: document.getElementById('docToggleLetter').classList.contains('active')
  }));
  ok(fb.cls.includes('warn'), 'AI 503: fallback status is warn', fb.cls);
  ok(/deterministic engine drafted|couldn/.test(fb.status), 'AI 503: message explains fallback', fb.status.slice(0, 120));
  ok(/Senior Software Engineer/.test(fb.p1) && /42%|8 engineers/.test(fb.p3), 'AI 503: deterministic letter written');
  ok(fb.letterActive, 'AI 503: preview switched to letter');

  /* 6. Screenshot the letter form + preview */
  await page.evaluate(() => switchTab('letter', null));
  await page.waitForTimeout(400);
  await page.locator('#tab-letter').screenshot({ path: '/tmp/letter-det-form.png' });
  await page.screenshot({ path: '/tmp/letter-det-preview.png', clip: { x: 560, y: 0, width: 880, height: 940 } });

  await browser.close();
  server.kill();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
