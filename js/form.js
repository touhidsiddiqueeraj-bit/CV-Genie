/* The editor form: dynamic experience / education / language rows,
 * drag-and-drop ordering, collapsible sections, skill cloud, design controls
 * (colour, font pairing), the control pickers built by buildAll(), and the
 * Cropper-powered photo editor. */

import { applyPhotoShape, applyPhotoSize, currentColor, currentFontPair, currentTemplate, photoData, photoShape, photoShapeCustom, photoSize, sectionOrder, setCurrentColor, setCurrentFontPair, setPhotoData, setPhotoShapeCustom, setSkillLevels, skillLevels, setSectionOrder } from './app-state.js';
import { COLORS, FONT_PAIRS, LANG_LEVELS, SKILL_CATEGORIES, SUMMARY_TEMPLATES, TEMPLATES, TEMPLATE_META } from './config.js';
import { updatePreview } from './render.js';
import { sanitizeInput, showToast, uiAnimateClose, updateCharCount } from './ui.js';

let pendingSummaryIdx=-1;
let cropperInstance=null;
const selectedSkills=new Set();

/* ── Skill proficiency sliders (v2.10) ──
 * One row per comma-separated skill in the Skills textarea: a 1–5 range
 * slider + live badge. Levels feed the rating designs (Scholar squares,
 * Primo bars) and persist with the document state. Rebuilding the rows on
 * textarea edits is fine — slider drags only update the badge in place. */
