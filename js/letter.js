/* Cover letter: editable envelope fields + paragraph rows, the shared
 * letterEnvelope() model, and the letter render + RTF/Markdown/plain-text
 * builders used by exports. */

import { scaleCVToFit } from './preview.js';
import { sanitizeInput } from './ui.js';

let letterDebounceT=null; /* letter-side edit debounce (independent of the CV one) */

/* ============ COVER LETTER ============ */
/* ── Editable paragraph list: the first four slots keep the ids clP1..clP4 so
   drafts, state and tests address them; extras get clP5, clP6… Slots are
   renumbered on remove, so ids are always contiguous. ── */
export const CL_PARA_PLACEHOLDERS=['Why you\u2019re writing and the role you want\u2026','What draws you to them specifically\u2026','Your strongest, most relevant achievements\u2026','Call to action — interview availability\u2026'];
export function letterParagraphTexts(){return Array.from(document.querySelectorAll('#clParagraphs textarea')).map(t=>t.value||'');}
export function renumberLetterParagraphs(){
  Array.from(document.querySelectorAll('#clParagraphs .cl-para')).forEach((row,i)=>{
    const ta=row.querySelector('textarea');
    ta.id='clP'+(i+1);
    const lbl=row.querySelector('label');
    if(lbl){lbl.htmlFor=ta.id;lbl.textContent='Paragraph '+(i+1)+(i<4?' — '+['opening','why this company','evidence','closing'][i]:'');}
    ta.placeholder=CL_PARA_PLACEHOLDERS[i]||'Extra paragraph — use for anything the four-part structure doesn\u2019t cover\u2026';
  });
}
export function addLetterParagraph(focus){
  const c=document.getElementById('clParagraphs');if(!c)return null;
  const d=document.createElement('div');d.className='form-group cl-para';
  d.innerHTML='<div class="cl-para-head"><label></label><button type="button" class="cl-para-remove" title="Remove this paragraph" aria-label="Remove this paragraph" onclick="removeLetterParagraph(this)">×</button></div><textarea rows="3" oninput="sanitizeInput(this);updateLetterPreview()"></textarea>';
  c.appendChild(d);
  renumberLetterParagraphs();
  d.classList.add('dynamic-item-new');
  if(focus){const ta=d.querySelector('textarea');if(ta)ta.focus();}
  return d;
}
export function removeLetterParagraph(btn){
  const c=document.getElementById('clParagraphs');if(!c)return;
  const rows=c.querySelectorAll('.cl-para');
  if(rows.length<=1)return; /* a letter always has at least one paragraph */
  const row=btn.closest('.cl-para');if(row)row.remove();
  renumberLetterParagraphs();
  updateLetterPreview();
}
/* Rebuild the list from an array of texts (writers, restoreState). An empty
   array yields the default four-slot layout. */
export function setLetterParagraphs(arr){
  const c=document.getElementById('clParagraphs');if(!c)return;
  const ps=Array.isArray(arr)&&arr.length?arr.map(x=>String(x==null?'':x)):['','','',''];
  c.innerHTML='';
  ps.forEach(p=>{const d=addLetterParagraph(false);if(d)d.querySelector('textarea').value=p;});
  renumberLetterParagraphs();
  letterAutoHints();
}
export function getLetterFields(){
  const paragraphs=letterParagraphTexts();
  const v=id=>document.getElementById(id)?.value||'';
  return{company:v('clCompany'),hiringManager:v('clHiringManager'),recipient:v('clRecipient'),role:v('clRole'),date:v('clDate'),subject:v('clSubject'),salutation:v('clSalutation'),tone:v('clTone'),p1:paragraphs[0]||'',p2:paragraphs[1]||'',p3:paragraphs[2]||'',p4:paragraphs[3]||'',paragraphs,signoff:v('clSignoff'),signature:v('clSignature')};
}
/* Placeholder hints mirror the smart defaults, so an empty field shows exactly
   what the letter will use. Called whenever the letter or CV identity changes. */
export function letterAutoHints(){
  const f=getLetterFields();
  const set=(id,ph)=>{const el=document.getElementById(id);if(el)el.placeholder=ph;};
  const hm=f.hiringManager.trim();
  set('clDate',new Date().toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}));
  set('clSubject',f.role.trim()?'Re: Application for '+f.role.trim():'Re: Application');
  set('clSalutation',hm?'Dear '+hm+',':(f.company.trim()?'Dear Hiring Team,':'Dear Sir or Madam,'));
  set('clSignature',document.getElementById('fullName')?.value||'Your Name');
}
/* ── The one source of truth for every letter renderer (preview, DOCX, RTF,
   Markdown, TXT): resolves the editable fields with smart fallbacks, so all
   formats always agree. ── */
