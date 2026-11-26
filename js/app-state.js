/* app-state */

/* Shared application state.
 *
 * The handful of values several feature modules both read and write live here
 * as exported live bindings: modules READ them via normal ES-module imports
 * and WRITE them through the small setters below (imported bindings are
 * read-only — which makes every mutation greppable:
 *   grep "setCurrentTemplate(" js/
 * lists every place a template switch can originate).
 *
 * Module-private state (undo stacks, debounce timers, carousel position…)
 * deliberately stays inside its owning module — see each file's header. */

export let currentTemplate='classic';
export let currentColor='#2563eb';
export let currentFontPair=0;
export let photoData=null;
export let photoShape='circle';
export let photoSize='md';
/* v2.10: per-skill proficiency levels (1–5), consumed by the rating designs
 * (Scholar squares, Primo bars). Keys are the exact skill strings. */
export let skillLevels={};
/* False until the user explicitly picks a shape — while false, each template
 * may impose its natural default (Scholar → square, most others → circle). */
export let photoShapeCustom=false;
export let activeDoc='cv'; /* 'cv' | 'letter' — which document the preview & exports target */
export let sectionOrder=['summary','skills','experience','education','publications','projects','volunteering','interests','languages'];

export const setCurrentTemplate=v=>{currentTemplate=v;};
export const setCurrentColor=v=>{currentColor=v;};
export const setCurrentFontPair=v=>{currentFontPair=v;};
export const setPhotoData=v=>{photoData=v;};
export const applyPhotoShape=v=>{photoShape=v;};
export const applyPhotoSize=v=>{photoSize=v;};
export const setSkillLevels=v=>{skillLevels=v&&typeof v==='object'?v:{};};
export const setPhotoShapeCustom=v=>{photoShapeCustom=!!v;};
export const applyActiveDoc=v=>{activeDoc=v;};
export const setSectionOrder=v=>{sectionOrder=v;};

/* Derived accent tints as rgba() strings. The pastel / cascade / functional
 * designs use them for soft fills; rgba (rather than color-mix) keeps the
 * instant-PDF renderer (html2canvas) able to parse the colours. */
export function cvColorAlpha(a){
  const c=String(currentColor||'').replace('#','');
  const n=/^[0-9a-fA-F]{6}$/.test(c)?parseInt(c,16):0x2563eb;
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}
