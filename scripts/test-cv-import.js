#!/usr/bin/env node
/* CV-Genie import feature E2E tests.
 * Covers: paste-text parse, DOCX upload, PDF upload, no-header fallback,
 * AI response mapping, and full apply-into-editor flow.
 * Usage: NODE_PATH=/home/z/.npm-global/lib/node_modules node scripts/test-cv-import.js
 * Run scripts/make-cv-fixtures.py first. */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const FIX = '/tmp/cvfix';
const PORT = 8123;
const BASE = `http://127.0.0.1:${PORT}`;

let failures = 0, passes = 0;
const ok = (m) => { passes++; console.log('  ✓ ' + m); };
const fail = (m) => { failures++; console.error('  ✗ ' + m); };
function assert(cond, msg) { cond ? ok(msg) : fail(msg); }

async function freshPage(context) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  page._errors = errors;
  return page;
}

async function openImport(page) {
  await page.click('.cvi-banner');
  await page.waitForSelector('#cvImportModal', { state: 'visible' });
}

async function parseViaPaste(page, text) {
  await openImport(page);
  await page.click('text=…or paste CV text');
  await page.fill('#cvImportPaste', text);
  await page.click('text=Parse pasted text');
  await page.waitForSelector('#cvImportStep2', { state: 'visible' });
  return page.evaluate(() => ({ ...cvImportData, _src: { ...cvImportSource } }));
}

async function parseViaUpload(page, filePath) {
  await openImport(page);
  await page.setInputFiles('#cvImportFile', filePath);
  await page.waitForSelector('#cvImportStep2', { state: 'visible' });
  return page.evaluate(() => ({ ...cvImportData, _src: { kind: cvImportSource.kind, fileName: cvImportSource.fileName } }));
}

async function applyImport(page) {
  await page.click('text=Import into editor');
  await page.waitForSelector('#cvImportModal', { state: 'hidden' });
  await page.waitForTimeout(250);
}

