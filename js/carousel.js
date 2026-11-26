/* The 3D template carousel — the default CV viewpoint — template
 * switching/selection, the mobile edit/preview navigation and the
 * gallery↔document preview-mode switch. */

import { activeDoc, currentColor, currentTemplate, setCurrentTemplate } from './app-state.js';
import { TEMPLATES, TEMPLATE_META, THUMB_WIRES } from './config.js';
import { collectPreviewData } from './cvdata.js';
import { applyTemplatePhotoDefaults } from './form.js';
import { scaleCVToFit, templateHtml } from './preview.js';
import { _updatePreviewNow } from './render.js';
import { pageAnim } from './ui.js';

export function mobileNav(mode){
  const fp=document.getElementById('formPanel');
  const nav=document.getElementById('mobileNav');
  const backBtn=document.getElementById('editBackBtn');
  const ptb=document.getElementById('previewToolbar');
  document.querySelectorAll('.mobile-nav-btn').forEach(b=>b.classList.remove('active'));
  if(mode==='preview'){
    fp.classList.remove('active');
    nav.classList.remove('nav-hidden');
    if(backBtn)backBtn.classList.remove('show');
    if(ptb)ptb.classList.add('visible');
    document.getElementById('mnav-preview').classList.add('active');
    applyPreviewMode();
    requestAnimationFrame(scaleCVToFit);
    setTimeout(scaleCVToFit,150);
  } else {
    fp.classList.add('active');
    nav.classList.add('nav-hidden');
    if(backBtn)backBtn.classList.add('show');
    if(ptb)ptb.classList.remove('visible');
    applyPreviewMode();
    switchTab('edit',null);
    document.getElementById('mnav-edit').classList.add('active');
  }
}
export function changeTemplate(t){setCurrentTemplate(t);applyTemplatePhotoDefaults(t);document.getElementById('cvPreview').className='cv-preview cv-'+t;document.getElementById('templateSelect').value=t;_updatePreviewNow();updateTemplateGallerySelection();pageAnim(document.getElementById('cvPreview'));}
/* ── Template carousel: 3D live-rendered pages — the default CV view ──
   The active design sits at the centre; neighbours flank it on both sides.
   Cards are real renders of the user's own CV via templateHtml(), so every
   design is previewed with live data (wireframe fallback if a render throws).
   previewMode: 'gallery' (3D carousel, default) | 'document' (full page).
   The carousel is the main CV viewpoint; letter mode always shows the document. */
