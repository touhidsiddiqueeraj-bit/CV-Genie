/* DOM → data collectors. Pure reads of the form; the single source that
 * preview, exports, the ATS engine and the letter writer all consume. */

import { photoData, photoShape, photoSize, sectionOrder, skillLevels } from './app-state.js';
import { updateCharCount } from './ui.js';

export function getExperiences(){return Array.from(document.querySelectorAll('#experienceList .dynamic-item')).map(i=>({title:i.querySelectorAll('input')[0]?.value||'',company:i.querySelectorAll('input')[1]?.value||'',dates:i.querySelectorAll('input')[2]?.value||'',description:i.querySelector('textarea')?.value||''})).filter(e=>e.title.trim()||e.company.trim());}
export function getEducation(){return Array.from(document.querySelectorAll('#educationList .dynamic-item')).map(i=>({degree:i.querySelectorAll('input')[0]?.value||'',institution:i.querySelectorAll('input')[1]?.value||'',year:i.querySelectorAll('input')[2]?.value||''})).filter(e=>e.degree.trim()||e.institution.trim());}
export function getLanguages(){return Array.from(document.querySelectorAll('#languageList .dynamic-item')).map(i=>({language:i.querySelector('input')?.value||'',level:i.querySelector('select')?.value||''})).filter(l=>l.language.trim());}
export function getPublications(){return Array.from(document.querySelectorAll('#publicationList .dynamic-item')).map(i=>({title:i.querySelectorAll('input')[0]?.value||'',venue:i.querySelectorAll('input')[1]?.value||'',dates:i.querySelectorAll('input')[2]?.value||'',status:i.querySelectorAll('input')[3]?.value||'',link:i.querySelectorAll('input')[4]?.value||''})).filter(p=>p.title.trim());}
export function getProjects(){return Array.from(document.querySelectorAll('#projectList .dynamic-item')).map(i=>({name:i.querySelectorAll('input')[0]?.value||'',description:i.querySelectorAll('input')[1]?.value||'',link:i.querySelectorAll('input')[2]?.value||''})).filter(p=>p.name.trim());}
export function getVolunteering(){return Array.from(document.querySelectorAll('#volunteeringList .dynamic-item')).map(i=>({organization:i.querySelectorAll('input')[0]?.value||'',role:i.querySelectorAll('input')[1]?.value||'',description:i.querySelector('textarea')?.value||''})).filter(v=>v.organization.trim()||v.role.trim());}
export function collectPreviewData(){
    const name=document.getElementById('fullName')?.value||'Your Name';
    const title=document.getElementById('title')?.value||'';
    const email=document.getElementById('email')?.value||'';
    const phone=document.getElementById('phone')?.value||'';
    const linkedin=document.getElementById('linkedin')?.value||'';
    const location=document.getElementById('location')?.value||'';
    const cs=[email,phone,linkedin,location].filter(Boolean).join(' | ');
    const summary=document.getElementById('summary')?.value||'',skills=document.getElementById('skills')?.value||'';
    const exp=getExperiences(),edu=getEducation(),langs=getLanguages();
    const pubs=getPublications(),projs=getProjects(),vols=getVolunteering();
    const interests=document.getElementById('interests')?.value||'';
    updateCharCount();
    const ph=photoData?`<img src="${photoData}" class="cv-photo ph-${photoShape} ph-${photoSize}" alt="Profile photo">`:'';
    const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const eH=exp.map(e=>`<div class="cv-item"><div class="cv-item-header"><span>${esc(e.title)}</span><span>${esc(e.dates)}</span></div><div class="cv-item-sub">${esc(e.company)}</div><p>${esc(e.description)}</p></div>`).join('');
    const dH=edu.map(e=>`<div class="cv-item"><div class="cv-item-header"><span>${esc(e.degree)}</span><span>${esc(e.year)}</span></div><div class="cv-item-sub">${esc(e.institution)}</div></div>`).join('');
    const langLines=langs.map(l=>`<div class="cv-lang-line"><span>${esc(l.language)}</span><span class="lvl">${esc(l.level==='Native'?'Native':(l.level||'').toUpperCase())}</span></div>`).join('');
    const pubH=pubs.map(p=>`<div class="cv-item"><div class="cv-item-header"><span>${esc(p.title)}</span><span>${esc(p.dates)}</span></div>${p.venue?`<div class="cv-item-sub">${esc(p.venue)}</div>`:''}${p.status?`<div class="cv-item-sub">${esc(p.status)}</div>`:''}${p.link?`<div class="cv-item-sub"><a href="${esc(p.link)}" target="_blank" rel="noopener">${esc(p.link)}</a></div>`:''}</div>`).join('');
    const projH=projs.map(p=>`<div class="cv-item"><div class="cv-item-header"><span>${esc(p.name)}</span></div>${p.description?`<div class="cv-item-sub">${esc(p.description)}</div>`:''}${p.link?`<div class="cv-item-sub"><a href="${esc(p.link)}" target="_blank" rel="noopener">${esc(p.link)}</a></div>`:''}</div>`).join('');
    const volH=vols.map(v=>`<div class="cv-item"><div class="cv-item-header"><span>${esc(v.organization)}</span></div>${v.role?`<div class="cv-item-sub">${esc(v.role)}</div>`:''}${v.description?`<p>${esc(v.description)}</p>`:''}</div>`).join('');
    const lH=langLines?`<div class="cv-section"><h2>Languages</h2>${langLines}</div>`:'';
    const skillList=skills.split(',').map(s=>s.trim()).filter(Boolean);
    /* v2.10: per-skill levels (1–5) keyed by the exact skill string — rating
     * designs (Scholar squares, Primo bars) read them; unset = 0 (designs
     * substitute their own default). */
    const skillLv=skillList.reduce((m,s)=>{m[s]=Math.min(5,Math.max(0,parseInt(skillLevels[s],10)||0));return m;},{});
    const contactLines=[email,phone,linkedin,location].filter(Boolean).map(c=>`<div>${esc(c)}</div>`).join('');
    const sec={};
    if(summary.trim())sec.summary=`<div class="cv-section"><h2>Professional Summary</h2><p>${esc(summary)}</p></div>`;
    if(skills.trim())sec.skills=`<div class="cv-section"><h2>Skills</h2><p>${esc(skills)}</p></div>`;
    if(exp.length>0)sec.experience=`<div class="cv-section"><h2>Experience</h2>${eH}</div>`;
    if(edu.length>0)sec.education=`<div class="cv-section"><h2>Education</h2>${dH}</div>`;
    if(langLines)sec.languages=lH;
    if(pubs.length)sec.publications=`<div class="cv-section"><h2>Publications</h2>${pubH}</div>`;
    if(projs.length)sec.projects=`<div class="cv-section"><h2>Projects</h2>${projH}</div>`;
    if(vols.length)sec.volunteering=`<div class="cv-section"><h2>Volunteering</h2>${volH}</div>`;
    if(interests.trim())sec.interests=`<div class="cv-section"><h2>Interests</h2><p>${esc(interests)}</p></div>`;
    const orderedContent=sectionOrder.filter(k=>sec[k]).map(k=>sec[k]).join('');
    return{name,title,email,phone,linkedin,location,cs,summary,skills,exp,edu,langs,interests,pubs,projs,vols,ph,esc,eH,dH,langLines,lH,pubH,projH,volH,skillList,skillLv,contactLines,orderedContent};
}
