/* CV Genie service worker — offline-first app shell.
   - The shell (index.html, manifest, icons) is precached at install.
   - Same-origin assets and the CDN libs/fonts the app needs are runtime-cached
     on first use, so an installed CV Genie works with no connection at all.
   - Navigations are network-first (updates land on refresh) with a cached
     fallback, so edits continue offline and you never get a dinosaur.
   - The Gemini API is deliberately NOT cached — it is never needed offline. */
const CACHE = 'cv-genie-v2.10';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/preview.css',
  './css/templates.css',
  './css/carousel.css',
  './css/letter.css',
  './css/ats.css',
  './css/motion.css',
  './css/overrides.css',
  './js/boot-prepaint.js',
  './js/main.js',
  './js/globals.js',
  './js/config.js',
  './js/app-state.js',
  './js/ui.js',
  './js/gemini.js',
  './js/cvdata.js',
  './js/history.js',
  './js/form.js',
  './js/preview.js',
  './js/render.js',
  './js/letter.js',
  './js/letter-engine.js',
  './js/ats.js',
  './js/export.js',
  './js/versions.js',
  './js/state.js',
  './js/cv-import.js',
  './js/carousel.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png'
];
const RUNTIME_HOSTS = [
  location.host,               /* GitHub Pages (same origin)          */
  'cdnjs.cloudflare.com',      /* html2pdf, JSZip, FileSaver, pdf.js… */
  'fonts.googleapis.com',      /* web font CSS                        */
  'fonts.gstatic.com'          /* web font files                      */
];
/* The exact CDN assets index.html loads — warmed at activation so the very
   first visit already survives going offline (page-load requests race the
   service worker registration and would otherwise never hit the cache). */
const CDN_WARM = [
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.0/Sortable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.5.0/lz-string.min.js',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&family=Inter:wght@300;400;500;600;700;800&family=Lora:ital,wght@0,400;0,600;1,400&family=Roboto:wght@300;400;500;700&family=Montserrat:wght@400;600;700;800&family=Merriweather:wght@300;400;700&family=Playfair+Display:wght@400;600;700&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&family=Poppins:wght@300;400;500;600;700&display=swap'
];

async function warmCdnCache() {
  const c = await caches.open(CACHE);
  await Promise.allSettled(CDN_WARM.map((u) =>
    fetch(u, { cache: 'no-cache' }).then((res) => { if (res.ok) return c.put(u, res); }).catch(() => {})
  ));
  /* Pull the woff2 file URLs out of the fonts CSS and cache those too. */
  try {
    const cssUrl = CDN_WARM[CDN_WARM.length - 1];
    const res = await fetch(cssUrl, { cache: 'no-cache' });
    if (res.ok) {
      const text = await res.text();
      await c.put(cssUrl, new Response(text, { headers: { 'Content-Type': 'text/css' } }));
      const fontUrls = [...text.matchAll(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/g)].map((m) => m[1]);
      await Promise.allSettled(fontUrls.map((u) =>
        fetch(u, { cache: 'no-cache' }).then((r) => { if (r.ok) return c.put(u, r); }).catch(() => {})
      ));
    }
  } catch (e) { /* fonts are a nice-to-have offline */ }
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => warmCdnCache())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
  if (url.host === 'generativelanguage.googleapis.com') return; /* never cache the AI */
  if (!RUNTIME_HOSTS.includes(url.host)) return;

  /* App navigations: network-first so deploys arrive, cache fallback offline. */
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  /* Everything else: cache-first, then fetch + fill the cache. */
  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
