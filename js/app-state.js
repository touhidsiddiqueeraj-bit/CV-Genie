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
export let activeDoc='cv'; /* 'cv' | 'letter' — which document the preview & exports target */
export let sectionOrder=['summary','skills','experience','education','languages'];

export const setCurrentTemplate=v=>{currentTemplate=v;};
export const setCurrentColor=v=>{currentColor=v;};
export const setCurrentFontPair=v=>{currentFontPair=v;};
export const setPhotoData=v=>{photoData=v;};
export const applyPhotoShape=v=>{photoShape=v;};
export const applyPhotoSize=v=>{photoSize=v;};
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
