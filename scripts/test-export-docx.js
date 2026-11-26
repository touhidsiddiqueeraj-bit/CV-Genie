#!/usr/bin/env node
/* Client-side DOCX export: builds a CV .docx and a cover-letter .docx through
   the real UI, then validates the packages with Python's zipfile + XML parser:
   required OOXML parts present, every XML part well-formed, content present,
   accent colour applied, letter mode produces letter structure. */
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const REPO = path.resolve(__dirname, '..');
const PORT = 8136;
const BASE = `http://127.0.0.1:${PORT}`;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cvgenie-docx-'));

let pass = 0, fail = 0;
const ok = (cond, label, extra) => { if (cond) { pass++; console.log('  PASS', label); } else { fail++; console.log('  FAIL', label, extra || ''); } };

const CV = {
  fullName: 'Touhid Siddiquee', title: 'Senior Software Engineer',
  email: 'touhid@example.com', phone: '+880 171 000 0000',
  location: 'Dhaka, Bangladesh', linkedin: 'linkedin.com/in/touhid',
  summary: 'Results-driven engineer with 8 years of experience.\nSecond summary line with & ampersand and <angle> brackets.',
  publications: [{ title: 'Helios: Validation of a predictive MPPT controller for tropical deployment', venue: 'IJPEDS \u00b7 Paper ID 90011', status: 'Accepted, pending publication', dates: 'September 2026', link: 'https://doi.org/10.5281/zenodo.99990001' }],
  interests: 'Chess, Astronomy',
  skills: 'JavaScript, React, Node.js, AWS, Docker',
  experiences: [
    { title: 'Senior Software Engineer', company: 'Tech Corp', dates: 'Mar 2021 – Present', description: 'Led a team of 8 engineers.\nReduced API latency by 42%.' },
    { title: 'Software Engineer', company: 'StartupCo', dates: 'Jan 2018 – Feb 2021', description: 'Developed the dashboard used by 20,000 users.' }],
  education: [{ degree: 'BSc Computer Science', institution: 'University of Dhaka', year: '2017' }],
  languages: [{ language: 'English', level: 'C1' }, { language: 'Bengali', level: 'Native' }]
};

