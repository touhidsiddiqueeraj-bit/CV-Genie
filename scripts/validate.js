#!/usr/bin/env node
/**
 * CV Genie — CI validation script (modular era).
 * The app is an ES-module graph (js/*.js) + sectioned stylesheets (css/*.css)
 * loaded by a small index.html shell with no build step. This script guards
 * the structure so debugging stays easy:
 *   1. index.html shell: structure, size sanity, stylesheet links, no inline app JS
 *   2. Stylesheets: every css/*.css linked (and every link exists)
 *   3. Modules: every js/*.js parses (node --check, type:module)
 *   4. Import graph: targets exist, relative only, NO import cycles
 *   5. Template registry: every template has meta + wireframe + renderer + CSS
 *   6. Window bridge: globals.js re-exports every module; every inline
 *      onclick/oninput/… handler in the markup resolves to a real export
 *   7. Service worker: parses, precaches the whole module/CSS graph,
 *      exactly one registration, no blob workers
 *   8. No export-server references may creep back in
 *   9. Docs & PWA assets: README images, workflows YAML, manifest, icons,
 *      assetlinks, signing keystore, apk driver
 * Exit code 0 = all good, 1 = failures.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'index.html');
const README = path.join(ROOT, 'README.md');
let failures = 0;
const fail = (msg) => { console.error('  ✗ ' + msg); failures++; };
const ok = (msg) => console.log('  ✓ ' + msg);

const read = (p) => fs.readFileSync(p, 'utf8');
const jsDir = path.join(ROOT, 'js');
const cssDir = path.join(ROOT, 'css');
const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).sort();
const cssFiles = fs.readdirSync(cssDir).filter(f => f.endsWith('.css')).sort();

/* ── 1. index.html shell ───────────────────────────────── */
console.log('\n[1/9] index.html shell');
const html = read(APP);
if (!/^<!DOCTYPE html>/i.test(html)) fail('missing <!DOCTYPE html>');
const count = (re) => (html.match(re) || []).length;
if (count(/<html[\s>]/gi) !== 1) fail('expected exactly one <html>');
if (count(/<head[\s>]/gi) !== 1) fail('expected exactly one <head>');
if (count(/<body[\s>]/gi) !== 1) fail('expected exactly one <body>');
if (!/charset=["']UTF-8["']/i.test(html)) fail('missing UTF-8 charset meta');
if (!/name=["']viewport["']/i.test(html)) fail('missing viewport meta');
if (html.length > 200000) fail(`index.html is ${Math.round(html.length / 1024)} KB — app code belongs in js/ and css/`);
if (html.length < 10000) fail('index.html suspiciously small — did the markup get lost?');
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].filter(m => m[1].trim());
if (inlineScripts.length) fail(`inline <script> found (${inlineScripts.length}) — move it to js/ (pre-paint logic goes to js/boot-prepaint.js)`);
else ok('no inline scripts — all JS lives in js/');
if (!/<script type="module" src="js\/main\.js">/.test(html)) fail('missing the js/main.js module entry');
else ok('loads js/main.js as a module');
if (!/<script src="js\/boot-prepaint\.js">/.test(html)) fail('missing js/boot-prepaint.js (pre-paint theme bootstrap)');
if (!/<link rel="manifest"[^>]*manifest\.webmanifest/.test(html)) fail('index.html does not link the manifest');
else ok('links the manifest');

/* ── 2. Stylesheets ────────────────────────────────────── */
console.log('\n[2/9] stylesheets');
const linkedCss = [...html.matchAll(/<link rel="stylesheet" href="css\/([\w.-]+\.css)">/g)].map(m => m[1]);
if (linkedCss.length === 0) fail('no css <link>s found');
for (const f of cssFiles) {
  if (read(path.join(cssDir, f)).trim().length < 40) fail(`css/${f} is empty`);
  if (!linkedCss.includes(f)) fail(`css/${f} exists but is not linked in index.html`);
}
for (const l of linkedCss) {
  if (!cssFiles.includes(l)) fail(`index.html links css/${l} which does not exist`);
}
if (failures === 0) ok(`${cssFiles.length} stylesheets, all linked and present (order: ${linkedCss.join(' → ')})`);

/* ── 3. Module syntax ──────────────────────────────────── */
console.log('\n[3/9] module syntax (node --check)');
if (jsFiles.length < 5) fail('js/ should hold the module graph — found almost nothing');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cvgenie-esm-'));
fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ type: 'module' }));
for (const f of jsFiles) fs.copyFileSync(path.join(jsDir, f), path.join(tmpDir, f));
for (const f of jsFiles) {
  try { execFileSync('node', ['--check', path.join(tmpDir, f)], { stdio: 'pipe' }); }
  catch (e) { fail(`js/${f} has a syntax error:\n    ${String(e.stderr).split('\n').slice(0, 4).join('\n    ')}`); }
}
if (failures === 0) ok(`all ${jsFiles.length} modules parse`);

