#!/usr/bin/env node
/**
 * CV Genie — CI validation script.
 * Checks the single-file app for structural and syntax problems:
 *   1. Basic HTML structure (doctype, single html/head/body)
 *   2. Balanced <div> tags outside of <script> blocks
 *   3. Inline <script> blocks pass `node --check`
 *   4. Every template in TEMPLATES has metadata, a wireframe thumb and a switch case
 *   5. All images referenced in README.md exist
 *   6. GitHub workflow files parse as YAML (via js-yaml if available, skipped otherwise)
 *   7. PWA assets: manifest parses, icons exist, sw.js + apk-driver.js parse, assetlinks valid
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

/* ── 1. File + basic structure ─────────────────────────── */
console.log('\n[1/6] Basic structure');
if (!fs.existsSync(APP)) { fail('index.html not found'); process.exit(1); }
const html = fs.readFileSync(APP, 'utf8');
if (html.length < 50000) fail('index.html suspiciously small (' + html.length + ' bytes)');
if (!/^<!DOCTYPE html>/i.test(html)) fail('missing <!DOCTYPE html>');
const count = (re) => (html.match(re) || []).length;
if (count(/<html[\s>]/gi) !== 1) fail('expected exactly one <html>');
if (count(/<head[\s>]/gi) !== 1) fail('expected exactly one <head>');
if (count(/<body[\s>]/gi) !== 1) fail('expected exactly one <body>');
if (!/<\/body>\s*<\/html>\s*$/.test(html)) fail('file should end with </body></html>');
if (!/charset=["']UTF-8["']/i.test(html)) fail('missing UTF-8 charset meta');
if (!/name=["']viewport["']/i.test(html)) fail('missing viewport meta');
if (failures === 0) ok('index.html (' + Math.round(html.length / 1024) + ' KB), doctype/head/body/charset/viewport present');

/* ── 2. Balanced divs outside scripts ──────────────────── */
console.log('\n[2/6] Tag balance (outside <script>)');
const noScripts = html.replace(/<script[\s\S]*?<\/script>/gi, '');
const openDivs = (noScripts.match(/<div[\s>]/gi) || []).length;
const closeDivs = (noScripts.match(/<\/div>/gi) || []).length;
if (openDivs !== closeDivs) fail(`<div> mismatch outside scripts: ${openDivs} opened vs ${closeDivs} closed`);
else ok(`<div> balanced (${openDivs})`);
const openSpans = (noScripts.match(/<span[\s>]/gi) || []).length;
const closeSpans = (noScripts.match(/<\/span>/gi) || []).length;
if (openSpans !== closeSpans) fail(`<span> mismatch outside scripts: ${openSpans} vs ${closeSpans}`);
else ok(`<span> balanced (${openSpans})`);

/* ── 3. Inline script syntax ───────────────────────────── */
console.log('\n[3/6] JavaScript syntax (node --check)');
const scriptBlocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).filter(s => s.trim());
if (scriptBlocks.length === 0) fail('no inline scripts found');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cvgenie-ci-'));
scriptBlocks.forEach((code, i) => {
  const f = path.join(tmpDir, `block-${i}.js`);
  fs.writeFileSync(f, code);
  try { execFileSync('node', ['--check', f], { stdio: 'pipe' }); ok(`script block ${i + 1} parses (${code.length} bytes)`); }
  catch (e) { fail(`script block ${i + 1} has a syntax error:\n    ${String(e.stderr).split('\n').slice(0, 4).join('\n    ')}`); }
});

/* ── 4. Template registry consistency ──────────────────── */
console.log('\n[4/6] Template registry');
const templatesMatch = html.match(/const TEMPLATES=\[([^\]]+)\]/);
if (!templatesMatch) fail('TEMPLATES array not found');
else {
  const templates = templatesMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
  templates.forEach(t => {
    const q = t.includes('-') ? `'${t}'` : t; /* keys with dashes are quoted in the source */
    if (!new RegExp(`case'${t.replace(/[-]/g, '\\-')}':`).test(html)) fail(`template "${t}" has no switch case`);
    if (!new RegExp(`${q.replace(/[-]/g, '\\-')}:\\{name:`).test(html)) fail(`template "${t}" missing in TEMPLATE_META`);
    if (!new RegExp(`THUMB_WIRES=\\{[\\s\\S]*?${q.replace(/[-]/g, '\\-')}:`).test(html)) fail(`template "${t}" missing in THUMB_WIRES`);
  });
  if (failures === 0) ok(`all ${templates.length} templates have meta, wireframe and renderer`);
  /* count entries inside the TEMPLATE_META block itself — a global /x:{name:/ regex
     false-positives on unrelated objects elsewhere in the app (letter payloads etc.) */
  const metaBlock = html.match(/const TEMPLATE_META=\{[\s\S]*?\n\};/);
  const metaCount = metaBlock ? (metaBlock[0].match(/['a-z-]+:\{name:/g) || []).length : 0;
  if (metaCount !== templates.length) fail(`TEMPLATE_META has ${metaCount} entries but TEMPLATES has ${templates.length}`);
}

/* ── 5. README images ──────────────────────────────────── */
console.log('\n[5/6] README assets');
if (fs.existsSync(README)) {
  const md = fs.readFileSync(README, 'utf8');
  const imgs = [...md.matchAll(/!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g)].map(m => m[1]).filter(p => !/^https?:/.test(p));
  if (imgs.length === 0) console.log('  (no local images referenced)');
  imgs.forEach(p => {
    if (fs.existsSync(path.join(ROOT, p))) ok(p);
    else fail('README references missing image: ' + p);
  });
} else console.log('  (no README)');

/* ── 6. Workflow YAML ──────────────────────────────────── */
console.log('\n[6/6] Workflow YAML');
const wfDir = path.join(ROOT, '.github', 'workflows');
if (fs.existsSync(wfDir)) {
  const yamls = fs.readdirSync(wfDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
  if (yamls.length === 0) console.log('  (no workflows)');
  for (const f of yamls) {
    try {
      require('js-yaml');
      require('js-yaml').load(fs.readFileSync(path.join(wfDir, f), 'utf8'));
      ok(f + ' parses');
    } catch (e) {
      if (e.code === 'MODULE_NOT_FOUND') { console.log('  (js-yaml not installed — skipping ' + f + ')'); break; }
      fail(f + ' YAML error: ' + e.message);
    }
  }
} else console.log('  (no workflows directory)');

/* ── 7. PWA + Android assets ───────────────────────────── */
console.log('\n[7/7] PWA & Android assets');
const manifestPath = path.join(ROOT, 'manifest.webmanifest');
if (!fs.existsSync(manifestPath)) fail('manifest.webmanifest missing');
else {
  try {
    const mf = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!mf.name || !mf.short_name) fail('manifest missing name/short_name');
    if (mf.display !== 'standalone') fail('manifest display should be standalone');
    if (!Array.isArray(mf.icons) || mf.icons.length < 4) fail('manifest needs any + maskable icons');
    mf.icons.forEach((i) => {
      if (!fs.existsSync(path.join(ROOT, i.src))) fail('manifest icon missing: ' + i.src);
    });
    if (failures === 0) ok('manifest.webmanifest valid (' + mf.icons.length + ' icons on disk)');
  } catch (e) { fail('manifest.webmanifest is not valid JSON: ' + e.message); }
}
if (!/<link rel="manifest"[^>]*manifest\.webmanifest/.test(html)) fail('index.html does not link the manifest');
else ok('index.html links the manifest');
const swPath = path.join(ROOT, 'sw.js');
if (!fs.existsSync(swPath)) fail('sw.js missing');
else {
  try { execFileSync('node', ['--check', swPath], { stdio: 'pipe' }); ok('sw.js parses'); }
  catch (e) { fail('sw.js syntax error'); }
}
const appleIcon = path.join(ROOT, 'icons', 'apple-touch-icon.png');
if (!fs.existsSync(appleIcon)) fail('icons/apple-touch-icon.png missing');
else ok('apple-touch-icon present');
const assetLinks = path.join(ROOT, '.well-known', 'assetlinks.json');
if (!fs.existsSync(assetLinks)) fail('.well-known/assetlinks.json missing');
else {
  try {
    const al = JSON.parse(fs.readFileSync(assetLinks, 'utf8'));
    const t = al[0] && al[0].target;
    if (!t || !t.package_name || !Array.isArray(t.sha256_cert_fingerprints) || !t.sha256_cert_fingerprints[0]) fail('assetlinks.json malformed');
    else ok('assetlinks.json valid (' + t.package_name + ')');
  } catch (e) { fail('assetlinks.json is not valid JSON: ' + e.message); }
}
const keystore = path.join(ROOT, 'android-signing', 'cv-genie.keystore');
if (!fs.existsSync(keystore)) fail('android-signing/cv-genie.keystore missing');
else ok('TWA signing keystore present');
const apkDriver = path.join(ROOT, 'scripts', 'apk-driver.js');
if (!fs.existsSync(apkDriver)) fail('scripts/apk-driver.js missing');
else {
  try { execFileSync('node', ['--check', apkDriver], { stdio: 'pipe' }); ok('apk-driver.js parses'); }
  catch (e) { fail('apk-driver.js syntax error'); }
}
/* no export-server references may creep back in */
if (/onrender\.com|PDF_SERVER_URL|DOCX_SERVER_URL/.test(html)) fail('index.html still references an export server');
else ok('no export-server references in index.html');

console.log('\n' + (failures === 0 ? '✔ All checks passed.' : '✘ ' + failures + ' check(s) failed.'));
process.exit(failures === 0 ? 0 : 1);