function validateDocx(file, expect) {
  /* Python: unzip, parse every XML part, run content assertions */
  const script = `
import zipfile, sys, json
from xml.dom import minidom
z = zipfile.ZipFile(${JSON.stringify(file)})
names = z.namelist()
assert_bad = []
required = ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/_rels/document.xml.rels', 'docProps/core.xml', 'docProps/app.xml']
missing = [r for r in required if r not in names]
xml_parts = [n for n in names if n.endswith('.xml') or n.endswith('.rels')]
for n in xml_parts:
    try: minidom.parseString(z.read(n))
    except Exception as e: assert_bad.append(n + ': ' + str(e))
doc = z.read('word/document.xml').decode('utf-8')
checks = {
  'missing_parts': missing,
  'malformed_xml': assert_bad,
  'expect': {k: (v in doc) for k, v in ${JSON.stringify(expect.texts)}.items()},
  'unexpected': {k: (v in doc) for k, v in ${JSON.stringify(expect.absent || {})}.items()},
  'accent': ${JSON.stringify(expect.accent)} in doc,
  'paragraph_count': doc.count('<w:p>'),
  'bullet_count': doc.count('\u2022'),
}
print(json.dumps(checks))
`;
  const out = execFileSync('python3', ['-c', script], { encoding: 'utf8' });
  return JSON.parse(out);
}

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', REPO], { stdio: 'pipe' });
  await new Promise((res) => { const t = setInterval(async () => { try { await fetch(BASE + '/'); clearInterval(t); res(); } catch (e) {} }, 200); });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 940 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => { fail++; console.log('  PAGE ERROR:', String(e).slice(0, 300)); });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });

  /* Fill the form with the fixture CV */
  await page.evaluate((cv) => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('fullName', cv.fullName); set('title', cv.title); set('email', cv.email);
    set('phone', cv.phone); set('location', cv.location); set('linkedin', cv.linkedin);
    set('summary', cv.summary); set('skills', cv.skills);
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
      l.querySelectorAll('input')[0].value = e.degree; l.querySelectorAll('input')[1].value = e.institution; l.querySelectorAll('input')[2].value = e.year;
    });
    document.getElementById('languageList').innerHTML = '';
    cv.languages.forEach(l0 => {
      addLangSilent();
      const is = document.querySelectorAll('#languageList .dynamic-item'); const l = is[is.length - 1];
      l.querySelector('input').value = l0.language; l.querySelector('select').value = l0.level;
    });
    document.getElementById('publicationList').innerHTML = '';
    (cv.publications || []).forEach(p => {
      addPubSilent();
      const is = document.querySelectorAll('#publicationList .dynamic-item'); const l = is[is.length - 1];
      l.querySelectorAll('input')[0].value = p.title; l.querySelectorAll('input')[1].value = p.venue;
      l.querySelectorAll('input')[2].value = p.dates; l.querySelectorAll('input')[3].value = p.status;
      l.querySelectorAll('input')[4].value = p.link;
    });
    set('interests', cv.interests || '');
    updatePreview();
  }, CV);

  /* 1 ── CV DOCX download via the export modal */
  const cvPath = path.join(TMP, 'cv.docx');
  const dl1 = page.waitForEvent('download');
  await page.evaluate(() => { exportSel.printPdf = false; exportSel.docx = true; exportDocx(); });
  const d1 = await dl1;
  await d1.saveAs(cvPath);
  ok((fs.statSync(cvPath).size / 1024) > 2, 'CV docx downloaded (' + (fs.statSync(cvPath).size / 1024).toFixed(1) + ' KB)');

  const cvr = validateDocx(cvPath, {
    texts: {
      name: 'Touhid Siddiquee', title: 'Senior Software Engineer',
      contact: 'touhid@example.com | +880 171 000 0000',
      section_exp: 'EXPERIENCE', section_edu: 'EDUCATION', section_lang: 'LANGUAGES', section_skills: 'SKILLS',
      exp1: 'Senior Software Engineer', exp1meta: 'Tech Corp — Mar 2021 – Present',
      bullet1: '•  Led a team of 8 engineers.', escaped_amp: '&amp;', escaped_lt: '&lt;',
      edu: 'BSc Computer Science', lang: 'English — C1', skills: 'JavaScript, React',
      section_pubs: 'PUBLICATIONS', pub1: 'Helios: Validation of a predictive MPPT controller for tropical deployment',
      pub1meta: 'IJPEDS · Paper ID 90011 — September 2026', pub1status: 'Accepted, pending publication',
      pub1doi: 'DOI: https://doi.org/10.5281/zenodo.99990001', section_int: 'INTERESTS', interests: 'Chess, Astronomy'
    },
    absent: { server_artifact: 'onrender' },
    accent: '2563EB'
  });
  ok(cvr.missing_parts.length === 0, 'all 7 OOXML parts present', JSON.stringify(cvr.missing_parts));
  ok(cvr.malformed_xml.length === 0, 'every XML part is well-formed', JSON.stringify(cvr.malformed_xml));
  ok(Object.values(cvr.expect).every(Boolean), 'all CV content present', JSON.stringify(Object.entries(cvr.expect).filter(([, v]) => !v)));
  ok(Object.values(cvr.unexpected).every(v => !v), 'no server artifacts');
  ok(cvr.accent, 'accent colour applied');
  ok(cvr.paragraph_count >= 14, 'paragraph count sane (' + cvr.paragraph_count + ')');
  ok(cvr.bullet_count === 3, 'experience bullets rendered (' + cvr.bullet_count + ')');

  /* 2 ── letter DOCX */
  await page.evaluate(() => {
    document.getElementById('clCompany').value = 'Flowbase';
    document.getElementById('clHiringManager').value = 'Ms. Rivera';
    document.getElementById('clRole').value = 'Senior Software Engineer';
    document.getElementById('clP1').value = 'I am writing to apply for the Senior Software Engineer role at Flowbase.';
    document.getElementById('clP4').value = 'I would welcome the chance to discuss my application.';
    setActiveDoc('letter');
  });
  const letterPath = path.join(TMP, 'letter.docx');
  const dl2 = page.waitForEvent('download');
  await page.evaluate(() => { exportDocx(); });
  const d2 = await dl2;
  await d2.saveAs(letterPath);
  const lr = validateDocx(letterPath, {
    texts: {
      name: 'Touhid Siddiquee', salutation: 'Dear Ms. Rivera,', recipient: 'Flowbase',
      subject: 'Re: Application for Senior Software Engineer',
      p1: 'I am writing to apply', p4: 'I would welcome the chance'
    },
    absent: { cv_section: 'EXPERIENCE' },
    accent: '2563EB'
  });
  ok(lr.missing_parts.length === 0 && lr.malformed_xml.length === 0, 'letter docx structure valid');
  ok(Object.values(lr.expect).every(Boolean), 'letter content present', JSON.stringify(Object.entries(lr.expect).filter(([, v]) => !v)));
  ok(Object.values(lr.absent || lr.unexpected).every(v => !v), 'no CV sections in the letter');
  ok(lr.accent, 'letter accent applied');

  /* 3 ── export modal: no server options left, DOCX visible in letter mode */
  await page.evaluate(() => openExportModal());
  const modalHtml = await page.evaluate(() => document.getElementById('exportModal').innerHTML);
  ok(!/onrender|\(server\)|chkServer|serverPdf|serverDocx/i.test(modalHtml), 'export modal has no server options');
  ok(/chkDocx/.test(modalHtml), 'DOCX option present');
  const docxVisible = await page.evaluate(() => document.getElementById('chkDocx').closest('.export-option').style.display !== 'none');
  ok(docxVisible, 'DOCX option visible in letter mode');

  /* 4 ── LibreOffice round-trip: the docx opens in a real word processor */
  try {
    execFileSync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', TMP, cvPath], { encoding: 'utf8', timeout: 90000 });
    const pdf = cvPath.replace(/\.docx$/, '.pdf');
    ok(fs.existsSync(pdf) && fs.statSync(pdf).size > 5000, 'LibreOffice opens the CV docx and renders a PDF');
  } catch (e) { ok(false, 'LibreOffice round-trip', String(e.message).slice(0, 120)); }

  await browser.close();
  server.kill();
  console.log('\n' + (fail === 0 ? `✔ all ${pass} docx checks passed` : `✘ ${fail} failed (${pass} passed)`));
  process.exit(fail === 0 ? 0 : 1);
})().catch(async (e) => { console.error(e); process.exit(1); });
