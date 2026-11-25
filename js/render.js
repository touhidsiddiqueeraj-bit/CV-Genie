/* Render dispatch: debounced updatePreview() → _updatePreviewNow() repaints
 * the CV, re-renders the cover letter and announces the change via
 * window 'cvgenie:preview-updated' (the ATS engine and the 3D carousel
 * subscribe — this keeps the module graph free of cycles). */

import { cvColorAlpha, currentColor, currentTemplate } from './app-state.js';
import { collectPreviewData } from './cvdata.js';
import { renderLetter } from './letter.js';
import { scaleCVToFit, templateHtml } from './preview.js';
import { updateCharCount } from './ui.js';

let debounceTimer=null; /* 200 ms edit → render debounce */

export function updatePreview(){if(debounceTimer)clearTimeout(debounceTimer);debounceTimer=setTimeout(_updatePreviewNow,200);}

export function _updatePreviewNow(){
    updateCharCount();
    document.getElementById('cvPreview').innerHTML=templateHtml(currentTemplate,collectPreviewData());
    renderLetter();
    document.documentElement.style.setProperty('--cv-color',currentColor);
    /* derived tints for the pastel / cascade / functional designs (rgba keeps
       html2canvas able to parse them for the instant-PDF export) */
    document.documentElement.style.setProperty('--cv-color-soft',cvColorAlpha(0.12));
    document.documentElement.style.setProperty('--cv-color-tint',cvColorAlpha(0.32));
    scaleCVToFit();
    /* re-measure once web fonts settle (metrics can shift after load) */
    clearTimeout(scaleCVToFit._t);scaleCVToFit._t=setTimeout(scaleCVToFit,350);
    window.dispatchEvent(new CustomEvent('cvgenie:preview-updated'));
}

