/* Window bridge (compatibility layer).
 *
 * The markup keeps its small inline handlers (onclick="updatePreview()" and
 * friends) and the Playwright suite drives the app through the same public
 * surface a user has. Native ES-module bindings are not globals, so every
 * feature module's public API is re-exported onto window here — one file,
 * one list, nothing implicit. Functions and const objects are assigned
 * directly; exported `let` bindings get getters so window always sees the
 * live value.
 *
 * Adding a module? Add it here — scripts/validate.js fails if one is missing. */
import * as config from './config.js';
import * as app_state from './app-state.js';
import * as ui from './ui.js';
import * as gemini from './gemini.js';
import * as cvdata from './cvdata.js';
import * as history from './history.js';
import * as form from './form.js';
import * as preview from './preview.js';
import * as render from './render.js';
import * as letter from './letter.js';
import * as letter_engine from './letter-engine.js';
import * as ats from './ats.js';
import * as exportMod from './export.js';
import * as versions from './versions.js';
import * as cv_import from './cv-import.js';
import * as state from './state.js';
import * as carousel from './carousel.js';

const API = {
  ...config,
  ...app_state,
  ...ui,
  ...gemini,
  ...cvdata,
  ...history,
  ...form,
  ...preview,
  ...render,
  ...letter,
  ...letter_engine,
  ...ats,
  ...exportMod,
  ...versions,
  ...cv_import,
  ...state,
  ...carousel,
};
Object.assign(window, API);

Object.defineProperty(window, "currentTemplate", { configurable: true, get: () => app_state.currentTemplate });
Object.defineProperty(window, "currentColor", { configurable: true, get: () => app_state.currentColor });
Object.defineProperty(window, "currentFontPair", { configurable: true, get: () => app_state.currentFontPair });
Object.defineProperty(window, "photoData", { configurable: true, get: () => app_state.photoData });
Object.defineProperty(window, "photoShape", { configurable: true, get: () => app_state.photoShape });
Object.defineProperty(window, "photoSize", { configurable: true, get: () => app_state.photoSize });
Object.defineProperty(window, "activeDoc", { configurable: true, get: () => app_state.activeDoc });
Object.defineProperty(window, "sectionOrder", { configurable: true, get: () => app_state.sectionOrder });
Object.defineProperty(window, "customKWList", { configurable: true, get: () => ats.customKWList });
Object.defineProperty(window, "atsLastReport", { configurable: true, get: () => ats.atsLastReport });
Object.defineProperty(window, "cvImportData", { configurable: true, get: () => cv_import.cvImportData });
Object.defineProperty(window, "cvImportSource", { configurable: true, get: () => cv_import.cvImportSource });
Object.defineProperty(window, "previewMode", { configurable: true, get: () => carousel.previewMode });
