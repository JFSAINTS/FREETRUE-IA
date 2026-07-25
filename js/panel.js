// Panel de estadísticas y buscador de la base pública de casos.

import { init as initI18n, setLang, currentLang, availableLangs, onLangChange, t } from './i18n.js';
import { doughnut, hbars, line, tagCloud, colorFor } from './charts.js';

const CONCLUSIONS = [
  'autentico_probable',
  'manipulado_ia_probable',
  'manipulado_edicion_probable',
  'no_concluyente'
];

let allCases = [];
let filterState = { q: '', conclusion: '', country: '', tag: '' };

// ---- Language switcher ----
async function bootstrap() {
  await initI18n();
  const sw = document.getElementById('lang-switcher');
  sw.value = currentLang();
  sw.addEventListener('change', () => setLang(sw.value));
  onLangChange(() => render()); // re-renderiza etiquetas dependientes de i18n

  const res = await fetch('casos/index.json', { cache: 'no-cache' });
  const idx = res.ok ? await res.json() : { casos: [] };
  allCases = idx.casos || [];
  buildFilters();
  bindFilterEvents();
  render();
}

function buildFilters() {
  const countries = uniqueSorted(allCases.map(c => c.pais).filter(Boolean));
  const tags = uniqueSorted(allCases.flatMap(c => c.tags || []));

  const conclSel = document.getElementById('f-conclusion');
  CONCLUSIONS.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = t(`conclusion.${c}`, c);
    conclSel.appendChild(opt);
  });

  const countrySel = document.getElementById('f-country');
  countries.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    countrySel.appendChild(opt);
  });

  const tagSel = document.getElementById('f-tag');
  tags.forEach(tag => {
    const opt = document.createElement('option');
    opt.value = tag; opt.textContent = tag;
    tagSel.appendChild(opt);
  });
}

function bindFilterEvents() {
  document.getElementById('q').addEventListener('input', e => { filterState.q = e.target.value; render(); });
  document.getElementById('f-conclusion').addEventListener('change', e => { filterState.conclusion = e.target.value; render(); });
  document.getElementById('f-country').addEventListener('change', e => { filterState.country = e.target.value; render(); });
  document.getElementById('f-tag').addEventListener('change', e => { filterState.tag = e.target.value; render(); });
  document.getElementById('f-reset').addEventListener('click', () => {
    filterState = { q: '', conclusion: '', country: '', tag: '' };
    document.getElementById('q').value = '';
    document.getElementById('f-conclusion').value = '';
    document.getElementById('f-country').value = '';
    document.getElementById('f-tag').value = '';
    render();
  });
}

function applyFilters(cases) {
  const q = filterState.q.trim().toLowerCase();
  return cases.filter(c => {
    if (filterState.conclusion && c.conclusion !== filterState.conclusion) return false;
    if (filterState.country && (c.pais || '') !== filterState.country) return false;
    if (filterState.tag && !(c.tags || []).includes(filterState.tag)) return false;
    if (q) {
      const hay = [c.titulo, c.pais, ...(c.tags || [])].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function render() {
  const filtered = applyFilters(allCases);
  document.getElementById('stats-line').textContent =
    `${t('panel.stats.showing')} ${filtered.length} / ${allCases.length} ${t('panel.stats.total').toLowerCase()}`;

  renderConclusionsChart(filtered);
  renderCountriesChart(filtered);
  renderTimelineChart(filtered);
  renderTagCloud(filtered);
  renderResultsList(filtered);
}

function renderConclusionsChart(cases) {
  const counts = {};
  CONCLUSIONS.forEach(c => counts[c] = 0);
  cases.forEach(c => { if (counts[c.conclusion] !== undefined) counts[c.conclusion]++; });
  const data = CONCLUSIONS.map(c => ({
    label: t(`conclusion.${c}`, c),
    value: counts[c],
    color: colorFor(c)
  })).filter(d => d.value > 0);
  document.getElementById('chart-conclusions').innerHTML =
    data.length
      ? doughnut(data, { centerText: t('panel.stats.total') })
      : `<p class="muted small">${t('panel.noresults')}</p>`;
}

function renderCountriesChart(cases) {
  const counts = {};
  cases.forEach(c => {
    const k = c.pais || '—';
    counts[k] = (counts[k] || 0) + 1;
  });
  const data = Object.entries(counts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);
  document.getElementById('chart-countries').innerHTML = hbars(data);
}

function renderTimelineChart(cases) {
  const counts = {};
  cases.forEach(c => {
    const m = (c.fecha_analisis || '').slice(0, 7);
    if (!m) return;
    counts[m] = (counts[m] || 0) + 1;
  });
  const data = Object.entries(counts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => a.label.localeCompare(b.label));
  document.getElementById('chart-timeline').innerHTML = line(data, { width: 720, height: 200 });
}

function renderTagCloud(cases) {
  const counts = {};
  cases.forEach(c => (c.tags || []).forEach(tag => {
    counts[tag] = (counts[tag] || 0) + 1;
  }));
  const tags = Object.entries(counts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 40);
  const el = document.getElementById('tagcloud');
  el.innerHTML = tagCloud(tags);
  el.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      filterState.tag = chip.dataset.tag;
      document.getElementById('f-tag').value = chip.dataset.tag;
      render();
      document.querySelector('.panel-results').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

function renderResultsList(cases) {
  const el = document.getElementById('results-list');
  if (!cases.length) { el.innerHTML = `<li class="muted">${t('panel.noresults')}</li>`; return; }
  el.innerHTML = cases.map(c => `
    <li>
      <a href="${c.ruta}" target="_blank"><strong>${escape(c.titulo)}</strong></a>
      <div class="case-meta">
        <span class="tag" style="border-color:${colorFor(c.conclusion)};color:${colorFor(c.conclusion)}">${escape(t('conclusion.' + c.conclusion, c.conclusion))}</span>
        ${c.pais ? `<span class="tag">${escape(c.pais)}</span>` : ''}
        <span class="small muted">${escape(c.fecha_analisis || '')}</span>
        ${(c.tags || []).map(tg => `<span class="tag">${escape(tg)}</span>`).join(' ')}
      </div>
    </li>
  `).join('');
}

function uniqueSorted(arr) {
  return [...new Set(arr)].sort((a, b) => String(a).localeCompare(String(b)));
}
function escape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

bootstrap();
