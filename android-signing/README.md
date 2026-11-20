# Android signing

`cv-genie.keystore` signs the TWA APK produced by `.github/workflows/apk.yml`
(Bubblewrap wraps the PWA into an Android app). Committing it keeps APK builds
fully automated on GitHub Actions with no secrets setup: every run produces an
APK that installs as an update over the previous one.

- **alias**: `cvgenie`
- **store & key password**: `CvGenie-Twa-2026!x7q`

## Security note — read this before publishing to Google Play

This keystore is public (it lives in this repository). Anyone could build an
APK signed with it, so treat it as a *wrapper-only* key: CV Genie is a
browser-local tool, the wrapper requests no powerful Android permissions, and
the app holds no secrets. That is an acceptable trade-off for a sideloaded /
hobby distribution — but **before publishing to Google Play**:

1. Generate a new, private keystore and keep it out of the repo:
   `keytool -genkeypair -keystore production.keystore -alias cvgenie -keyalg RSA -keysize 2048 -validity 10950`
2. Store it in repository secrets as `ANDROID_KEYSTORE_B64`
   (`base64 -w0 production.keystore`) with `ANDROID_KEYSTORE_PASSWORD`,
   `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`. The workflow prefers the
   secret over the committed keystore automatically.
3. Publish under the new signature (Play requires it anyway) and remove the
   committed keystore from this folder.

The matching Digital Asset Links statement is committed at
`.well-known/assetlinks.json` (served by GitHub Pages). If you rotate the key,
regenerate it with the new fingerprint:
`keytool -list -v -keystore production.keystore | grep SHA256`
