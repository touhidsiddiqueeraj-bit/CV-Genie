/* The cover-letter writers: the deterministic engine (rules + CV data,
 * stable output, works offline) and the Gemini AI rewrite on top of it. */

import { extractJDTerms } from './ats.js';
import { collectPreviewData } from './cvdata.js';
import { cviCallGemini, cviGetKey, cviGetModel, cviSetKey } from './gemini.js';
import { getLetterFields, renderLetter, setLetterParagraphs } from './letter.js';
import { scaleCVToFit } from './preview.js';
import { showToast } from './ui.js';

/* ── Deterministic cover-letter engine — the PRIMARY writer. Rules + your CV data only:
   no network, no key, no hallucination. Gemini stays as the backup (runLetterAi falls back
   here automatically). Same 4-paragraph contract as the AI so the two are interchangeable. ── */
export const LETTER_VERBS=/^(led|built|launched|shipped|increased|reduced|improved|grew|saved|delivered|designed|automated|managed|created|developed|drove|cut|won|trained|mentored|spearheaded|optimised|optimized|streamlined|negotiated|achieved|exceeded|owned|wrote|ran|oversaw|introduced|migrated|rebuilt|scaled|supported|maintained|analysed|analyzed|researched|planned|coordinated|presented|taught|founded|started|helped|worked|responsible|accountable)\b/i;
export function letterHash(s){let h=7;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return Math.abs(h);} /* stable pick: same CV → same letter */
export function letterAnd(a){a=a.filter(Boolean);if(a.length<=1)return a[0]||'';if(a.length===2)return a[0]+' and '+a[1];return a.slice(0,-1).join(', ')+' and '+a[a.length-1];}
export function letterCap(s){return s?s.charAt(0).toUpperCase()+s.slice(1):s;}
export function letterParseDate(s){
    s=(s||'').trim();if(!s)return null;
    const M={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
    let m=s.match(/^(\d{4})$/);if(m)return new Date(+m[1],6,1);
    m=s.match(/^(?:(\d{1,2})[/.\-]\s*)?(\d{4})$/);if(m)return new Date(+m[2],m[1]?+m[1]-1:6,1);
    m=s.match(/^([A-Za-z]{3,})[a-z]*\.?\s+(\d{4})$/);if(m&&M[m[1].slice(0,3).toLowerCase()]!=null)return new Date(+m[2],M[m[1].slice(0,3).toLowerCase()],1);
    m=s.match(/^(\d{1,2})\s+([A-Za-z]{3,})[a-z]*\.?\s+(\d{4})$/);if(m&&M[m[2].slice(0,3).toLowerCase()]!=null)return new Date(+m[3],M[m[2].slice(0,3).toLowerCase()],+m[1]);
    return null;
}
export function letterParseRange(dates){
    const d=(dates||'').trim();if(!d)return null;
    const parts=d.split(/\s*(?:–|—|-|to)\s*/i).filter(Boolean);
    if(parts.length<2){const s=letterParseDate(parts[0]);return s?{start:s,end:s}:null;}
    const present=/present|current|now|ongoing|today/i.test(d);
    const start=letterParseDate(parts[0]);
    const end=present?new Date():letterParseDate(parts[parts.length-1]);
    if(!start||!end||end<start)return null;
    return{start,end};
}
export function letterExperienceSpan(exp){
    const ranges=exp.map(e=>letterParseRange(e.dates)).filter(Boolean);
    if(!ranges.length)return null;
    ranges.sort((a,b)=>a.start-b.start);
    let months=0,lastEnd=null;
    for(const r of ranges){
        if(lastEnd&&r.start<lastEnd){if(r.end>lastEnd){months+=(r.end-lastEnd)/(30.44*864e5);lastEnd=r.end;}}
        else{months+=(r.end-r.start)/(30.44*864e5);lastEnd=r.end;}
    }
    return Math.max(0,months);
}
export function letterAchievements(exp){
    const out=[];
    exp.forEach((job,ji)=>{
        String(job.description||'').split(/\n|\u2022|•/).forEach(raw=>{
            const l=raw.replace(/^[\s\-–—*•\u2022.]+/,'').replace(/\s+$/,'').trim();
            if(l.length<25||l.length>240)return;
            let s=0;
            if(/\d/.test(l))s+=3;
            if(/(\d+\s*%|\$\d|\b\d+x\b|\b\d{2,}\b)/i.test(l))s+=2;
            if(LETTER_VERBS.test(l))s+=2;
            out.push({line:l,score:s,job,ji});
        });
    });
    out.sort((a,b)=>b.score-a.score||a.ji-b.ji);
    return out;
}
export function letterRankSkills(skills,jdTerms){
    if(!skills.length)return[];
    if(!jdTerms||!jdTerms.length)return skills.slice(0,4);
    const scored=skills.map(sk=>{
        const k=sk.toLowerCase();let sc=0;
        jdTerms.forEach(t=>{if(t&&(k.includes(t)||t.includes(k)))sc+=3;});
        return{sk,sc};
    });
    scored.sort((a,b)=>b.sc-a.sc); /* stable: ties keep CV order */
    return scored.map(x=>x.sk).slice(0,4);
}
/* turn a CV bullet into an "I …" clause without breaking proper nouns.
   form 'sub' → follows "As X, …" · 'verb' → follows "I also …" · 'i' → standalone */
export function letterAchieveClause(line,form){
    form=form||'sub';
    let s=line.replace(/[\s.;,]+$/,'').trim();
    if(!s)return'';
    const fw=s.split(/\s+/)[0];
    if(LETTER_VERBS.test(s)){
        const lc=fw.toLowerCase()+s.slice(fw.length);
        return form==='verb'?lc:'I '+lc; /* verb-first bullet → "I led a team of 5" */
    }
    /* noun phrase, digit or acronym start → "my work included …", original casing for acronyms */
    const lowerable=/^[A-Z][a-z'’]*$/.test(fw);
    const body=lowerable?fw.toLowerCase()+s.slice(fw.length):s;
    if(form==='verb')return 'did work that included '+body;
    return (form==='i'?'My':'my')+' work included '+body;
}
export function letterDeterministicParts(){
    const f=getLetterFields();
    const D=collectPreviewData();
    const jd=(document.getElementById('jdText')?.value||'').trim();
    const targetRole=(document.getElementById('targetRole')?.value||'').trim();
    const role=f.role.trim()||targetRole;
    const roleThe=role?`the ${role} role`:'the advertised role'; /* "apply for …" */
    const roleA=role?`a ${role}`:'this role'; /* "is hiring …" */
    const company=f.company.trim();
    const coFormal=company||'your organisation';
    const coPlain=company||'your company';
    const v=letterHash((D.name||'')+'|'+role+'|'+company)%2; /* stable variant per candidate+role */
    const tone=f.tone==='direct'?'direct':f.tone==='warm'?'warm':'formal';
    const months=letterExperienceSpan(D.exp);
    const years=months?months/12:0;
    const jdTerms=jd?extractJDTerms(jd).slice(0,6):[];
    const skills=letterRankSkills(D.skillList,jdTerms);
    const top2=skills.slice(0,2),top3=skills.slice(0,3);
    const skillPhrase=top2.length?letterAnd(top2):'the core of this work';
    const cur=D.exp[0]||null;
    const ach=letterAchievements(D.exp).slice(0,2);
    const curRef=cur&&cur.title?`${cur.title}${cur.company?' at '+cur.company:''}`:'';
    const yearsPhrase=years>=2?(Math.round(years)+' years'):years>=1?'the past year':'';
    const P={};
    /* ── p1: opening — role + one-line fit ── */
    if(tone==='formal'){
        P.p1=v===0
            ?`I am writing to apply for ${roleThe} at ${coFormal}.${yearsPhrase?` I bring ${yearsPhrase==='the past year'?'a year':'over '+yearsPhrase} of experience in ${skillPhrase}${curRef?', most recently as '+curRef:''}.`:` My background is in ${skillPhrase}${curRef?', currently as '+curRef:''}.`}`
            :`Please accept this letter as my application for ${roleThe} at ${coFormal}.${yearsPhrase?` Over ${yearsPhrase}, I have built my work around ${skillPhrase}${curRef?', most recently as '+curRef:''}.`:` My work centres on ${skillPhrase}${curRef?', currently as '+curRef:''}.`}`;
    }else if(tone==='direct'){
        P.p1=v===0
            ?`I'm applying for ${roleThe} at ${coPlain}.${yearsPhrase?` Short version: ${yearsPhrase} doing exactly this kind of work${curRef?', currently as '+curRef:''}.`:` This is the work I do${curRef?' — as '+curRef:''}.`}`
            :`${coPlain} is hiring ${roleA}${yearsPhrase?`, and I've spent ${yearsPhrase} doing exactly that`:''}.${top3.length?` What I bring: ${letterAnd(top3)}.`:''}`;
    }else{
        P.p1=v===0
            ?`When I saw ${coPlain} was looking for ${roleA}, I had to write in — this is exactly the work I've been building toward${yearsPhrase?' for '+yearsPhrase:''}.`
            :`${letterCap(roleThe)} at ${coPlain} caught my eye${yearsPhrase?` — ${yearsPhrase} working with ${skillPhrase} made it read like my day job`:top2.length?` — ${skillPhrase} are what I do best`:''}.`;
    }
    /* ── p2: why this company — grounded in the JD when we have one, honest guidance when we don't.
       Skip JD terms that just restate the role; prefer terms the candidate's skills match. ── */
    const skLow=skills.map(s=>s.toLowerCase());
    const rLow=role.toLowerCase();
    const jt=jdTerms.filter(t=>t!==rLow&&!rLow.includes(t)&&!t.includes(rLow))
                    .sort((a,b)=>(skLow.some(s=>s.includes(a)||a.includes(s))?0:1)-(skLow.some(s=>s.includes(b)||b.includes(s))?0:1))
                    .slice(0,3);
    if(jt.length){
        if(tone==='formal'){
            P.p2=`Your posting emphasises ${letterAnd(jt)} — these are precisely the areas where I have invested most of my effort${top2.length?`, particularly ${letterAnd(top2)}`:''}. That combination is what I look for in a next role.`;
        }else if(tone==='direct'){
            P.p2=`The posting is clear about what matters: ${letterAnd(jt)}. Convenient, because that's where my work already lives${top2.length?` — ${letterAnd(top2)} are my strongest ground`:''}.`;
        }else{
            P.p2=`What pulled me in was how the posting describes the work — ${letterAnd(jt)} — because that's the part of the job I genuinely enjoy most.`;
        }
    }else{
        const guide=company?`[One specific sentence about ${company} — a product you use, a decision they made, why their work matters to you. It carries real weight.]`:`[Add one sentence about the company once you know them — it is the line recruiters read first.]`;
        if(tone==='formal'){
            P.p2=`The shape of this role — ${skillPhrase} applied to real problems — is precisely the work I want to be doing. ${guide}`;
        }else if(tone==='direct'){
            P.p2=`Straight answer: I'm drawn to the work itself — ${skillPhrase} on problems that matter. ${guide}`;
        }else{
            P.p2=`What draws me is simpler than it sounds: work that treats ${skillPhrase} as craft. ${guide}`;
        }
    }
    /* ── p3: evidence — the most quantified achievements we can find ── */
    if(ach.length){
        const a0=ach[0],current0=a0.ji===0;
        const lead=current0
            ?`In my current role${a0.job.title?' as '+a0.job.title:''}${a0.job.company?' at '+a0.job.company:''}`
            :`As ${a0.job.title||'a professional'}${a0.job.company?' at '+a0.job.company:''}`;
        let ev=`${lead}, ${letterAchieveClause(a0.line,'sub')}.`;
        if(ach[1]){
            const same=ach[1].job===a0.job;
            if(same)ev+=` I also ${letterAchieveClause(ach[1].line,'verb')}.`;
            else ev+=` Earlier, as ${ach[1].job.title||'a professional'}${ach[1].job.company?' at '+ach[1].job.company:''}, ${letterAchieveClause(ach[1].line,'sub')}.`;
        }
        if(!ach.some(a=>/\d/.test(a.line)))ev+=' [Add a number to one of these — a figure makes evidence land.]';
        P.p3=letterCap(ev);
    }else if(cur&&(cur.title||cur.description)){
        const desc=String(cur.description||'').split(/[.\n]/).map(x=>x.trim()).filter(Boolean)[0]||'';
        P.p3=tone==='formal'
            ?`In my present role${cur.title?' as '+cur.title:''}${cur.company?' at '+cur.company:''}${desc?', my responsibilities centre on '+desc.charAt(0).toLowerCase()+desc.slice(1):''}. My strongest assets for this position are ${skillPhrase}.`
            :`Right now${cur.title?' I work as '+cur.title:''}${cur.company?' at '+cur.company:''}${desc?': '+desc.charAt(0).toLowerCase()+desc.slice(1):''}. ${letterCap(skillPhrase)} are what I bring to this role.`;
    }else if(D.pubs&&D.pubs.length){
        /* researcher path — no quantified work bullets, but published papers */
        const pb=D.pubs[0];
        const pbRef=pb.venue?` in ${pb.venue}`:'';
        const pbMore=D.pubs.length>1?` Alongside it, I have ${D.pubs.length-1} further ${D.pubs.length-1===1?'publication':'publications'}${D.pubs.length>2?' across applied research topics':''}.`:'';
        P.p3=tone==='formal'
            ?`My work is published: my ${/accepted|published/i.test(pb.status||'')?'paper':'most recent paper'}, “${(pb.title||'').replace(/\.$/,'')}”${pbRef}${pb.status?', '+pb.status.charAt(0).toLowerCase()+pb.status.slice(1):''}.${pbMore}${top3.length?` ${letterCap(skillPhrase)} are the skills behind it.`:''}`
            :`I publish my work — most recently “${(pb.title||'').replace(/\.$/,'')}”${pbRef}${pb.status?' ('+pb.status.charAt(0).toLowerCase()+pb.status.slice(1)+')':''}.${pbMore}`;
    }else{
        const edu=D.edu[0],langs=D.langs.map(l=>l.language).filter(Boolean);
        let p3=top3.length?`My strongest assets for this role are ${letterAnd(top3)}.`:'';
        if(edu&&edu.degree)p3+=` My ${edu.degree}${edu.institution?' from '+edu.institution:''} provided the foundation for this work.`;
        if(langs.length)p3+=` I also bring ${letterAnd(langs.slice(0,2))}${langs.length>2?' (among other languages)':''}.`;
        P.p3=(p3||'My background aligns closely with what this role needs.').trim();
    }
    /* ── p4: closing — short, confident, clear CTA ── */
    if(tone==='formal'){
        P.p4=v===0
            ?`My CV is attached with further detail. I would welcome the opportunity to discuss how I could contribute to ${coFormal}, and I am available for interview at your convenience.`
            :`Thank you for considering my application. My CV is attached, and I would be glad to expand on any part of it in an interview.`;
    }else if(tone==='direct'){
        P.p4=v===0
            ?`My CV has the detail. I'd welcome a conversation about what ${coPlain} needs from this role first — that's usually the fastest way to see the fit. I'm available any weekday.`
            :`Happy to talk whenever suits. My CV is attached, and I can walk through any part of it in detail.`;
    }else{
        P.p4=v===0
            ?`Thank you for reading this far — I know what an inbox of applications looks like. I'd love to talk about what ${coPlain} needs from this role; my CV is attached with the rest of the story.`
            :`I'd really enjoy a conversation about the role — thank you for considering my application. My CV has the full picture.`;
    }
    return{p1:P.p1.trim(),p2:P.p2.trim(),p3:P.p3.trim(),p4:P.p4.trim(),meta:{tone,years:+years.toFixed(1),skills,jdUsed:jdTerms.length>0,achievements:ach.length}};
}
export function draftLetter(opts){
    opts=opts||{};
    const f=getLetterFields();
    const D=collectPreviewData();
    const hasCv=D.name!=='Your Name'&&((D.summary&&D.summary.trim())||D.skillList.length||D.exp.length);
    const st=document.getElementById('clAiStatus');
    if(!hasCv){
        const msg='Fill in your CV first — there is nothing to write from yet.';
        if(opts.quiet)return null;
        if(st){st.textContent=msg;st.className='ats-ai-status err';}
        showToast(msg);return null;
    }
    if(!opts.quiet&&f.paragraphs.some(p=>p.trim())&&!confirm('Replace your current letter text with a fresh draft?'))return null;
    const parts=letterDeterministicParts();
    setLetterParagraphs([parts.p1,parts.p2,parts.p3,parts.p4]);
    renderLetter();
    setActiveDoc('letter');
    scaleCVToFit();
    if(opts.fallbackMsg){
        if(st){st.textContent=opts.fallbackMsg;st.className='ats-ai-status warn';}
        showToast('Gemini unavailable — instant draft written instead');
    }else{
        if(st){st.textContent=`Drafted from your CV — ${parts.meta.achievements||0} achievement${parts.meta.achievements===1?'':'s'}${parts.meta.jdUsed?', matched to the job description':''}, fully offline. Edit freely or let Gemini rewrite it.`;st.className='ats-ai-status ok';}
        showToast('Letter drafted from your CV');
    }
    return parts;
}
/* ── AI cover letter writer (Gemini, user's own key — same engine as the ATS coach) ── */
export const LETTER_AI_SCHEMA={
  type:'OBJECT',
  properties:{
    p1:{type:'STRING',description:'Opening paragraph — the role applied for and a one-line statement of fit'},
    p2:{type:'STRING',description:'Why this company — a specific, grounded connection'},
    p3:{type:'STRING',description:'Evidence — the 1-2 most relevant achievements from the CV, stated concretely'},
    p4:{type:'STRING',description:'Closing — a brief, confident call to action'}
  },
  required:['p1','p2','p3','p4']
};
export function letterAiTone(t){return t==='direct'?'direct — confident and concise, zero fluff':t==='warm'?'warm — personable and human, still professional':'formal — classic professional business register';}
export function letterAiParts(){
  const f=getLetterFields();
  const D=collectPreviewData();
  const targetRole=(document.getElementById('targetRole')?.value||'').trim();
  const jd=(document.getElementById('jdText')?.value||'').trim();
  const inst=['You are an expert cover-letter writer who sounds like a real person, not a template.',
  'You receive: the candidate\u2019s CV data, the letter context (role, company, hiring manager, tone), and optionally a job description.',
  'Rules:',
  '- Use ONLY facts present in the CV (roles, employers, skills, achievements). Never invent employers, dates, numbers or skills.',
  '- Where a number would strengthen a claim but is unknown, write a short [placeholder like this] the candidate can fill in.',
  '- p1 (opening): name the exact role and give a one-line reason this candidate fits it. Do NOT open with a greeting like "Dear ..." — the salutation line is generated separately by the app.',
  '- p2 (why this company): use the job description and company field if provided. Be specific about the work or mission, never hollow flattery.',
  '- p3 (evidence): pick the 1-2 most relevant achievements from the CV for THIS role and state them concretely — what was done and the measurable result.',
  '- p4 (closing): two or three sentences at most — availability and a clear, low-pressure call to action.',
  '- Tone: '+letterAiTone(f.tone)+'.',
  '- Length: 2-4 sentences per paragraph, whole letter 180-320 words. Plain sentences only — no markdown, no bullet points, no clichés ("team player", "perfect candidate", "leverage my skills").',
  '- Complement the CV, don\u2019t repeat it line by line. No salutation and no sign-off inside the paragraphs — the app renders those itself.',
  '- Output valid JSON matching the schema exactly.'].join('\n');
  const payload={
    candidate:{name:D.name,title:D.title,summary:D.summary,skills:D.skillList,experiences:D.exp,education:D.edu,languages:D.langs,targetRole},
    letterContext:{role:f.role||targetRole||'',company:f.company||'',hiringManager:f.hiringManager||'',tone:f.tone},
    jobDescription:jd?jd.slice(0,4000):''
  };
  return [{text:inst},{text:'CV AND CONTEXT DATA:\n'+JSON.stringify(payload)}];
}
export async function runLetterAi(){
  const keyEl=document.getElementById('clAiKey');
  const key=(keyEl?keyEl.value:'').trim()||cviGetKey();
  if(keyEl&&key)keyEl.value=key;
  const st=document.getElementById('clAiStatus');
  const btn=document.getElementById('clAiBtn');
  if(!key){if(st){st.textContent='Paste a Gemini API key first \u2014 get a free one at aistudio.google.com/apikey.';st.className='ats-ai-status err';}return;}
  const f=getLetterFields();
  const D=collectPreviewData();
  const hasCv=D.name!=='Your Name'&&((D.summary&&D.summary.trim())||D.skillList.length||D.exp.length);
  if(!hasCv){if(st){st.textContent='Fill in your CV first \u2014 there is nothing to write from yet.';st.className='ats-ai-status err';}return;}
  if(!f.role.trim()&&!(document.getElementById('targetRole')?.value||'').trim()){if(st){st.textContent='Add the role you\u2019re applying for (or a target role in the ATS tab) so the letter can be tailored.';st.className='ats-ai-status err';}return;}
  if(f.paragraphs.some(p=>p.trim())&&!confirm('Replace your current letter text with a fresh AI draft?'))return;
  cviSetKey(key);
  if(btn)btn.disabled=true;
  if(st){st.textContent='Asking Gemini\u2026';st.className='ats-ai-status';}
  try{
    const {data}=await cviCallGemini(key,cviGetModel(),letterAiParts(),m=>{if(st)st.textContent=m;},{schema:LETTER_AI_SCHEMA,temperature:0.7,maxOutputTokens:1400});
    const p1=String(data.p1||'').trim(),p2=String(data.p2||'').trim(),p3=String(data.p3||'').trim(),p4=String(data.p4||'').trim();
    if(!p1&&!p2&&!p3&&!p4)throw new Error('Gemini returned an empty letter \u2014 try again.');
    setLetterParagraphs([p1,p2,p3,p4]);
    renderLetter();
    setActiveDoc('letter');
    scaleCVToFit();
    showToast('Cover letter drafted \u2014 tweak any [placeholders]');
    if(st){st.textContent='Gemini finished — edit freely below, it\u2019s your letter.';st.className='ats-ai-status ok';}
  }catch(e){
    /* AI is the backup — when Gemini fails (quota, 503, offline, bad key) the
       deterministic engine writes the letter so the user is never left empty-handed */
    const msg=(e&&e.message)||'Gemini request failed';
    const parts=draftLetter({quiet:true,fallbackMsg:'Gemini couldn\u2019t write it ('+msg+') \u2014 the instant letter was drafted from your CV instead. Edit it below, or try Gemini again in a minute.'});
    if(!parts&&st){st.textContent=msg+' \u2014 and the CV is too empty to draft from. Add experience, skills or a summary first.';st.className='ats-ai-status err';}
  }finally{
    if(btn)btn.disabled=false;
  }
}
