/* Version history slots, share links and JSON backup in/out. */

import { currentTemplate } from './app-state.js';
import { TEMPLATE_META } from './config.js';
import { getState, restoreState } from './state.js';
import { showToast } from './ui.js';

let versionSlots=[];

/* ── Version history ── */
export function saveVersion(){const s={timestamp:new Date().toLocaleString(),state:getState(),preview:(document.getElementById('fullName')?.value||'Untitled')+' — '+TEMPLATE_META[currentTemplate].name};versionSlots.unshift(s);if(versionSlots.length>10)versionSlots.pop();try{localStorage.setItem('cvGenieVersions',JSON.stringify(versionSlots));}catch(e){}renderVersionSlots();showToast('Version saved');}
export function loadVersion(i){if(!versionSlots[i])return;restoreState(versionSlots[i].state);}
export function deleteVersion(i){versionSlots.splice(i,1);try{localStorage.setItem('cvGenieVersions',JSON.stringify(versionSlots));}catch(e){}renderVersionSlots();}
export function renderVersionSlots(){const c=document.getElementById('versionSlots');if(!c)return;c.innerHTML=versionSlots.length===0?'<p style="text-align:center;color:var(--text-tertiary);font-size:12px;grid-column:1/-1;padding:0.4rem">No versions saved yet.</p>':versionSlots.map((s,i)=>`<div class="version-slot"><div class="slot-date">${s.timestamp}</div><div class="slot-name">${s.preview||''}</div><div class="slot-actions"><button class="btn btn-sm" onclick="loadVersion(${i})">Load</button><button class="btn btn-danger btn-sm" onclick="deleteVersion(${i})">×</button></div></div>`).join('');}

/* ── Share link ── */
export function generateShareLink(){try{const c=LZString.compressToEncodedURIComponent(JSON.stringify({...getState(),v:'2.0'}));const l=location.origin+location.pathname+'?load='+c;document.getElementById('shareLinkBox').style.display='block';document.getElementById('shareLinkBox').textContent=l.length>400?l.substring(0,400)+'…':l;document.getElementById('copyShareBtn').style.display='block';document.getElementById('shareLinkBox').dataset.fullLink=l;}catch(e){}}
export function copyShareLink(){const l=document.getElementById('shareLinkBox')?.dataset?.fullLink;if(l)navigator.clipboard.writeText(l).then(()=>showToast('Link copied'));}

// ============ JSON backup / persistence ============
export function exportJSON(){const d={version:'2.0',...getState()};saveAs(new Blob([JSON.stringify(d,null,2)],{type:'application/json'}),'cv-genie-backup.json');}
export function importJSON(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{try{restoreState(JSON.parse(ev.target.result));showToast('Backup imported');}catch(ex){showToast('Invalid file');}};r.readAsText(f);}

try{const vs=localStorage.getItem('cvGenieVersions');if(vs)versionSlots=JSON.parse(vs)||[];}catch(e){}
