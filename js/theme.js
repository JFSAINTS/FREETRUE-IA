// Toggle manual de tema: auto → oscuro → claro → auto.
// En "auto" manda prefers-color-scheme del sistema.

const KEY = 'freetrue.theme';

export function initTheme() {
  apply(localStorage.getItem(KEY) || 'auto');
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.addEventListener('click', () => {
      const cur = localStorage.getItem(KEY) || 'auto';
      const next = cur === 'auto' ? 'dark' : cur === 'dark' ? 'light' : 'auto';
      localStorage.setItem(KEY, next);
      apply(next);
    });
  }
}

function apply(mode) {
  const root = document.documentElement;
  if (mode === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.textContent = mode === 'auto' ? '🌓' : mode === 'dark' ? '🌙' : '☀️';
    btn.title = `Tema: ${mode}`;
  }
}