/* ── 4. Import graph ───────────────────────────────────── */
console.log('\n[4/9] import graph');
const graph = {};
let importErrors = 0;
for (const f of jsFiles) {
  const src = read(path.join(jsDir, f));
  const deps = [];
  for (const m of src.matchAll(/import\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g)) {
    const spec = m[1];
    if (!spec.startsWith('./')) { fail(`js/${f} imports "${spec}" — imports must be relative (./name.js)`); importErrors++; continue; }
    const target = path.join(jsDir, spec.replace('./', ''));
    if (!fs.existsSync(target)) { fail(`js/${f} imports missing module "${spec}"`); importErrors++; continue; }
    if (f === 'boot-prepaint.js') { fail('boot-prepaint.js must stay dependency-free (it is a classic script)'); }
    deps.push(spec.replace('./', '').replace('.js', ''));
  }
  graph[f.replace('.js', '')] = deps;
}
if (importErrors === 0 && failures === 0) ok(`all imports resolve (${Object.values(graph).reduce((a, d) => a + d.length, 0)} edges)`);
/* cycle detection (DFS) */
const color = {}; const cycles = [];
function dfs(u, stack) {
  color[u] = 1; stack.push(u);
  for (const v of graph[u] || []) {
    if (color[v] === 1) cycles.push([...stack.slice(stack.indexOf(v)), v].join(' → '));
    else if (!color[v]) dfs(v, stack);
  }
  stack.pop(); color[u] = 2;
}
for (const m of Object.keys(graph)) if (!color[m]) dfs(m, []);
if (cycles.length) { for (const c of cycles) fail(`import cycle: ${c}`); }
else if (importErrors === 0) ok('no import cycles');