export function renderSkillLevels(){
  const box=document.getElementById('skillLevels');
  if(!box)return;
  const skills=(document.getElementById('skills')?.value||'').split(',').map(s=>s.trim()).filter(Boolean);
  if(!skills.length){box.innerHTML='';box.classList.remove('has-rows');return;}
  box.classList.add('has-rows');
  box.innerHTML=skills.map(s=>{
    const lv=Math.min(5,Math.max(0,parseInt(skillLevels[s],10)||0));
    return `<div class="skill-level-row" data-skill="${s.replace(/"/g,'&quot;')}"><span class="skill-level-name" title="${s.replace(/"/g,'&quot;')}">${s.replace(/</g,'&lt;')}</span><span class="skill-level-ctl"><input type="range" min="1" max="5" step="1" value="${lv||4}" aria-label="${s.replace(/"/g,'&quot;')} level"><span class="skill-level-badge">${lv||4}/5</span></span></div>`;
  }).join('');
  box.querySelectorAll('.skill-level-row input[type=range]').forEach(r=>{
    r.addEventListener('input',()=>{
      const row=r.closest('.skill-level-row');
      const sk=row?.dataset.skill||'';
      const v=parseInt(r.value,10)||1;
      row.querySelector('.skill-level-badge').textContent=v+'/5';
      const next={...skillLevels,[sk]:v};
      setSkillLevels(next);
      updatePreview();
    });
  });
}
export function setSkillLevelInput(){/* slider events are wired directly in renderSkillLevels; kept for API symmetry */}
export function buildAll(){
    const colorHtml=COLORS.map(c=>`<span class="color-dot${c===currentColor?' active':''}" style="background:${c}" onclick="setColor('${c}',this)" title="${c}"></span>`).join('');
    document.getElementById('colorPresets').innerHTML=colorHtml;
    if(document.getElementById('colorPresetsPreview'))document.getElementById('colorPresetsPreview').innerHTML=colorHtml;
    document.getElementById('templateSelect').innerHTML=TEMPLATES.map(t=>`<option value="${t}"${t===currentTemplate?' selected':''}>${TEMPLATE_META[t].name}</option>`).join('');
    const fontHtml=FONT_PAIRS.map((fp,i)=>`<button class="font-pair-btn${i===currentFontPair?' selected':''}" onclick="setFontPair(${i},this)">${fp.name}</button>`).join('');
    document.getElementById('fontPairSelector').innerHTML=fontHtml;
    if(document.getElementById('fontPairSelectorPreview'))document.getElementById('fontPairSelectorPreview').innerHTML=fontHtml;
    document.getElementById('summaryLibrary').innerHTML=SUMMARY_TEMPLATES.map((st,i)=>`<button class="summary-template-btn" onclick="showSummaryConfirm(${i})">${st.label}</button>`).join('');
    const catSel=document.getElementById('skillCategory');
    if(catSel&&!catSel.options.length)catSel.innerHTML=Object.entries(SKILL_CATEGORIES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('');
}
export function showSummaryConfirm(idx){pendingSummaryIdx=idx;document.getElementById('confirmPreview').textContent='"'+SUMMARY_TEMPLATES[idx].text.substring(0,80)+'…" will replace your current summary.';document.getElementById('confirmDialog').style.display='flex';}
export function closeConfirmDialog(){uiAnimateClose('confirmDialog');pendingSummaryIdx=-1;}
document.getElementById('confirmApplyBtn').addEventListener('click',function(){if(pendingSummaryIdx<0)return;document.getElementById('summary').value=SUMMARY_TEMPLATES[pendingSummaryIdx].text;updatePreview();updateCharCount();document.getElementById('confirmDialog').style.display='none';showToast('Summary applied');pendingSummaryIdx=-1;});
export function renderSkillCloud(){const cat=SKILL_CATEGORIES[document.getElementById('skillCategory').value];document.getElementById('skillCloud').innerHTML=(cat?cat.skills:[]).map(s=>`<span class="skill-chip${selectedSkills.has(s)?' selected':''}" onclick="toggleSkill('${s}',this)">${s}</span>`).join('');}
export function toggleSkill(s,el){if(selectedSkills.has(s)){selectedSkills.delete(s);el.classList.remove('selected');}else{selectedSkills.add(s);el.classList.add('selected');}}
export function addSelectedSkills(){if(selectedSkills.size===0)return;const curSkills=document.getElementById('skills').value;const existing=curSkills?curSkills.split(',').map(s=>s.trim()).filter(s=>s.length>0):[];const newSkills=Array.from(selectedSkills).filter(s=>!existing.some(e=>e.toLowerCase()===s.toLowerCase()));if(newSkills.length===0){showToast('Skills already added');selectedSkills.clear();renderSkillCloud();return;}document.getElementById('skills').value=existing.length?existing.join(', ')+', '+newSkills.join(', '):newSkills.join(', ');selectedSkills.clear();renderSkillCloud();renderSkillLevels();updatePreview();showToast(newSkills.length+' skill(s) added');}
export function setFontPair(i,btn){setCurrentFontPair(i);document.querySelectorAll('.font-pair-btn').forEach(b=>b.classList.remove('selected'));document.querySelectorAll('.font-pair-selector').forEach(sel=>{const b=sel.querySelector(`.font-pair-btn:nth-child(${i+1})`);if(b)b.classList.add('selected');});const fp=FONT_PAIRS[i];document.documentElement.style.setProperty('--cv-font-heading',fp.heading);document.documentElement.style.setProperty('--cv-font-body',fp.body);}
export function initSectionSortable(){const c=document.getElementById('formSectionsContainer');if(!c)return;if(c._sortable)c._sortable.destroy();c._sortable=new Sortable(c,{animation:200,handle:'.section-drag-handle',draggable:'.section-draggable',onEnd:function(){setSectionOrder(Array.from(c.querySelectorAll('.section-draggable')).map(el=>el.dataset.section));updatePreview();}});}
export function toggleSection(h){const c=h.parentElement.querySelector('.section-content');const chev=h.querySelector('.chev');if(!c)return;if(c.classList.contains('collapsed')){c.classList.remove('collapsed');if(chev)chev.classList.add('open');c.style.maxHeight=c.scrollHeight+'px';setTimeout(()=>{if(!c.classList.contains('collapsed'))c.style.maxHeight='none';},350);}else{c.style.maxHeight=c.scrollHeight+'px';requestAnimationFrame(()=>{c.classList.add('collapsed');c.style.maxHeight='0';if(chev)chev.classList.remove('open');});}}
/* ── Photo handling ── */
export function handlePhoto(e){const f=e.target.files[0];if(!f||f.size>5*1024*1024){if(f)showToast('Photo must be under 5MB');return;}const r=new FileReader();r.onload=ev=>{setPhotoData(ev.target.result);document.getElementById('photoPreview').src=photoData;document.getElementById('photoPreview').style.display='block';document.getElementById('photoPlaceholder').style.display='none';renderPhotoControls();openPhotoEditor();};r.readAsDataURL(f);}
export function renderPhotoControls(){
  const c=document.getElementById('photoControls');
  if(!c)return;
  /* v2.10: the shape/size chooser is always visible (users pick how the photo
   * will be displayed before or after importing); only Remove needs a photo. */
  c.classList.add('visible');
  c.classList.toggle('no-photo',!photoData);
  document.querySelectorAll('#photoShapeSeg button').forEach(b=>b.classList.toggle('active',b.dataset.shape===photoShape));
  document.querySelectorAll('#photoSizeSeg button').forEach(b=>b.classList.toggle('active',b.dataset.size===photoSize));
}
export function setPhotoShape(s,btn){applyPhotoShape(s);setPhotoShapeCustom(true);document.querySelectorAll('#photoShapeSeg button').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');updatePreview();}
export function setPhotoSize(s,btn){applyPhotoSize(s);document.querySelectorAll('#photoSizeSeg button').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');updatePreview();}
/* Apply a template's natural photo shape while the user hasn't picked one
 * themselves (Scholar → square; others → circle). Called on every template
 * switch and after state restore. */
export function applyTemplatePhotoDefaults(t){
  if(photoShapeCustom)return;
  const def=(t&&TEMPLATE_META[t]&&TEMPLATE_META[t].photoShape)||'circle';
  if(def!==photoShape){applyPhotoShape(def);updatePreview();}
  document.querySelectorAll('#photoShapeSeg button').forEach(b=>b.classList.toggle('active',b.dataset.shape===photoShape));
}
export function removePhoto(){setPhotoData(null);document.getElementById('photoPreview').style.display='none';document.getElementById('photoPreview').src='';document.getElementById('photoPlaceholder').style.display='block';renderPhotoControls();updatePreview();showToast('Photo removed');}
export function reorderFormSections(){const c=document.getElementById('formSectionsContainer');if(!c)return;const ex={};c.querySelectorAll('.section-draggable').forEach(el=>ex[el.dataset.section]=el);c.innerHTML='';const done=new Set();sectionOrder.forEach(k=>{if(ex[k]&&!done.has(k)){c.appendChild(ex[k]);done.add(k);}});Object.keys(ex).forEach(k=>{if(!done.has(k)){c.appendChild(ex[k]);done.add(k);if(!sectionOrder.includes(k))sectionOrder.push(k);}});}

/* ── Dynamic list builders ── */
export function addExperience(){pushUndo();addExpSilent();updatePreview();initDragDrop();}
export function addEducation(){pushUndo();addEduSilent();updatePreview();initDragDrop();}
export function addLanguage(){pushUndo();addLangSilent();updatePreview();initDragDrop();}
export function addPublication(){pushUndo();addPubSilent();updatePreview();initDragDrop();}
export function addProject(){pushUndo();addProjSilent();updatePreview();initDragDrop();}
export function addVolunteering(){pushUndo();addVolSilent();updatePreview();initDragDrop();}
export function addExpSilent(){const d=document.createElement('div');d.className='dynamic-item';d.innerHTML=`<span class="drag-handle">⋮⋮</span><button class="remove-btn" onclick="this.parentElement.remove();updatePreview()" title="Remove">×</button><div class="form-group"><label>Job title</label><input type="text" oninput="sanitizeInput(this);updatePreview()" placeholder="Senior Developer"></div><div class="form-group"><label>Company</label><input type="text" oninput="sanitizeInput(this);updatePreview()" placeholder="Tech Corp"></div><div class="form-group"><label>Dates</label><input type="text" oninput="sanitizeInput(this);updatePreview()" placeholder="2020 – Present"></div><div class="form-group"><label>Description</label><textarea oninput="sanitizeInput(this);updatePreview()" rows="2" placeholder="Led a team of 5…"></textarea></div>`;const _xl=document.getElementById('experienceList');if(!_xl)return;_xl.appendChild(d);d.classList.add('dynamic-item-new');}
export function addEduSilent(){const d=document.createElement('div');d.className='dynamic-item';d.innerHTML=`<span class="drag-handle">⋮⋮</span><button class="remove-btn" onclick="this.parentElement.remove();updatePreview()" title="Remove">×</button><div class="form-group"><label>Degree</label><input type="text" oninput="sanitizeInput(this);updatePreview()" placeholder="B.S. Computer Science"></div><div class="form-group"><label>Institution</label><input type="text" oninput="sanitizeInput(this);updatePreview()" placeholder="University"></div><div class="form-group"><label>Year</label><input type="text" oninput="sanitizeInput(this);updatePreview()" placeholder="2016 – 2020"></div>`;const _el=document.getElementById('educationList');if(!_el)return;_el.appendChild(d);d.classList.add('dynamic-item-new');}
export function addLangSilent(){const d=document.createElement('div');d.className='dynamic-item';d.innerHTML=`<span class="drag-handle">⋮⋮</span><button class="remove-btn" onclick="this.parentElement.remove();updatePreview()" title="Remove">×</button><div class="form-group" style="display:flex;gap:0.4rem;align-items:flex-end;"><div style="flex:1"><label>Language</label><input type="text" oninput="sanitizeInput(this);updatePreview()" placeholder="English"></div><div style="width:104px"><label>Level</label><select onchange="updatePreview()">${LANG_LEVELS.map(l=>`<option value="${l}">${l||'—'}</option>`).join('')}</select></div></div>`;const _ll=document.getElementById('languageList');if(!_ll)return;_ll.appendChild(d);d.classList.add('dynamic-item-new');}
export function addPubSilent(){const d=document.createElement('div');d.className='dynamic-item';d.innerHTML=`<span class="drag-handle">⋮⋮</span><button class="remove-btn" onclick="this.parentElement.remove();updatePreview()" title="Remove">×</button><div class="form-group"><label>Title</label><input type="text" oninput="sanitizeInput(this);updatePreview()" placeholder="Design and validation of a dual-microcontroller MPPT controller"></div><div class="form-group" style="display:flex;gap:0.4rem"><div style="flex:1"><label>Venue</label><input type="text" oninput="sanitizeInput(this);updatePreview()" placeholder="IJPEDS · Paper ID 25195"></div><div style="width:110px"><label>Date</label><input type="text" oninput="sanitizeInput(this);updatePreview()" placeholder="Sep 2026"></div></div><div class="form-group" style="display:flex;gap:0.4rem"><div style="flex:1"><label>Status</label><input type="text" oninput="sanitizeInput(this);updatePreview()" placeholder="Accepted, pending publication"></div><div style="flex:1"><label>Link (DOI)</label><input type="text" oninput="sanitizeInput(this);updatePreview()" placeholder="https://doi.org/…"></div></div>`;const _pl=document.getElementById('publicationList');if(!_pl)return;_pl.appendChild(d);d.classList.add('dynamic-item-new');}
export function addProjSilent(){const d=document.createElement('div');d.className='dynamic-item';d.innerHTML=`<span class="drag-handle">⋮⋮</span><button class="remove-btn" onclick="this.parentElement.remove();updatePreview()" title="Remove">×</button><div class="form-group"><label>Project name</label><input type="text" oninput="sanitizeInput(this);updatePreview()" placeholder="Pixel Lab"></div><div class="form-group"><label>Description</label><input type="text" oninput="sanitizeInput(this);updatePreview()" placeholder="An open source image editor"></div><div class="form-group"><label>Link</label><input type="text" oninput="sanitizeInput(this);updatePreview()" placeholder="https://github.com/…"></div>`;const _pj=document.getElementById('projectList');if(!_pj)return;_pj.appendChild(d);d.classList.add('dynamic-item-new');}
export function addVolSilent(){const d=document.createElement('div');d.className='dynamic-item';d.innerHTML=`<span class="drag-handle">⋮⋮</span><button class="remove-btn" onclick="this.parentElement.remove();updatePreview()" title="Remove">×</button><div class="form-group"><label>Organization</label><input type="text" oninput="sanitizeInput(this);updatePreview()" placeholder="University Social Service Club"></div><div class="form-group"><label>Role</label><input type="text" oninput="sanitizeInput(this);updatePreview()" placeholder="Joint General Secretary"></div><div class="form-group"><label>Description (optional)</label><textarea oninput="sanitizeInput(this);updatePreview()" rows="2" placeholder="What the role involved…"></textarea></div>`;const _vl=document.getElementById('volunteeringList');if(!_vl)return;_vl.appendChild(d);d.classList.add('dynamic-item-new');}
export function initDragDrop(){['experienceList','educationList','languageList','publicationList','projectList','volunteeringList'].forEach(id=>{const el=document.getElementById(id);if(!el)return;if(el._sortable)el._sortable.destroy();el._sortable=new Sortable(el,{animation:200,handle:'.drag-handle',onEnd:updatePreview});});}
export function setColor(c,el){setCurrentColor(c);document.querySelectorAll('.color-dot').forEach(d=>{d.classList.remove('active');if(d.style.background===c||d.style.backgroundColor===c)d.classList.add('active');});document.documentElement.style.setProperty('--cv-color',c);updatePreview();}
/* ── Photo editor ── */
export function openPhotoEditor(){if(!photoData){document.getElementById('photoInput').click();return;}document.getElementById('photoCropperModal').style.display='flex';document.getElementById('cropperImage').src=photoData;document.getElementById('cropperImage').style.display='block';if(cropperInstance)cropperInstance.destroy();cropperInstance=new Cropper(document.getElementById('cropperImage'),{aspectRatio:1,viewMode:1,dragMode:'move',autoCropArea:0.9});}
export function closePhotoEditor(){uiAnimateClose('photoCropperModal');if(cropperInstance){cropperInstance.destroy();cropperInstance=null;}}
export function rotatePhoto(deg){if(cropperInstance)cropperInstance.rotate(deg);}
export function applyCrop(){if(!cropperInstance)return;const c=cropperInstance.getCroppedCanvas({width:400,height:400});setPhotoData(c.toDataURL('image/jpeg',0.9));document.getElementById('photoPreview').src=photoData;document.getElementById('photoPreview').style.display='block';document.getElementById('photoPlaceholder').style.display='none';closePhotoEditor();renderPhotoControls();updatePreview();}

