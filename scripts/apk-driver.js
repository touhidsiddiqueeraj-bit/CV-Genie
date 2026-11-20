#!/usr/bin/env node
/* ── Non-interactive Bubblewrap driver for CI ────────────────────────────────
   Wraps the PWA into a Trusted Web Activity Android app (APK + AAB) without a
   TTY. Bubblewrap 1.x asks every question through a Prompt interface, and the
   library commands accept any implementation — so we inject canned answers:

     - Application ID, version code, key store location and key name come from
       env vars (everything else takes the values derived from the live web
       manifest: name, colours, display mode, icons, start URL…).
     - Confirmation prompts take their defaults (update project when the
       twa-manifest changed = yes; Play Billing / geolocation = no).

   Flow:  seed ~/.bubblewrap/config.json from JAVA_HOME + ANDROID_SDK_ROOT
          → init (downloads the live manifest + icons, generates the Gradle
            project, reuses the committed signing key)
          → patch appVersion to a human version name
          → build (gradle assembleRelease + bundleRelease, zipalign, apksigner)

   Env vars (all optional):
     PWA_MANIFEST_URL   default: the GitHub Pages manifest
     TWA_DIR            default: twa
     APK_PACKAGE_ID     default: io.github.touhidsiddiqueerajbit.cvgenie
     APK_VERSION_NAME   default: 1.0        (e.g. 2.3)
     APK_VERSION_CODE   default: 1          (e.g. github.run_number)
     ANDROID_KEYSTORE   default: android-signing/cv-genie.keystore
     ANDROID_KEY_ALIAS  default: cvgenie
     BUBBLEWRAP_KEYSTORE_PASSWORD / BUBBLEWRAP_KEY_PASSWORD  (signing)

   Run inside the workflow after: npm install @bubblewrap/cli (NODE_PATH set). */

const fs = require('fs');
const path = require('path');
const os = require('os');

const MANIFEST_URL = process.env.PWA_MANIFEST_URL || 'https://touhidsiddiqueeraj-bit.github.io/CV-Genie/manifest.webmanifest';
const DIRECTORY = process.env.TWA_DIR || 'twa';
const PACKAGE_ID = process.env.APK_PACKAGE_ID || 'io.github.touhidsiddiqueerajbit.cvgenie';
const VERSION_NAME = process.env.APK_VERSION_NAME || '1.0';
const VERSION_CODE = parseInt(process.env.APK_VERSION_CODE || '1', 10);
const KEYSTORE = path.resolve(process.env.ANDROID_KEYSTORE || 'android-signing/cv-genie.keystore');
const ALIAS = process.env.ANDROID_KEY_ALIAS || 'cvgenie';

class AutoPrompt {
  async printMessage(m) { console.log('   ·', String(m).split('\n')[0].slice(0, 140)); }
  /* The Prompt contract: validateFunction converts the raw answer into the
     target type (e.g. validateColor → Color object) — run it, or TwaManifest
     ends up with plain strings where the generator expects wrapped types. */
  async #validated(raw, validate, msg) {
    if (!validate) return raw;
    const r = await validate(String(raw));
    if (r && typeof r.unwrap === 'function') {
      try { return r.unwrap(); }
      catch (e) { throw new Error('apk-driver: prompt ["' + String(msg).slice(0, 60) + '"] rejected answer "' + raw + '": ' + (e && e.message ? e.message : e)); }
    }
    return r;
  }
  async promptInput(msg, defaultValue, validate) {
    const m = String(msg);
    let answer;
    if (/^Application ID/.test(m)) answer = PACKAGE_ID;
    else if (/version code/i.test(m)) answer = String(VERSION_CODE);
    else if (/Key store location/i.test(m)) answer = KEYSTORE;
    else if (/^Key name/.test(m)) answer = ALIAS;
    else if (/version\s*name/i.test(m)) answer = VERSION_NAME;
    else if (defaultValue === null || defaultValue === undefined) {
      throw new Error('apk-driver: unexpected prompt with no default: ' + m);
    } else answer = defaultValue;
    return this.#validated(answer, validate, m);
  }
  async promptChoice(msg, choices, defaultValue, validate) {
    return this.#validated(defaultValue, validate, msg);
  }
  async promptConfirm(msg, defaultValue) { return defaultValue; }
  async promptPassword() {
    const p = process.env.BUBBLEWRAP_KEYSTORE_PASSWORD;
    if (!p) throw new Error('apk-driver: BUBBLEWRAP_KEYSTORE_PASSWORD not set');
    return p;
  }
  async downloadFile() { throw new Error('apk-driver: unexpected download prompt (JDK/SDK should be preinstalled)'); }
}

