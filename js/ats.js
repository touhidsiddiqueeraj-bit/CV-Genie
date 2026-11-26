/* ATS engine v2: 7-category local analysis, role dictionary, job-description
 * matching, custom keyword chips, plain-text view and the Gemini AI coach. */

import { photoData } from './app-state.js';
import { getEducation, getExperiences, getLanguages, getProjects, getPublications, getVolunteering } from './cvdata.js';
import { cviCallGemini, cviGetKey, cviGetModel, cviSetKey } from './gemini.js';
import { updatePreview } from './render.js';
import { showToast, uiAnimateClose } from './ui.js';

/* ============ JOB DESCRIPTION MATCHER ============ */
export const JD_STOP=new Set(('a,an,the,and,or,but,if,then,else,for,to,of,in,on,at,by,with,from,as,is,are,was,were,be,been,being,have,has,had,do,does,did,will,would,shall,should,can,could,may,might,must,about,across,after,all,also,any,both,each,either,every,few,more,most,other,some,such,no,nor,not,only,own,same,so,than,too,very,you,your,yours,we,our,ours,they,their,them,he,she,his,her,it,its,i,me,my,this,that,these,those,what,which,who,whom,when,where,why,how,all,any,both,each,few,more,most,other,some,such,s, t, just, don, now, up, out, off, over, under, again, further, once, here, there, during, before, after, above, below, between, into, through, while,because,until,against,role,position,job,work,working,works,team,teams,company,companies,organisation,organization,ability,able,experience,experiences,year,years,including,include,includes,included,strong,excellent,good,great,plus,etc,via,per,within,without,apply,applicant,applicants,candidate,candidates,seeking,looking,join,joining,offer,offering,opportunity,opportunities,environment,culture,benefits,salary,package,location,based,remote,hybrid,onsite,full,part,time,contract,permanent,required,require,requires,requirement,requirements,preferred,desirable,responsibilities,responsible,duties,tasks,ideal,perfect,successful,new,well,using,use,used,tools,tool,systems,system,support,supported,supporting,help,helps,helping,ensure,ensuring,ensures,across,around,role').split(',').map(w=>w.trim()).filter(Boolean));
export function extractJDTerms(text){
    const norm=text.toLowerCase().replace(/[\u2018\u2019]/g,"'").replace(/[\u2013\u2014]/g,'-');
    /* protect technical tokens like c++, c#, node.js, ci/cd before splitting */
    const tokens=norm.match(/[a-z0-9][a-z0-9+#./-]*[a-z0-9+#]|[a-z0-9]/g)||[];
    const kept=tokens.filter(t=>t.length>1&&!JD_STOP.has(t)&&!/^\d+$/.test(t));
    /* v2.7: merge singular/plural so "dashboard" and "dashboards" count as one
       term — counts keyed on a light stem, display keeps the most common form */
    const stem=t=>t.length>3&&!/(?:ss|us|is)$/.test(t)&&/s$/.test(t)?t.slice(0,-1):t;
    const counts={};const forms={};
    kept.forEach(t=>{const k=stem(t);counts[k]=(counts[k]||0)+1;(forms[k]=forms[k]||{})[t]=(forms[k][t]||0)+1;});
    const disp=k=>{let best=k,n=0;for(const f in forms[k]){if(forms[k][f]>n){n=forms[k][f];best=f;}}return best;};
    /* 2- and 3-word phrases from consecutive kept tokens */
    const phrases={};
    for(let n=2;n<=3;n++){
        for(let i=0;i+n<=kept.length;i++){
            const ph=kept.slice(i,i+n).join(' ');
            if(norm.includes(ph)){phrases[ph]=(phrases[ph]||0)+1;}
        }
    }
    /* score: phrases get a big boost (they're specific) and frequency matters */
    const scored=[];
    Object.entries(phrases).forEach(([ph,c])=>{if(c>=2)scored.push({term:ph,score:c*(2+ph.split(' ').length)});});
    /* v2.7: rescue single-occurrence phrases that contain a known technical
       token — a JD lists "Kubernetes cluster" or "Power BI" exactly once but it
       is still a hard requirement */
    const TECH=new Set('js,ts,sql,nosql,aws,gcp,azure,k8s,react,vue,angular,node,nodejs,python,java,kotlin,swift,docker,kubernetes,terraform,ansible,jenkins,figma,salesforce,sap,excel,tableau,powerbi,seo,sem,crm,erp,etl,api,rest,graphql,css,html,php,laravel,django,flask,rails,scala,rust,golang,cpp,csharp,devops,saas,jira,confluence,notion,slack,hubspot,pandas,numpy,spark,hadoop,kafka,ml'.split(','));
    Object.entries(phrases).forEach(([ph,c])=>{
        if(c>=2)return;
        const ws=ph.split(' ');
        if(ws.some(w=>TECH.has(w)||TECH.has(stem(w))))scored.push({term:ph,score:2+ws.length});
    });
    /* a stem is covered when an already-picked term contains it (plural-aware) */
    const covered=w=>scored.some(s=>s.term.split(' ').map(stem).includes(w));
    Object.entries(counts).forEach(([w,c])=>{if(c>=2&&!covered(w))scored.push({term:disp(w),score:c});});
    /* keep single words that are part of no kept phrase, appearing >=3 times, as extras */
    Object.entries(counts).forEach(([w,c])=>{if(c>=3&&!covered(w))scored.push({term:disp(w),score:c*0.5});});
    scored.sort((a,b)=>b.score-a.score);
    /* drop terms that are substrings of an already-picked higher term */
    const picked=[];
    for(const s of scored){if(!picked.some(p=>p.term.includes(s.term)||s.term.includes(p.term)))picked.push(s);if(picked.length>=24)break;}
    return picked.map(p=>p.term);
}
export function runJDMatch(){runATSAnalysis();} /* the v2 engine renders #jdResults as part of the full analysis */
export function addJDMissing(jsonStr){
    try{const arr=JSON.parse(jsonStr);arr.forEach(k=>{if(!customKWList.includes(k))customKWList.push(k);});renderCustomKWChips();runATSAnalysis();showToast(arr.length+' keywords added');}catch(e){}
}

/* ============ ATS PLAIN-TEXT VIEW ============ */
export function buildAtsPlainText(){
    const name=document.getElementById('fullName')?.value||'Your Name',title=document.getElementById('title')?.value||'';
    const email=document.getElementById('email')?.value||'',phone=document.getElementById('phone')?.value||'',li=document.getElementById('linkedin')?.value||'',loc=document.getElementById('location')?.value||'';
    const summary=document.getElementById('summary')?.value||'',skills=document.getElementById('skills')?.value||'';
    const exp=getExperiences(),edu=getEducation(),langs=getLanguages();
    const pubs=getPublications(),projs=getProjects(),vols=getVolunteering();
    const interests=document.getElementById('interests')?.value||'';
    let t=`${name}\n${title}\n${[email,phone,li,loc].filter(Boolean).join('\n')}\n\n`;
    if(summary.trim())t+=`SUMMARY\n${summary.trim()}\n\n`;
    if(skills.trim())t+=`SKILLS\n${skills.split(',').map(s=>s.trim()).filter(Boolean).join(', ')}\n\n`;
    if(exp.length){t+=`EXPERIENCE\n`;exp.forEach(x=>{t+=`${x.title} - ${x.company} - ${x.dates}\n`;if(x.description)t+=x.description.split('\n').filter(Boolean).map(d=>'* '+d.trim()).join('\n')+'\n';t+='\n';});}
    if(edu.length){t+=`EDUCATION\n`;edu.forEach(x=>{t+=`${x.degree} - ${x.institution} - ${x.year}\n`;});t+='\n';}
    if(pubs.length){t+=`PUBLICATIONS\n`;pubs.forEach(x=>{t+=`${x.title||''}${x.dates?' - '+x.dates:''}\n`;if(x.venue)t+='  '+x.venue+'\n';if(x.status)t+='  '+x.status+'\n';if(x.link)t+='  '+x.link+'\n';t+='\n';});}
    if(projs.length){t+=`PROJECTS\n`;projs.forEach(x=>{t+=`${x.name||''}${x.description?' - '+x.description:''}\n`;if(x.link)t+='  '+x.link+'\n';});t+='\n';}
    if(vols.length){t+=`VOLUNTEERING\n`;vols.forEach(x=>{t+=`${x.organization||''}${x.role?' - '+x.role:''}\n`;if(x.description)t+=x.description.split('\n').filter(Boolean).map(d=>'* '+d.trim()).join('\n')+'\n';});t+='\n';}
    if(edu.length){t+=`EDUCATION\n`;edu.forEach(x=>{t+=`${x.degree} - ${x.institution} - ${x.year}\n`;});t+='\n';}
    if(langs.length){t+=`LANGUAGES\n`;langs.forEach(l=>{t+=`${l.language} - ${l.level||'not specified'}\n`;});}
    if(interests.trim())t+=`\nINTERESTS\n${interests.trim()}\n`;
    return t;
}
export function openAtsTextView(){
    const txt=buildAtsPlainText();
    const emailOk=/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(txt);
    const phoneOk=/(\+?\d[\d\s().-]{7,}\d)/.test(txt);
    const words=txt.split(/\s+/).filter(Boolean).length;
    const dates=(txt.match(/\b(19|20)\d{2}\b/g)||[]).length;
    const sections=['SUMMARY','SKILLS','EXPERIENCE','EDUCATION','LANGUAGES'].filter(s=>txt.includes(s+'\n'));
    const checks=[
        {label:'Email found',pass:emailOk},
        {label:'Phone found',pass:phoneOk},
        {label:words>=200&&words<=1000?`Word count ${words} (in range)`:`Word count ${words} (aim 200–1000)`,pass:words>=200&&words<=1000},
        {label:`Sections detected: ${sections.length}`,pass:sections.length>=3},
        {label:`Date references: ${dates}`,pass:dates>=2},
        {label:photoData?'Photo: present (fine for humans, some parsers prefer none)':'Photo: none (safest for parsing)',pass:true},
    ];
    document.getElementById('atsTextChecks').innerHTML=checks.map(c=>`<div class="ats-chk-tile ${c.pass?'pass':'fail'}"><span>${c.label}</span><span class="dot"></span></div>`).join('');
    document.getElementById('atsTextPre').textContent=txt;
    document.getElementById('atsTextModal').style.display='flex';
}
export function closeAtsTextView(){uiAnimateClose('atsTextModal');}
export function copyAtsText(){navigator.clipboard.writeText(buildAtsPlainText()).then(()=>showToast('Copied'));}

/* ── Custom keyword chips ── */
export let customKWList=[];
export function renderCustomKWChips(){
  const c=document.getElementById('customKeywordChips');
  if(!c)return;
  c.innerHTML=customKWList.map((k,i)=>`<span class="kw-chip kw-custom" style="cursor:default">${k}<button onclick="removeCustomKW(${i})" style="background:none;border:none;color:inherit;cursor:pointer;font-size:12px;padding:0 0 0 2px;line-height:1;opacity:0.7;">×</button></span>`).join('');
}
export function addCustomKeyword(){
  const inp=document.getElementById('customKeywordInput');
  if(!inp)return;
  const val=inp.value.trim().toLowerCase();
  if(!val)return;
  val.split(',').map(k=>k.trim()).filter(k=>k.length>1&&!customKWList.includes(k)).forEach(k=>customKWList.push(k));
  inp.value='';
  renderCustomKWChips();
  runATSAnalysis();
}
export function removeCustomKW(i){
  customKWList.splice(i,1);
  renderCustomKWChips();
  runATSAnalysis();
}
export function addKWFromCloud(kw){
  const k=kw.trim().toLowerCase();
  if(k&&!customKWList.includes(k)){
    customKWList.push(k);
    renderCustomKWChips();
    const skillsEl=document.getElementById('skills');
    if(skillsEl){
      const cur=skillsEl.value.trim();
      skillsEl.value=cur?cur+', '+k:k;
      updatePreview();
    }
    runATSAnalysis();
  }
}
export function handleKWKey(e){if(e.key==='Enter'||e.key===','){e.preventDefault();addCustomKeyword();}}

export function getAllText(){
  const parts=[
    document.getElementById('fullName')?.value||'',
    document.getElementById('title')?.value||'',
    document.getElementById('summary')?.value||'',
    document.getElementById('skills')?.value||'',
    ...getExperiences().map(e=>[e.title,e.company,e.description].join(' ')),
    ...getEducation().map(e=>[e.degree,e.institution].join(' ')),
    ...getLanguages().map(l=>l.language+' '+l.level),
    ...getPublications().map(p=>[p.title,p.venue,p.status].join(' ')),
    ...getProjects().map(p=>[p.name,p.description].join(' ')),
    ...getVolunteering().map(v=>[v.organization,v.role,v.description].join(' ')),
    document.getElementById('interests')?.value||''
  ];
  return parts.join(' ').toLowerCase();
}

export function runATSAnalysis(){atsRunV2();}
/* Role keyword dictionary — used by the ATS engine when no job description is pasted */
export const ROLE_KW={
    /* Tech */
    'software engineer':    ['javascript','python','react','node.js','aws','agile','git','api','database','testing','docker','typescript','sql','rest','ci/cd'],
    'frontend developer':   ['javascript','react','css','html','typescript','webpack','responsive design','accessibility','vue','angular','performance'],
    'backend developer':    ['python','java','node.js','sql','api','microservices','docker','kubernetes','database','rest','graphql','authentication'],
    'fullstack developer':  ['javascript','react','node.js','sql','api','docker','git','typescript','html','css','database','cloud'],
    'engineer':             ['problem solving','technical design','debugging','testing','documentation','collaboration','systems design','version control'],
    'developer':            ['javascript','python','git','api','database','testing','agile','documentation','code review'],
    'devops':               ['docker','kubernetes','ci/cd','terraform','aws','linux','monitoring','ansible','jenkins','cloud','automation'],
    'data scientist':       ['machine learning','python','sql','tensorflow','statistics','nlp','deep learning','pandas','data analysis','scikit-learn'],
    'data analyst':         ['sql','excel','tableau','power bi','python','data visualisation','reporting','analytics','statistics'],
    'data engineer':        ['sql','python','spark','etl','data pipeline','cloud','aws','bigquery','airflow','kafka'],
    'machine learning':     ['python','tensorflow','pytorch','scikit-learn','deep learning','nlp','statistics','model deployment','neural networks'],
    'cybersecurity':        ['network security','penetration testing','siem','firewalls','incident response','compliance','vulnerability','encryption','iso 27001'],
    'cloud engineer':       ['aws','azure','gcp','terraform','kubernetes','docker','cloud','networking','security','devops'],
    'mobile developer':     ['ios','android','swift','kotlin','react native','flutter','mobile','api','ui/ux','app store'],
    'qa engineer':          ['testing','automation','selenium','cypress','jest','bug tracking','test cases','agile','regression','quality assurance'],
    'systems administrator':['linux','windows server','active directory','networking','powershell','bash','monitoring','security','backup','virtualisation'],
    'network engineer':     ['cisco','routing','switching','firewalls','tcp/ip','vpn','network security','lan/wan','troubleshooting','bgp'],
    /* Product & Design */
    'product manager':      ['roadmap','stakeholder','agile','scrum','user stories','kpi','strategy','analytics','mvp','prioritisation','go-to-market'],
    'product owner':        ['backlog','user stories','scrum','stakeholder','sprint','acceptance criteria','roadmap','agile','prioritisation'],
    'ux designer':          ['figma','user research','wireframing','prototyping','usability testing','information architecture','design system','accessibility'],
    'ui designer':          ['figma','adobe xd','visual design','typography','colour theory','design system','prototype','css','responsive design'],
    'designer':             ['figma','adobe','ui/ux','wireframe','prototype','user research','typography','design system','creative'],
    'graphic designer':     ['illustrator','photoshop','indesign','typography','branding','print','digital design','colour theory'],
    /* Business */
    'project manager':      ['pmp','agile','stakeholder management','risk management','budgeting','resource planning','delivery','reporting','change management'],
    'business analyst':     ['requirements gathering','process mapping','stakeholder','user stories','gap analysis','sql','documentation','agile'],
    'consultant':           ['analysis','strategy','stakeholder','deliverables','project management','presentation','problem solving','client management'],
    'manager':              ['leadership','stakeholder management','budgeting','kpi','strategy','team management','performance review','coaching'],
    'director':             ['strategy','p&l','leadership','board reporting','change management','stakeholder','budgeting'],
    'operations manager':   ['process improvement','lean','six sigma','kpi','supply chain','budgeting','vendor management','workflow'],
    'strategy':             ['strategic planning','market analysis','competitive intelligence','financial modelling','consulting','stakeholder'],
    'change manager':       ['change management','stakeholder engagement','communications','training','adoption','impact assessment','project management'],
    /* Sales & Marketing */
    'sales':                ['crm','revenue','pipeline','negotiation','prospecting','quota','salesforce','client relations','b2b','account management'],
    'account manager':      ['client relations','crm','upselling','retention','salesforce','negotiation','revenue','account growth'],
    'marketing manager':    ['seo','content strategy','social media','google analytics','email marketing','ppc','brand','campaigns','roi','hubspot'],
    'digital marketing':    ['seo','sem','google ads','social media','analytics','email marketing','content marketing','conversion rate','ab testing'],
    'content':              ['copywriting','seo','content strategy','editorial','social media','brand voice','analytics','wordpress'],
    'social media':         ['instagram','linkedin','tiktok','content calendar','engagement','analytics','brand voice','community management'],
    'pr':                   ['media relations','press releases','crisis communications','brand','stakeholder','events','copywriting'],
    'seo':                  ['seo','keyword research','google analytics','search console','on-page optimisation','link building','technical seo','content strategy'],
    'ecommerce':            ['shopify','woocommerce','conversion rate','google shopping','email marketing','merchandising','analytics','a/b testing'],
    /* Finance */
    'accountant':           ['financial reporting','tax','audit','excel','quickbooks','reconciliation','budgeting','forecasting','ifrs','gaap'],
    'finance':              ['financial modelling','excel','forecasting','budgeting','variance analysis','financial reporting','p&l'],
    'financial analyst':    ['financial modelling','excel','valuation','forecasting','sql','tableau','variance analysis','bloomberg'],
    'auditor':              ['audit','risk assessment','ifrs','gaap','compliance','internal controls','sox','reporting'],
    'tax':                  ['tax compliance','corporation tax','vat','tax planning','excel','financial reporting','transfer pricing'],
    'investment banker':    ['financial modelling','valuation','m&a','due diligence','pitchbook','excel','bloomberg','deal execution'],
    /* HR & People */
    'hr':                   ['recruitment','onboarding','performance management','hris','employee relations','talent acquisition','compliance','learning & development'],
    'recruiter':            ['talent acquisition','sourcing','linkedin recruiter','interviewing','applicant tracking','employer branding','negotiation'],
    'people operations':    ['culture','engagement','wellbeing','hris','talent management','performance','diversity & inclusion','coaching'],
    'learning development': ['training','e-learning','instructional design','lms','needs analysis','facilitation','curriculum design'],
    /* Healthcare */
    'nurse':                ['patient care','clinical assessment','medication administration','triage','documentation','hipaa','ehr','safeguarding','iv therapy'],
    'doctor':               ['diagnosis','patient care','clinical','medical records','treatment','evidence-based','hipaa','clinical governance'],
    'pharmacist':           ['dispensing','medication review','clinical pharmacology','patient counselling','drug interactions','formulary','compliance'],
    'physiotherapist':      ['patient assessment','rehabilitation','exercise therapy','manual therapy','discharge planning','clinical reasoning'],
    'paramedic':            ['emergency care','triage','clinical assessment','patient safety','documentation','medications','teamwork'],
    'dentist':              ['patient care','dental procedures','clinical assessment','radiography','treatment planning','patient communication'],
    /* Education */
    'teacher':              ['curriculum design','lesson planning','classroom management','student assessment','differentiation','safeguarding','sen','behaviour management'],
    'educator':             ['curriculum design','lesson planning','classroom management','student assessment','differentiation','safeguarding','sen'],
    'lecturer':             ['curriculum development','research','academic writing','student support','assessment','module design','higher education'],
    'teaching assistant':   ['sen','classroom support','differentiation','safeguarding','behaviour management','literacy','numeracy','pastoral'],
    /* Legal */
    'lawyer':               ['legal research','contract drafting','litigation','client management','due diligence','negotiation','legal writing','compliance'],
    'solicitor':            ['legal research','contract drafting','litigation','client management','due diligence','negotiation','compliance'],
    'paralegal':            ['legal research','drafting','case management','client contact','billing','document review','compliance'],
    /* Engineering (non-software) */
    'mechanical engineer':  ['cad','solidworks','autocad','fea','manufacturing','product design','stress analysis','materials'],
    'civil engineer':       ['autocad','revit','structural analysis','project management','bim','site supervision','drainage','highways'],
    'electrical engineer':  ['autocad','plc','circuit design','power systems','testing','commissioning','cad','project management'],
    'construction':         ['project management','site management','health & safety','cad','budgeting','contracts','subcontractors','bim'],
    /* Creative */
    'architect':            ['autocad','revit','bim','planning','project management','design','technical drawing','sustainable design'],
    'journalist':           ['writing','editing','research','interviewing','seo','social media','deadlines','fact-checking'],
    'writer':               ['copywriting','editing','research','seo','storytelling','brand voice','wordpress','content strategy'],
    'photographer':         ['adobe lightroom','photoshop','studio lighting','client management','composition','colour grading','retouching'],
    'videographer':         ['premiere pro','after effects','cinematography','colour grading','client management','storytelling','final cut'],
    /* Hospitality & Retail */
    'chef':                 ['menu development','food safety','haccp','kitchen management','inventory','cost control','team leadership','allergen awareness'],
    'retail':               ['customer service','stock management','visual merchandising','kpi','sales','pos','team leadership','inventory'],
    'hospitality':          ['customer service','event management','reservations','team leadership','upselling','health & safety','stock control'],
    'barista':              ['customer service','coffee preparation','food safety','upselling','cash handling','teamwork','product knowledge'],
    /* Logistics & Supply Chain */
    'logistics':            ['supply chain','warehouse management','inventory','erp','transport planning','vendor management','kpi','lean'],
    'supply chain':         ['procurement','supplier management','inventory','demand planning','erp','cost reduction','logistics','lean'],
    'warehouse':            ['inventory management','health & safety','stock control','forklift','wms','kpi','picking & packing','lean'],
    /* Default */
    'default':              ['leadership','communication','teamwork','problem solving','project management','analytical','strategic','collaboration','attention to detail']
  };
/* ============ ATS ENGINE v2 ============
   Deterministic, local-first scoring in the spirit of commercial ATS scanners:
   7 weighted categories (contact, summary, experience, skills, education,
   impact & wording, keywords / job match) built from ~25 individual checks,
   each with a concrete fix. An optional Gemini AI layer (user's own key)
   adds human-style review, rewrites and keyword suggestions. */
export const ATS_VERBS=new Set('accelerated,achieved,acquired,adapted,addressed,administered,advanced,advised,advocated,analysed,analyzed,architected,assembled,assessed,audited,authored,automated,balanced,built,captured,centralised,chaired,championed,clarified,coached,collaborated,compiled,completed,composed,conceived,condensed,conducted,consolidated,constructed,consulted,converted,convinced,coordinated,created,cultivated,debugged,decreased,defined,delegated,delivered,demonstrated,deployed,designed,developed,devised,diagnosed,directed,documented,doubled,drafted,drove,earned,edited,educated,eliminated,enabled,encouraged,engineered,enhanced,enlisted,established,evaluated,examined,exceeded,executed,expanded,expedited,facilitated,fashioned,finalised,finalized,founded,fulfilled,furnished,gathered,generated,grew,guarded,guided,handled,headed,identified,illustrated,implemented,improved,increased,influenced,initiated,innovated,inspected,installed,instituted,instructed,integrated,introduced,invented,investigated,launched,led,leveraged,maintained,managed,marketed,maximised,maximized,measured,mediated,mentored,merged,minimised,minimized,mobilised,mobilized,moderated,modernised,modernized,monitored,motivated,negotiated,optimised,optimized,organised,organized,overhauled,oversaw,partnered,performed,pioneered,pivoted,planned,prepared,presented,prioritised,prioritized,produced,programmed,promoted,proposed,prototyped,provided,published,purchased,quadrupled,raised,rebuilt,recruited,redesigned,reduced,reengineered,refined,reorganised,reorganized,repaired,replaced,researched,resolved,restructured,revamped,reviewed,revised,revitalised,revitalized,saved,scaled,scheduled,secured,selected,served,shaped,shipped,simplified,solved,sourced,spurred,standardised,standardized,started,streamlined,strengthened,structured,submitted,supervised,supplied,supported,surpassed,surveyed,sustained,synthesised,synthesized,tested,trained,transformed,translated,trimmed,tripled,uncovered,undertook,unified,updated,upgraded,validated,verified,visualised,visualized,won,wrote'.split(','));
export const ATS_WEAK=/\b(?:responsible for|duties included|tasked with|in charge of|helped (?:with|to)|assisted (?:with|in)|worked on|involved in|participated in|familiar with|exposure to)\b/gi;
export const ATS_BUZZ=/\b(?:go-?getter|team player|hard[- ]working|hard worker|thinks? outside the box|thinking outside the box|detail[- ]oriented|results[- ]driven|self[- ]starter|rock ?star|ninja|guru|synergy|hit the ground running|wearing many hats|fast[- ]paced environment)\b/gi;
export const ATS_FIRST_PERSON=/\b(?:i|me|my|mine)\b|\bi['\u2019](?:m|ve|d|ll)\b/i;
export let atsLastReport=null;
export function atsEsc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
export function atsVal(id){return (document.getElementById(id)?.value||'').trim();}
export function atsWordCount(t){return String(t||'').split(/\s+/).filter(Boolean).length;}
export function atsCollectCv(){return{name:atsVal('fullName'),title:atsVal('title'),email:atsVal('email'),phone:atsVal('phone'),linkedin:atsVal('linkedin'),location:atsVal('location'),summary:atsVal('summary'),skills:atsVal('skills').split(',').map(s=>s.trim()).filter(Boolean),experiences:getExperiences(),education:getEducation(),languages:getLanguages(),targetRole:atsVal('targetRole'),jd:atsVal('jdText'),customKW:[...customKWList]};}
export function atsHasContent(cv){return (cv.name+' '+cv.title+' '+cv.summary+' '+cv.skills.join(' ')+cv.experiences.map(e=>e.title+' '+e.company+' '+e.description).join(' ')).trim().length>10;}
export function atsBullets(cv){const out=[];cv.experiences.forEach((e,ei)=>{String(e.description||'').split('\n').forEach(raw=>{const b=raw.trim();if(b)out.push({ei,text:b});});});return out;}
export function atsStripYears(s){return String(s||'').replace(/\b(19|20)\d{2}\b/g,' ').replace(/\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b/g,' ');}
export function atsHasMetric(s){return /(\d+\s*%|\$\s*\d|€\s*\d|£\s*\d|\b\d+\b)/i.test(atsStripYears(s));}
export function atsStartsWithVerb(b){const w=b.toLowerCase().replace(/[^a-z].*$/,'');return ATS_VERBS.has(w);}
export const ATS_CHECKS=[
  /* — Contact — */
  {cat:'contact',label:'Name',run:cv=>cv.name?{status:'pass'}:{status:'fail',detail:'No name detected.',fix:'Add your full name at the very top.'}},
  {cat:'contact',label:'Professional title',run:cv=>cv.title?{status:'pass'}:{status:'warn',detail:'No headline under your name.',fix:'Add one line like \u201cSenior Data Analyst\u201d so recruiters and ATS can categorise you.'}},
  {cat:'contact',label:'Email address',run:cv=>/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(cv.email)?{status:'pass'}:{status:'fail',detail:cv.email?'\u201c'+cv.email+'\u201d doesn\u2019t look like a valid email.':'No email found.',fix:'Use a plain-text address like name@example.com.'}},
  {cat:'contact',label:'Phone number',run:cv=>/\+?[\d\s().-]{7,}\d/.test(cv.phone)?{status:'pass'}:{status:'warn',detail:'No phone number.',fix:'Add one with your country code, e.g. +880 17XX-XXXXXX.'}},
  {cat:'contact',label:'Location',run:cv=>cv.location?{status:'pass'}:{status:'warn',detail:'No location.',fix:'City + country is enough \u2014 many ATS filter by location.'}},
  {cat:'contact',label:'LinkedIn or portfolio link',run:cv=>cv.linkedin?{status:'pass'}:{status:'warn',detail:'No link found.',fix:'Add your LinkedIn (or portfolio / GitHub) URL.'}},
  /* — Summary — */
  {cat:'summary',label:'Summary present',run:cv=>cv.summary.length>=80?{status:'pass',detail:atsWordCount(cv.summary)+' words.'}:{status:'fail',detail:cv.summary?'Summary is very thin ('+atsWordCount(cv.summary)+' words).':'No professional summary.',fix:'Write 3\u20135 lines: who you are, years of experience, strongest skills, and what you\u2019re targeting.'}},
  {cat:'summary',label:'Summary length',run:cv=>{if(!cv.summary)return{status:'na'};const w=atsWordCount(cv.summary);return w>=40&&w<=90?{status:'pass',detail:w+' words.'}:w>=25&&w<=130?{status:'warn',detail:w+' words \u2014 the sweet spot is 40\u201390.'}:{status:'warn',detail:w+' words is '+(w<25?'too short':'too long')+'.'};}},
  {cat:'summary',label:'Summary targets a role',run:cv=>{if(!cv.summary)return{status:'na'};const hay=(cv.summary+' '+cv.title).toLowerCase();const roleHit=cv.targetRole&&cv.targetRole.toLowerCase().split(/\s+/).filter(w=>w.length>3).some(w=>hay.includes(w));const skillHit=cv.skills.slice(0,8).some(s=>s.length>2&&hay.includes(s.toLowerCase()));return roleHit||skillHit?{status:'pass'}:{status:'warn',detail:'Doesn\u2019t mention your target role or top skills.',fix:'Name the role you want and 2\u20133 core skills in the first sentence.'};}},
  /* — Experience — */
  {cat:'experience',label:'At least one role',run:cv=>cv.experiences.length?{status:'pass',detail:cv.experiences.length+' role'+(cv.experiences.length>1?'s':'')+' listed.'}:{status:'fail',detail:'No experience entries.',fix:'Add your work history \u2014 most ATS reject CVs without it.'}},
  {cat:'experience',label:'Dates on every entry',run:cv=>{if(!cv.experiences.length)return{status:'na'};const miss=cv.experiences.filter(e=>!String(e.dates||'').trim()).length;if(miss===0)return{status:'pass'};if(miss===cv.experiences.length)return{status:'fail',detail:'No dates on any entry.',fix:'ATS builds your timeline from dates \u2014 add them, e.g. \u201cMar 2021 \u2013 Present\u201d.'};return{status:'warn',detail:'Missing dates on '+miss+' entr'+(miss>1?'ies':'y')+'.',fix:'Fill in the dates.'};}},
  {cat:'experience',label:'Bullet depth',run:(cv,ctx)=>{if(!ctx.bullets.length)return{status:'fail',detail:'No achievement bullets.',fix:'Describe each role with 3\u20135 bullets starting with an action verb.'};const per=ctx.bullets.length/cv.experiences.length;return per>=3?{status:'pass',detail:'~'+Math.round(per)+' bullets per role.'}:per>=1.5?{status:'warn',detail:'~'+Math.round(per)+' bullets per role \u2014 aim for 3\u20135.',fix:'Add bullets for your strongest achievements.'}:{status:'fail',detail:'~'+Math.round(per)+' bullets per role.',fix:'Each role needs 3\u20135 bullets; even one strong one beats a bare job title.'};}},
  {cat:'experience',label:'Action-verb bullets',run:(cv,ctx)=>{if(!ctx.bullets.length)return{status:'na'};const r=ctx.bullets.filter(b=>atsStartsWithVerb(b.text)).length/ctx.bullets.length;return r>=0.6?{status:'pass',detail:Math.round(r*100)+'% start with an action verb.'}:r>=0.3?{status:'warn',detail:'Only '+Math.round(r*100)+'% start with an action verb.',fix:'Start each bullet with a verb: Led, Built, Reduced, Grew\u2026'}:{status:'fail',detail:'Only '+Math.round(r*100)+'% start with an action verb.',fix:'Rewrite \u201cResponsible for X\u201d as \u201cLed X\u2026\u201d.'};}},
  {cat:'experience',label:'Quantified achievements',run:(cv,ctx)=>{if(!ctx.bullets.length)return{status:'na'};const r=ctx.bullets.filter(b=>atsHasMetric(b.text)).length/ctx.bullets.length;return r>=0.4?{status:'pass',detail:Math.round(r*100)+'% of bullets contain numbers.'}:r>=0.15?{status:'warn',detail:'Only '+Math.round(r*100)+'% of bullets contain numbers.',fix:'Add real metrics: %, amounts, team sizes, users, time saved.'}:{status:'fail',detail:'Almost no numbers in your bullets.',fix:'Recruiters scan for evidence \u2014 quantify at least a third of your bullets.'};}},
  {cat:'experience',label:'Bullet length',run:(cv,ctx)=>{if(!ctx.bullets.length)return{status:'na'};const avg=ctx.bullets.reduce((a,b)=>a+atsWordCount(b.text),0)/ctx.bullets.length;return avg<=25?{status:'pass',detail:'Average '+Math.round(avg)+' words per bullet.'}:avg<=32?{status:'warn',detail:'Average '+Math.round(avg)+' words per bullet.',fix:'Trim to 1\u20132 lines each.'}:{status:'fail',detail:'Average '+Math.round(avg)+' words per bullet.',fix:'Split long bullets; one idea per line.'};}},
  {cat:'experience',label:'No first-person pronouns',run:(cv,ctx)=>{const hit=(cv.summary&&ATS_FIRST_PERSON.test(cv.summary))||ctx.bullets.some(b=>ATS_FIRST_PERSON.test(b.text));return hit?{status:'warn',detail:'Found \u201cI / my\u201d in the summary or bullets.',fix:'CVs read stronger in implied first person: \u201cLed a team\u201d, not \u201cI led a team\u201d.'}:{status:'pass'};}},
  {cat:'experience',label:'Recent experience',run:(cv,ctx)=>{if(!cv.experiences.length)return{status:'na'};const allDates=cv.experiences.map(e=>String(e.dates||'')).join(' ').toLowerCase();const yrs=(allDates.match(/\b(19|20)\d{2}\b/g)||[]).map(Number);const latest=yrs.length?Math.max(...yrs):0;return /present|current|now/.test(allDates)||latest>=ctx.year-2?{status:'pass'}:{status:'warn',detail:'Most recent dated year is '+latest+'.',fix:'Still working there? End the date with \u201cPresent\u201d.'};}},
  /* — Skills — */
  {cat:'skills',label:'Skills listed',run:cv=>cv.skills.length>=6?{status:'pass',detail:cv.skills.length+' skills.'}:cv.skills.length>=3?{status:'warn',detail:'Only '+cv.skills.length+' skills.',fix:'List 6\u201312 hard skills you actually have.'}:{status:'fail',detail:'Almost no skills listed.',fix:'ATS keyword searches hit the skills section hardest \u2014 list your tools and hard skills.'}},
  {cat:'skills',label:'Skills mirror the posting',run:(cv,ctx)=>{if(ctx.mode!=='jd'||!cv.skills.length)return{status:'na'};const skillHay=cv.skills.join(' ').toLowerCase();const top=ctx.jdTerms.slice(0,12);const hit=top.filter(t=>skillHay.includes(t)).length;if(hit>=top.length*0.5)return{status:'pass',detail:hit+' of the posting\u2019s top '+top.length+' keywords appear in your skills list.'};return{status:'warn',detail:'Only '+hit+' of the posting\u2019s top '+top.length+' keywords appear in your skills list.',fix:'Move your strongest matching skills into the skills list \u2014 ATS keyword searches hit it hardest.'};}},
  /* — Education — */
  {cat:'education',label:'Education present',run:cv=>cv.education.length?{status:'pass',detail:cv.education.length+' entr'+(cv.education.length>1?'ies':'y')+'.'}:{status:'warn',detail:'No education entry.',fix:'Add your highest qualification \u2014 even in-progress ones.'}},
  {cat:'education',label:'Education completeness',run:cv=>{if(!cv.education.length)return{status:'na'};const bad=cv.education.filter(e=>!e.degree.trim()||!e.institution.trim()||!String(e.year||'').trim()).length;return bad===0?{status:'pass'}:{status:'warn',detail:bad+' entr'+(bad>1?'ies':'y')+' missing degree, institution or year.',fix:'Complete all three fields \u2014 ATS looks for the degree + dates pattern.'};}},
  /* — Impact & wording — */
  {cat:'impact',label:'Overall length',run:(cv,ctx)=>{const w=atsWordCount(ctx.cvText);return w>=350&&w<=900?{status:'pass',detail:w+' words of content.'}:w>=250&&w<=1200?{status:'warn',detail:w+' words.',fix:'Aim for 350\u2013900 words (1\u20132 pages).'}:{status:'fail',detail:w+' words is '+(w<250?'too thin':'too long')+'.',fix:w<250?'Add more substance \u2014 bullets, skills, detail.':'Cut older roles and trim bullets.'};}},
  {cat:'impact',label:'Duty phrasing',run:(cv,ctx)=>{if(!ctx.bullets.length)return{status:'na'};const n=ctx.bullets.filter(b=>(b.text.match(ATS_WEAK)||[]).length).length;return n===0?{status:'pass'}:n<=2?{status:'warn',detail:'\u201cResponsible for\u2026\u201d style phrasing on '+n+' bullet'+(n>1?'s':'')+'.',fix:'Swap for \u201cLed / Delivered / Reduced \u2026\u201d.'}:{status:'fail',detail:n+' bullets use duty phrasing.',fix:'Rewrite as achievements: verb + what + measurable result.'};}},
  {cat:'impact',label:'Buzzword-free',run:(cv,ctx)=>{const hay=(cv.summary+' '+ctx.bullets.map(b=>b.text).join(' '));const hits=hay.match(ATS_BUZZ)||[];const uniq=[...new Set(hits.map(h=>h.toLowerCase().trim()))];return uniq.length===0?{status:'pass'}:uniq.length<=2?{status:'warn',detail:'Found: '+uniq.slice(0,3).join(', ')+'.',fix:'Replace clich\u00e9s with concrete evidence.'}:{status:'fail',detail:'Found: '+uniq.slice(0,4).join(', ')+'.',fix:'Cut the clich\u00e9s \u2014 show the achievement instead.'};}},
  {cat:'impact',label:'Verb variety',run:(cv,ctx)=>{if(!ctx.bullets.length)return{status:'na'};const vs=new Set(ctx.bullets.map(b=>b.text.toLowerCase().replace(/[^a-z].*$/,'')).filter(w=>ATS_VERBS.has(w)));return vs.size>=8?{status:'pass',detail:vs.size+' distinct action verbs.'}:{status:'warn',detail:'Only '+vs.size+' distinct action verb'+(vs.size===1?'':'s')+'.',fix:'Vary your openers \u2014 repeating \u201cManaged\u201d dulls the impact.'};}},
  {cat:'impact',label:'Consistent date style',run:cv=>{const ds=cv.experiences.map(e=>String(e.dates||'').trim()).filter(Boolean);if(ds.length<2)return{status:'na'};const hasMonth=ds.some(d=>/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(d));const yearOnly=ds.some(d=>/^\d{4}\s*[-\u2013\u2014]\s*(\d{4}|present)$/i.test(d));return hasMonth&&yearOnly?{status:'warn',detail:'Mixed date formats (some month-based, some year-only).',fix:'Pick one style and use it everywhere.'}:{status:'pass'};}},
  /* — Keywords / job match — */
  {cat:'keywords',label:'Keyword coverage',run:(cv,ctx)=>{if(!ctx.kwResults)return{status:'na',detail:'Paste a job description (or set a target role) to score keywords.'};const found=ctx.kwResults.filter(r=>r.present).length,total=ctx.kwResults.length;const pct=total?found/total:0;const what=ctx.mode==='jd'?'posting keywords':'role keywords';if(pct>=0.7)return{status:'pass',detail:'Found '+found+' of '+total+' '+what+'.'};if(pct>=0.45)return{status:'warn',detail:'Found '+found+' of '+total+' '+what+'.',fix:'Work the missing terms in \u2014 only where genuinely true.'};return{status:'fail',detail:'Found only '+found+' of '+total+' '+what+'.',fix:ctx.mode==='jd'?'Tailor your CV to this posting \u2014 mirror its exact terms.':'Add the missing keywords that are true for you, or refine your target role.'};}},
  {cat:'keywords',label:'Missing keywords',run:(cv,ctx)=>{if(!ctx.kwResults)return{status:'na'};const miss=ctx.kwResults.filter(r=>!r.present);return miss.length===0?{status:'pass',detail:'Nothing missing.'}:{status:'warn',detail:miss.length+' keyword'+(miss.length>1?'s':'')+' missing: '+miss.slice(0,6).map(m=>m.keyword).join(', ')+(miss.length>6?'\u2026':'.'),fix:'Click the red chips below to add the truthful ones to your skills.'};}}
];
export const ATS_CAT_DEFS=[
  {id:'contact',label:'Contact',weight:10},
  {id:'summary',label:'Summary',weight:10},
  {id:'experience',label:'Experience',weight:22},
  {id:'skills',label:'Skills',weight:12},
  {id:'education',label:'Education',weight:6},
  {id:'impact',label:'Impact & wording',weight:15},
  {id:'keywords',label:'Keywords',weight:25}
];
export function atsAnalyze(cv){
  const cvText=getAllText();
  const bullets=atsBullets(cv);
  const year=new Date().getFullYear();
  /* keyword context: pasted job description wins, otherwise role dictionary + custom keywords */
  let kwResults=null,jdTerms=[],mode='none';
  if(cv.jd.length>=120){
    jdTerms=extractJDTerms(cv.jd);
    if(jdTerms.length){mode='jd';kwResults=jdTerms.map(t=>({keyword:t,present:cvText.includes(t),custom:false}));}
  }
  if(mode==='none'){
    const role=cv.targetRole.toLowerCase();
    const matchedRole=Object.keys(ROLE_KW).filter(k=>k!=='default'&&role.length>=2&&(role.includes(k)||k.includes(role))).sort((a,b)=>b.length-a.length)[0]||'default';
    const hasTarget=role.length>=2&&matchedRole!=='default';
    const roleKW=hasTarget?ROLE_KW[matchedRole]:[];
    const allKW=[...roleKW,...cv.customKW.filter(k=>!roleKW.includes(k))];
    if(allKW.length){mode='role';kwResults=allKW.map(kw=>({keyword:kw,present:cvText.includes(kw.toLowerCase()),custom:cv.customKW.includes(kw)}));}
  }
  const ctx={cvText,bullets,year,kwResults,mode,jdTerms};
  const checks=ATS_CHECKS.map(c=>{try{const r=c.run(cv,ctx)||{};return{cat:c.cat,label:c.label,status:r.status||'na',detail:r.detail||'',fix:r.fix||''};}catch(e){return{cat:c.cat,label:c.label,status:'na',detail:'',fix:''};}});
  const cats=ATS_CAT_DEFS.map(def=>{
    const cs=checks.filter(c=>c.cat===def.id&&c.status!=='na');
    if(!cs.length)return null;
    const score=cs.reduce((a,c)=>a+(c.status==='pass'?1:c.status==='warn'?0.55:0),0)/cs.length;
    return{id:def.id,label:def.id==='keywords'&&mode==='jd'?'Job match':def.label,weight:def.weight,score};
  }).filter(Boolean);
  const wsum=cats.reduce((a,c)=>a+c.weight,0);
  const score=wsum?Math.round(cats.reduce((a,c)=>a+c.weight*c.score,0)/wsum*100):0;
  const grade=score>=85?{t:'Excellent',c:'#16a34a'}:score>=70?{t:'Good',c:'#16a34a'}:score>=55?{t:'Fair',c:'#d97706'}:{t:'Needs work',c:'#dc2626'};
  return{score,grade,cats,checks,kwResults,mode,jdTerms};
}
export function atsCheckRow(c){
  const ic=c.status==='fail'?'\u00d7':c.status==='warn'?'!':'\u2713';
  return '<div class="ats-check '+c.status+'"><span class="st">'+ic+'</span><div><strong>'+atsEsc(c.label)+'</strong><small>'+atsEsc(c.detail)+(c.fix?' Fix: '+atsEsc(c.fix):'')+'</small></div></div>';
}
export function atsRunV2(){
  const cv=atsCollectCv();
  /* prefill the AI Coach key input from the stored import key */
  const keyEl=document.getElementById('atsAiKey');
  if(keyEl&&!keyEl.value){const k=cviGetKey();if(k)keyEl.value=k;}
  const C=188.5,C2=150.8;
  const ring=document.getElementById('atsRingFill'),sn=document.getElementById('atsScoreNum');
  const pr=document.getElementById('atsPreviewRing'),pn=document.getElementById('atsPreviewNum');
  if(!atsHasContent(cv)){
    atsLastReport=null;
    if(ring){ring.style.strokeDasharray=C;ring.style.strokeDashoffset=C;ring.style.stroke='var(--text-tertiary)';}
    if(sn){sn.textContent='\u2014';sn.style.color='var(--text-tertiary)';}
    if(pr){pr.style.strokeDasharray=C2;pr.style.strokeDashoffset=C2;pr.style.stroke='var(--text-tertiary)';}
    if(pn){pn.textContent='\u2014';pn.style.color='var(--text-tertiary)';}
    const g=document.getElementById('atsGrade');if(g)g.style.display='none';
    const ab=document.getElementById('atsBreakdown');if(ab)ab.innerHTML='<div style="text-align:center;color:var(--text-secondary);font-size:12px;padding:0.4rem">Fill in your CV details to see your ATS score.</div>';
    const ch=document.getElementById('atsChecks');if(ch)ch.innerHTML='';
    const hd=document.getElementById('atsChecksHead');if(hd)hd.textContent='';
    const kc=document.getElementById('keywordCloud');if(kc)kc.innerHTML='';
    const jr=document.getElementById('jdResults');if(jr)jr.innerHTML='';
    const pc=document.getElementById('atsPreviewChecks');if(pc)pc.innerHTML='';
    return;
  }
  const rep=atsAnalyze(cv);
  atsLastReport=rep;
  const col=rep.score>=70?'#16a34a':rep.score>=55?'#d97706':'#dc2626';
  if(ring){ring.style.strokeDasharray=C;ring.style.strokeDashoffset=C-(C*rep.score/100);ring.style.stroke=col;}
  if(sn){sn.textContent=rep.score;sn.style.color=col;}
  if(pr){pr.style.strokeDasharray=C2;pr.style.strokeDashoffset=C2-(C2*rep.score/100);pr.style.stroke=col;}
  if(pn){pn.textContent=rep.score;pn.style.color=col;}
  const g=document.getElementById('atsGrade');
  if(g){g.style.display='';g.style.borderColor=col;g.style.color=col;g.textContent=rep.grade.t+' \u2014 '+rep.score+'/100';}
  const ab=document.getElementById('atsBreakdown');
  if(ab){
    ab.innerHTML=rep.cats.map(cat=>{
      const pct=Math.round(cat.score*100);
      const cc=pct>=70?'#16a34a':pct>=40?'#d97706':'#dc2626';
      return '<div class="ats-cat"><span class="ats-cat-label">'+atsEsc(cat.label)+'</span><div class="ats-cat-bar"><div class="ats-cat-fill" style="width:'+pct+'%;background:'+cc+'"></div></div><span class="ats-cat-num" style="color:'+cc+'">'+pct+'</span></div>';
    }).join('');
  }
  const probs=rep.checks.filter(c=>c.status==='fail'||c.status==='warn');
  const ch=document.getElementById('atsChecks');
  const hd=document.getElementById('atsChecksHead');
  if(ch){
    ch.innerHTML=probs.length?probs.slice(0,10).map(atsCheckRow).join('')+(probs.length>10?'<div class="ats-checks-head">+ '+(probs.length-10)+' more \u2014 fix the top items first.</div>':''):'';
    if(hd)hd.textContent=probs.length?('Fix these '+probs.length+' \u2014 everything else passed.'):'All checks passed \u2014 nothing is holding this CV back.';
  }
  const kc=document.getElementById('keywordCloud');
  if(kc){
    if(rep.kwResults){
      kc.innerHTML=rep.kwResults.map(r=>{
        const clickable=!r.present&&!r.custom;
        const cls='kw-chip '+(r.present?(r.custom?'kw-custom':'kw-pass'):(r.custom?'kw-custom':'kw-miss'))+(clickable?' kw-click':'');
        const oc=clickable?('onclick="addKWFromCloud(\''+r.keyword.replace(/'/g,"\\'")+'\')"'):'';
        const ti=clickable?('title="Click to add \''+atsEsc(r.keyword)+'\' to your skills"'):'';
        return '<span '+oc+' '+ti+' class="'+cls+'">'+atsEsc(r.keyword)+(r.custom?'<span class="star">\u2605</span>':'')+(clickable?' +':'')+'</span>';
      }).join('');
    }else{
      kc.innerHTML='<span style="font-size:11px;color:var(--text-tertiary)">Set a target role or paste a job description to get keyword suggestions.</span>';
    }
  }
  const jr=document.getElementById('jdResults');
  if(jr){
    if(rep.mode==='jd'&&rep.kwResults){
      const found=rep.kwResults.filter(r=>r.present).length,total=rep.kwResults.length;
      const pct=Math.round(found/total*100);
      const jcol=pct>=70?'#16a34a':pct>=45?'#d97706':'#dc2626';
      const missing=rep.kwResults.filter(r=>!r.present);
      jr.innerHTML='<div class="jd-score-row"><div class="jd-score-bar"><div class="jd-score-fill" style="width:'+pct+'%;background:'+jcol+'"></div></div><span class="jd-score-num" style="color:'+jcol+'">'+pct+'%</span></div>'
        +'<div class="jd-note"><strong>'+found+' of '+total+'</strong> keywords from this posting appear in your CV. '+(missing.length===0?'Nothing obvious missing \u2014 this posting matches you well.':'Only add the ones that are genuinely true for you; ATS filters and human readers both punish padding.')+'</div>'
        +(missing.length?'<div class="jd-actions"><button class="btn btn-sm" data-kws="'+atsEsc(JSON.stringify(missing.map(m=>m.keyword)))+'" onclick="addJDMissing(this.getAttribute(\'data-kws\'))">Add all missing to keywords</button></div>':'')
        +'<div style="display:flex;flex-wrap:wrap;gap:0.3rem">'+rep.kwResults.map(r=>r.present
          ?'<span class="kw-chip kw-pass">'+atsEsc(r.keyword)+'</span>'
          :'<span class="kw-chip kw-miss kw-click" title="Click to add \''+atsEsc(r.keyword)+'\' to your skills" onclick="addKWFromCloud(\''+r.keyword.replace(/'/g,"\\'")+'\')">'+atsEsc(r.keyword)+' +</span>').join('')+'</div>';
    }else if(cv.jd.length>=120){
      jr.innerHTML='<div class="jd-note">Couldn\u2019t extract enough keywords from this text \u2014 is it a real job posting?</div>';
    }else if(cv.jd.length>0){
      jr.innerHTML='<div class="jd-note">Paste a full job description (at least a paragraph or two) for a meaningful match.</div>';
    }else{
      jr.innerHTML='';
    }
  }
  const pc=document.getElementById('atsPreviewChecks');
  if(pc){
    pc.innerHTML=rep.cats.map(cat=>{
      const pct=Math.round(cat.score*100);
      const cls=pct>=70?'pass':pct>=40?'warn':'fail';
      return '<div class="ats-chk '+cls+'"><span>'+atsEsc(cat.label)+'</span><span class="dot"></span></div>';
    }).join('');
  }
}
/* ── AI Coach: Gemini review layered on top of the local report (user's own key) ── */
export const ATS_AI_SCHEMA={
  type:'OBJECT',
  properties:{
    verdict:{type:'STRING',description:'One-sentence overall assessment of the CV'},
    quickWins:{type:'ARRAY',items:{type:'OBJECT',properties:{title:{type:'STRING'},detail:{type:'STRING'}},required:['title','detail']}},
    summaryRewrite:{type:'STRING',description:'Improved professional summary, or empty string if the current one is already good'},
    bulletRewrites:{type:'ARRAY',items:{type:'OBJECT',properties:{
      experience:{type:'INTEGER',description:'0-based index into the experiences array'},
      bullet:{type:'INTEGER',description:'0-based line index within that experience description'},
      original:{type:'STRING'},improved:{type:'STRING'},why:{type:'STRING'}},
      required:['experience','bullet','original','improved','why']}},
    keywordsToAdd:{type:'ARRAY',items:{type:'STRING'},description:'Up to 8 relevant keywords plausibly missing from the CV'},
    tips:{type:'ARRAY',items:{type:'STRING'},description:'Up to 4 additional concise tips'}
  },
  required:['verdict','quickWins','summaryRewrite','bulletRewrites','keywordsToAdd','tips']
};
export function atsAiParts(cv,rep){
  const inst='You are an expert CV/resume coach specialised in ATS (applicant tracking system) optimisation and achievement writing.\nYou receive: the CV content, the target role, optionally a job description, and a rule-based ATS report.\nRules:\n- Never invent employers, titles, dates, metrics or skills. Where a number is needed but unknown, use a placeholder like [X%] or [N users] for the user to fill in.\n- "bulletRewrites": pick at most 4 weak bullets (duty phrasing, no action verb, no measurable outcome). Rewrite as: strong action verb + what you did + measurable result/impact. "experience" and "bullet" are 0-based indexes into the data you receive.\n- "summaryRewrite": only if the current summary is missing or weak. Max 55 words, no first person, only facts from the CV.\n- "keywordsToAdd": up to 8 keywords relevant to the target role / job description that are plausibly missing from this CV.\n- Be specific and honest. Output valid JSON matching the schema exactly. Use empty string / empty array when not applicable.';
  const payload={cv:{title:cv.title,name:cv.name,summary:cv.summary,skills:cv.skills,experiences:cv.experiences,education:cv.education,languages:cv.languages,targetRole:cv.targetRole},jobDescription:cv.jd?cv.jd.slice(0,4000):'',atsReport:{score:rep?rep.score:null,failingChecks:rep?rep.checks.filter(c=>c.status==='fail').map(c=>c.label):[],warningChecks:rep?rep.checks.filter(c=>c.status==='warn').map(c=>c.label):[]}};
  return [{text:inst},{text:'CV AND REPORT DATA:\n'+JSON.stringify(payload)}];
}
export async function runAtsAiCoach(){
  const keyEl=document.getElementById('atsAiKey');
  const key=(keyEl?keyEl.value:'').trim()||cviGetKey();
  if(keyEl&&key)keyEl.value=key;
  const st=document.getElementById('atsAiStatus');
  const btn=document.getElementById('atsAiBtn');
  if(!key){if(st){st.textContent='Paste a Gemini API key first \u2014 get a free one at aistudio.google.com/apikey.';st.className='ats-ai-status err';}return;}
  const cv=atsCollectCv();
  if(!atsHasContent(cv)){if(st){st.textContent='Fill in your CV first \u2014 there is nothing to review yet.';st.className='ats-ai-status err';}return;}
  cviSetKey(key);
  if(btn)btn.disabled=true;
  if(st){st.textContent='Asking Gemini\u2026';st.className='ats-ai-status';}
  try{
    const {data,model}=await cviCallGemini(key,cviGetModel(),atsAiParts(cv,atsLastReport),m=>{if(st)st.textContent=m;},{schema:ATS_AI_SCHEMA});
    atsRenderAi(data);
    if(st){st.textContent='Reviewed with '+model+' \u2014 re-run the analysis after applying changes.';st.className='ats-ai-status ok';}
  }catch(e){
    if(st){st.textContent=e&&e.message?e.message:'Gemini request failed \u2014 try again in a minute.';st.className='ats-ai-status err';}
  }finally{
    if(btn)btn.disabled=false;
  }
}
export async function testGeminiKey(){ /* tiny ping through the same fallback engine — pinpoints key/model/region problems in the UI */
  const keyEl=document.getElementById('atsAiKey');
  const key=(keyEl?keyEl.value:'').trim()||cviGetKey();
  const st=document.getElementById('atsAiStatus');
  if(!key){if(st){st.textContent='Paste a Gemini API key first \u2014 get a free one at aistudio.google.com/apikey.';st.className='ats-ai-status err';}return;}
  if(keyEl)keyEl.value=key;
  cviSetKey(key);
  if(st){st.textContent='Testing connection\u2026';st.className='ats-ai-status';}
  try{
    const {data,model}=await cviCallGemini(key,cviGetModel(),[{text:'Connection test. Reply with exactly: OK'}],m=>{if(st)st.textContent=m;},{temperature:0,timeout:30000});
    if(st){st.textContent='Connection OK \u2014 answered via '+model+'. The AI coach and CV import will work.';st.className='ats-ai-status ok';}
  }catch(e){
    if(st){st.textContent=(e&&e.message)||'Connection failed.';st.className='ats-ai-status err';}
  }
}
export function atsRenderAi(d){
  const box=document.getElementById('atsAiResults');
  if(!box)return;
  window.atsAiData=d||null;
  if(!d){box.innerHTML='';return;}
  let h='';
  if(d.verdict)h+='<div class="ats-ai-verdict">'+atsEsc(d.verdict)+'</div>';
  (d.quickWins||[]).forEach(w=>{h+='<div class="ai-card"><div class="ai-card-t">'+atsEsc(w.title)+'</div><div class="ai-card-d">'+atsEsc(w.detail)+'</div></div>';});
  if(d.summaryRewrite){h+='<div class="ai-card"><div class="ai-card-t">Suggested summary <button class="btn-ai-apply" onclick="atsApplySummary()">Apply</button></div><div class="ai-rew"><div class="line new">'+atsEsc(d.summaryRewrite)+'</div></div></div>';}
  (d.bulletRewrites||[]).forEach((r,i)=>{h+='<div class="ai-card"><div class="ai-card-t">Bullet rewrite <button class="btn-ai-apply" onclick="atsApplyBullet('+i+')">Apply</button></div><div class="ai-rew"><div class="line old">'+atsEsc(r.original)+'</div><div class="line new">'+atsEsc(r.improved)+'</div></div><div class="ai-card-d">Why: '+atsEsc(r.why)+'</div></div>';});
  if((d.keywordsToAdd||[]).length){h+='<div class="ai-card"><div class="ai-card-t">Suggested keywords <button class="btn-ai-apply" onclick="atsApplyKeywords()">Add all</button></div><div class="ai-card-d" style="display:flex;flex-wrap:wrap;gap:0.3rem">'+d.keywordsToAdd.map(k=>'<span class="kw-chip kw-custom">'+atsEsc(k)+'</span>').join('')+'</div><div class="ai-card-d">Only keep the ones that are genuinely true for you.</div></div>';}
  (d.tips||[]).forEach(t=>{h+='<div class="ai-card"><div class="ai-card-d">\u2022 '+atsEsc(t)+'</div></div>';});
  box.innerHTML=h||'<div class="ai-card-d">No suggestions returned \u2014 try again.</div>';
}
export function atsApplySummary(){
  const d=window.atsAiData;
  if(!d||!d.summaryRewrite)return;
  if(!confirm('Replace your current summary with the AI version?'))return;
  const el=document.getElementById('summary');
  if(!el)return;
  el.value=String(d.summaryRewrite);
  updatePreview();
  showToast('Summary updated \u2014 tweak any [placeholders]');
}
export function atsApplyBullet(i){
  const d=window.atsAiData;
  if(!d)return;
  const rw=(d.bulletRewrites||[])[i];
  if(!rw)return;
  const exps=getExperiences();
  const tgt=exps[rw.experience];
  if(!tgt){showToast('That role is no longer in the editor');return;}
  const items=Array.from(document.querySelectorAll('#experienceList .dynamic-item'));
  const it=items.find(n=>(((n.querySelectorAll('input')[0]||{}).value)||'')===tgt.title&&(((n.querySelectorAll('input')[1]||{}).value)||'')===tgt.company);
  const ta=it?it.querySelector('textarea'):null;
  if(!ta){showToast('Could not locate that role in the editor');return;}
  const lines=ta.value.split('\n');
  if(rw.bullet<0||rw.bullet>=lines.length){showToast('That bullet no longer matches \u2014 edit it manually');return;}
  if(!confirm('Replace this bullet?'))return;
  lines[rw.bullet]=String(rw.improved);
  ta.value=lines.join('\n');
  updatePreview();
  showToast('Bullet updated \u2014 tweak any [placeholders]');
}
export function atsApplyKeywords(){
  const d=window.atsAiData;
  if(!d||!(d.keywordsToAdd||[]).length)return;
  if(!confirm('Add these keywords to your skills list? (Only keep what is genuinely true.)'))return;
  const el=document.getElementById('skills');
  if(!el)return;
  const cur=el.value.split(',').map(s=>s.trim()).filter(Boolean);
  d.keywordsToAdd.forEach(k=>{k=String(k).trim();if(k&&!cur.some(c=>c.toLowerCase()===k.toLowerCase()))cur.push(k);});
  el.value=cur.join(', ');
  updatePreview();
  showToast('Keywords merged into skills');
}

export const setCustomKWList=v=>{customKWList=v;};
/* re-run the local analysis whenever the rendered documents change
   (render.js dispatches this after every preview update) */
window.addEventListener('cvgenie:preview-updated',()=>runATSAnalysis());