/* ── 5. Template registry ──────────────────────────────── */
console.log('\n[5/9] template registry');
const configSrc = read(path.join(jsDir, 'config.js'));
const previewSrc = read(path.join(jsDir, 'preview.js'));
const templatesCss = read(path.join(cssDir, 'templates.css'));
const templatesMatch = configSrc.match(/export const TEMPLATES=\[([^\]]+)\]/);
if (!templatesMatch) fail('TEMPLATES array not found in js/config.js');
else {
  const templates = templatesMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
  templates.forEach(t => {
    const q = t.includes('-') ? `'${t}'` : t;
    if (!new RegExp(`case'${t.replace(/-/g, '\\-')}':`).test(previewSrc)) fail(`template "${t}" has no renderer case in js/preview.js`);
    if (!new RegExp(`${q.replace(/-/g, '\\-')}:\\{name:`).test(configSrc)) fail(`template "${t}" missing in TEMPLATE_META`);
    if (!new RegExp(`${q.replace(/-/g, '\\-')}:`).test(configSrc.slice(configSrc.indexOf('THUMB_WIRES')))) fail(`template "${t}" missing in THUMB_WIRES`);
    if (!new RegExp(`\\.cv-${t.replace(/-/g, '\\-')}\\s*[,{.]`).test(templatesCss)) fail(`template "${t}" has no CSS rules in css/templates.css`);
  });
  const metaBlock = configSrc.match(/export const TEMPLATE_META=\{[\s\S]*?\n\};/);
  const metaCount = metaBlock ? (metaBlock[0].match(/['a-z-]+:\{name:/g) || []).length : 0;
  if (metaCount !== templates.length) fail(`TEMPLATE_META has ${metaCount} entries but TEMPLATES has ${templates.length}`);
  if (failures === 0) ok(`all ${templates.length} templates have meta, wireframe, renderer and CSS`);
}

/* ── 6. Window bridge + inline handlers ────────────────── */
console.log('\n[6/9] window bridge & inline handlers');
const globalsSrc = read(path.join(jsDir, 'globals.js'));
const mainSrc = read(path.join(jsDir, 'main.js'));
/* every feature module must be bridged */
const bridgeMods = [...globalsSrc.matchAll(/import \* as \w+ from '\.\/([\w.-]+)\.js';/g)].map(m => m[1]);
for (const f of jsFiles) {
  const mod = f.replace('.js', '');
  if (['globals', 'main', 'boot-prepaint'].includes(mod)) continue;
  if (!bridgeMods.includes(mod)) fail(`js/${f} is not re-exported in js/globals.js — inline handlers and tests cannot reach it`);
}
if (failures === 0) ok(`globals.js bridges ${bridgeMods.length} modules`);
/* exported names across modules */
const exportedNames = new Set();
for (const f of jsFiles) {
  for (const m of read(path.join(jsDir, f)).matchAll(/^export (?:async )?(?:function|const|let|class) ([A-Za-z_$][\w$]*)/gm)) exportedNames.add(m[1]);
}
/* main's own window surface */
const mainWindow = [...mainSrc.matchAll(/Object\.assign\(window,\s*\{([^}]+)\}/g)].flatMap(m => m[1].split(',').map(s => s.trim().split(':')[0].trim()).filter(Boolean));
/* every inline handler identifier must resolve (skip member calls like
   document.getElementById, keywords, and control-flow parens) */
const DOM_STDLIB = new Set(['this', 'event', 'print', 'focus', 'blur', 'remove', 'classList', 'style',
  'value', 'checked', 'parentElement', 'preventDefault', 'stopPropagation', 'submit', 'reset', 'click',
  'scrollIntoView', 'if', 'for', 'while', 'switch', 'return', 'new', 'typeof', 'await', 'async',
  'confirm', 'alert', 'setTimeout', 'parseInt', 'parseFloat', 'encodeURIComponent']);
const handlerNames = new Set();
for (const m of html.matchAll(/\son\w+="([^"]+)"/g)) {
  for (const call of m[1].matchAll(/(?:^|[;{}\s(])([A-Za-z_$][\w$]*)\s*\(/g)) {
    const before = m[1].slice(Math.max(0, call.index - 1), call.index);
    if (before === '.') continue; /* member call — not a global handler */
    handlerNames.add(call[1]);
  }
}
let missing = 0;
for (const name of handlerNames) {
  if (DOM_STDLIB.has(name)) continue;
  if (!exportedNames.has(name) && !mainWindow.includes(name)) { fail(`inline handler "${name}(" has no exported function (broken onclick?)`); missing++; }
}
if (missing === 0) ok(`all ${handlerNames.size} distinct inline handlers resolve to module exports`);
/* exported `let` bindings need live getters on window */
let letsMissing = 0;
for (const f of jsFiles) {
  for (const m of read(path.join(jsDir, f)).matchAll(/^export let ([A-Za-z_$][\w$]*)/gm)) {
    if (!new RegExp(`defineProperty\\(window, ['"]${m[1]}['"]`).test(globalsSrc)) { fail(`exported let "${m[1]}" (js/${f}) needs a live getter in globals.js`); letsMissing++; }
  }
}
if (letsMissing === 0) ok('every exported `let` has a live window getter');

/* ── 7. Service worker ─────────────────────────────────── */
console.log('\n[7/9] service worker');
const swPath = path.join(ROOT, 'sw.js');
const swSrc = read(swPath);
try { execFileSync('node', ['--check', swPath], { stdio: 'pipe' }); ok('sw.js parses'); }
catch (e) { fail('sw.js syntax error'); }
/* APP_SHELL must contain the whole graph */
const shellEntries = [...swSrc.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]);
for (const f of jsFiles) if (!shellEntries.includes(`js/${f}`)) fail(`sw.js APP_SHELL misses js/${f} — offline installs would break`);
for (const f of cssFiles) if (!shellEntries.includes(`css/${f}`)) fail(`sw.js APP_SHELL misses css/${f} — offline installs would break`);
if (failures === 0) ok(`APP_SHELL precaches all ${jsFiles.length} modules + ${cssFiles.length} stylesheets`);
/* exactly one registration, targeting sw.js, and no blob workers */
{
  const allJs = jsFiles.map(f => read(path.join(jsDir, f))).join('\n');
  const regs = (allJs + html).match(/serviceWorker\s*\.\s*register\s*\(/g) || [];
  if (regs.length !== 1) fail('the app must register exactly one service worker, found ' + regs.length);
  else if (!/serviceWorker\s*\.\s*register\s*\(\s*['"]sw\.js['"]/.test(mainSrc)) fail("the single serviceWorker.register() must live in js/main.js and target 'sw.js'");
  else if (/createObjectURL\s*\(\s*\w*blob/i.test(allJs + html)) fail('a service worker is registered from a Blob URL');
  else ok('sw.js is the only service-worker registration (from js/main.js)');
}

/* ── 8. No export server ───────────────────────────────── */
console.log('\n[8/9] export-server references');
{
  const allApp = html + jsFiles.map(f => read(path.join(jsDir, f))).join('\n');
  if (/onrender\.com|PDF_SERVER_URL|DOCX_SERVER_URL/.test(allApp)) fail('an export-server reference crept back in');
  else ok('none in index.html or any module');
}

/* ── 9. Docs & PWA assets ──────────────────────────────── */
console.log('\n[9/9] docs & PWA assets');
if (fs.existsSync(README)) {
  const md = read(README);
  const imgs = [...md.matchAll(/!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g)].map(m => m[1]).filter(p => !/^https?:/.test(p));
  let missingImgs = 0;
  imgs.forEach(p => { if (!fs.existsSync(path.join(ROOT, p))) { fail('README references missing image: ' + p); missingImgs++; } });
  if (missingImgs === 0) ok(`${imgs.length} README images present`);
} else console.log('  (no README)');
const wfDir = path.join(ROOT, '.github', 'workflows');
if (fs.existsSync(wfDir)) {
  const yamls = fs.readdirSync(wfDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
  for (const f of yamls) {
    try {
      require('js-yaml');
      require('js-yaml').load(read(path.join(wfDir, f)));
      ok(f + ' parses');
    } catch (e) {
      if (e.code === 'MODULE_NOT_FOUND') { console.log('  (js-yaml not installed — skipping ' + f + ')'); break; }
      fail(f + ' YAML error: ' + e.message);
    }
  }
}
const manifestPath = path.join(ROOT, 'manifest.webmanifest');
if (!fs.existsSync(manifestPath)) fail('manifest.webmanifest missing');
else {
  try {
    const mf = JSON.parse(read(manifestPath));
    if (!mf.name || !mf.short_name) fail('manifest missing name/short_name');
    if (mf.display !== 'standalone') fail('manifest display should be standalone');
    if (!Array.isArray(mf.icons) || mf.icons.length < 4) fail('manifest needs any + maskable icons');
    mf.icons.forEach((i) => { if (!fs.existsSync(path.join(ROOT, i.src))) fail('manifest icon missing: ' + i.src); });
    if (failures === 0) ok('manifest.webmanifest valid (' + mf.icons.length + ' icons on disk)');
  } catch (e) { fail('manifest.webmanifest is not valid JSON: ' + e.message); }
}
const appleIcon = path.join(ROOT, 'icons', 'apple-touch-icon.png');
if (!fs.existsSync(appleIcon)) fail('icons/apple-touch-icon.png missing');
else ok('apple-touch-icon present');
const assetLinks = path.join(ROOT, '.well-known', 'assetlinks.json');
if (!fs.existsSync(assetLinks)) fail('.well-known/assetlinks.json missing');
else {
  try {
    const al = JSON.parse(read(assetLinks));
    const t = al[0] && al[0].target;
    if (!t || !t.package_name || !Array.isArray(t.sha256_cert_fingerprints) || !t.sha256_cert_fingerprints[0]) fail('assetlinks.json malformed');
    else ok('assetlinks.json valid (' + t.package_name + ')');
  } catch (e) { fail('assetlinks.json is not valid JSON: ' + e.message); }
}
if (!fs.existsSync(path.join(ROOT, 'android-signing', 'cv-genie.keystore'))) fail('android-signing/cv-genie.keystore missing');
else ok('TWA signing keystore present');
const apkDriver = path.join(ROOT, 'scripts', 'apk-driver.js');
if (!fs.existsSync(apkDriver)) fail('scripts/apk-driver.js missing');
else {
  try { execFileSync('node', ['--check', apkDriver], { stdio: 'pipe' }); ok('apk-driver.js parses'); }
  catch (e) { fail('apk-driver.js syntax error'); }
}

console.log('\n' + (failures === 0 ? '✔ All checks passed.' : '✘ ' + failures + ' check(s) failed.'));
process.exit(failures === 0 ? 0 : 1);
