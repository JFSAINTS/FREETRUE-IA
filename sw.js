// Service worker de FREETRUE-IA.
// Estrategia:
//  - Navegaciones y casos/index.json: red primero (frescura importa en una
//    herramienta de verificación), caché como respaldo offline.
//  - Estáticos propios (css/js/i18n/assets): stale-while-revalidate.
//  - Nunca interceptamos peticiones a otros orígenes (CDNs, buscadores).

const VERSION = 'freetrue-v1';
const CORE = [
  '.',
  'index.html',
  'panel.html',
  'quiz.html',
  'css/style.css',
  'manifest.webmanifest',
  'assets/logo-64.png',
  'assets/logo-512.png',
  'i18n/es.json',
  'i18n/en.json',
  'i18n/ca.json',
  'casos/index.json',
  'js/app.js', 'js/panel.js', 'js/quiz.js',
  'js/i18n.js', 'js/theme.js', 'js/hash.js', 'js/phash.js', 'js/exif.js',
  'js/c2pa.js', 'js/ela.js', 'js/frames.js', 'js/reverse-search.js',
  'js/news-context.js', 'js/db.js', 'js/checklist.js', 'js/community.js',
  'js/tags.js', 'js/charts.js', 'js/verdict.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(CORE))
      .catch(() => {}) // instalación parcial mejor que fallo total
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isFreshFirst = req.mode === 'navigate' || url.pathname.endsWith('casos/index.json');

  if (isFreshFirst) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
  } else {
    e.respondWith(
      caches.match(req).then(cached => {
        const network = fetch(req)
          .then(res => {
            const copy = res.clone();
            caches.open(VERSION).then(c => c.put(req, copy));
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