export function letterEnvelope(){
  const f=getLetterFields();
  const name=document.getElementById('fullName')?.value||'Your Name',title=document.getElementById('title')?.value||'';
  const email=document.getElementById('email')?.value||'',phone=document.getElementById('phone')?.value||'',loc=document.getElementById('location')?.value||'',li=document.getElementById('linkedin')?.value||'';
  const contacts=[email,phone,loc,li].filter(Boolean);
  const hm=f.hiringManager.trim();
  const recipientLines=[hm,f.company.trim()].filter(Boolean).concat(String(f.recipient||'').split('\n').map(s=>s.trim()).filter(Boolean));
  return{
    name,title,email,contacts,
    date:f.date.trim()||new Date().toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}),
    recipientLines,
    subject:f.subject.trim()||(f.role.trim()?'Re: Application for '+f.role.trim():'Re: Application'),
    salutation:f.salutation.trim()||(hm?'Dear '+hm+',':(f.company.trim()?'Dear Hiring Team,':'Dear Sir or Madam,')),
    paragraphs:f.paragraphs.filter(p=>p&&p.trim()),
    signoff:f.signoff.trim()||'Kind regards,',
    signature:f.signature.trim()||name
  };
}
export function updateLetterPreview(){if(letterDebounceT)clearTimeout(letterDebounceT);letterDebounceT=setTimeout(()=>{renderLetter();scaleCVToFit();},200);}
export function renderLetter(){
    const el=document.getElementById('clPreview');if(!el)return;
    const E=letterEnvelope();
    const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const nl=s=>esc(s).split('\n').filter(x=>x.trim()).map(x=>`<p class="cl-p">${x}</p>`).join('');
    const contacts=E.contacts.map(c=>c===E.email?`<a href="mailto:${esc(E.email)}">${esc(E.email)}</a>`:`<span>${esc(c)}</span>`);
    el.innerHTML=`<div class="cl-name">${esc(E.name)}</div>${E.title?`<div class="cl-title">${esc(E.title)}</div>`:''}${contacts.length?`<div class="cl-contact">${contacts.join('')}</div>`:''}<div class="cl-date">${esc(E.date)}</div>${E.recipientLines.length?`<div class="cl-recipient">${E.recipientLines.map(l=>esc(l)).join('<br>')}</div>`:''}<div class="cl-subject">${esc(E.subject)}</div><div class="cl-salutation">${esc(E.salutation)}</div>${E.paragraphs.map(p=>nl(p)).join('')}<div class="cl-signoff">${esc(E.signoff)}</div><div class="cl-sig">${esc(E.signature)}</div>`;
    letterAutoHints();
}
export function buildLetterRTF(){
    const E=letterEnvelope();
    const e=s=>String(s).replace(/\\/g,'\\\\').replace(/\{/g,'\\{').replace(/\}/g,'\\}').replace(/\n/g,'\\line ');
    let r='{\\rtf1\\ansi\\deff0\n{\\fonttbl{\\f0\\fswiss Helvetica;}{\\f1\\froman Georgia;}}\n\\paperw11906\\paperh16838\\margl1440\\margr1440\\margt1440\\margb1440\n';
    r+='\\pard\\qc\\sb100{\\f1\\fs36\\b '+e(E.name)+'}\\par\n';
    if(E.contacts.length)r+='\\pard\\qc\\sb0\\sa120{\\f0\\fs18 '+e(E.contacts.join(' | '))+'}\\par\n';
    r+='\\pard\\sb200\\sa0{\\f0\\fs20 '+e(E.date)+'}\\par\n';
    if(E.recipientLines.length)r+='\\pard\\sb200\\sa0{\\f0\\fs20 '+e(E.recipientLines.join('\n'))+'}\\par\n'; /* e() turns \n into a real RTF \line — joining with a literal '\line' would get backslash-escaped into visible text */
    r+='\\pard\\sb200\\sa0{\\f1\\fs22\\b '+e(E.subject)+'}\\par\n';
    r+='\\pard\\sb200\\sa0{\\f1\\fs20 '+e(E.salutation)+'}\\par\n';
    E.paragraphs.forEach(p=>{r+='\\pard\\sb120\\sa0{\\f1\\fs20 '+e(p)+'}\\par\n';});
    r+='\\pard\\sb200\\sa0{\\f1\\fs20 '+e(E.signoff)+'}\\par\n\\pard\\sb60{\\f1\\fs22\\b '+e(E.signature)+'}\\par\n}';
    return r;
}

export function buildLetterMarkdown(){
    const E=letterEnvelope();
    let m=`# ${E.name}\n\n`;
    if(E.contacts.length)m+=`${E.contacts.join(' · ')}\n\n`;
    m+=`*${E.date}*\n\n`;
    if(E.recipientLines.length)m+=`${E.recipientLines.join('  \n')}\n\n`;
    m+=`**${E.subject}**\n\n`;
    m+=`${E.salutation}\n\n`;
    E.paragraphs.forEach(p=>{m+=`${p.trim()}\n\n`;});
    m+=`${E.signoff}\n\n**${E.signature}**\n`;
    return m;
}
export function buildLetterPlain(){
    const E=letterEnvelope();
    let t=`${E.name}\n${E.contacts.join(' | ')}\n${E.date}\n\n`;
    if(E.recipientLines.length)t+=`${E.recipientLines.join('\n')}\n\n`;
    t+=`${E.subject}\n\n${E.salutation}\n\n`;
    E.paragraphs.forEach(p=>{t+=`${p.trim()}\n\n`;});
    t+=`${E.signoff}\n${E.signature}\n`;
    return t;
}
