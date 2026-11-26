/* Universal CV import: client-side text extraction (PDF/DOCX/TXT), the
 * deterministic parser, optional Gemini extraction, review UI + apply,
 * and the LinkedIn PDF importer. */

import { mobileNav } from './carousel.js';
import { getEducation, getExperiences } from './cvdata.js';
import { addEduSilent, addExpSilent, addLangSilent, addProjSilent, addPubSilent, addVolSilent, initDragDrop } from './form.js';
import { CVI_GEMINI_DEFAULT, cviCallGemini, cviGetKey, cviGetModel, cviSetKey, cviSetModel } from './gemini.js';
import { _updatePreviewNow, updatePreview } from './render.js';
import { persistState } from './state.js';
import { showToast, uiAnimateClose } from './ui.js';

let pendingLinkedInData=null;

// ============ LinkedIn Import ============
/* v2.7: extract LinkedIn text through the same coordinate-aware PDF reader
   (cviPdfToLines) the universal parser uses — the old space-join handed the
   parser one giant blob per page, which made the name field swallow the whole
   first page on real exports. Rows are joined to real visual lines; the
   parser's clean() strips the "|" column separators it inserts. */
export async function importLinkedInPDF(e){const f=e.target.files[0];if(!f)return;document.getElementById('linkedInProgress').style.display='block';document.getElementById('linkedInProgressFill').style.width='20%';document.getElementById('linkedInProgressText').textContent='Reading…';try{const b=await f.arrayBuffer();document.getElementById('linkedInProgressFill').style.width='50%';const pdf=await pdfjsLib.getDocument({data:b}).promise;const out=await cviPdfToLines(pdf);document.getElementById('linkedInProgressFill').style.width='80%';pendingLinkedInData=parseLinkedInText(out.text);const pv=[];if(pendingLinkedInData.name)pv.push(['Name',pendingLinkedInData.name]);if(pendingLinkedInData.title)pv.push(['Title',pendingLinkedInData.title]);if(pendingLinkedInData.email)pv.push(['Email',pendingLinkedInData.email]);if(pendingLinkedInData.phone)pv.push(['Phone',pendingLinkedInData.phone]);if(pendingLinkedInData.location)pv.push(['Location',pendingLinkedInData.location]);if(pendingLinkedInData.summary)pv.push(['Summary',pendingLinkedInData.summary.substring(0,80)+'…']);if(pendingLinkedInData.experiences&&pendingLinkedInData.experiences.length)pv.push(['Experience',pendingLinkedInData.experiences.length+' position(s)']);if(pendingLinkedInData.education&&pendingLinkedInData.education.length)pv.push(['Education',pendingLinkedInData.education.length+' degree(s)']);if(pendingLinkedInData.languages&&pendingLinkedInData.languages.length)pv.push(['Languages',pendingLinkedInData.languages.length+' language(s)']);if(pendingLinkedInData.skills)pv.push(['Skills',pendingLinkedInData.skills.substring(0,80)+'…']);document.getElementById('linkedInPreviewTable').innerHTML=pv.map(([l,v])=>`<tr><td>${l}</td><td>${v}</td></tr>`).join('');document.getElementById('linkedInPreview').style.display='block';document.getElementById('linkedInProgressFill').style.width='100%';document.getElementById('linkedInProgressText').textContent='Review below';setTimeout(()=>document.getElementById('linkedInProgress').style.display='none',2000);}catch(err){document.getElementById('linkedInProgressText').textContent='Could not read PDF';setTimeout(()=>document.getElementById('linkedInProgress').style.display='none',3000);}}
export function applyLinkedInData(){if(!pendingLinkedInData)return;const d=pendingLinkedInData;if(d.name)document.getElementById('fullName').value=d.name;if(d.title)document.getElementById('title').value=d.title;if(d.email)document.getElementById('email').value=d.email;if(d.phone)document.getElementById('phone').value=d.phone;if(d.location)document.getElementById('location').value=d.location;if(d.summary)document.getElementById('summary').value=d.summary.substring(0,300);if(d.skills)document.getElementById('skills').value=d.skills;document.getElementById('experienceList').innerHTML='';(d.experiences||[]).forEach(e=>{addExpSilent();const is=document.querySelectorAll('#experienceList .dynamic-item');const l=is[is.length-1];if(l){l.querySelectorAll('input')[0].value=e.title||'';l.querySelectorAll('input')[1].value=e.company||'';l.querySelectorAll('input')[2].value=e.dates||'';l.querySelector('textarea').value=e.description||'';}});if(!d.experiences||!d.experiences.length)addExpSilent();document.getElementById('volunteeringList').innerHTML='';(d.volunteering||[]).forEach(e=>{addVolSilent();const is=document.querySelectorAll('#volunteeringList .dynamic-item');const l=is[is.length-1];if(l){l.querySelectorAll('input')[0].value=e.organization||'';l.querySelectorAll('input')[1].value=e.role||'';l.querySelector('textarea').value=e.description||'';}});if(d.interests)document.getElementById('interests').value=d.interests;document.getElementById('educationList').innerHTML='';(d.education||[]).forEach(e=>{addEduSilent();const is=document.querySelectorAll('#educationList .dynamic-item');const l=is[is.length-1];if(l){l.querySelectorAll('input')[0].value=e.degree||'';l.querySelectorAll('input')[1].value=e.institution||'';l.querySelectorAll('input')[2].value=e.year||'';}});if(!d.education||!d.education.length)addEduSilent();document.getElementById('languageList').innerHTML='';(d.languages||[]).forEach(e=>{addLangSilent();const is=document.querySelectorAll('#languageList .dynamic-item');const l=is[is.length-1];if(l){l.querySelector('input').value=e.language||'';l.querySelector('select').value=e.level||'';}});if(!d.languages||!d.languages.length)addLangSilent();updatePreview();initDragDrop();document.getElementById('linkedInPreview').style.display='none';pendingLinkedInData=null;showToast('Profile applied');}
export function discardLinkedInData(){document.getElementById('linkedInPreview').style.display='none';pendingLinkedInData=null;showToast('Discarded');}
export function parseLinkedInText(t){
  /* v2.7: rebuilt on top of the universal parser. The old positional splitter
     assumed fixed 4-line blocks (title/company/dates/description) and broke on
     every real "Save to PDF" export. Now: line-ise the text, split it into
     sections with the shared heading detector, and run the same battle-tested
     section parsers (cviParseExperience/Education/Skills/Languages). */
  const EMPTY={name:'',title:'',email:'',phone:'',location:'',summary:'',skills:'',experiences:[],education:[],languages:[]};
  const text=cviNormalize(t||'');
  /* LinkedIn decorations that are never CV content: "· 2 yrs 3 mos" duration
     suffixes, "· Full-time" employment types, "Contact info", "500+ connections",
     "Show all N experiences" links. Durations keep their leading · so prose like
     "5+ years of experience" inside descriptions is never touched. */
  const liNoise=/^(?:contact\s+info|page\s*\d+(?:\s+of\s+\d+)?|\d[\d.,]*\s*\+?\s*(?:connections?|followers?|recommendations?)|show\s+(?:all|more)\b)/i;
  const liDur=/\s*[\u00b7|]\s*\d+\s*(?:yrs?|years?|mos?|months?)\s*(?:\d+\s*(?:yrs?|years?|mos?|months?)\s*)?$/i;
  const liEmp=/\s*[\u00b7|]\s*(?:full[- ]time|part[- ]time|contract|internship|self[- ]employed|freelance|apprenticeship)\s*$/i;
  const clean=s=>String(s).replace(liDur,'').replace(liEmp,'').replace(/\s{2,}/g,' ').replace(/^[\s|\u00b7]+|[\s|\u00b7]+$/g,'').trim();
  const rows=cviLines(text).map(clean).filter(s=>s&&!liNoise.test(s));
  const L=rows.map(s=>({segs:[s],size:0,top:false}));
  if(!L.length)return EMPTY;
  /* section split through the shared heading detector (Experience, Education,
     Skills, Languages, Summary/About, Volunteer Experience all match) */
  const secs={pre:[]};let cur='pre';
  for(const ln of L){
    const h=cviHeaderType(ln.segs.join(' '));
    if(h){cur=h;if(!secs[cur])secs[cur]=[];continue;}
    secs[cur].push(ln);
  }
  const sl=k=>secs[k]||[];
  const r={...EMPTY};
  /* identity from the preamble: name (1-5 words), headline, "City, Country" */
  const pre=sl('pre');
  if(pre.length){
    let ni=0;
    r.name=pre[ni].segs.join(' ').slice(0,60);
    /* long names export on two stacked lines: single word + title-case follower */
    if(r.name.split(/\s+/).length===1&&pre[ni+1]){
      const s1=pre[ni+1].segs.join(' ').trim();
      if(s1&&!/\d|@|http|,/.test(s1)&&!cviHeaderType(s1)&&!CVI_ROLE_KW.test(s1)&&!CVI_CO_KW.test(s1)&&s1.split(/\s+/).length<=3){r.name+=' '+s1;ni++;}
    }
    for(let i=ni+1;i<pre.length;i++){
      const s=pre[i].segs.join(' ');
      if(!r.location&&/^[A-Z][\p{L}.`'\u2019-]+(?:\s+[A-Z][\p{L}.`'\u2019-]+)?,\s*(?:[A-Z]{2}\b|[A-Z][\p{L}.`'\u2019-]+)/u.test(s)&&!CVI_ROLE_KW.test(s)&&!CVI_CO_KW.test(s)){r.location=s;continue;}
      if(!r.title&&s!==r.name&&!cviHeaderType(s)&&!/^(?:contact|page|phone|email)\b/i.test(s))r.title=s.slice(0,90);
      if(r.title&&r.location)break;
    }
  }
  const emM=text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  if(emM)r.email=emM[0];
  r.phone=cviFindPhone(text);
  /* job/education lines that are pure "City, Country" markers are dropped (a
     company like "Acme Corp, Inc." survives via the company-keyword guard) */
  const liPlace=/^[A-Z][\p{L}.`'\u2019-]+(?:\s+[A-Z][\p{L}.`'\u2019-]+)?,\s*(?:[A-Z]{2}\b|[A-Z][\p{L}.`'\u2019-]+(?:\s+[A-Z][\p{L}.`'\u2019-]+)?)$/u;
  const notPlace=arr=>arr.filter(ln=>{const s=ln.segs.join(' ');return !liPlace.test(s)||/\d/.test(s)||CVI_CO_KW.test(s)||CVI_INST_KW.test(s);});
  const found=Object.keys(secs).some(k=>k!=='pre'&&k!=='personal'&&k!=='ignore'&&secs[k].length);
  if(found){
    r.experiences=cviParseExperience(notPlace(sl('experience'))).slice(0,12);
    r.volunteering=cviParseVolunteering(notPlace(sl('volunteering')));
    r.education=cviParseEducation(sl('education'));
    const sk=cviParseSkills(sl('skills'));r.skills=sk.join(', ');
    r.languages=cviParseLanguages(sl('languages'));
    r.summary=cviParseSummary(sl('summary'));
  }else{
    /* no recognisable headings at all — best-effort on the whole document */
    r.experiences=cviParseExperience(notPlace(L)).slice(0,12);
    r.education=cviParseEducation(L);
    r.skills=cviParseSkills(L).join(', ');
    r.languages=cviParseLanguages(L);
  }
  return r;
}
const dz=document.getElementById('linkedInDropZone');if(dz){dz.addEventListener('dragover',e=>{e.preventDefault();dz.style.borderColor='var(--text-secondary)';});dz.addEventListener('dragleave',e=>{e.preventDefault();dz.style.borderColor='';});dz.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();dz.style.borderColor='';const f=e.dataTransfer.files[0];if(f&&f.type==='application/pdf'){const dt=new DataTransfer();dt.items.add(f);document.getElementById('linkedInFile').files=dt.files;importLinkedInPDF({target:{files:dt.files}});}});}

// ============ Universal CV Import (local parser + optional Gemini AI) ============
export const CVI_LEVELS=['','Native','A1','A2','B1','B2','C1','C2'];
export const CVI_LANG_NAMES=['English','Spanish','French','German','Italian','Portuguese','Dutch','Swedish','Polish','Arabic','Chinese','Mandarin','Cantonese','Hindi','Bengali','Bangla','Urdu','Russian','Japanese','Korean','Turkish','Danish','Norwegian','Finnish','Greek','Czech','Romanian','Hungarian','Ukrainian','Vietnamese','Thai','Indonesian','Malay','Punjabi','Tamil','Telugu','Marathi','Gujarati','Kannada','Malayalam','Sinhala','Sinhalese','Nepali','Pashto','Persian','Farsi','Hebrew','Swahili','Catalan','Basque','Galician','Welsh','Irish','Bulgarian','Slovak','Croatian','Serbian','Bosnian','Slovenian','Albanian','Macedonian','Lithuanian','Latvian','Estonian','Afrikaans','Tagalog','Amharic','Somali','Kurdish','Azerbaijani','Uzbek','Kazakh','Mongolian','Burmese','Khmer','Lao','Hausa','Yoruba','Igbo','Zulu','Xhosa'];
export const CVI_ROLE_KW=/(engineer|developer|programmer|manager|consultant|analyst|designer|specialist|architect|scientist|director|coordinator|assistant|officer|accountant|teacher|lecturer|professor|researcher|intern|apprentice|trainee|nurse|doctor|physician|lawyer|attorney|paralegal|technician|administrator|executive|recruiter|advisor|associate|partner|freelance|contractor|scrum\s*master|product\s+owner|chef|bartender|barista|waiter|waitress|server|cashier|sales|marketing|writer|editor|journalist|translator|tutor|volunteer|founder|co-?founder|ceo|cto|cfo|coo|steward|operator|mechanic|electrician|plumber|driver|pilot|head|lead|secretary|president|treasurer|chairman|chairperson|representative|captain|mentor|organizer|member)/i;
export const CVI_CO_KW=/\b(inc|llc|ltd|limited|gmbh|s\.?a\.?|ag|bv|nv|plc|pty|pvt|corp|corporation|company|group|agency|technologies|technology|labs?|solutions|systems|consulting|partners|associates|studios?|media|software|digital|bank|hospital|clinic|universit|institute|college|school|academy|foundation|ministry|department|bureau|communications|networks?|industries|logistics|pharma|capital|ventures|association|organisation|organization|centre|center|council|airlines|hotel|restaurant|cafe|store|shop|retail|energy|petroleum|telecom|insurance|firm)\b/i;
export const CVI_SEC_DEFS=[
 ['summary',/^(?:(?:personal|professional|career|executive)\s+)?(?:profile|summary|about(?:\s+me)?|objective|personal\s+statement|career\s+overview|career\s+objective|profile\s+summary)\s*$/i],
 ['experience',/^(?:(?:work|professional|employment|career|relevant)\s+)?(?:experience|employment\s+history|work\s+history|professional\s+background|career\s+history|history|employment|professional\s+history|employment\s+record|relevant\s+work\s+experience|research\s+experience)\s*$/i],
 ['education',/^(?:education|academics?|educational\s+background|academic\s+(?:background|history|qualifications|record)|qualifications?|training|professional\s+development|continuing\s+education)\s*(?:\s*[&+]\s*training)?\s*$/i],
 ['skills',/^(?:(?:technical|core|key|professional|personal|it|digital|computer|special|top)\s+)?(?:skills|competencies|expertise|technologies|tech\s*stack|strengths|tools|summary\s+of\s+qualifications|core\s+competencies|technical\s+profile|key\s+strengths)\s*(?:\s*[&+]\s*(?:abilities|tools|interests|endorsements|technologies))?\s*$/i],
 ['languages',/^(?:languages?|linguistic\s+skills?|language\s+skills?)\s*$/i],
 ['volunteering',/^(?:volunteer(?:ing)?(?:\s+(?:experience|work|service))?|community\s+service|extracurricular(?:\s+activities)?|activities)\s*$/i],
 ['publications',/^(?:publications?|papers|research\s+publications|selected\s+publications|peer[- ]reviewed\s+publications|articles?|research\s+outputs?)\s*$/i],
 ['projects',/^(?:projects?|key\s+projects|selected\s+projects|personal\s+projects|side\s+projects|portfolio|open[- ]source\s+(?:projects|contributions))\s*$/i],
 ['interests',/^(?:interests?|hobbies(?:\s*(?:&|and)\s*interests)?|personal\s+interests|areas\s+of\s+interest)\s*$/i],
 ['personal',/^(?:personal\s+(?:information|details|data)|contact(?:\s+(?:information|details|info))?|additional\s+contact)\s*$/i],
 ['ignore',/^(?:references|awards?|honou?rs?(?:\s*(?:&|and)\s*awards?)?|certificates?|certifications?|licen[cs]es?(?:\s*(?:&|and)?\s*certifications?)?|achievements|courses|additional\s+information|objective\s+statement|declaration|annex(?:es)?|photographs?|patents|memberships|professional\s+affiliations|conferences|talks)\s*$/i]
];
/* compressed (space-stripped) header names — handles letter-spaced headers like "E D U C AT I O N" */
export const CVI_SEC_COMPRESSED={summary:['SUMMARY','PROFILE','ABOUTME','ABOUT','OBJECTIVE','PERSONALSTATEMENT','CAREEROVERVIEW','PROFESSIONALPROFILE','CAREERPROFILE','PERSONALPROFILE','EXECUTIVESUMMARY','CAREEROBJECTIVE','PROFILESUMMARY'],experience:['EXPERIENCE','WORKEXPERIENCE','EMPLOYMENTHISTORY','EMPLOYMENT','WORKHISTORY','CAREERHISTORY','PROFESSIONALEXPERIENCE','PROFESSIONALBACKGROUND','RELEVANTEXPERIENCE','PROFESSIONALHISTORY','EMPLOYMENTRECORD','RELEVANTWORKEXPERIENCE','RESEARCHEXPERIENCE'],education:['EDUCATION','ACADEMICS','EDUCATIONALBACKGROUND','ACADEMICBACKGROUND','ACADEMICHISTORY','ACADEMICQUALIFICATIONS','QUALIFICATIONS','EDUCATIONTRAINING','EDUCATIONANDTRAINING','TRAINING','PROFESSIONALDEVELOPMENT','CONTINUINGEDUCATION','ACADEMICRECORD'],skills:['SKILLS','TECHNICALSKILLS','CORESKILLS','KEYSKILLS','PROFESSIONALSKILLS','PERSONALSKILLS','ITSKILLS','DIGITALSKILLS','SPECIALSKILLS','COMPETENCIES','EXPERTISE','TECHNOLOGIES','TECHSTACK','STRENGTHS','TOOLS','SKILLSABILITIES','SKILLSANDABILITIES','SKILLSINTERESTS','SKILLSENDORSEMENTS','SKILLSANDENDORSEMENTS','TOPSKILLS','SUMMARYOFQUALIFICATIONS','CORECOMPETENCIES','TECHNICALPROFILE','TOOLSANDTECHNOLOGIES','KEYSTRENGTHS'],languages:['LANGUAGES','LANGUAGE','LANGUAGESKILLS','LINGUISTICSKILLS'],volunteering:['VOLUNTEERING','VOLUNTEEREXPERIENCE','VOLUNTEERWORK','VOLUNTEER','COMMUNITYSERVICE','EXTRACURRICULAR','EXTRACURRICULARACTIVITIES','ACTIVITIES'],publications:['PUBLICATIONS','PUBLICATION','PAPERS','PAPER','RESEARCHPUBLICATIONS','SELECTEDPUBLICATIONS','PEERREVIEWEDPUBLICATIONS','ARTICLES','ARTICLE','RESEARCHOUTPUTS'],projects:['PROJECTS','PROJECT','KEYPROJECTS','SELECTEDPROJECTS','PERSONALPROJECTS','SIDEPROJECTS','PORTFOLIO','OPENSOURCEPROJECTS','OPENSOURCECONTRIBUTIONS'],interests:['INTERESTS','INTEREST','HOBBIES','HOBBIESANDINTERESTS','PERSONALINTERESTS','AREASOFINTEREST'],personal:['PERSONALINFORMATION','PERSONALDETAILS','PERSONALDATA','CONTACT','CONTACTINFORMATION','CONTACTDETAILS','ADDITIONALCONTACT'],ignore:['REFERENCES','INTERESTS','HOBBIES','HOBBIESANDINTERESTS','PERSONALINTERESTS','AWARDS','HONOURS','HONORS','HONORSANDAWARDS','HONOURSANDAWARDS','PUBLICATIONS','PAPERS','CERTIFICATES','CERTIFICATIONS','LICENSES','LICENSESCERTIFICATIONS','PROJECTS','ACHIEVEMENTS','COURSES','ADDITIONALINFORMATION','OBJECTIVESTATEMENT','DECLARATION','ANNEXES','PHOTOGRAPHS','PHOTO','PATENTS','MEMBERSHIPS','PROFESSIONALAFFILIATIONS','CONFERENCES','TALKS']};
export const CVI_SEC_MAP={};
Object.keys(CVI_SEC_COMPRESSED).forEach(k=>CVI_SEC_COMPRESSED[k].forEach(w=>{if(!CVI_SEC_MAP[w])CVI_SEC_MAP[w]=k;}));
export const CVI_LABEL_ALIAS={address:'location',location:'location',city:'location',basedin:'location',residence:'location',telephone:'phone',tel:'phone',phone:'phone',mobile:'phone',mob:'phone',cell:'phone',email:'email',mail:'email',linkedin:'linkedin',web:'web',website:'web',url:'web',site:'web',portfolio:'web',github:'web',gitlab:'web',behance:'web',dribbble:'web',homepage:'web'};
export const CVI_MON='(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';
export const CVI_DATE_PART=`(?:${CVI_MON}\\s*'?(?:19|20)\\d{2}|(?:0?[1-9]|1[0-2])\\/(?:19|20)?\\d{2}|(?:19|20)\\d{2})`;
export const CVI_RANGE_RE=new RegExp('('+CVI_DATE_PART+')\\s*(?:-|\\u2013|\\u2014|to|until|through)\\s*('+CVI_DATE_PART+'|present|current|now|today|ongoing)','i');
export const CVI_IS_BULLET=/^[▪•●◦·∙*o]\s+|^\d{1,2}[.)]\s+|^[-–]\s+/;
export const CVI_DEG_KW=/bachelor|master|ph\.?d|doctora|m\.?sc|b\.?sc|b\.?eng|b\.?tech|m\.?tech|\bba\b|\bma\b|\bmba\b|engineer(?:ing)?(?:'s|\u2019s)?\s+degree|diploma|associate(?:'s|\u2019s)?\s+degree|\bhnd\b|\bhnc\b|a[-\s]levels?|gcse|certificate|llb|llm|\bmd\b|high\s+school|secondary\s+school|lyc\u00e9e|gymnasi|honours|honors/i;
export const CVI_INST_KW=/universit|institut|college|school|academy|polytechnic|\u00e9cole|l'\u00e9cole|business\s+school|law\s+school|medical\s+school/i;

export function cviEsc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
export function cviNormalize(t){return String(t||'').replace(/\r\n?/g,'\n').replace(/[\u2028\u2029]/g,'\n').replace(/\u00ad\n?/g,'').replace(/\u00a0/g,' ').replace(/([a-z,;])-\n([a-z])/g,'$1$2');}
export function cviLines(t){return cviNormalize(t).split('\n').map(l=>l.replace(/\s+/g,' ').trim()).filter(l=>l&&!/^(?:page\s*)?\d{1,3}\s*(?:\/\s*\d{1,3}|of\s*\d{1,3})?$/i.test(l)&&!/\d[\d.,]*\s*\+?\s*(?:connections?|followers?|recommendations?)$/i.test(l));}

/* ── text extraction: TXT / DOCX / PDF (all client-side) ── */
export async function cviExtractText(file){
  const name=(file.name||'').toLowerCase();
  if(name.endsWith('.doc')&&!name.endsWith('.docx'))throw new Error('Legacy .doc files are not supported — please re-save as .docx or PDF first.');
  if(name.endsWith('.docx')||file.type==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'){
    const zip=await JSZip.loadAsync(await file.arrayBuffer());
    const docFile=zip.file('word/document.xml');
    if(!docFile)throw new Error('This .docx file has no readable document body.');
    const xml=await docFile.async('string');
    const text=xml.split(/<\/w:p>/).map(p=>{
      const s=p.replace(/<w:tab[^>]*\/>/g,'\t').replace(/<w:br[^>]*\/>/g,'\n');
      return [...s.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m=>m[1]).join('');
    }).join('\n');
    return {text:text.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#x?([0-9a-f]+);/gi,(m,c)=>{try{return String.fromCodePoint(parseInt(c,16))}catch(e){return m}}).replace(/&amp;/g,'&'),kind:'docx'};
  }
  if(name.endsWith('.pdf')||file.type==='application/pdf'){
    const ab=await file.arrayBuffer();
    const pdf=await pdfjsLib.getDocument({data:ab.slice(0)}).promise;
    const out=await cviPdfToLines(pdf);
    return {text:out.text,kind:'pdf',bytes:ab,lines:out.lines};
  }
  const t=await file.text();
  if(!name.endsWith('.txt')&&!name.endsWith('.md')&&/[\u0000-\u0008\u000e-\u001f]/.test(t.slice(0,2000)))throw new Error('Unsupported file type — use PDF, DOCX or a plain-text file.');
  return {text:t,kind:'txt'};
}
/* ── coordinate-aware PDF reader: y-sorted lines, x-sorted items, big horizontal gaps become "|" column separators ── */
export async function cviPdfToLines(pdf){
  const lines=[];let text='';
  for(let p=1;p<=pdf.numPages;p++){
    const page=await pdf.getPage(p);
    const tc=await page.getTextContent();
    const items=[];
    for(const it of tc.items){
      if(!('str'in it)||!it.str||!it.str.trim())continue;
      const tr=it.transform||[1,0,0,1,0,0];
      const fs=Math.abs(tr[3])||Math.abs(tr[0])||it.height||10;
      items.push({x:tr[4],y:tr[5],w:it.width||it.str.length*fs*0.5,s:it.str,fs});
    }
    if(!items.length)continue;
    items.sort((a,b)=>b.y-a.y||a.x-b.x);
    const rows=[];let row=null;
    for(const it of items){
      if(row&&Math.abs(it.y-row.y)<=Math.max(2.4,((it.fs||10)+(row.fs||10))*0.24))row.items.push(it);
      else{row={y:it.y,fs:it.fs||10,items:[it]};rows.push(row);}
    }
    for(const rw of rows){
      rw.items.sort((a,b)=>a.x-b.x);
      const segs=[];let cur=null;
      for(const it of rw.items){
        if(cur){
          const gap=it.x-(cur.x+cur.w);
          if(gap>Math.max(16,Math.max(cur.fs,it.fs)*1.7)){segs.push(cur);cur={x:it.x,w:it.w,fs:it.fs,t:it.s};}
          else{cur.w=Math.max(cur.w,it.x+it.w-cur.x);cur.fs=Math.max(cur.fs,it.fs);cur.t+=(gap>Math.max(0.8,cur.fs*0.15)?' ':'')+it.s;}
        }else cur={x:it.x,w:it.w,fs:it.fs,t:it.s};
      }
      if(cur)segs.push(cur);
      const clean=segs.map(sg=>String(sg.t).replace(/\s+/g,' ').trim()).filter(Boolean);
      if(!clean.length)continue;
      lines.push({page:p,y:rw.y,size:Math.max.apply(null,segs.map(sg=>sg.fs||10)),segs:clean});
      text+=clean.join(' | ')+'\n';
    }
    text+='\n';
  }
  return {text:text.trim(),lines};
}
export function cviBytesToBase64(ab){const u=new Uint8Array(ab);let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s);}

/* ── field heuristics ── */
export function cviUnspace(s){ /* "E D U C AT I O N" → "EDUCATION" */
  const t=String(s||'').trim();
  if(t.length<4)return t;
  const toks=t.split(/\s+/);
  if(toks.length<3)return t;
  const single=toks.filter(w=>w.length===1&&/[A-Za-z\u00c0-\u024f]/.test(w)).length;
  if(single<Math.max(3,toks.length*0.6))return t;
  const c=toks.join('').toUpperCase();
  return /^[A-Z&/.-]{3,}$/.test(c)?c:t;
}
export function cviHeaderType(line){
  let l=String(line).replace(/^[\s=*_~#>▪•●◦·∙|>-]+/,'').replace(/[\s=*_~:.\u2013\u2014-]+$/,'').trim();
  l=l.replace(/^(?:[ivxIVX]{1,4}|\d{1,2})\s*[.)]\s*/,'');
  if(!l||l.length>44)return null;
  for(const[k,re]of CVI_SEC_DEFS){if(re.test(l))return k;}
  for(const c of [cviUnspace(l),l.replace(/[\s&]+/g,'').toUpperCase()]){
    if(c&&c.length>=3&&c.length<=34&&Object.prototype.hasOwnProperty.call(CVI_SEC_MAP,c))return CVI_SEC_MAP[c];
  }
  return null;
}
export function cviLabels(L){ /* label/value pairs: "EMAIL | x@y.z", "Phone: 123…" */
  const out={};
  const set=(k,v)=>{if(v&&!out[k])out[k]=v;};
  for(let li=0;li<L.length;li++){
    const segs=L[li].segs;
    for(let i=0;i<segs.length;i++){
      const seg=segs[i];
      const m=seg.match(/^([A-Za-z][A-Za-z ]{1,16}?)\s*[:\u2192\u2013\u2014-]\s*(.{2,90})$/);
      if(m){
        const k=CVI_LABEL_ALIAS[m[1].toLowerCase().replace(/\s+/g,'')];
        if(k){set(k,m[2].replace(/\s+/g,' ').trim());continue;}
      }
      const u=cviUnspace(seg);
      const lab=u&&u===u.toUpperCase()?u.toLowerCase().replace(/[^a-z]/g,''):'';
      const k=lab?CVI_LABEL_ALIAS[lab]:null;
      if(k){
        let val=segs[i+1]||'';
        if(!val&&segs.length===1&&L[li+1])val=L[li+1].segs.join(' ');
        if(val)set(k,val.replace(/\s+/g,' ').trim());
      }
    }
  }
  if(out.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(out.email))delete out.email;
  if(out.phone){const d=String(out.phone).replace(/\D/g,'');if(d.length<8||d.length>15)delete out.phone;}
  if(out.linkedin&&!/linkedin/i.test(out.linkedin))delete out.linkedin;
  if(out.location&&(out.location.length>60||/@|http/i.test(out.location)))delete out.location;
  if(out.web&&!/^(https?:\/\/|www\.)/i.test(out.web))delete out.web;
  if(out.web&&/linkedin/i.test(out.web)){if(!out.linkedin)out.linkedin=out.web;delete out.web;}
  return out;
}
export function cviFindName(L){
  /* 1) biggest font in the top area of page 1 (PDFs with coordinates) */
  const sizes=L.map(l=>l.size).filter(v=>v>0).sort((a,b)=>a-b);
  const med=sizes.length?sizes[Math.floor(sizes.length/2)]:0;
  let best=null;
  for(let i=0;i<Math.min(L.length,30);i++){
    const ln=L[i];
    if(!ln.top)continue;
    const t=ln.segs.join(' ').replace(/\s+/g,' ').trim();
    if(!t||t.length>52)continue;
    const tu=cviUnspace(t);
    if(/curriculum|vitae|resume|^cv\b|@|http|linkedin|\d/i.test(t)||/curriculum|vitae|resume/i.test(tu))continue;
    if(cviHeaderType(t)||ln.segs.some(s=>cviHeaderType(s)))continue;
    const words=t.split(/\s+/);
    if(words.length<2||words.length>5)continue;
    if(!words.every(w=>/^[A-Z\u00c0-\u024f'’.\u2010-]/.test(w)))continue;
    if(!best||ln.size>best.size)best={name:t,idx:i,size:ln.size};
  }
  if(best&&(best.size>=14||(med&&best.size>=med*1.3)))return best;
  /* 2) plain-text heuristic: first name-like line */
  for(let i=0;i<Math.min(L.length,10);i++){
    let t=L[i].segs.join(' ').replace(CVI_IS_BULLET,'').replace(/^[|·—–\s]+/,'').trim();
    if(!t||t.length>48)continue;
    const tu=cviUnspace(t);
    if(/curriculum\s+vit|resume|^cv$|@|http|linkedin|\d/i.test(t)||/curriculum|vitae|resume/i.test(tu))continue;
    if(cviHeaderType(t)||L[i].segs.some(s=>cviHeaderType(s)))continue;
    const words=t.split(/\s+/);
    if(words.length<2||words.length>5)continue;
    const okTitle=words.every(w=>/^[A-Z\u00c0-\u024f'’.\u2010-]/.test(w));
    const okUpper=t===t.toUpperCase()&&/[A-Z]{3}/.test(t)&&words.length<=4;
    if(okTitle||okUpper){
      if(okUpper)t=words.map(w=>w.charAt(0)+w.slice(1).toLowerCase()).join(' ');
      return {name:t,idx:i,size:0};
    }
  }
  return {name:'',idx:-1,size:0};
}
export function cviFindTitle(L,nameIdx){
  const cands=[];
  const lim=Math.min(L.length,nameIdx>=0?nameIdx+4:12);
  for(let i=0;i<lim;i++){
    if(i===nameIdx)continue;
    const t=L[i].segs.join(' ').replace(/\s+/g,' ').trim();
    if(!t||t.length<4||t.length>95)continue;
    const tu=cviUnspace(t);
    if(/@|http|linkedin|\d{4}|curriculum|vitae|resume/i.test(t)||/curriculum|vitae|resume/i.test(tu))continue;
    if(cviHeaderType(t)||L[i].segs.some(s=>cviHeaderType(s)))continue;
    if(!CVI_ROLE_KW.test(t))continue;
    cands.push({i,t});
  }
  if(!cands.length)return '';
  cands.sort((a,b)=>Math.abs(a.i-(nameIdx+1))-Math.abs(b.i-(nameIdx+1)));
  return cands[0].t.slice(0,90);
}
export function cviFindPhone(text){
  const res=[/\(\+\d{1,3}\)[\s.-]?\d[\d\s().-]{5,13}\d/g,/\+\d{1,3}[\s.-]?\d[\d\s().-]{6,14}\d/g,/(?:\(\d{2,4}\)|\d{2,4})[\s.-]?\d[\d\s().-]{6,14}\d/g];
  for(const re of res){
    let m;
    while((m=re.exec(text))){
      const cand=(m[0]||'').trim().replace(/[\s.,;|-]+$/,'');
      const digits=cand.replace(/\D/g,'');
      if(digits.length<8||digits.length>15)continue;
      if(/(?:19|20)\d{2}\s*[-\u2013\u2014]\s*(?:19|20)\d{2}/.test(cand))continue;
      if(/doi\.org\/|zenodo\.|paper\s*id|manuscript\s*id|github\.com\/|gitlab\.com\//i.test(text.slice(Math.max(0,m.index-16),m.index)))continue;
      if(/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(cand))continue;
      if(!/^\+/.test(cand)&&/^\d{8,}$/.test(cand)&&!(cand.length>=10&&cand.length<=12&&/^0/.test(cand)))continue;
      if(/@/.test(text.slice(Math.max(0,m.index-1),m.index+1)))continue;
      return cand.replace(/\s+/g,' ').trim().slice(0,25);
    }
  }
  return '';
}
export function cviFindLocation(lines,nameIdx){
  const WORD='[A-Z][\\p{L}.\'\\u2019-]+';
  const PLACE=WORD+'(?:\\s'+WORD+'){0,2}';
  const re=new RegExp('^('+PLACE+'),\\s*([A-Z]{2}\\b|'+PLACE+')(?:,\\s*[A-Z]{2}\\b)?\\s*$','u');
  const preRe=new RegExp('^('+PLACE+'),\\s*([A-Z]{2}\\b|'+PLACE+')(?=\\s*[|\\u00b7])','u');
  const postRe=new RegExp('(?:^|\\s[|\\u00b7]\\s*)('+PLACE+'),\\s*([A-Z]{2}\\b|'+PLACE+')\\s*$','u');
  for(let i=0;i<Math.min(lines.length,14);i++){
    if(i===nameIdx)continue;
    const l=lines[i].replace(CVI_IS_BULLET,'').replace(/^[|\u00b7\u2014\u2013\s]+/,'').replace(/[\s|,;]+$/,'').trim();
    if(!l)continue;
    if(/@|http|linkedin/i.test(l)){ // composite contact line: "City, Country | email | phone"
      if(CVI_ROLE_KW.test(l))continue;
      const mp=l.match(preRe);
      if(mp)return mp[0].trim();
      const mq=l.match(postRe);
      if(mq)return (mq[1]+', '+mq[2]).trim();
      continue;
    }
    if(!re.test(l))continue;
    if(CVI_ROLE_KW.test(l))continue;
    return l;
  }
  return '';
}
export function cviTidyRange(s){return String(s).replace(/\s+/g,' ').replace(/\s*(?:-|to|until|through)\s*/gi,' \u2013 ').replace(/\s+/g,' ').trim().slice(0,40);}
export function cviSplitRoleCompany(s){
  s=String(s).replace(CVI_IS_BULLET,'').replace(/^[|·:\s]+/,'').replace(/[\s|·]+$/,'').trim();
  const m=s.match(/^(.{2,60}?)\s*(?:\bat\b|\||\b\u2014\b|\b\u2013\b|\band\s+at\b|,|\u00b7|:)\s*(.{2,60})$/i);
  if(m){
    let a=m[1].trim(),b=m[2].trim();
    const aR=CVI_ROLE_KW.test(a),bR=CVI_ROLE_KW.test(b),aC=CVI_CO_KW.test(a),bC=CVI_CO_KW.test(b);
    if(aR&&!bR)return{title:a,company:b};
    if(bR&&!aR)return{title:b,company:a};
    if(aC&&!bC)return{title:b,company:a};
    if(bC&&!aC)return{title:a,company:b};
    return{title:a,company:b};
  }
  return{title:s,company:''};
}
export function cviTidyCompany(c){
  return String(c).replace(/\s*[\u2013\u2014-]\s*[A-Z][\p{L}]+(?:,\s*[A-Z]{2}\b)?\s*$/u,'').trim().slice(0,80);
}

/* ── section parsers ── */
export function cviParseSummary(lines){
  const txt=lines.map(l=>l.segs.join(' ').replace(CVI_IS_BULLET,'').trim()).filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
  if(!txt)return '';
  return txt.length>1200?txt.slice(0,1197)+'\u2026':txt;
}
export function cviParseSkills(lines){
  const out=[],seen=new Set();
  const add=s=>{
    s=String(s).replace(CVI_IS_BULLET,'').trim();
    if(!s||s.length>45)return;
    if(s.split(/\s+/).length>6)return;
    if(/@|http|linkedin|\d{5,}/i.test(s))return;
    if(/^(?:a[12]|b[12]|c[12]|native|fluent|beginner|elementary|intermediate|advanced|proficient|professional)$/i.test(s))return;
    if(/^[a-z]$/i.test(s)&&!/^[crd]$/i.test(s))return;
    if(!/[a-zA-Z0-9\u00c0-\u024f]/.test(s))return;
    const k=s.toLowerCase();
    if(seen.has(k))return;
    seen.add(k);out.push(s);
  };
  for(const ln of lines){
    for(const seg of ln.segs){
      const m=seg.match(/^([^:]{2,32}):\s*(.+)$/);
      const src=m?m[2]:seg;
      src.split(/[,;\u2022\u00b7|]+/).forEach(add);
    }
  }
  return out.slice(0,40);
}
export function cviRoleLine(s){ /* "Front Desk Manager · Sylhet, Bangladesh" → {title:'Front Desk Manager'} */
  const parts=String(s).split(/\s*[·|•]\s*|\s+[\u2013\u2014]\s+|\s*,\s+/);
  let title='';const rest=[];
  for(const p of parts){
    const t=p.trim();if(!t)continue;
    if(!title&&CVI_ROLE_KW.test(t)&&t.split(/\s+/).length<=7&&t.length<=60)title=t;else rest.push(t);
  }
  return title?{title,rest}:null;
}
export function cviAnchorOf(ln,joined){ /* find a date/year segment → {dates, pre} */
  const segs=(ln&&ln.segs&&ln.segs.length)?ln.segs:(joined!=null?[joined]:[]);
  for(let i=0;i<segs.length;i++){
    const seg=segs[i];
    const rm=CVI_RANGE_RE.exec(seg);
    if(rm){
      const head=seg.slice(0,rm.index),others=segs.filter((_,j)=>j!==i).join(' ');
      const pre=[head,others].filter(x=>x&&x.trim()).join(' ').replace(/[,;(|\u00b7\u2013\u2014]\s*$/,'').trim();
      return {dates:cviTidyRange(rm[0]),pre};
    }
    if(/^((?:19|20)\d{2})(?:\s*[\u2013\u2014-]\s*((?:19|20)\d{2}|present|current|now|today))?\s*$/i.test(seg)){
      const others=segs.filter((_,j)=>j!==i).join(' ');
      return {dates:seg.replace(/\s+/g,' ').trim(),pre:others.replace(/[,;|\u00b7\u2013\u2014]\s*$/,'').trim()};
    }
    const ym=seg.match(/[,()\[]\s*((?:19|20)\d{2}(?:\s*[\u2013\u2014-]\s*(?:19|20)\d{2})?)\s*[)\]]?\s*$/);
    if(ym){
      const head=seg.slice(0,ym.index),others=segs.filter((_,j)=>j!==i).join(' ');
      const pre=[head,others].filter(x=>x&&x.trim()).join(' ').replace(/[,;(|\u00b7\u2013\u2014]\s*$/,'').trim();
      if(pre)return {dates:ym[1].replace(/\s+/g,' ').trim(),pre};
    }
  }
  /* v2.7: cross-segment fallback — column-split PDFs put "Jan 2020 –" and
     "Present" in different segments of the same visual row; match the joined line */
  const j=joined||segs.join(' ');
  if(segs.length>1&&j){
    const jm=CVI_RANGE_RE.exec(j);
    if(jm){
      const before=j.slice(0,jm.index),after=j.slice(jm.index+jm[0].length);
      const pre=[before,after].map(x=>x.replace(/^[\s|,;\u00b7]+/,'').replace(/[\s|,;\u00b7]+$/,'').trim()).filter(Boolean).join(' ');
      return {dates:cviTidyRange(jm[0]),pre};
    }
  }
  return null;
}
export function cviParseExperience(lines){
  const entries=[];let cur=null;let pending=[];let tail=[];
  const pushCur=()=>{if(cur&&(cur.title||cur.company||cur.description.length))entries.push(cur);cur=null;};
  for(const ln of lines){
    const joined=ln.segs.join(' ');
    const a=cviAnchorOf(ln,joined);
    if(a){
      pushCur();
      const fromTail=tail.length>0;
      const plCand=fromTail?tail[tail.length-1]:(pending[pending.length-1]||'');
      const pendingExtras=fromTail?[]:pending.slice(0,-1);
      /* role+company stacked right above the anchor both belong to the new entry.
         v2.7: a role line like "Junior Software Engineer" used to be rejected because
         "Software" is also a company keyword — accept it when the line ENDS on a
         role word ("Engineer"), which company lines ("TechCorp Solutions Ltd.") don't. */
      let extraRole='';
      if(tail.length>=2){
        const t2=tail[tail.length-2];
        const t2Last=String(t2).trim().split(/\s+/).pop().replace(/[.,]$/,'').toLowerCase();
        if(plCand&&(CVI_CO_KW.test(plCand)||CVI_INST_KW.test(plCand))&&CVI_ROLE_KW.test(t2)&&(!CVI_CO_KW.test(t2)||CVI_ROLE_KW.test(t2Last)))extraRole=t2;
      }
      const earlierTail=tail.length>1?tail.slice(0,extraRole?tail.length-2:tail.length-1):[];
      tail=[];pending=[];
      if(earlierTail.length&&entries.length)entries[entries.length-1].description.push(...earlierTail);
      const cands=[...pendingExtras];
      if(extraRole)cands.push(extraRole);
      if(plCand)cands.push(plCand);
      if(a.pre)cands.push(a.pre);
      cur={title:'',company:'',dates:a.dates,description:[]};
      if(cands.length===1){
        const c=cands[0];
        const r=cviSplitRoleCompany(c);
        if(r.company&&CVI_ROLE_KW.test(r.title)&&!CVI_ROLE_KW.test(r.company)){cur.title=r.title;cur.company=r.company;}
        else if(CVI_ROLE_KW.test(c)&&!CVI_CO_KW.test(c)&&!CVI_INST_KW.test(c))cur.title=c;
        else cur.company=c;
      }else if(cands.length>=2){
        const x=cands[cands.length-2],y=cands[cands.length-1];
        const xR=CVI_ROLE_KW.test(x),yR=CVI_ROLE_KW.test(y);
        const xC=CVI_CO_KW.test(x)||CVI_INST_KW.test(x),yC=CVI_CO_KW.test(y)||CVI_INST_KW.test(y);
        if(xR&&!yR){cur.title=x;cur.company=y;}
        else if(yR&&!xR){cur.title=y;cur.company=x;}
        else if(xR&&yR){ /* both role-ish: the later one may be "Role at Company" */
          const s=cviSplitRoleCompany(y);
          if(s.company&&CVI_ROLE_KW.test(s.title)&&!CVI_ROLE_KW.test(s.company)){cur.title=s.title;cur.company=s.company;}
          else{cur.title=x;cur.company=y;}
        }
        else if(xC&&!yC){cur.company=x;cur.title=y;}
        else if(yC&&!xC){cur.company=y;cur.title=x;}
        else{cur.title=x;cur.company=y;}
        if(cands.length>2)cur.description.push(...cands.slice(0,-2).filter(Boolean));
      }
      continue;
    }
    const clean=joined.replace(CVI_IS_BULLET,'').trim();
    if(!clean)continue;
    if(cur){
      if(!cur.title&&clean.length<=85&&!/[.;]$/.test(clean)){
        const rl=cviRoleLine(clean);
        if(rl){cur.title=rl.title;continue;}
      }
      /* short role/company-ish lines may belong to the NEXT entry (role-above-company layouts): hold them provisionally */
      if(!CVI_IS_BULLET.test(joined)&&clean.length<=70&&!/[.;:]$/.test(clean)&&(CVI_ROLE_KW.test(clean)||CVI_CO_KW.test(clean)||CVI_INST_KW.test(clean)||clean===clean.toUpperCase())){tail.push(clean);continue;}
      if(tail.length){cur.description.push(...tail);tail=[];}
      if(!cur.company&&!cur.description.length&&clean.length<=60&&(CVI_CO_KW.test(clean)||CVI_INST_KW.test(clean))){cur.company=clean;continue;}
      cur.description.push(clean);
      continue;
    }
    if(clean.length<=90&&!/@|http/.test(clean)&&(CVI_ROLE_KW.test(clean)||CVI_CO_KW.test(clean)||CVI_INST_KW.test(clean)||clean===clean.toUpperCase()))pending.push(clean);
  }
  if(cur){if(tail.length){cur.description.push(...tail);tail=[];}pushCur();}
  else if(tail.length&&entries.length)entries[entries.length-1].description.push(...tail);
  if(pending.length&&entries.length)entries[entries.length-1].description.push(...pending.map(x=>x.replace(CVI_IS_BULLET,'').trim()).filter(Boolean));
  if(!entries.length&&pending.length){ /* no dates at all (volunteering etc.): pair org-line + role-line */
    for(let i=0;i<pending.length;i++){
      const a=pending[i],b=pending[i+1];
      const ra=cviRoleLine(a),rb=b?cviRoleLine(b):null;
      if(ra&&rb){
        const aOrg=CVI_INST_KW.test(a)||CVI_CO_KW.test(a),bOrg=CVI_INST_KW.test(b)||CVI_CO_KW.test(b);
        if(aOrg&&!bOrg)entries.push({title:rb.title,company:a,dates:'',description:[]});
        else entries.push({title:ra.title,company:b,dates:'',description:[]});
        i++;
      }else if(!ra&&rb){entries.push({title:rb.title,company:a,dates:'',description:[]});i++;}
      else if(ra&&!rb)entries.push({title:ra.title,company:'',dates:'',description:[]});
      else entries.push({title:'',company:a,dates:'',description:[]});
    }
  }
  return entries.slice(0,12).map(e=>({title:(e.title||'').slice(0,80),company:cviTidyCompany(e.company||''),dates:(e.dates||'').slice(0,40),description:(e.description||[]).filter(Boolean).join('\n').slice(0,900)})).filter(e=>e.title||e.company||e.description);
}
export function cviEduParts(c){
  const s=String(c);
  const parts=s.split(/\s*,\s*/);
  if(parts.length<2)return [s];
  const i=parts.findIndex(p=>CVI_INST_KW.test(p));
  if(i<=0)return [s];
  return [parts.slice(0,i).join(', '),parts.slice(i).join(', ')];
}
export function cviParseEducation(lines){
  const entries=[];let cur=null;let pending=[];
  const pushCur=()=>{if(cur&&(cur.degree||cur.institution))entries.push(cur);cur=null;};
  for(const ln of lines){
    const joined=ln.segs.join(' ');
    const a=cviAnchorOf(ln,joined);
    if(a){
      pushCur();
      const pl=pending[pending.length-1]||'';
      const earlier=pending.slice(0,-1);
      pending=[];
      cur={degree:'',institution:'',year:a.dates.slice(0,20)};
      const cands=[];
      if(a.pre&&a.pre.length<=95)cands.push(a.pre);
      if(pl&&pl.length<=95)cands.push(pl);
      earlier.forEach(c=>{if(c.length<=95)cands.push(c);});
      for(const c of cands){
        for(const part of cviEduParts(c)){
          const p=part.trim();if(!p)continue;
          if(!cur.institution&&CVI_INST_KW.test(p)){cur.institution=p;continue;}
          if(!cur.degree&&(CVI_DEG_KW.test(p)||/\u00b7/.test(p))&&p.length<=95){cur.degree=p;continue;}
          if(!cur.degree&&p.length<=90&&!/@|http/.test(p)){cur.degree=p;continue;}
          if(!cur.institution&&p.length<=70&&!/@|http/.test(p)){cur.institution=p;continue;}
        }
      }
      continue;
    }
    const clean=joined.replace(CVI_IS_BULLET,'').trim();
    if(!clean)continue;
    if(cur){
      if(!cur.degree&&(CVI_DEG_KW.test(clean)||/\u00b7/.test(clean))&&clean.length<=95&&!/@|http/.test(clean)){cur.degree=clean;continue;}
      if(!cur.institution&&CVI_INST_KW.test(clean)&&clean.length<=90){cur.institution=clean;continue;}
      continue;
    }
    if(clean.length<=95&&(CVI_DEG_KW.test(clean)||CVI_INST_KW.test(clean)))pending.push(clean);
  }
  pushCur();
  if(!entries.length&&pending.length){ /* degrees without years */
    let pend=null;
    for(const c of pending){
      if(CVI_DEG_KW.test(c)&&!entries.some(e=>e.degree===c)){pend={degree:c,institution:'',year:''};entries.push(pend);}
      else if(pend&&CVI_INST_KW.test(c)){pend.institution=c;pend=null;}
    }
  }
  return entries.slice(0,8).map(e=>({degree:(e.degree||'').slice(0,90),institution:(e.institution||'').slice(0,90),year:(e.year||'').slice(0,20)})).filter(e=>e.degree||e.institution);
}
export function cviLevelFromText(t){
  const s=String(t==null?'':t).trim();
  if(CVI_LEVELS.includes(s))return s;
  const cefr=s.match(/\b([ABC][12])\b/);if(cefr)return cefr[1].toUpperCase();
  /* v2.7: LinkedIn's ILR-style proficiency labels mapped to CEFR */
  if(/native|mother\s*tongue|first\s*language|bilingual/i.test(s))return 'Native';
  if(/full\s*professional|fluent/i.test(s))return 'C2';
  if(/professional\s*working/i.test(s))return 'C1';
  if(/advanced|professional|proficient/i.test(s))return 'C1';
  if(/limited\s*working/i.test(s))return 'B1';
  if(/upper[\s-]?intermediate/i.test(s))return 'B2';
  if(/intermediate|conversational|communicat|oral/i.test(s))return 'B1';
  if(/basic|elementary/i.test(s))return 'A2';
  if(/beginner|learning|studying/i.test(s))return 'A1';
  return '';
}
export function cviLangName(s){
  const t=String(s||'').replace(/[\u00b7|,;:]+$/,'').trim();
  if(!t||t.length>34)return null;
  const m=t.match(/^([A-Za-z\u00c0-\u024f][A-Za-z\u00c0-\u024f' -]{0,24}?)\s*(?:\(\s*([^)]{1,28})\s*\)|[\u2013\u2014:]\s*(.{1,32}))?$/);
  if(!m)return null;
  const cand=(m[1]||'').trim();
  if(!cand)return null;
  const hit=CVI_LANG_NAMES.find(L=>L.toLowerCase()===cand.toLowerCase());
  return hit?{name:hit,rest:String(m[2]||m[3]||'').trim()}:null;
}
export function cviParseLanguages(lines){
  const found=new Map();
  const add=(name,src)=>{
    const k=name.toLowerCase();
    if(found.has(k))return;
    found.set(k,{language:name,level:cviLevelFromText(src||'')});
  };
  const expand=ln=>{ /* "German: Native, English: C2" → per-language cells */
    const cs=[];
    if(!ln)return cs;
    for(const seg of ln.segs){
      const parts=seg.split(/\s*,\s*/);
      if(parts.length>1&&parts.filter(p=>cviLangName(p)).length>=2){parts.forEach(p=>cs.push(p));continue;}
      cs.push(seg);
    }
    return cs;
  };
  for(let i=0;i<lines.length;i++){
    const cells=expand(lines[i]);
    const named=cells.map(s=>cviLangName(s));
    if(named.length&&named.every(Boolean)&&named.length>=2){
      const nxtCells=expand(lines[i+1]);
      if(nxtCells.length===named.length&&!nxtCells.every(s=>cviLangName(s))){
        named.forEach((n,j)=>add(n.name,nxtCells[j]));
        i++;
      }else{
        named.forEach(n=>add(n.name,n.rest));
      }
      continue;
    }
    const fi=named.findIndex(Boolean);
    if(fi>=0&&named.filter(Boolean).length===1){
      const n=named[fi];
      const others=cells.filter((_,j)=>j!==fi).join(' ');
      let lvl=n.rest||others||'';
      const nxtCells=lines[i+1]?expand(lines[i+1]):[];
      if(!lvl&&nxtCells.length&&!nxtCells.some(s=>cviLangName(s))&&nxtCells.join(' ').length<=64){lvl=nxtCells.join(' ');i++;}
      add(n.name,lvl);
    }
  }
  return [...found.values()].slice(0,8);
}

/* ── main entry: parse raw CV text (plus optional structured PDF lines) into the app's data model ── */
/* Volunteering: structurally simpler than jobs — org / role (+ optional
   description), sometimes with a date anchor. A dedicated parser keeps the
   generic experience heuristics out of the way. */
export function cviParseVolunteering(lines){
  const out=[];let cur=null;
  const push=()=>{if(cur&&(cur.organization||cur.role))out.push(cur);cur=null;};
  for(const ln of lines){
    const segs=(ln.segs||[]).map(x=>String(x).trim()).filter(Boolean);
    const full=segs.join(' ');
    if(!full)continue;
    const a=cviAnchorOf(ln,full);
    if(a){push();cur={organization:a.pre?cviTidyCompany(a.pre):'',role:'',description:[]};continue;}
    const r=cviRoleLine(full);
    if(r){
      if(!cur)cur={organization:'',role:r.title,description:[]};
      else if(!cur.role)cur.role=r.title;
      else{push();cur={organization:'',role:r.title,description:[]};}
      continue;
    }
    if(!cur||cur.role){push();cur={organization:cviTidyCompany(full),role:'',description:[]};continue;} /* next org line */
    if(full.length>60){cur.description.push(full);continue;} /* long line under an org-only entry = description */
    push();cur={organization:cviTidyCompany(full),role:'',description:[]};
  }
  push();
  return out.map(v=>({organization:(v.organization||'').slice(0,90),role:(v.role||'').slice(0,90),description:(v.description||[]).filter(Boolean).join('\n').slice(0,400)})).filter(v=>v.organization||v.role);
}
/* Publications: entries are a title (often wrapped) with a trailing date
   segment, followed by venue / status / DOI lines. Wrapped titles only join
   while the head is long and the next line is long, non-link, non-status and
   doesn't look like a journal/venue name. */
export function cviParsePublications(lines){
  const DATE_SEG=/^(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?(?:19|20)\d{2}$/i;
  const LINK_SEG=/^(?:doi:?[\s:]+)?(?:https?:\/\/|www\.)\S+$/i;
  const STATUS_RE=/\b(accepted|under\s*(?:first|second|1st|2nd|third)?\s*review|revision|submitted|preprint|in\s+press|published|forthcoming)\b/i;
  const VENUE_RE=/(ieee|acm|elsevier|springer|nature|science|transactions|journal|proceedings|conference|letters|paper\s*id|manuscript\s*id|\bvol\.?\s*\d|university\s+press)/i;
  const splitDate=seg=>{const m=String(seg).match(/^(.{25,}?)\s+((?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?(?:19|20)\d{2})$/i);return m?{t:m[1].trim(),d:m[2].trim()}:null;};
  const norm=m=>/^www\./i.test(m)?'https://'+m:m;
  const entries=[];let cur=null;
  const push=()=>{if(cur&&(cur.title||cur.meta.length))entries.push(cur);cur=null;};
  for(const ln of lines){
    const segs=(ln.segs||[]).map(x=>String(x).trim()).filter(Boolean);
    const full=segs.join(' ');
    if(!full)continue;
    /* a seg that ends in an inline date splits into title-part + date */
    let dateSeg='',parts=[];
    for(const seg of segs){
      const sp=splitDate(seg);
      if(sp&&!dateSeg){parts.push(sp.t);dateSeg=sp.d;}
      else if(DATE_SEG.test(seg)&&!dateSeg)dateSeg=seg;
      else parts.push(seg);
    }
    const head=(parts[0]||'').trim();
    if(dateSeg&&head&&head.length>=18&&!LINK_SEG.test(head)){
      push();
      cur={title:head,dates:dateSeg,meta:parts.slice(1)};
      continue;
    }
    if(DATE_SEG.test(full)&&cur&&!cur.dates){cur.dates=full;continue;}
    if(cur&&cur.hasLink&&!LINK_SEG.test(full)){push();cur={title:full,dates:'',meta:[]};continue;} /* DOI closes an entry */
    if(!cur){cur={title:full,dates:'',meta:[]};continue;}
    if(LINK_SEG.test(full))cur.hasLink=true;
    cur.meta.push(full);
  }
  push();
  return entries.map(e=>{
    let title=e.title;const meta=[...e.meta];
    let joins=0;
    while(meta.length&&joins<2&&title.length>=60&&meta[0].length>=45&&!LINK_SEG.test(meta[0])&&!STATUS_RE.test(meta[0])&&!VENUE_RE.test(meta[0])&&!DATE_SEG.test(meta[0])){
      title+=' '+meta.shift();joins++;
    }
    const links=meta.filter(m=>LINK_SEG.test(m)).map(m=>norm(m.replace(/^doi:?[\s:]+/i,'')));
    const link=links[0]||'';
    let status=meta.find(m=>STATUS_RE.test(m)&&!LINK_SEG.test(m))||'';
    const venue=meta.find(m=>!LINK_SEG.test(m)&&!STATUS_RE.test(m)&&m!==status)||'';
    const extras=links.slice(1);
    if(extras.length)status=(status?status+' · ':'')+'earlier version: '+extras.join('; ');
    return{title:title.slice(0,300),venue:venue.slice(0,120),status:status.slice(0,200),dates:e.dates||'',link};
  }).filter(p=>p.title);
}
/* Projects: name, optional description lines, closed by a URL line. */
export function cviParseProjects(lines){
  const LINK=/^(?:https?:\/\/|www\.)/i;
  const out=[];let cur=null;
  const push=()=>{if(cur&&cur.name)out.push(cur);cur=null;};
  for(const ln of lines){
    const full=(ln.segs||[]).join(' ').trim();
    if(!full)continue;
    if(LINK.test(full)){
      if(!cur)cur={name:'',meta:[]};
      cur.link=/^https?:\/\//i.test(full)?full:'https://'+full;
      push();continue;
    }
    if(!cur){cur={name:full,meta:[]};continue;}
    cur.meta.push(full);
  }
  push();
  return out.map(x=>({name:x.name.slice(0,90),description:x.meta.join(' ').slice(0,240),link:x.link||''})).filter(x=>x.name);
}
export function parseCVText(rawText,SL){
  const text=cviNormalize(rawText||'');
  let L;
  if(SL&&SL.length){
    const p1=SL.filter(l=>l.page===1);
    const ys=p1.map(l=>l.y);
    const ymax=ys.length?Math.max.apply(null,ys):0,ymin=ys.length?Math.min.apply(null,ys):0;
    const topCut=ymax-(ymax-ymin)*0.20;
    L=SL.map(l=>({segs:(l.segs||[]).map(cviUnspace).filter(Boolean),size:l.size||0,top:l.page===1&&l.y>=topCut}));
  }else{
    L=cviLines(text).map(t=>({segs:[t],size:0,top:false}));
  }
  L=L.filter(l=>l.segs.length);
  const secs={preamble:[]};let cur='preamble';
  for(const ln of L){
    const rest=[];
    for(const seg of ln.segs){
      const h=cviHeaderType(seg);
      if(h){cur=h;if(!secs[cur])secs[cur]=[];continue;}
      rest.push(seg);
    }
    if(rest.length){if(!secs[cur])secs[cur]=[];secs[cur].push({segs:rest,size:ln.size,top:ln.top});}
  }
  const hasSections=Object.keys(secs).some(k=>k!=='preamble'&&k!=='personal'&&k!=='ignore'&&secs[k].length);
  const labels=cviLabels(L);
  const emailM=text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  const liM=text.match(/(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9._%-]{2,60}/i);
  const {name,idx:nameIdx}=cviFindName(L);
  const secLines=k=>secs[k]||[];
  let experiences=cviParseExperience(secLines('experience'));
  const volunteering=cviParseVolunteering(secLines('volunteering'));
  const publications=cviParsePublications(secLines('publications'));
  const projects=cviParseProjects(secLines('projects'));
  const interests=secLines('interests').map(l=>l.segs.join(' ')).join(', ').replace(/\s*,\s*/g,', ').replace(/,\s*$/,'').slice(0,300);
  let education=cviParseEducation(secLines('education'));
  let languages=cviParseLanguages(secLines('languages'));
  if(!languages.length){const lm=text.match(/languages?\s*[:\u2013\u2014]\s*([^\n]+)/i);if(lm)languages=cviParseLanguages([{segs:[lm[1]],size:0}]);}
  if(!hasSections){
    if(!experiences.length&&(text.match(/\b(?:19|20)\d{2}\b/g)||[]).length>=2)experiences=cviParseExperience(L);
    if(!education.length)education=cviParseEducation(L);
  }
  const p={
    name,nameIdx,
    title:cviFindTitle(L,nameIdx),
    email:labels.email||(emailM?emailM[0]:''),
    phone:labels.phone||cviFindPhone(text),
    linkedin:labels.linkedin||(liM?('https://'+liM[0].replace(/^https?:\/\//i,'')):''),
    location:labels.location||cviFindLocation(L.map(l=>l.segs.join(' ')),nameIdx),
    summary:cviParseSummary(secLines('summary')),
    skillsArr:cviParseSkills(secLines('skills')),
    experiences:experiences.slice(0,12),education,languages,publications,projects,volunteering,interests
  };
  /* v2.7: heading-less CVs often open with an unlabelled pitch paragraph —
     take the preamble prose that sits BEFORE the first date anchor as summary */
  if(!p.summary&&secs.preamble&&secs.preamble.length){
    const preAll=secs.preamble;
    const cutAt=preAll.findIndex(ln=>CVI_RANGE_RE.test(ln.segs.join(' '))||/^((?:19|20)\d{2})\s*$/i.test(ln.segs.join(' ').trim()));
    const preBlock=(cutAt>=0?preAll.slice(0,cutAt):preAll);
    const drop=s=>!s||s===p.name||s===p.title||s===p.location||/^(?:curriculum\s+vitae|resume|cv)$/i.test(s)||/@|http|linkedin/i.test(s)||!!cviFindPhone(s);
    const txt=preBlock.map(ln=>ln.segs.join(' ').replace(CVI_IS_BULLET,'').trim()).filter(s=>s&&!drop(s)).join(' ');
    if(txt.length>=150)p.summary=txt.length>1200?txt.slice(0,1197)+'\u2026':txt;
  }
  p.skills=p.skillsArr.join(', ');
  return {...p,...cviScore(p)};
}
export function cviScore(p){
  let s=0;const notes=[];
  if(p.name)s+=15;
  if(p.email)s+=12;
  if(p.phone)s+=8;
  if(p.linkedin)s+=5;
  if(p.location)s+=4;
  if(p.title)s+=8;
  if(p.summary&&p.summary.length>=80)s+=8;else if(p.summary)s+=3;
  if(p.skillsArr.length>=3)s+=(p.skillsArr.length>=8?14:10);
  if(p.experiences.length>=1)s+=(p.experiences.length>=2?20:15);
  if(p.experiences.length&&p.experiences.every(e=>e.dates))s+=5;
  if(p.education.length>=1)s+=8;
  if(p.languages.length>=1)s+=2;
  if((p.publications||[]).length>=1)s+=3;
  if((p.projects||[]).length>=1)s+=2;
  if(!p.experiences.length)notes.push('no work experience detected');
  if(!p.education.length)notes.push('no education detected');
  if(!p.skillsArr.length)notes.push('no skills detected');
  if(!p.summary)notes.push('no summary detected');
  const score=Math.min(100,Math.round(s));
  return {score,level:score>=75?'high':score>=50?'medium':'low',notes};
}

export const CVI_SCHEMA={
  type:'OBJECT',
  properties:{
    name:{type:'STRING',description:'Full name of the CV owner'},
    title:{type:'STRING',description:'Current or most recent professional role'},
    email:{type:'STRING'},phone:{type:'STRING'},
    linkedin:{type:'STRING',description:'LinkedIn profile URL or handle'},
    location:{type:'STRING',description:'City / country of residence'},
    summary:{type:'STRING',description:'Professional summary or profile paragraph'},
    skills:{type:'ARRAY',items:{type:'STRING'},description:'Flat list of individual skills and tools'},
    experiences:{type:'ARRAY',items:{type:'OBJECT',properties:{title:{type:'STRING'},company:{type:'STRING'},dates:{type:'STRING'},description:{type:'STRING',description:'Achievements, bullet lines joined with \\n'}},required:['title','company','dates','description']}},
    education:{type:'ARRAY',items:{type:'OBJECT',properties:{degree:{type:'STRING'},institution:{type:'STRING'},year:{type:'STRING'}},required:['degree','institution','year']}},
    languages:{type:'ARRAY',items:{type:'OBJECT',properties:{language:{type:'STRING'},level:{type:'STRING',description:'One of: Native, A1, A2, B1, B2, C1, C2 — empty string if not stated'}},required:['language','level']}},
    publications:{type:'ARRAY',description:'Published papers, articles, preprints — empty array if none',items:{type:'OBJECT',properties:{title:{type:'STRING'},venue:{type:'STRING',description:'Journal / conference, incl. paper or manuscript ID'},status:{type:'STRING',description:'e.g. Accepted, Under review, Submitted, Preprint'},dates:{type:'STRING'},link:{type:'STRING',description:'DOI or URL, empty string if none'}},required:['title','venue','status','dates','link']}},
    projects:{type:'ARRAY',description:'Personal / open-source projects — empty array if none',items:{type:'OBJECT',properties:{name:{type:'STRING'},description:{type:'STRING'},link:{type:'STRING'}},required:['name','description','link']}},
    volunteering:{type:'ARRAY',description:'Volunteer roles — empty array if none',items:{type:'OBJECT',properties:{organization:{type:'STRING'},role:{type:'STRING'},description:{type:'STRING'}},required:['organization','role','description']}},
    interests:{type:'STRING',description:'Comma-separated personal interests/hobbies, empty string if none'}
  },
  required:['name','title','email','phone','linkedin','location','summary','skills','experiences','education','languages']
};
export function cviAiPrompt(){
  return ['You are a precise CV/resume parsing engine. Extract structured data from the CV provided.',
  'Rules:',
  '- Use ONLY information present in the CV. Never invent, guess or embellish. Missing data = empty string or empty array.',
  '- Keep the original wording (light whitespace cleanup only).',
  '- "dates": copy date ranges exactly as written, e.g. "Jan 2020 - Present" or "2018 - 2021".',
  '- "description": join the role\u2019s achievement bullets with newline characters, without leading bullet symbols.',
  '- "skills": flat list of individual skills/tools, no categories and no proficiency words.',
  '- "level": map language proficiency to "", "Native", "A1", "A2", "B1", "B2", "C1", "C2" (fluent/bilingual=C2, advanced/professional=C1, upper-intermediate=B2, intermediate/conversational=B1, basic/elementary=A2, beginner=A1).',
  '- "title": the current or most recent professional role.',
  '- The CV may arrive twice: as the original PDF and as pre-extracted text where "|" separates side-by-side columns of the layout — reconcile them and prefer the richer reading.',
  '- "publications": papers with their venue (incl. paper ID), status and DOI link; empty array if the CV has none.',
  '- "projects": named projects with a one-line description and link; empty array if none.',
  '- "volunteering": organization + role (+ what it involved); empty array if none.',
  '- "interests": the interests/hobbies line as a comma-separated string; empty string if none.',
  '- Output valid JSON matching the schema exactly.'].join('\n');
}
export function cviMapAi(d){
  const cl=(v,n)=>String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n);
  const p={
    name:cl(d.name,60),title:cl(d.title,80),email:cl(d.email,100),phone:cl(d.phone,25),
    linkedin:cl(d.linkedin,120),location:cl(d.location,60),
    summary:cl(d.summary,1500),
    skillsArr:(Array.isArray(d.skills)?d.skills:[]).map(s=>cl(s,45)).filter(Boolean).slice(0,40),
    experiences:(Array.isArray(d.experiences)?d.experiences:[]).map(e=>({title:cl(e.title,80),company:cl(e.company,80),dates:cl(e.dates,40),description:String(e.description==null?'':e.description).split('\n').map(x=>x.replace(/^[\s\u2022\u25aa\u25cf\u25e6\u00b7*\u2023\u2043-]+/,'').trim()).filter(Boolean).join('\n').slice(0,900)})).filter(e=>e.title||e.company).slice(0,12),
    education:(Array.isArray(d.education)?d.education:[]).map(e=>({degree:cl(e.degree,90),institution:cl(e.institution,90),year:cl(e.year,20)})).filter(e=>e.degree||e.institution).slice(0,8),
    languages:(Array.isArray(d.languages)?d.languages:[]).map(e=>({language:cl(e.language,40),level:cviLevelFromText(e.level)})).filter(e=>e.language).slice(0,8),
    publications:(Array.isArray(d.publications)?d.publications:[]).map(e=>({title:cl(e.title,300),venue:cl(e.venue,120),status:cl(e.status,200),dates:cl(e.dates,40),link:cl(e.link,200)})).filter(e=>e.title).slice(0,12),
    projects:(Array.isArray(d.projects)?d.projects:[]).map(e=>({name:cl(e.name,90),description:cl(e.description,240),link:cl(e.link,200)})).filter(e=>e.name).slice(0,10),
    volunteering:(Array.isArray(d.volunteering)?d.volunteering:[]).map(e=>({organization:cl(e.organization,90),role:cl(e.role,90),description:cl(e.description,400)})).filter(e=>e.organization||e.role).slice(0,8),
    interests:cl(d.interests,300)
  };
  p.skills=p.skillsArr.join(', ');
  return {...p,...cviScore(p)};
}
export function cviMergeResults(base,ai){
  const m={...ai};
  ['name','title','email','phone','linkedin','location','summary'].forEach(k=>{if(!m[k]&&base[k])m[k]=base[k];});
  if(!m.skillsArr.length&&base.skillsArr)m.skillsArr=base.skillsArr;
  ['experiences','education','languages','publications','projects','volunteering'].forEach(k=>{if(!(m[k]||[]).length&&base[k]&&base[k].length)m[k]=base[k];});
  if(!m.interests&&base.interests)m.interests=base.interests;
  m.skills=m.skillsArr.join(', ');
  return {...m,...cviScore(m)};
}

/* ── import UI wiring ── */
export let cvImportData=null;
export let cvImportSource=null;
export function openCvImport(){document.getElementById('cvImportModal').style.display='flex';cvImportReset();}
export function closeCvImport(){uiAnimateClose('cvImportModal');}
export function cvImportReset(){
  cvImportData=null;cvImportSource=null;
  document.getElementById('cvImportStep1').style.display='block';
  document.getElementById('cvImportStep2').style.display='none';
  cviHide('cvImportError');cviHide('cvImportStatus');cviHide('cvAiStatus');
  document.getElementById('cvImportFile').value='';
}
export function cvImportStartOver(){cvImportReset();showToast('Ready for another CV');}
export function cviShow(id,msg){const el=document.getElementById(id);if(el){el.style.display=msg?'block':'none';if(msg!==undefined)el.textContent=msg;}}
export function cviHide(id){const el=document.getElementById(id);if(el)el.style.display='none';}
export function toggleCvPaste(){const w=document.getElementById('cvImportPasteWrap');const open=w.style.display==='none';w.style.display=open?'block':'none';if(open)document.getElementById('cvImportPaste').focus();}
export function cviShowError(msg){cviHide('cvImportStatus');cviShow('cvImportError',msg);}
export async function cvImportHandleFiles(files){
  const f=files&&files[0];
  if(!f)return;
  cviHide('cvImportError');
  cviShow('cvImportStatus','Reading "'+f.name+'"…');
  try{
    const ex=await cviExtractText(f);
    cvImportSource={kind:ex.kind,fileName:f.name,text:ex.text,pdfBytes:ex.bytes||null,lines:ex.lines||null};
    await cvImportRunParser(ex.text,f.name,ex.lines||null);
  }catch(err){
    cviShowError((err&&err.message)||'Could not read this file.');
  }
}
export function cvImportParsePasted(){
  const t=document.getElementById('cvImportPaste').value;
  if(t.trim().length<40){cviShowError('Paste the full text of your CV first (at least a few lines).');return;}
  cvImportSource={kind:'txt',fileName:'pasted text',text:t,pdfBytes:null};
  cvImportRunParser(t,'pasted text');
}
export async function cvImportRunParser(text,fileName,SL){
  cviHide('cvImportError');
  cviShow('cvImportStatus','Parsing…');
  await new Promise(r=>setTimeout(r,30));
  const p=parseCVText(text,SL);
  const stripped=(text||'').replace(/\s/g,'').length;
  if(stripped<300)p.notes.unshift('almost no text found — this may be a scanned PDF');
  cvImportData={...p,source:'parser',include:{
    basics:!!(p.name||p.title||p.email||p.phone||p.linkedin||p.location),
    summary:!!p.summary,
    skills:p.skillsArr.length>0,
    experience:p.experiences.length>0,
    education:p.education.length>0,
    languages:p.languages.length>0,
    publications:(p.publications||[]).length>0,
    projects:(p.projects||[]).length>0,
    volunteering:(p.volunteering||[]).length>0,
    interests:!!(p.interests||'').trim()
  }};
  cviHide('cvImportStatus');
  renderCvImportReview(fileName);
}
export function cviGroup(key,label,count,inner){
  const d=cvImportData;
  return '<div class="cvi-group"><label class="cvi-g-head"><input type="checkbox" '+(d.include[key]?'checked':'')+' onchange="cvImportData.include[\''+key+'\']=this.checked"><strong>'+label+'</strong><span class="cvi-count">'+(count?count+(count===1?' item':' items'):'nothing found')+'</span><span class="cvi-badge'+(d.source==='ai'?' ai':'')+'">'+(d.source==='ai'?'Gemini AI':'Parser')+'</span></label><div class="cvi-g-body">'+inner+'</div></div>';
}
export function renderCvImportReview(fileName){
  const d=cvImportData,E=cviEsc;
  document.getElementById('cvImportStep1').style.display='none';
  const s2=document.getElementById('cvImportStep2');
  s2.style.display='block';
  const conf=document.getElementById('cvImportConfidence');
  conf.className='cvi-conf '+d.level;
  let h='<strong>'+(d.level==='high'?'High-confidence parse':'Confidence: '+d.level)+' \u2014 '+d.score+'/100.</strong> '+(d.level==='high'?'Review below, untick anything you don\u2019t want, then import.':'Check the fields below, or let Gemini AI re-extract them.');
  if(d.notes.length)h+='<div class="cvi-notes">Heads-up: '+E(d.notes.join(' \u00b7 '))+'.</div>';
  conf.innerHTML=h;
  const G=[];
  const basicRows=[['Name',d.name],['Job title',d.title],['Email',d.email],['Phone',d.phone],['LinkedIn',d.linkedin],['Location',d.location]].filter(r=>r[1]);
  G.push(cviGroup('basics','Personal details',basicRows.length,basicRows.length?basicRows.map(r=>'<div class="cvi-row"><span class="k">'+r[0]+'</span><span class="v">'+E(r[1])+'</span></div>').join(''):'<p>Nothing detected</p>'));
  G.push(cviGroup('summary','Summary',d.summary?1:0,d.summary?'<p>'+E(d.summary.slice(0,320))+(d.summary.length>320?'\u2026':'')+'</p>':'<p>Nothing detected</p>'));
  G.push(cviGroup('skills','Skills',d.skillsArr.length,d.skillsArr.length?'<div class="cvi-chips">'+d.skillsArr.slice(0,18).map(s=>'<span class="cvi-chip">'+E(s)+'</span>').join('')+(d.skillsArr.length>18?'<span class="cvi-chip">+'+(d.skillsArr.length-18)+' more</span>':'')+'</div>':'<p>Nothing detected</p>'));
  G.push(cviGroup('experience','Work experience',d.experiences.length,d.experiences.length?d.experiences.map(e=>'<div class="cvi-item"><div><strong>'+E(e.title||'\u2014')+'</strong>'+(e.company?' \u2014 '+E(e.company):'')+' <span class="cvi-dates">'+E(e.dates)+'</span></div>'+(e.description?'<p>'+E(e.description.split('\n')[0].slice(0,120))+'</p>':'')+'</div>').join(''):'<p>Nothing detected</p>'));
  G.push(cviGroup('education','Education',d.education.length,d.education.length?d.education.map(e=>'<div class="cvi-item"><div><strong>'+E(e.degree||'\u2014')+'</strong>'+(e.institution?' \u2014 '+E(e.institution):'')+' <span class="cvi-dates">'+E(e.year)+'</span></div></div>').join(''):'<p>Nothing detected</p>'));
  G.push(cviGroup('languages','Languages',d.languages.length,d.languages.length?'<div class="cvi-chips">'+d.languages.map(l=>'<span class="cvi-chip">'+E(l.language)+(l.level?' ('+E(l.level)+')':'')+'</span>').join('')+'</div>':'<p>Nothing detected</p>'));
  const pubs=d.publications||[];
  G.push(cviGroup('publications','Publications',pubs.length,pubs.length?pubs.slice(0,6).map(p=>'<div class="cvi-item"><div><strong>'+E(p.title.slice(0,90))+(p.title.length>90?'…':'')+'</strong> <span class="cvi-dates">'+E(p.dates)+'</span></div>'+(p.venue||p.status?'<p>'+E([p.venue,p.status].filter(Boolean).join(' · ').slice(0,110))+'</p>':'')+'</div>').join('')+(pubs.length>6?'<p>+'+(pubs.length-6)+' more</p>':''):'<p>Nothing detected</p>'));
  const prjs=d.projects||[];
  G.push(cviGroup('projects','Projects',prjs.length,prjs.length?prjs.slice(0,6).map(p=>'<div class="cvi-item"><div><strong>'+E(p.name)+'</strong></div>'+(p.description?'<p>'+E(p.description.slice(0,110))+'</p>':'')+'</div>').join(''):'<p>Nothing detected</p>'));
  const vols=d.volunteering||[];
  G.push(cviGroup('volunteering','Volunteering',vols.length,vols.length?vols.slice(0,6).map(v=>'<div class="cvi-item"><div><strong>'+E(v.organization||v.role)+'</strong>'+(v.organization&&v.role?' — '+E(v.role):'')+'</div></div>').join(''):'<p>Nothing detected</p>'));
  const ints=d.interests||'';
  G.push(cviGroup('interests','Interests',ints.trim()?1:0,ints.trim()?'<p>'+E(ints.slice(0,220))+'</p>':'<p>Nothing detected</p>'));
  document.getElementById('cvImportReview').innerHTML=G.join('');
  document.getElementById('cvAiKey').value=cviGetKey();
  document.getElementById('cvAiModel').value=cviGetModel();
  s2.scrollTop=0;
}
export async function runGeminiExtraction(){
  const key=(document.getElementById('cvAiKey').value||'').trim();
  if(!key){cviAiStatus('Paste a Gemini API key first — get a free one at aistudio.google.com/apikey.',true);return;}
  const modelIn=(document.getElementById('cvAiModel').value||'').trim();
  cviSetKey(key);
  const text=(cvImportSource&&cvImportSource.text)||document.getElementById('cvImportPaste').value||'';
  if(!text.trim()&&!(cvImportSource&&cvImportSource.pdfBytes)){cviAiStatus('Upload or paste a CV first.',true);return;}
  const btn=document.getElementById('cvAiRunBtn');
  btn.disabled=true;
  cviAiStatus('Asking Gemini…');
  try{
    const parts=[{text:cviAiPrompt()}];
    const bytes=cvImportSource&&cvImportSource.pdfBytes;
    if(cvImportSource&&cvImportSource.kind==='pdf'&&bytes&&bytes.byteLength<=15*1024*1024){
      parts.push({inline_data:{mime_type:'application/pdf',data:cviBytesToBase64(bytes)}});
    }
    if(text.trim())parts.push({text:'CV TEXT (pre-extracted; "|" separates side-by-side columns from the PDF layout):\n'+text.slice(0,90000)});
    const {data,model}=await cviCallGemini(key,modelIn||null,parts,m=>cviAiStatus(m),{schema:CVI_SCHEMA});
    let p=cviMapAi(data);
    if(cvImportData)p=cviMergeResults(cvImportData,p);
    const prevInc=cvImportData?cvImportData.include:null;
    const has={basics:!!(p.name||p.title||p.email||p.phone||p.linkedin||p.location),summary:!!p.summary,skills:p.skillsArr.length>0,experience:p.experiences.length>0,education:p.education.length>0,languages:p.languages.length>0,publications:(p.publications||[]).length>0,projects:(p.projects||[]).length>0,volunteering:(p.volunteering||[]).length>0,interests:!!(p.interests||'').trim()};
    const inc={};
    Object.keys(has).forEach(k=>{inc[k]=prevInc?(prevInc[k]||has[k]):has[k];});
    cvImportData={...p,source:'ai',include:inc};
    renderCvImportReview(cvImportSource?cvImportSource.fileName:'pasted text');
    if(!modelIn||modelIn===CVI_GEMINI_DEFAULT){document.getElementById('cvAiModel').value=model;cviSetModel(model);}
    cviAiStatus('AI extraction complete via '+model+' ('+p.score+'/100). Review and import below.');
  }catch(err){
    cviAiStatus((err&&err.message)||'AI extraction failed.',true);
  }finally{
    btn.disabled=false;
  }
}
export function cviAiStatus(msg,isErr){
  const el=document.getElementById('cvAiStatus');
  el.style.display='block';
  el.className='cvi-ai-status'+(isErr?' err':'');
  el.textContent=msg;
}
export function applyCvImport(){
  if(!cvImportData)return;
  const d=cvImportData,inc=d.include||{};
  const hasExisting=(document.getElementById('fullName').value.trim()||document.getElementById('summary').value.trim()||getExperiences().length||getEducation().length);
  if(hasExisting&&!window.confirm('Importing will replace the corresponding sections of your current CV. Continue?'))return;
  pushUndo();
  try{
    if(inc.basics){
      if(d.name)document.getElementById('fullName').value=d.name;
      if(d.title)document.getElementById('title').value=d.title;
      if(d.email)document.getElementById('email').value=d.email;
      if(d.phone)document.getElementById('phone').value=d.phone;
      if(d.linkedin)document.getElementById('linkedin').value=d.linkedin;
      if(d.location)document.getElementById('location').value=d.location;
    }
    if(inc.summary&&d.summary)document.getElementById('summary').value=d.summary;
    if(inc.skills&&d.skillsArr&&d.skillsArr.length)document.getElementById('skills').value=d.skillsArr.join(', ');
    if(inc.experience&&d.experiences&&d.experiences.length){
      document.getElementById('experienceList').innerHTML='';
      d.experiences.forEach(e=>{addExpSilent();const is=document.querySelectorAll('#experienceList .dynamic-item');const l=is[is.length-1];if(l){l.querySelectorAll('input')[0].value=e.title||'';l.querySelectorAll('input')[1].value=e.company||'';l.querySelectorAll('input')[2].value=e.dates||'';l.querySelector('textarea').value=e.description||'';}});
    }
    if(inc.education&&d.education&&d.education.length){
      document.getElementById('educationList').innerHTML='';
      d.education.forEach(e=>{addEduSilent();const is=document.querySelectorAll('#educationList .dynamic-item');const l=is[is.length-1];if(l){l.querySelectorAll('input')[0].value=e.degree||'';l.querySelectorAll('input')[1].value=e.institution||'';l.querySelectorAll('input')[2].value=e.year||'';}});
    }
    if(inc.languages&&d.languages&&d.languages.length){
      document.getElementById('languageList').innerHTML='';
      d.languages.forEach(e=>{addLangSilent();const is=document.querySelectorAll('#languageList .dynamic-item');const l=is[is.length-1];if(l){l.querySelector('input').value=e.language||'';l.querySelector('select').value=e.level||'';}});
    }
    if(inc.publications&&d.publications&&d.publications.length){
      document.getElementById('publicationList').innerHTML='';
      d.publications.forEach(e=>{addPubSilent();const is=document.querySelectorAll('#publicationList .dynamic-item');const l=is[is.length-1];if(l){l.querySelectorAll('input')[0].value=e.title||'';l.querySelectorAll('input')[1].value=e.venue||'';l.querySelectorAll('input')[2].value=e.dates||'';l.querySelectorAll('input')[3].value=e.status||'';l.querySelectorAll('input')[4].value=e.link||'';}});
    }
    if(inc.projects&&d.projects&&d.projects.length){
      document.getElementById('projectList').innerHTML='';
      d.projects.forEach(e=>{addProjSilent();const is=document.querySelectorAll('#projectList .dynamic-item');const l=is[is.length-1];if(l){l.querySelectorAll('input')[0].value=e.name||'';l.querySelectorAll('input')[1].value=e.description||'';l.querySelectorAll('input')[2].value=e.link||'';}});
    }
    if(inc.volunteering&&d.volunteering&&d.volunteering.length){
      document.getElementById('volunteeringList').innerHTML='';
      d.volunteering.forEach(e=>{addVolSilent();const is=document.querySelectorAll('#volunteeringList .dynamic-item');const l=is[is.length-1];if(l){l.querySelectorAll('input')[0].value=e.organization||'';l.querySelectorAll('input')[1].value=e.role||'';l.querySelector('textarea').value=e.description||'';}});
    }
    if(inc.interests&&d.interests)document.getElementById('interests').value=d.interests;
    if(document.getElementById('experienceList')&&!document.querySelector('#experienceList .dynamic-item'))addExpSilent();
    if(document.getElementById('educationList')&&!document.querySelector('#educationList .dynamic-item'))addEduSilent();
    if(document.getElementById('languageList')&&!document.querySelector('#languageList .dynamic-item'))addLangSilent();
  }catch(e){console.warn('Import partially applied:',e);}
  try{updatePreview();_updatePreviewNow();initDragDrop();persistState();}catch(e){console.warn(e);}
  closeCvImport();
  showToast('CV imported \u2014 review each section');
  switchTab('edit',null);
  if(window.innerWidth<=900)mobileNav('edit');
}
const cviDz=document.getElementById('cvImportDropZone');
if(cviDz){
  cviDz.addEventListener('dragover',e=>{e.preventDefault();cviDz.style.borderColor='var(--text-secondary)';});
  cviDz.addEventListener('dragleave',e=>{e.preventDefault();cviDz.style.borderColor='';});
  cviDz.addEventListener('drop',e=>{
    e.preventDefault();e.stopPropagation();cviDz.style.borderColor='';
    const f=e.dataTransfer.files&&e.dataTransfer.files[0];
    if(!f)return;
    if(!/\.(pdf|docx|txt|md)$/i.test(f.name||'')){cviShowError('Please drop a PDF, DOCX or plain-text file.');return;}
    const dt=new DataTransfer();dt.items.add(f);
    document.getElementById('cvImportFile').files=dt.files;
    cvImportHandleFiles(dt.files);
  });
}

