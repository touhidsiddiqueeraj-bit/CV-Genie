/* UI utilities: toasts, animated modal close, tab ink, page-swap animation,
 * theme toggle, input sanitation. Deliberately imports no feature module. */

import { currentColor } from './app-state.js';

export function toggleDarkMode(){const dark=document.documentElement.classList.toggle('dark');localStorage.setItem('cvGenieDarkMode',dark);updateDarkBtn();}
export function updateDarkBtn(){const b=document.getElementById('darkBtn');if(!b)return;b.innerHTML=document.documentElement.classList.contains('dark')?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';}
export function sanitizeInput(el){el.value=el.value.replace(/<[^>]*>/g,'');}
export function validateEmail(el){el.classList.toggle('invalid',el.value.trim()&&!/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(el.value));}
export function showToast(m){const others=document.querySelectorAll('.toast');const t=document.createElement('div');t.className='toast';t.textContent=m;if(others.length)t.style.bottom=(84+others.length*46)+'px';document.body.appendChild(t);setTimeout(()=>t.remove(),2700);}
/* sliding ink bar under the active tab — pure decoration, tabs work without it */
export function positionTabInk(){const ink=document.getElementById('tabInk');if(!ink)return;const btn=document.querySelector('.smart-tab-btn.active');if(!btn){ink.classList.remove('ready');return;}ink.style.width=btn.offsetWidth+'px';ink.style.transform='translateX('+btn.offsetLeft+'px)';ink.classList.add('ready');}
/* one-shot page-swap animation (template change / CV↔letter toggle) */
export function pageAnim(el){if(!el)return;el.classList.remove('page-anim');void el.offsetWidth;el.classList.add('page-anim');clearTimeout(el._pageAnimT);el._pageAnimT=setTimeout(()=>el.classList.remove('page-anim'),450);}
/* animated modal close: fade the overlay + settle the dialog, then hide */
export function uiAnimateClose(id){const m=document.getElementById(id);if(!m||m.style.display==='none'||m.classList.contains('closing'))return;m.classList.add('closing');setTimeout(()=>{m.style.display='none';m.classList.remove('closing');},180);}

export function updateCharCount(){const len=document.getElementById('summary')?.value.length||0;const el=document.getElementById('summaryCount');if(!el)return;el.textContent=len+'/300';el.style.color=len>=280?'var(--danger)':len>=220?'var(--warning)':'var(--text-tertiary)';}

