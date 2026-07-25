// i18n mínimo, sin dependencias. Carga JSON de idioma, aplica a elementos
// con [data-i18n], [data-i18n-html], [data-i18n-placeholder], [data-i18n-attr].

const LANGS = ['es', 'en', 'ca'];
const DEFAULT = 'es';
const STORAGE_KEY = 'freetrue.lang';

let current = DEFAULT;
let dict = {};
const listeners = [];

function detect() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && LANGS.includes(stored)) return stored;
  const nav = (navigator.language || 'es').slice(0, 2).toLowerCase();
  return LANGS.includes(nav) ? nav : DEFAULT;
}

async function load(lang) {
  const res = await fetch(`i18n/${lang}.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`i18n ${lang} not found`);
  return res.json();
}

export function t(key, fallback) {
  return dict[key] || fallback || key;
}

export function currentLang() { return current; }
export function availableLangs() { return LANGS.slice(); }

export function onLangChange(cb) { listeners.push(cb); }

export async function setLang(lang) {
  if (!LANGS.includes(lang)) return;
  dict = await load(lang);
  current = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  document.documentElement.lang = lang;
  applyToDom();
  listeners.forEach(cb => { try { cb(lang); } catch {} });
}

export function applyToDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) el.textContent = dict[key];
  });
  root.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    if (dict[key]) el.innerHTML = dict[key];
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (dict[key]) el.setAttribute('placeholder', dict[key]);
  });
  root.querySelectorAll('[data-i18n-attr]').forEach(el => {
    // formato: "attr:key;attr:key"
    const spec = el.getAttribute('data-i18n-attr');
    spec.split(';').forEach(pair => {
      const [attr, key] = pair.split(':').map(s => s.trim());
      if (attr && dict[key]) el.setAttribute(attr, dict[key]);
    });
  });
}

export async function init() {
  const lang = detect();
  await setLang(lang);
}

// URL de Google Translate para un texto arbitrario, con idioma destino = actual.
export function translateUrl(text) {
  const target = current === 'es' ? 'es' : current;
  return `https://translate.google.com/?sl=auto&tl=${target}&text=${encodeURIComponent(text || '')}&op=translate`;
}