let tpl3dIndex=0,tpl3dDirty=true,tpl3dRefreshT=null,tpl3dApplyT=null;
export let previewMode='gallery';
export function carouselShown(){
  if(previewMode!=='gallery'||activeDoc!=='cv')return false;
  /* on mobile the edit form overlays the panel — the carousel is not visible then,
     so skip background rebuilds while the user types. (The 'active' class is
     hardcoded in the markup but only overlays at <=900px.) */
  if(window.innerWidth<=900){
    const fp=document.getElementById('formPanel');
    if(fp&&fp.classList.contains('active'))return false;
  }
  return true;
}
export function applyPreviewMode(){
  const panel=document.getElementById('previewPanel');
  if(!panel)return;
  const on=carouselShown();
  panel.classList.toggle('show-gallery',on);
  const btn=document.getElementById('previewModeBtn');
  if(btn){
    btn.classList.toggle('mode-on',on);
    btn.title=on?'Show full document view':'Show template carousel';
    btn.setAttribute('aria-label',btn.title);
    btn.innerHTML=on
      ?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'
      :'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>';
  }
  if(on){tpl3dBuild(tpl3dDirty||!document.getElementById('tpl3dTrack').children.length);tpl3dDirty=false;}
  scaleCVToFit();
}
export function setPreviewMode(m){previewMode=m;applyPreviewMode();}
export function togglePreviewMode(){setPreviewMode(previewMode==='gallery'?'document':'gallery');}
export function tpl3dScheduleRefresh(){
  if(!carouselShown()){tpl3dDirty=true;return;}
  clearTimeout(tpl3dRefreshT);
  /* keepIndex: a data refresh must not yank the ring back — the user may be
     mid-rotation with the auto-apply debounce still pending */
  tpl3dRefreshT=setTimeout(()=>{tpl3dBuild(true,true);tpl3dDirty=false;},500);
}
export function tpl3dAutoApply(){
  clearTimeout(tpl3dApplyT);
  tpl3dApplyT=setTimeout(()=>{const t=TEMPLATES[tpl3dIndex];if(t&&t!==currentTemplate)changeTemplate(t);},350);
}
export function tpl3dBuild(rebuildHtml,keepIndex){
  const track=document.getElementById('tpl3dTrack');
  if(!track)return;
  if(rebuildHtml||!track.children.length){
    const D=collectPreviewData();
    track.innerHTML=TEMPLATES.map(t=>{
      let page;
      try{page=`<div class="tpl3d-scale"><div class="cv-preview cv-${t}">${templateHtml(t,D)}</div></div>`;}
      catch(e){page=`<div class="tpl3d-scale tpl3d-wire"><div class="tw">${THUMB_WIRES[t]}</div></div>`;}
      return `<div class="tpl3d-card" data-tpl="${t}" onclick="tpl3dCardClick(this)"><span class="tpl3d-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Active</span><div class="tpl3d-page">${page}</div></div>`;
    }).join('');
  }
  if(!keepIndex){const i=TEMPLATES.indexOf(currentTemplate);tpl3dIndex=i<0?0:i;}
  tpl3dLayout(true);
}
export function tpl3dLayout(instant){
  const stage=document.getElementById('tpl3dStage');
  if(!stage)return;
  const n=TEMPLATES.length,half=Math.floor(n/2);
  const W=stage.clientWidth||600,H=stage.clientHeight||420;
  const AR=297/210; /* A4 portrait aspect */
  /* fill ALL the free space: the card is capped by height (page fits the stage)
     and by a width share that keeps the flanking pages inside the stage.
     phones get a wider share — their stage is narrow and tall */
  const wShare=W<560?0.46:0.40;
  let w=Math.floor(Math.min(W*wShare,(H-26)/AR,470));
  w=Math.max(136,Math.min(w,W-32));
  const h=Math.round(w*AR);
  stage.style.setProperty('--tpl-w',w+'px');
  stage.style.setProperty('--tpl-h',h+'px');
  stage.style.setProperty('--tpl-s',(w/794).toFixed(4));
  /* perspective and depth scale with the card so the 3D look stays balanced at any size */
  stage.style.perspective=Math.round(Math.max(900,w*5.6))+'px';
  const zC=Math.round(w*0.30),z1=Math.round(w*0.66),z2=Math.round(w*1.5);
  const cards=document.getElementById('tpl3dTrack').children;
  for(let i=0;i<cards.length;i++){
    let off=i-tpl3dIndex;
    if(off>half)off-=n;else if(off<-half)off+=n; /* circular ring */
    const card=cards[i],a=Math.abs(off);
    card.classList.toggle('is-center',off===0);
    card.classList.toggle('is-applied',TEMPLATES[i]===currentTemplate);
    card.classList.toggle('tpl3d-off',a>2);
    if(instant){card.style.transition='none';requestAnimationFrame(()=>{card.style.transition='';});}
    if(a>2){card.style.opacity='0';card.style.visibility='hidden';card.style.zIndex='1';continue;}
    card.style.visibility='visible';
    card.style.zIndex=String(10-a);
    if(off===0){
      card.style.transform=`translateX(0px) translateZ(${zC}px) rotateY(0deg) scale(1)`;
      card.style.opacity='1';
      card.style.filter='none';
    }else{
      const dir=off<0?-1:1;
      const x=dir*(a===1?w*0.94:w*1.42);
      const z=a===1?-z1:-z2;
      const rot=dir*(a===1?42:52)*-1;
      const sc=a===1?0.82:0.60;
      card.style.transform=`translateX(${x}px) translateZ(${z}px) rotateY(${rot}deg) scale(${sc})`;
      card.style.opacity=a===1?'0.92':'0.55';
      card.style.filter=a===1?'brightness(0.93)':'brightness(0.88)';
    }
  }
  const t=TEMPLATES[tpl3dIndex];
  const meta=TEMPLATE_META[t]||{name:t,desc:''};
  const cnt=document.getElementById('tpl3dCount');
  if(cnt)cnt.textContent=(tpl3dIndex+1)+' / '+n;
  const nm=document.getElementById('tpl3dName');
  if(nm)nm.textContent=meta.name;
  const ds=document.getElementById('tpl3dDesc');
  if(ds)ds.textContent=meta.desc;
}
export function tpl3dPrev(){const n=TEMPLATES.length;tpl3dIndex=(tpl3dIndex-1+n)%n;tpl3dLayout(false);tpl3dAutoApply();}
export function tpl3dNext(){tpl3dIndex=(tpl3dIndex+1)%TEMPLATES.length;tpl3dLayout(false);tpl3dAutoApply();}
export function tpl3dCardClick(card){
  const idx=TEMPLATES.indexOf(card.dataset.tpl);
  if(idx<0)return;
  if(idx===tpl3dIndex){setPreviewMode('document');return;}
  tpl3dIndex=idx;tpl3dLayout(false);tpl3dAutoApply();
}
export function updateTemplateGallerySelection(){
  if(!carouselShown()){tpl3dDirty=true;return;}
  const i=TEMPLATES.indexOf(currentTemplate);
  if(i>=0)tpl3dIndex=i; /* explicit selection (dropdown, undo, import) re-centres the ring */
  tpl3dLayout(false);
}
/* swipe / drag + keyboard */
(function(){
  let sx=null,moved=false;
  const stage=document.getElementById('tpl3dStage');
  if(!stage)return;
  stage.addEventListener('pointerdown',e=>{if(e.target.closest('.tpl3d-nav'))return;sx=e.clientX;moved=false;});
  stage.addEventListener('pointermove',e=>{if(sx===null)return;if(Math.abs(e.clientX-sx)>8)moved=true;});
  const end=e=>{
    if(sx===null)return;
    const dx=e.clientX-sx;sx=null;
    if(!moved||Math.abs(dx)<36)return;
    if(dx<0)tpl3dNext();else tpl3dPrev();
  };
  stage.addEventListener('pointerup',end);
  stage.addEventListener('pointercancel',()=>{sx=null;});
  window.addEventListener('resize',()=>{if(carouselShown())tpl3dLayout(false);else applyPreviewMode();});
  document.addEventListener('keydown',e=>{
    if(!carouselShown())return;
    const tag=document.activeElement&&document.activeElement.tagName;
    if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
    if(e.key==='ArrowLeft'){e.preventDefault();tpl3dPrev();}
    else if(e.key==='ArrowRight'){e.preventDefault();tpl3dNext();}
  });
})();

/* rebuild the live cards after every preview update
   (render.js dispatches this after every preview update) */
window.addEventListener('cvgenie:preview-updated',()=>tpl3dScheduleRefresh());
