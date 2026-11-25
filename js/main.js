/* Composition root: boot sequence, cross-feature dispatchers (tab
 * switching, active-document toggle), keyboard shortcuts, install prompt
 * and service-worker registration. The only module index.html loads. */

import './globals.js';

import { applyActiveDoc } from './app-state.js';
import { closeAtsTextView, runATSAnalysis } from './ats.js';
import { applyPreviewMode, mobileNav } from './carousel.js';
import { closeCvImport } from './cv-import.js';
import { closeExportModal } from './export.js';
import { closeConfirmDialog, closePhotoEditor, renderPhotoControls, renderSkillCloud } from './form.js';
import { cviGetKey } from './gemini.js';
import { renderLetter, setLetterParagraphs, updateLetterPreview } from './letter.js';
import { scaleCVToFit } from './preview.js';
import { getState, loadSaved, restoreState } from './state.js';
import { pageAnim, positionTabInk, showToast, updateDarkBtn } from './ui.js';
import { renderVersionSlots } from './versions.js';


/* ── cross-module wiring that belongs to the composition root ────────── */

/* undo/redo snapshot the whole app state — inject the providers so
   history.js stays import-free (no cycles, easy to reason about) */
bindHistory({ getState, restoreState });

/* main.js's own public surface (its handlers are wired into the markup);
   every other module reaches the page through js/globals.js */
Object.assign(window, { switchTab, setActiveDoc, installApp });
pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export function switchTab(tab,btn){document.querySelectorAll('.smart-tab-btn').forEach(t=>t.classList.remove('active'));if(btn){btn.classList.add('active');}else{const b=Array.from(document.querySelectorAll('.smart-tab-btn')).find(b=>(b.getAttribute('onclick')||'').includes("'"+tab+"'"));if(b)b.classList.add('active');}document.querySelectorAll('.tab-content').forEach(c=>c.style.display='none');const el=document.getElementById('tab-'+tab);if(el){el.style.display='block';el.classList.remove('tab-anim');void el.offsetWidth;el.classList.add('tab-anim');}positionTabInk();if(tab==='ats')runATSAnalysis();if(tab==='content')renderSkillCloud();if(tab==='tools')renderVersionSlots();if(tab==='letter')renderLetter();}
export function setActiveDoc(doc){
    applyActiveDoc(doc);
    document.getElementById('docToggleCv').classList.toggle('active',doc==='cv');
    document.getElementById('docToggleLetter').classList.toggle('active',doc==='letter');
    document.getElementById('cvPreview').style.display=doc==='cv'?'':'none';
    document.getElementById('clPreview').style.display=doc==='letter'?'':'none';
    applyPreviewMode();
    updateLetterPreview();
    scaleCVToFit();
    pageAnim(doc==='letter'?document.getElementById('clPreview'):document.getElementById('cvPreview'));
}
document.addEventListener('keydown',e=>{const tag=document.activeElement?.tagName;const isInput=tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT';if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();}if((e.ctrlKey||e.metaKey)&&e.key==='z'&&!isInput){e.preventDefault();undo();}if((e.ctrlKey||e.metaKey)&&e.key==='y'&&!isInput){e.preventDefault();redo();}if(e.key==='Escape'){const open=[...document.querySelectorAll('.confirm-overlay,.modal-overlay')].filter(o=>o.style.display!=='none');if(open.length){const top=open.sort((a,b)=>(+getComputedStyle(b).zIndex||0)-(+getComputedStyle(a).zIndex||0))[0];const fn={confirmDialog:closeConfirmDialog,photoCropperModal:closePhotoEditor,atsTextModal:closeAtsTextView,exportModal:closeExportModal,cvImportModal:closeCvImport}[top.id];if(fn)fn();}}});
updateDarkBtn();
renderPhotoControls();
setLetterParagraphs([]); /* default four editable paragraph slots (clP1..clP4) */
loadSaved();
/* prefill the Gemini key inputs from storage (same key powers import, ATS coach and letter writer) */
try{const _gk=cviGetKey();if(_gk){const _ak=document.getElementById('atsAiKey');if(_ak&&!_ak.value)_ak.value=_gk;const _lk=document.getElementById('clAiKey');if(_lk&&!_lk.value)_lk.value=_gk;}}catch(e){}
/* On mobile, start in Edit mode — form visible, the floating Preview pill is
   the gateway to the CV viewpoint (3D carousel). mobileNav('edit') also arms it. */
if(window.innerWidth<=900){
  mobileNav('edit');
}
applyPreviewMode();

/* ── Motion polish (v2.5): arm the tab ink bar and retire the boot choreography ── */
requestAnimationFrame(positionTabInk);
window.addEventListener('load',()=>requestAnimationFrame(positionTabInk));
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>requestAnimationFrame(positionTabInk)).catch(()=>{});
let _inkResizeT=null;
window.addEventListener('resize',()=>{clearTimeout(_inkResizeT);_inkResizeT=setTimeout(positionTabInk,120);});
setTimeout(()=>document.documentElement.classList.remove('boot'),1400);

/* ── PWA: install prompt + service worker (offline app) ───────────── */
let deferredInstallPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();deferredInstallPrompt=e;
  const b=document.getElementById('installBtn');if(b)b.style.display='';
});
window.addEventListener('appinstalled',()=>{
  deferredInstallPrompt=null;
  const b=document.getElementById('installBtn');if(b)b.style.display='none';
  showToast('CV Genie installed — it now works offline');
});
export function installApp(){
  if(!deferredInstallPrompt)return;
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.then(()=>{
    deferredInstallPrompt=null;
    const b=document.getElementById('installBtn');if(b)b.style.display='none';
  }).catch(()=>{});
}
/* Register the service worker on secure contexts (GitHub Pages / localhost).
   127.0.0.1 is included so local dev gets the same offline behaviour. */
if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='127.0.0.1'||location.hostname==='localhost')){
  window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(()=>{});});
}
