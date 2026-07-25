// Service worker de FREETRUE-IA.
// Estrategia: RED PRIMERO para todo lo propio, caché solo como respaldo
// offline. En una herramienta que evoluciona rápido, servir JS viejo con
// HTML nuevo (o viceversa) rompe la página — se comprobó en las pruebas
// del release de la checklist. El coste extra de red es mínimo y la
// coherencia de versión está garantizada; sin conexión, todo sigue
// funcionando desde la caché.
// Nunca interceptamos peticiones a otros orígenes (CDNs, buscadores).

const VERSION = 'freetrue-v2';
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
  if (url.origin !== self.location.origin || url.protocol !== 'https:') return;

  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
