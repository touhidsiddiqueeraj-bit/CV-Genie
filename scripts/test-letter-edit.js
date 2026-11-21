#!/usr/bin/env node
/* Full letter editing: every part of the cover letter is editable —
   envelope fields (date, subject, salutation, recipient details, custom
   sign-off, signature) with smart auto-defaults, add/remove/renumber
   paragraphs, state round-trip, and every export format agrees on the
   envelope. All local — no network needed. */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const PORT = 8137;
const BASE = `http://127.0.0.1:${PORT}`;

let pass = 0, fail = 0;
const ok = (cond, label, extra) => { if (cond) { pass++; console.log('  PASS', label); } else { fail++; console.log('  FAIL', label, extra || ''); } };

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', REPO], { stdio: 'pipe' });
  await new Promise((res) => { const t = setInterval(async () => { try { await fetch(BASE + '/'); clearInterval(t); res(); } catch (e) {} }, 200); });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 940 } });
  const page = await context.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  page.on('pageerror', (e) => { fail++; console.log('  PAGE ERROR:', String(e).slice(0, 300)); });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });

  /* ── 1. default layout ── */
  console.log('\n[1] default letter form');
  {
    const r = await page.evaluate(() => ({
      slots: document.querySelectorAll('#clParagraphs .cl-para').length,
      ids: Array.from(document.querySelectorAll('#clParagraphs textarea')).map(t => t.id),
      labels: Array.from(document.querySelectorAll('#clParagraphs label')).map(l => l.textContent),
      signoffTag: document.getElementById('clSignoff').tagName,
      datalist: !!document.getElementById('clSignoffPresets'),
      envelopeFields: ['clDate', 'clSubject', 'clSalutation', 'clRecipient', 'clSignature'].map(id => !!document.getElementById(id))
    }));
    ok(r.slots === 4, 'four default paragraph slots');
    ok(r.ids.join(',') === 'clP1,clP2,clP3,clP4', 'first four slots keep ids clP1..clP4', r.ids.join(','));
    ok(r.labels[0].includes('opening') && r.labels[3].includes('closing'), 'semantic labels on the four slots', r.labels.join(' | '));
    ok(r.signoffTag === 'INPUT', 'sign-off is a free-text input');
    ok(r.datalist, 'sign-off has preset datalist');
    ok(r.envelopeFields.every(Boolean), 'all envelope fields present');
  }

  /* ── 2. smart defaults when fields are empty ── */
  console.log('\n[2] smart auto-defaults');
  await page.evaluate(() => {
    document.getElementById('fullName').value = 'Jane Doe';
    document.getElementById('title').value = 'Senior Product Designer';
    document.getElementById('email').value = 'jane@example.com';
    document.getElementById('clCompany').value = 'Acme Corp';
    document.getElementById('clRole').value = 'Lead Product Designer';
    renderLetter();
  });
  {
    const r = await page.evaluate(() => ({
      subject: document.querySelector('.cl-subject').textContent,
      salutation: document.querySelector('.cl-salutation').textContent,
      sig: document.querySelector('.cl-sig').textContent,
      date: document.querySelector('.cl-date').textContent,
      recip: document.querySelector('.cl-recipient').textContent,
      subjectPh: document.getElementById('clSubject').placeholder,
      salutPh: document.getElementById('clSalutation').placeholder
    }));
    ok(r.subject === 'Re: Application for Lead Product Designer', 'auto subject follows role', r.subject);
    ok(r.salutation === 'Dear Hiring Team,', 'auto salutation without manager', r.salutation);
    ok(r.sig === 'Jane Doe', 'signature falls back to CV name', r.sig);
    ok(/\d{4}/.test(r.date), 'auto date is today');
    ok(r.recip === 'Acme Corp', 'recipient block = company', r.recip);
    ok(r.subjectPh === 'Re: Application for Lead Product Designer', 'subject placeholder mirrors default');
    ok(r.salutPh === 'Dear Hiring Team,', 'salutation placeholder mirrors default');
  }
  {
    const r = await page.evaluate(() => {
      document.getElementById('clHiringManager').value = 'Ms. Rivera';
      renderLetter();
      return document.querySelector('.cl-salutation').textContent;
    });
    ok(r === 'Dear Ms. Rivera,', 'salutation follows hiring manager', r);
    await page.evaluate(() => { document.getElementById('clHiringManager').value = ''; });
  }

  /* ── 3. envelope overrides ── */
  console.log('\n[3] envelope overrides win');
  {
    const r = await page.evaluate(() => {
      const set = (id, v) => { document.getElementById(id).value = v; };
      set('clDate', '1 January 2030');
      set('clSubject', 'Lead Product Designer — application');
      set('clSalutation', 'Hello Acme!');
      set('clSignoff', 'Cheers,');
      set('clSignature', 'J. Doe');
      set('clRecipient', '123 Main St\nLondon EC1A 1BB');
      set('clP1', 'Para one.');
      renderLetter();
      const q = s => document.querySelector(s).textContent;
      return {
        date: q('.cl-date'), subject: q('.cl-subject'), salutation: q('.cl-salutation'),
        signoff: q('.cl-signoff'), sig: q('.cl-sig'),
        recipLines: document.querySelector('.cl-recipient') ? document.querySelector('.cl-recipient').innerHTML.split('<br>').length : 0
      };
    });
    ok(r.date === '1 January 2030', 'date override', r.date);
    ok(r.subject === 'Lead Product Designer — application', 'subject override', r.subject);
    ok(r.salutation === 'Hello Acme!', 'salutation override', r.salutation);
    ok(r.signoff === 'Cheers,', 'custom sign-off (not in presets)', r.signoff);
    ok(r.sig === 'J. Doe', 'signature override', r.sig);
    ok(r.recipLines === 3, 'recipient block: company + 2 address lines (no manager)', r.recipLines);
  }

  /* ── 4. paragraphs: add, remove, renumber ── */
  console.log('\n[4] dynamic paragraphs');
  {
    const r = await page.evaluate(() => {
      const out = {};
      addLetterParagraph(true);
      const tas = document.querySelectorAll('#clParagraphs textarea');
      out.count = tas.length; out.newId = tas[4].id;
      tas[4].value = 'Para five.';
      out.fifthLabel = document.querySelectorAll('#clParagraphs label')[4].textContent;
      renderLetter();
      out.paragraphsRendered = Array.from(document.querySelectorAll('.cl-p')).map(p => p.textContent);
      removeLetterParagraph(document.querySelectorAll('#clParagraphs .cl-para-remove')[0]); /* drop slot 1 */
      out.afterRemove = document.querySelectorAll('#clParagraphs .cl-para').length;
      out.firstIdAfter = document.querySelector('#clParagraphs textarea').id;
      out.firstValAfter = document.querySelector('#clParagraphs textarea').value;
      out.firstLabelAfter = document.querySelector('#clParagraphs label').textContent;
      /* single-paragraph guard */
      setLetterParagraphs(['only one']);
      removeLetterParagraph(document.querySelector('#clParagraphs .cl-para-remove'));
      out.minGuard = document.querySelectorAll('#clParagraphs .cl-para').length;
      setLetterParagraphs(['one', 'two', 'three']);
      out.customCount = document.querySelectorAll('#clParagraphs .cl-para').length;
      renderLetter();
      return out;
    });
    ok(r.count === 5 && r.newId === 'clP5', 'add paragraph → clP5', r.newId);
    ok(/5/.test(r.fifthLabel) && !/opening|closing/.test(r.fifthLabel), 'extra slot gets plain label', r.fifthLabel);
    ok(r.paragraphsRendered.join('|') === 'Para one.|Para five.', 'only non-empty paragraphs render', r.paragraphsRendered.join('|'));
    ok(r.afterRemove === 4 && r.firstIdAfter === 'clP1', 'remove renumbers ids contiguously', r.firstIdAfter);
    ok(r.firstValAfter === '', 'remove preserves remaining order');
    ok(/opening/.test(r.firstLabelAfter), 'semantic labels follow position after renumber', r.firstLabelAfter);
    ok(r.minGuard === 1, 'cannot remove the last paragraph');
    ok(r.customCount === 3, 'setLetterParagraphs rebuilds exact count');
  }

  /* ── 5. writers replace the whole list ── */
  console.log('\n[5] writers replace all paragraphs');
  {
    const r = await page.evaluate(() => {
      const out = {};
      document.getElementById('experienceList').innerHTML = '';
      addExpSilent();
      const is = document.querySelectorAll('#experienceList .dynamic-item'); const l = is[is.length - 1];
      l.querySelectorAll('input')[0].value = 'Senior Software Engineer'; l.querySelectorAll('input')[1].value = 'Tech Corp';
      l.querySelectorAll('input')[2].value = 'Mar 2021 – Present';
      l.querySelector('textarea').value = 'Led a team of 8 engineers delivering the payments platform.\nReduced API latency by 42% through caching.';
      addLetterParagraph(false); addLetterParagraph(false); /* now 5 slots */
      draftLetter();
      out.afterDraft = document.querySelectorAll('#clParagraphs .cl-para').length;
      out.p1 = document.getElementById('clP1').value.length > 40;
      out.p4 = document.getElementById('clP4').value.length > 10;
      return out;
    });
    ok(r.afterDraft === 4, 'draftLetter resets to the 4-paragraph contract', r.afterDraft);
    ok(r.p1 && r.p4, 'draft filled the slots');
  }

  /* ── 6. state round-trip (undo stack, versions, share links all use this) ── */
  console.log('\n[6] state round-trip');
  {
    const r = await page.evaluate(() => {
      setLetterParagraphs(['a', 'b', 'c', 'd', 'e']);
      document.getElementById('clSubject').value = 'Custom subject';
      document.getElementById('clSignature').value = 'J. D.';
      document.getElementById('clSignoff').value = 'Thanks,';
      const st = JSON.parse(JSON.stringify(getState()));
      setLetterParagraphs(['x']);
      document.getElementById('clSubject').value = '';
      document.getElementById('clSignature').value = '';
      document.getElementById('clSignoff').value = '';
      restoreState(st);
      return {
        paras: Array.from(document.querySelectorAll('#clParagraphs textarea')).map(t => t.value),
        subject: document.getElementById('clSubject').value,
        signature: document.getElementById('clSignature').value,
        signoff: document.getElementById('clSignoff').value,
        sigRendered: document.querySelector('.cl-sig').textContent
      };
    });
    ok(r.paras.join('') === 'abcde', 'paragraph count and content survive restore', r.paras.join(''));
    ok(r.subject === 'Custom subject' && r.signature === 'J. D.' && r.signoff === 'Thanks,', 'envelope fields survive restore');
    ok(r.sigRendered === 'J. D.', 'signature renders after restore');
  }

  /* ── 7. old state (p1..p4, no envelope) migrates ── */
  console.log('\n[7] legacy state migration');
  {
    const r = await page.evaluate(() => {
      restoreState({
        name: 'Legacy User', letter: {
          company: 'Old Corp', hiringManager: '', role: 'Old Role', tone: 'warm',
          p1: 'legacy one', p2: 'legacy two', p3: '', p4: 'legacy four', signoff: 'Yours sincerely,'
        }
      });
      return {
        paras: Array.from(document.querySelectorAll('#clParagraphs textarea')).map(t => t.value),
        company: document.getElementById('clCompany').value,
        signoff: document.getElementById('clSignoff').value,
        sig: document.querySelector('.cl-sig').textContent,
        salutation: document.querySelector('.cl-salutation').textContent
      };
    });
    ok(r.paras.join('|') === 'legacy one|legacy two||legacy four', 'old p1..p4 map into paragraph slots', r.paras.join('|'));
    ok(r.company === 'Old Corp' && r.signoff === 'Yours sincerely,', 'legacy envelope fields restored');
    ok(r.sig === 'Legacy User', 'legacy state: signature falls back to name');
    ok(r.salutation === 'Dear Hiring Team,', 'legacy state: salutation default');
  }

  /* ── 8. every export format agrees on the envelope ── */
  console.log('\n[8] exports agree on the envelope');
  {
    const r = await page.evaluate(() => {
      const set = (id, v) => { document.getElementById(id).value = v; };
      document.getElementById('fullName').value = 'Jane Doe';
      document.getElementById('email').value = 'jane@example.com';
      set('clCompany', 'Acme Corp'); set('clRole', 'Lead Product Designer');
      set('clDate', '1 January 2030'); set('clSubject', 'Custom Subject X');
      set('clSalutation', 'Hello there,'); set('clSignoff', 'Cheers,'); set('clSignature', 'J. Doe');
      setLetterParagraphs(['Body alpha.', 'Body beta.']);
      renderLetter();
      return {
        md: buildLetterMarkdown(), plain: buildLetterPlain(), rtf: buildLetterRTF(),
        docx: docxLetterParts()
      };
    });
    for (const [name, txt] of [['markdown', r.md], ['plain', r.plain], ['rtf', r.rtf], ['docx', r.docx]]) {
      ok(txt.includes('Custom Subject X'), name + ': custom subject');
      ok(txt.includes('1 January 2030'), name + ': custom date');
      ok(txt.includes('Hello there,'), name + ': custom salutation');
      ok(txt.includes('Cheers,'), name + ': custom sign-off');
      ok(txt.includes('J. Doe'), name + ': custom signature');
      ok(txt.includes('Body alpha.') && txt.includes('Body beta.'), name + ': all paragraphs');
      ok(!/Dear Hiring Team/.test(txt), name + ': no default salutation leak');
    }
    /* rtf-specific: line breaks instead of raw \n in recipient */
    await page.evaluate(() => { document.getElementById('clRecipient').value = '123 Main St\nLondon'; renderLetter(); });
    const rtf = await page.evaluate(() => buildLetterRTF());
    ok(rtf.includes('123 Main St\\line London'), 'rtf: recipient lines separated by \\line');
  }

  /* ── 9. live typing flows through the debounced preview ── */
  console.log('\n[9] live editing');
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.smart-tab-btn')).find(x => (x.getAttribute('onclick') || '').includes("'letter'")); if (b) b.click(); });
  await page.fill('#clSubject', 'Typed subject');
  await page.waitForTimeout(450);
  {
    const t = await page.evaluate(() => document.querySelector('.cl-subject').textContent);
    ok(t === 'Typed subject', 'typing in subject updates the preview', t);
  }

  console.log(`\n${fail === 0 ? '✔' : '✘'} ${pass} passed, ${fail} failed (${pass + fail} checks)`);
  await browser.close();
  server.kill();
  process.exit(fail === 0 ? 0 : 1);
})();