(async () => {
  if (!fs.existsSync(path.join(FIX, 'fixture2.docx')) || !fs.existsSync(path.join(FIX, 'fixture4-linkedin.pdf')) || !fs.existsSync(path.join(FIX, 'fixture5-researcher.pdf')) || !fs.existsSync(path.join(FIX, 'fixture6-researcher2.pdf'))) {
    console.error('Fixtures missing — run: python3 scripts/make-cv-fixtures.py');
    process.exit(1);
  }

  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', REPO], { stdio: 'pipe' });
  await new Promise((res) => {
    const t = setInterval(async () => {
      try { await fetch(BASE + '/'); clearInterval(t); res(); } catch (e) { /* retry */ }
    }, 250);
  });
  console.log('server up on ' + BASE);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });

  /* ── Test 1: paste text (classic TXT layout) ─────────────────── */
  console.log('\n[1] Paste-text parse (fixture1.txt layout)');
  {
    const page = await freshPage(context);
    const txt = fs.readFileSync(path.join(FIX, 'fixture1.txt'), 'utf8');
    const d = await parseViaPaste(page, txt);
    assert(d.name === 'Touhid Siddique', `name = "${d.name}"`);
    assert(d.title === 'Senior Software Engineer', `title = "${d.title}"`);
    assert(d.email === 'touhid.siddique@gmail.com', `email = "${d.email}"`);
    assert(d.phone === '+880 1712 345 678', `phone = "${d.phone}"`);
    assert(d.linkedin === 'https://linkedin.com/in/touhidsiddique', `linkedin = "${d.linkedin}"`);
    assert(d.location === 'Dhaka, Bangladesh', `location = "${d.location}"`);
    assert(d.summary.toLowerCase().includes('results-driven'), 'summary found');
    assert(d.experiences.length === 3, `experiences = ${d.experiences.length}`);
    assert(d.experiences[0].title === 'Senior Software Engineer' && d.experiences[0].company === 'TechCorp Solutions Ltd.', `exp[0] = ${d.experiences[0].title} @ ${d.experiences[0].company}`);
    assert(/Jan 2021/.test(d.experiences[0].dates), `exp[0].dates = "${d.experiences[0].dates}"`);
    assert(d.experiences[0].description.includes('multi-tenant SaaS'), 'exp[0] description kept');
    assert(d.education.length === 1 && d.education[0].degree.includes('BSc') && d.education[0].institution === 'University of Dhaka', `education = ${JSON.stringify(d.education[0])}`);
    assert(d.skillsArr.length >= 10, `skills = ${d.skillsArr.length}`);
    assert(d.languages.length === 3, `languages = ${JSON.stringify(d.languages)}`);
    const lv = Object.fromEntries(d.languages.map(l => [l.language, l.level]));
    assert(lv['Bengali'] === 'Native' && lv['English'] === 'C1' && lv['Hindi'] === 'B1', `language levels = ${JSON.stringify(lv)}`);
    assert(d.score >= 75, `score = ${d.score} (${d.level})`);
    assert(d._src.kind === 'txt', 'source kind txt');

    /* apply into the editor and verify the form + preview */
    await applyImport(page);
    const applied = await page.evaluate(() => ({
      name: document.getElementById('fullName').value,
      title: document.getElementById('title').value,
      email: document.getElementById('email').value,
      phone: document.getElementById('phone').value,
      location: document.getElementById('location').value,
      skills: document.getElementById('skills').value,
      exps: getExperiences().length,
      exp0: getExperiences()[0],
      edu: getEducation().length,
      langs: getLanguages(),
      preview: document.getElementById('cvPreview').innerText
    }));
    assert(applied.name === 'Touhid Siddique', 'form name applied');
    assert(applied.exps === 3, `form experiences = ${applied.exps}`);
    assert(applied.exp0.company === 'TechCorp Solutions Ltd.', 'form exp[0].company applied');
    assert(applied.edu === 1, `form education = ${applied.edu}`);
    assert(applied.langs.length === 3 && applied.langs[1].level === 'C1', `form languages = ${JSON.stringify(applied.langs)}`);
    assert(applied.skills.includes('TypeScript') && applied.skills.includes('React'), 'skills field applied');
    assert(applied.preview.includes('Touhid Siddique') && applied.preview.includes('TechCorp'), 'preview rendered imported data');
    assert(page._errors.length === 0, 'no page errors (' + page._errors.slice(0, 2).join('; ') + ')');
    await page.close();
  }

  /* ── Test 2: DOCX upload ─────────────────────────────────────── */
  console.log('\n[2] DOCX upload (fixture2.docx)');
  {
    const page = await freshPage(context);
    const d = await parseViaUpload(page, path.join(FIX, 'fixture2.docx'));
    assert(d._src.kind === 'docx', 'kind = docx');
    assert(d.name === 'Amelia Bennett', `name = "${d.name}"`);
    assert(d.title === 'Senior Product Designer', `title = "${d.title}"`);
    assert(d.email === 'amelia.bennett@email.com', `email = "${d.email}"`);
    assert(d.phone === '+44 7700 900123', `phone = "${d.phone}"`);
    assert(d.location === 'London, UK', `location = "${d.location}"`);
    assert(d.experiences.length === 3, `experiences = ${d.experiences.length}`);
    assert(d.experiences[0].title === 'Senior Product Designer' && d.experiences[0].company === 'Northwind Labs', `exp[0] = ${d.experiences[0].title} @ ${d.experiences[0].company}`);
    assert(/Jan 2021/.test(d.experiences[0].dates) && /Present/i.test(d.experiences[0].dates), `exp[0].dates = "${d.experiences[0].dates}"`);
    assert(d.experiences[1].title === 'Product Designer' && d.experiences[1].company === 'Brightline Software', `exp[1] = ${d.experiences[1].title} @ ${d.experiences[1].company}`);
    assert(d.experiences[0].description.includes('design system'), 'exp[0] description kept');
    assert(d.education.length === 2, `education = ${d.education.length} (${d.education.map(e => e.degree).join(' | ')})`);
    assert(d.education[0].institution === 'University of Leeds', `edu[0].institution = "${d.education[0].institution}"`);
    assert(d.skillsArr.length >= 6 && d.skillsArr.includes('Figma'), `skills = ${d.skillsArr.length}`);
    assert(d.languages.length === 2, `languages = ${JSON.stringify(d.languages)}`);
    const lv = Object.fromEntries(d.languages.map(l => [l.language, l.level]));
    assert(lv['English'] === 'Native' && lv['French'] === 'C2', `French fluent → C2: ${JSON.stringify(lv)}`);
    assert(d.score >= 75, `score = ${d.score} (${d.level})`);
    await applyImport(page);
    const applied = await page.evaluate(() => ({ name: document.getElementById('fullName').value, exps: getExperiences().length }));
    assert(applied.name === 'Amelia Bennett' && applied.exps === 3, 'applied to editor');
    assert(page._errors.length === 0, 'no page errors');
    await page.close();
  }

  /* ── Test 3: PDF upload ──────────────────────────────────────── */
  console.log('\n[3] PDF upload (fixture3.pdf)');
  {
    const page = await freshPage(context);
    const d = await parseViaUpload(page, path.join(FIX, 'fixture3.pdf'));
    assert(d._src.kind === 'pdf', 'kind = pdf');
    assert(d.name === 'Sofia Andersen', `name = "${d.name}"`);
    assert(d.title === 'Data Analyst', `title = "${d.title}"`);
    assert(d.email === 's.andersen@mail.de', `email = "${d.email}"`);
    assert(d.phone === '+49 30 1234 5678', `phone = "${d.phone}"`);
    assert(d.location === 'Berlin, Germany', `location = "${d.location}"`);
    assert(d.experiences.length === 3, `experiences = ${d.experiences.length}`);
    assert(d.experiences[0].title === 'Data Analyst' && d.experiences[0].company === 'Contoso', `exp[0] = ${d.experiences[0].title} @ ${d.experiences[0].company}`);
    assert(/03\/2019/.test(d.experiences[0].dates) && /06\/2022/.test(d.experiences[0].dates), `exp[0].dates = "${d.experiences[0].dates}"`);
    assert(d.experiences[2].title === 'Intern', `exp[2].title = "${d.experiences[2].title}"`);
    assert(d.education.length === 2, `education = ${d.education.length}`);
    assert(d.education[0].degree.includes('MSc Statistics') || d.education[0].institution.includes('London School'), `edu[0] = ${JSON.stringify(d.education[0])}`);
    assert(d.skillsArr.includes('Python') && d.skillsArr.includes('SQL'), `skills include Python/SQL (${d.skillsArr.length} total)`);
    assert(d.languages.length === 4, `languages = ${JSON.stringify(d.languages)}`);
    const lv = Object.fromEntries(d.languages.map(l => [l.language, l.level]));
    assert(lv['German'] === 'Native' && lv['English'] === 'C2' && lv['French'] === 'B2' && lv['Spanish'] === 'A2', `CEFR levels = ${JSON.stringify(lv)}`);
    assert(d.score >= 75, `score = ${d.score} (${d.level})`);
    await applyImport(page);
    const applied = await page.evaluate(() => ({ name: document.getElementById('fullName').value, langs: getLanguages().length }));
    assert(applied.name === 'Sofia Andersen' && applied.langs === 4, 'applied to editor');
    assert(page._errors.length === 0, 'no page errors');
    await page.close();
  }

  /* ── Test 4: no-header fallback + include flags ──────────────── */
  console.log('\n[4] No-section-headers fallback');
  {
    const page = await freshPage(context);
    const messy = `James Okafor
Marketing Manager
james.okafor@mail.com | +234 803 555 1234 | Lagos, Nigeria

Marketing Manager at Zenith Foods
Feb 2019 - Present
Oversaw campaigns across 5 regions.
Grew social reach by 300%.

Marketing Assistant, Bluewave Media
06/2016 - 01/2019
Supported the content calendar.`;
    const d = await parseViaPaste(page, messy);
    assert(d.email === 'james.okafor@mail.com', `email = "${d.email}"`);
    assert(d.name === 'James Okafor', `name = "${d.name}"`);
    assert(d.experiences.length === 2, `fallback experiences = ${d.experiences.length}`);
    assert(d.experiences[0].title === 'Marketing Manager' && d.experiences[0].company === 'Zenith Foods', `exp[0] = ${d.experiences[0].title} @ ${d.experiences[0].company}`);
    assert(d.experiences[1].company === 'Bluewave Media', `exp[1].company = "${d.experiences[1].company}"`);

    /* untick languages + summary (empty anyway) and apply; experience must land */
    await page.evaluate(() => { cvImportData.include.languages = false; });
    await applyImport(page);
    const applied = await page.evaluate(() => ({ exps: getExperiences().length, exp0title: getExperiences()[0].title }));
    assert(applied.exps === 2 && applied.exp0title === 'Marketing Manager', 'fallback experiences applied');
    assert(page._errors.length === 0, 'no page errors');
    await page.close();
  }

  /* ── Test 5: AI response mapping (canned Gemini JSON) ────────── */
  console.log('\n[5] Gemini response mapping + merge');
  {
    const page = await freshPage(context);
    const canned = {
      name: 'Amelia Bennett', title: 'Senior Product Designer', email: 'amelia.bennett@email.com',
      phone: '+44 7700 900123', linkedin: 'https://linkedin.com/in/ameliabennett', location: 'London, UK',
      summary: 'Product designer with 8 years of experience.',
      skills: ['Figma', 'Design Systems', 'Prototyping'],
      experiences: [
        { title: 'Senior Product Designer', company: 'Northwind Labs', dates: 'Jan 2021 - Present', description: '\u2022 Lead designer\n\u2022 Cut QA time' },
        { title: 'Product Designer', company: 'Brightline Software', dates: 'Mar 2018 - Dec 2020', description: 'Onboarding flows' }
      ],
      education: [{ degree: 'BA (Hons) Graphic Communication', institution: 'University of Leeds', year: '2012 - 2016' }],
      languages: [{ language: 'English', level: 'Native' }, { language: 'French', level: 'Fluent' }, { language: 'German', level: 'XYZ' }]
    };
    const r = await page.evaluate((j) => cviMapAi(j), canned);
    assert(r.experiences[0].description === 'Lead designer\nCut QA time', 'bullet markers stripped from AI description');
    const lv = Object.fromEntries(r.languages.map(l => [l.language, l.level]));
    assert(lv['French'] === 'C2' && lv['German'] === '', `Fluent→C2 mapping, invalid→empty: ${JSON.stringify(lv)}`);
    assert(r.skillsArr.length === 3 && r.skills === 'Figma, Design Systems, Prototyping', 'skills joined');
    const merged = await page.evaluate((j) => {
      const base = parseCVText('Touhid\nSenior Software Engineer\ntouhid@mail.com\n\nSKILLS\nDocker, SQL');
      return cviMergeResults(base, cviMapAi(j));
    }, { ...canned, skills: [], education: [], languages: [], summary: '' });
    assert(merged.skillsArr.length === 2 && merged.skillsArr.includes('Docker'), 'merge keeps parser skills when AI returns none');
    assert(merged.email === 'amelia.bennett@email.com', 'merge prefers AI values');
    assert(page._errors.length === 0, 'no page errors');
    await page.close();
  }

  /* ── Test 6: bad file + empty paste guards ───────────────────── */
  console.log('\n[6] Guard rails');
  {
    const page = await freshPage(context);
    await openImport(page);
    await page.click('text=…or paste CV text');
    await page.fill('#cvImportPaste', 'too short');
    await page.click('text=Parse pasted text');
    const err = await page.evaluate(() => document.getElementById('cvImportError').textContent);
    assert(/Paste the full text/.test(err), `short paste rejected: "${err}"`);
    await page.setInputFiles('#cvImportFile', { name: 'old.doc', mimeType: 'application/msword', buffer: Buffer.from('x') });
    await page.waitForTimeout(300);
    const err2 = await page.evaluate(() => document.getElementById('cvImportError').textContent);
    assert(/Legacy \.doc/.test(err2), `.doc rejected: "${err2}"`);
    /* still on step1 after errors: close, reopen, confirm clean state */
    await page.click('#cvImportModal .modal-close');
    await page.waitForSelector('#cvImportModal', { state: 'hidden' });
    await openImport(page);
    const step1 = await page.evaluate(() => document.getElementById('cvImportStep1').style.display);
    assert(step1 === 'block', 'reopening shows the upload step again');
    const fileCleared = await page.evaluate(() => document.getElementById('cvImportFile').value === '');
    assert(fileCleared, 'file input cleared on reopen');
    assert(page._errors.length === 0, 'no page errors');
    await page.close();
  }

  /* ── Test 7: LinkedIn PDF import (fixture4-linkedin.pdf) ────── */
  console.log('\n[7] LinkedIn PDF import');
  {
    const page = await freshPage(context);
    await page.evaluate(() => switchTab('tools', null)); /* the LinkedIn panel lives in the Tools tab */
    await page.setInputFiles('#linkedInFile', path.join(FIX, 'fixture4-linkedin.pdf'));
    await page.waitForSelector('#linkedInPreview', { state: 'visible' });
    const preview = await page.evaluate(() => [...document.querySelectorAll('#linkedInPreviewTable tr')].map(tr => tr.textContent.trim()).join(' | '));
    assert(preview.includes('Touhid Siddique'), 'preview row: name');
    assert(preview.includes('2 position(s)'), 'preview row: experience count = ' + (preview.match(/\d+ position/) || ['?'])[0]);
    await page.click('text=Apply to CV');
    await page.waitForTimeout(400);
    const applied = await page.evaluate(() => ({
      name: document.getElementById('fullName').value,
      title: document.getElementById('title').value,
      location: document.getElementById('location').value,
      summary: document.getElementById('summary').value,
      skills: document.getElementById('skills').value,
      exps: getExperiences(),
      edu: getEducation(),
      langs: getLanguages()
    }));
    assert(applied.name === 'Touhid Siddique', `name = "${applied.name}"`);
    assert(applied.title === 'Senior Software Engineer', `title = "${applied.title}"`);
    assert(applied.location === 'Dhaka, Bangladesh', `location = "${applied.location}"`);
    assert(applied.exps.length === 2, `experiences = ${applied.exps.length}`);
    assert(applied.exps[0].title === 'Software Engineer' && applied.exps[0].company === 'TechCorp Solutions Ltd.', `exp[0] = ${applied.exps[0].title} @ ${applied.exps[0].company}`);
    assert(/Jan 2021/.test(applied.exps[0].dates) && /Present/i.test(applied.exps[0].dates) && !/yrs/.test(applied.exps[0].dates), `exp[0].dates = "${applied.exps[0].dates}" (duration suffix stripped)`);
    assert(!/Dhaka/.test(applied.exps[0].description), 'job location line not leaked into the description');
    assert(applied.exps[0].description.includes('multi-tenant SaaS'), 'exp[0] description kept');
    assert(applied.exps[1].title === 'Junior Software Engineer' && applied.exps[1].company === 'Globex Digital Agency', `exp[1] = ${applied.exps[1].title} @ ${applied.exps[1].company}`);
    assert(applied.edu.length === 1 && applied.edu[0].institution === 'University of Dhaka' && applied.edu[0].degree.includes('BSc'), `education = ${JSON.stringify(applied.edu)}`);
    assert(/2013/.test(applied.edu[0].year) && /2017/.test(applied.edu[0].year), `edu[0].year = "${applied.edu[0].year}"`);
    assert(applied.skills.split(',').length >= 5 && applied.skills.includes('TypeScript'), `skills = "${applied.skills}"`);
    const lv = Object.fromEntries(applied.langs.map(l => [l.language, l.level]));
    assert(lv['English'] === 'C2' && lv['Bengali'] === 'Native', `LinkedIn ILR levels mapped = ${JSON.stringify(lv)}`);
    assert(applied.summary.toLowerCase().includes('results-driven'), 'About section imported as summary');
    assert(page._errors.length === 0, 'no page errors');
    await page.close();
  }

  /* ── Test 8: parser-engine unit checks (new v2.7 heuristics) ── */
  console.log('\n[8] Parser engine unit checks');
  {
    const page = await freshPage(context);
    const u = await page.evaluate(() => {
      const out = {};
      /* cross-segment date anchors: "Jan 2020 –" | "Present" split by the PDF column reader */
      out.crossSeg = (() => { const a = cviAnchorOf({ segs: ['Marketing Manager', 'Jan 2020 \u2013', 'Present'] }, ''); return !!(a && /Jan 2020/.test(a.dates) && /Present/i.test(a.dates) && /Marketing Manager/.test(a.pre)); })();
      /* new section headings route correctly */
      out.headers = ['Career Objective', 'Professional History', 'Summary of Qualifications', 'Licenses & Certifications', 'Training', 'Research Experience']
        .map(h => [h, cviHeaderType(h)]);
      out.objHeader = out.headers.find(h => h[0] === 'Career Objective')[1] === 'summary';
      out.expHeader = ['Professional History', 'Research Experience'].every(h => cviHeaderType(h) === 'experience');
      out.skillHeader = cviHeaderType('Summary of Qualifications') === 'skills';
      out.ignoreHeader = cviHeaderType('Licenses & Certifications') === 'ignore';
      out.eduHeader = cviHeaderType('Training') === 'education';
      /* bare page-number lines and "N connections" noise are dropped */
      out.pageDrop = cviLines('Page 2\nSome line\n3\n500+ connections\n12 of 14').length === 1;
      /* ILR proficiency labels map to CEFR */
      out.ilr = ['Full professional proficiency', 'Professional working proficiency', 'Limited working proficiency', 'Native or bilingual proficiency'].map(cviLevelFromText);
      /* heading-less CVs: the opening pitch before the first date anchor becomes the summary */
      const pitch = 'James Okafor\nMarketing Manager\njames@mail.com | +234 803 555 1234 | Lagos, Nigeria\nI am a results-driven marketing professional with eight years of experience across FMCG and retail, leading integrated campaigns and mentoring high-performing teams that consistently beat their targets.\nFeb 2019 - Present\nOversaw campaigns across 5 regions.';
      out.pitch = parseCVText(pitch).summary.toLowerCase().includes('results-driven');
      /* (parenthesised) international phone prefix is recognised */
      out.phone = cviFindPhone('call me at (+880) 1712 345 678 anytime');
      return out;
    });
    assert(u.crossSeg, 'cross-segment date anchor joined');
    assert(u.objHeader && u.expHeader && u.skillHeader && u.ignoreHeader && u.eduHeader, `new headings route: ${JSON.stringify(u.headers)}`);
    assert(u.pageDrop, 'page-number and connection-count noise lines dropped');
    assert(JSON.stringify(u.ilr) === JSON.stringify(['C2', 'C1', 'B1', 'Native']), `ILR→CEFR = ${JSON.stringify(u.ilr)}`);
    assert(u.pitch, 'heading-less pitch paragraph becomes the summary');
    assert(u.phone.replace(/\s+/g, '') === '(+880)1712345678'.replace(/\s+/g, ''), `parenthesised phone = "${u.phone}"`);
    assert(page._errors.length === 0, 'no page errors');
    await page.close();
  }

  /* ── Test 9: researcher CV — publications / projects / volunteering / interests (fixture5) ── */
  console.log('\n[9] Researcher CV sections (fixture5-researcher.pdf)');
  {
    const page = await freshPage(context);
    const d = await parseViaUpload(page, path.join(FIX, 'fixture5-researcher.pdf'));
    assert(d.source === 'parser', 'parsed by the local parser');
    assert(d.name === 'Dr. Amira Rahman', `name = "${d.name}"`);
    assert(d.experiences.length === 2, `experiences = ${d.experiences.length}`);
    /* publications: title (wrapped lines joined), dates, venue, status, DOI */
    assert(d.publications.length === 3, `publications = ${d.publications.length}`);
    const p0 = d.publications[0];
    assert(p0.title.startsWith('Helios-B') && p0.title.includes('MPPT Controller'), `pub[0].title = "${p0.title.slice(0, 60)}…" (wrapped title joined)`);
    assert(/September 2026/.test(p0.dates), `pub[0].dates = "${p0.dates}"`);
    assert(/IJPEDS/.test(p0.venue) && /90011/.test(p0.venue), `pub[0].venue = "${p0.venue}"`);
    assert(/Accepted/i.test(p0.status), `pub[0].status = "${p0.status}"`);
    assert(p0.link.includes('99990001'), `pub[0].link = "${p0.link}"`);
    const p1 = d.publications[1];
    assert(/IEEE Transactions/.test(p1.venue) && /first review/i.test(p1.status), `pub[1] venue/status = "${p1.venue}" / "${p1.status}"`);
    /* projects: name, description, link */
    assert(d.projects.length === 2, `projects = ${d.projects.length}`);
    assert(d.projects[0].name === 'Aurora Editor' && d.projects[0].link.includes('github.com/example/aurora'), `proj[0] = ${JSON.stringify(d.projects[0])}`);
    assert(d.projects[1].name === 'Nimbus Dashboard' && /telemetry/.test(d.projects[1].description), `proj[1] = ${JSON.stringify(d.projects[1])}`);
    /* volunteering: organization + role */
    assert(d.volunteering.length === 2, `volunteering = ${d.volunteering.length}`);
    assert(d.volunteering[0].organization === 'Robotics Club' && d.volunteering[0].role === 'Joint General Secretary', `vol[0] = ${JSON.stringify(d.volunteering[0])}`);
    /* interests line */
    assert(/Chess/.test(d.interests) && /Astronomy/.test(d.interests), `interests = "${d.interests}"`);
    /* include flags */
    const inc = d.include;
    assert(inc.publications && inc.projects && inc.volunteering && inc.interests, `include flags = ${JSON.stringify(inc)}`);
    /* apply to the form and check the new lists */
    await applyImport(page);
    const applied = await page.evaluate(() => ({
      pubs: getPublications(),
      projs: getProjects(),
      vols: getVolunteering(),
      interests: document.getElementById('interests').value,
    }));
    assert(applied.pubs.length === 3 && applied.pubs[0].venue.includes('IJPEDS'), `form publications = ${applied.pubs.length}, pub[0].venue = "${applied.pubs[0].venue}"`);
    assert(applied.projs.length === 2 && applied.projs[0].name === 'Aurora Editor', `form projects = ${applied.projs.length}`);
    assert(applied.vols.length === 2 && applied.vols[1].role === 'Publicity Secretary', `form volunteering = ${applied.vols.length}`);
    assert(/Chess/.test(applied.interests), `form interests = "${applied.interests}"`);
    assert(page._errors.length === 0, 'no page errors');
    await page.close();
  }

  /* ── Test 10: researcher CV v2 — pure-date publications, hard wraps (fixture6) ── */
  console.log('\n[10] Researcher CV hard mode (fixture6-researcher2.pdf)');
  {
    const page = await freshPage(context);
    const d = await parseViaUpload(page, path.join(FIX, 'fixture6-researcher2.pdf'));
    assert(d.source === 'parser', 'parsed by the local parser');
    /* six publications, none phantom: wrapped titles fully joined, short
       continuations ("converters", "Studies, 2021–2026") stay in the title,
       hyphen wraps fuse ("routine-quality"), the extra preprint DOI line stays
       with its record instead of becoming a 7th publication */
    assert(d.publications.length === 6, `publications = ${d.publications.length} → ${JSON.stringify(d.publications.map(p => p.title.slice(0, 40)))}`);
    const p0 = d.publications[0];
    assert(p0.title.startsWith('Helios-C') && p0.title.endsWith('SHS Deployment in Bangladesh'), `pub[0].title = "${p0.title}"`);
    assert(p0.dates.includes('September 2026') && /IJPEDS/.test(p0.venue) && /accepted/i.test(p0.status) && p0.link.includes('11111101'), `pub[0] = ${JSON.stringify(p0)}`);
    const p1 = d.publications[1];
    assert(p1.title.endsWith('buck-boost converters'), `pub[1].title = "${p1.title}" (short continuation joined, not a venue)`);
    assert(/IJPEDS/.test(p1.venue) && /revision/i.test(p1.status), `pub[1] venue/status = "${p1.venue}" / "${p1.status}"`);
    const p2 = d.publications[2];
    assert(/IEEE Transactions/.test(p2.venue), `pub[2].venue = "${p2.venue}"`);
    assert(p2.link.includes('11111103'), `pub[2].link = "${p2.link}" (primary DOI first)`);
    assert(/earlier version.*11111104/i.test(p2.status), `pub[2].status keeps the preprint DOI = "${p2.status}"`);
    const p3 = d.publications[3];
    assert(p3.title.endsWith('Studies, 2021\u20132026'), `pub[3].title = "${p3.title}" (date-range continuation joined)`);
    assert(/IET Communications/.test(p3.venue) && /first review/i.test(p3.status), `pub[3] venue/status = "${p3.venue}" / "${p3.status}"`);
    const p4 = d.publications[4];
    assert(p4.title.includes('routine-quality envelope at 17.0%'), `pub[4].title = "${p4.title}" (hyphen wrap fused)`);
    assert(/ADV26-AR-05017/.test(p4.venue) && /submitted/i.test(p4.status), `pub[4] venue/status = "${p4.venue}" / "${p4.status}"`);
    const p5 = d.publications[5];
    assert(p5.title.startsWith('Oxidation-Budgeted') && /JAP26-AR-04819/.test(p5.venue), `pub[5] = ${JSON.stringify({ t: p5.title.slice(0, 40), v: p5.venue })}`);
    /* volunteering: org-first — "Leading University … Club" is an organization,
       the role line beneath fills the role (v2.9 read the org as a role) */
    assert(d.volunteering.length === 2, `volunteering = ${d.volunteering.length} → ${JSON.stringify(d.volunteering)}`);
    assert(d.volunteering[0].organization === 'Leading University Social Service Club' && d.volunteering[0].role === 'Joint General Secretary', `vol[0] = ${JSON.stringify(d.volunteering[0])}`);
    assert(d.volunteering[1].organization === 'Leading University Electronics Club' && d.volunteering[1].role === 'Publicity Secretary', `vol[1] = ${JSON.stringify(d.volunteering[1])}`);
    assert(d.skillsArr.length === 5, `skills = ${d.skillsArr.length}`);
    /* apply and confirm the editor + skill sliders got the data */
    await applyImport(page);
    const applied = await page.evaluate(() => ({
      pubs: getPublications(),
      vols: getVolunteering(),
      sliders: document.querySelectorAll('#skillLevels .skill-level-row').length,
    }));
    assert(applied.pubs.length === 6 && applied.pubs[1].title.endsWith('buck-boost converters'), `form publications = ${applied.pubs.length}`);
    assert(applied.vols.length === 2 && applied.vols[0].organization === 'Leading University Social Service Club', `form volunteering = ${JSON.stringify(applied.vols[0])}`);
    assert(applied.sliders === 5, `skill sliders rendered = ${applied.sliders}`);
    assert(page._errors.length === 0, 'no page errors');
    await page.close();
  }

  await browser.close();
  server.kill();

  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