async function main() {
  /* 1. Seed the bubblewrap config so loadOrCreateConfig never prompts to
        install a JDK / Android SDK — the runner provides both. */
  const jdkPath = process.env.JAVA_HOME;
  const androidSdkPath = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME;
  if (!jdkPath || !androidSdkPath) {
    throw new Error('apk-driver: JAVA_HOME and ANDROID_SDK_ROOT must be set');
  }
  const configDir = path.join(os.homedir(), '.bubblewrap');
  fs.mkdirSync(configDir, { recursive: true });
  const configPath = path.join(configDir, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify({ jdkPath, androidSdkPath }));
  console.log('apk-driver: seeded config →', configPath);
  console.log('apk-driver: JDK', jdkPath, '| SDK', androidSdkPath);

  const { loadOrCreateConfig } = require('@bubblewrap/cli/dist/lib/config');
  const { init } = require('@bubblewrap/cli/dist/lib/cmds/init');
  const { build } = require('@bubblewrap/cli/dist/lib/cmds/build');
  const config = await loadOrCreateConfig();

  /* 2. Fresh project from the live web manifest. */
  fs.mkdirSync(DIRECTORY, { recursive: true });
  console.log('apk-driver: init from', MANIFEST_URL);
  const okInit = await init({ manifest: MANIFEST_URL, directory: DIRECTORY }, config, new AutoPrompt());
  if (!okInit) throw new Error('apk-driver: init failed');

  /* 3. Give the app a human version name and a minSdk the current
        androidbrowserhelper accepts (2.7.x requires API 24; the bubblewrap
        template still defaults to 21). The checksum file is now stale on
        purpose — build() notices, asks to regenerate the project and takes
        the new values through the AutoPrompt above. */
  const mf = path.join(DIRECTORY, 'twa-manifest.json');
  const twa = JSON.parse(fs.readFileSync(mf, 'utf8'));
  console.log('apk-driver: generated', mf, '→', JSON.stringify({
    packageId: twa.packageId, host: twa.host, name: twa.name,
    version: twa.appVersion + ' (' + twa.appVersionCode + ')',
    display: twa.display
  }));
  twa.appVersion = VERSION_NAME;
  twa.minSdkVersion = Math.max(parseInt(twa.minSdkVersion || '21', 10) || 21, 24);
  fs.writeFileSync(mf, JSON.stringify(twa, null, 2));

  /* 4. Build + sign — run from inside the project dir (that is where
        bubblewrap's relative output paths expect to be). */
  process.chdir(DIRECTORY);
  const okBuild = await build(config, { directory: '.', manifest: 'twa-manifest.json' }, undefined, new AutoPrompt());
  if (!okBuild) throw new Error('apk-driver: build failed');

  for (const f of ['app-release-signed.apk', 'app-release-bundle.aab']) {
    if (fs.existsSync(f)) console.log('apk-driver: built', f, (fs.statSync(f).size / 1024 / 1024).toFixed(2) + ' MB');
    else console.warn('apk-driver: expected output missing:', f);
  }
  console.log('apk-driver: done');
}

main().catch((e) => { console.error('apk-driver failed:', e && e.message ? e.message : e); process.exit(1); });
