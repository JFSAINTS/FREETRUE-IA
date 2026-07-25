// Orquestador principal de la app FREETRUE-IA.

import { sha256 } from './hash.js';
import { extractExif } from './exif.js';
import { detectC2PA } from './c2pa.js';
import { buildReverseSearchLinks } from './reverse-search.js';
import { findBySha256 } from './db.js';
import { buildChecklist } from './checklist.js';

// ------- Tabs -------
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const name = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => {
      const active = t === tab;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.tab-panel').forEach(p => {
      p.classList.toggle('active', p.dataset.panel === name);
    });
  });
});

// ------- Dropzone / file input -------
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');

dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => {
  if (e.target.files[0]) analyzeFile(e.target.files[0], null);
});

['dragenter', 'dragover'].forEach(ev => dropzone.addEventListener(ev, e => {
  e.preventDefault(); dropzone.classList.add('hover');
}));
['dragleave', 'drop'].forEach(ev => dropzone.addEventListener(ev, e => {
  e.preventDefault(); dropzone.classList.remove('hover');
}));
dropzone.addEventListener('drop', e => {
  const f = e.dataTransfer.files[0];
  if (f) analyzeFile(f, null);
});

// ------- URL analyzer -------
const urlInput = document.getElementById('url-input');
const urlBtn = document.getElementById('url-analyze');
urlBtn.addEventListener('click', () => analyzeUrl(urlInput.value.trim()));
urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') analyzeUrl(urlInput.value.trim()); });

async function analyzeUrl(url) {
  if (!url) return;
  try {
    new URL(url);
  } catch {
    alert('URL no válida.');
    return;
  }
  showResults();
  renderFileSummaryFromUrl(url);
  // Intentar descarga (probablemente falle por CORS en muchos sitios)
  let file = null;
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      const name = url.split('/').pop().split('?')[0] || 'remote-file';
      file = new File([blob], name, { type: blob.type });
    }
  } catch (err) {
    // silencioso; renderizamos igualmente lo que podemos
  }
  if (file) {
    analyzeFile(file, url);
  } else {
    // Renderizar solo lo que se puede sin el archivo
    setCard('hash', `
      <p class="muted">No se pudo descargar el archivo por restricciones CORS del servidor.</p>
      <p class="small">Descárgalo manualmente y súbelo desde la pestaña <em>Archivo</em> para obtener hash, EXIF y detección C2PA.</p>
    `);
    setCard('exif', '<p class="muted">Requiere descarga local del archivo.</p>');
    setCard('c2pa', '<p class="muted">Requiere descarga local del archivo.</p>');
    setCard('db', '<p class="muted">Requiere hash del archivo.</p>');
    renderReverseSearch(url);
    renderChecklist(guessKindFromUrl(url));
    lastReport = { source: 'url', url, timestamp: new Date().toISOString() };
    document.getElementById('download-report').onclick = downloadReport;
  }
}

// ------- File analysis -------
let lastReport = null;

async function analyzeFile(file, sourceUrl) {
  if (file.size > 100 * 1024 * 1024) {
    alert('Archivo mayor de 100 MB — no soportado en esta versión.');
    return;
  }
  showResults();
  renderFileSummary(file, sourceUrl);

  const kind = file.type.startsWith('video') ? 'video' : 'image';
  renderChecklist(kind);
  renderReverseSearch(sourceUrl);

  // hash
  const hashPromise = sha256(file).then(h => {
    setCard('hash', `<p class="mono">${h}</p><p class="small muted">Identificador único e inmutable del archivo. Puedes citarlo en denuncias o cruzarlo con otras bases.</p>`);
    return h;
  }).catch(e => {
    setCard('hash', `<p class="muted">Error: ${e.message}</p>`);
    return null;
  });

  // exif
  const exifPromise = extractExif(file).then(r => {
    if (r.present) {
      setCard('exif', `
        <p><span class="tag ok">Presentes</span></p>
        <p>${escape(r.summary)}</p>
        <details><summary>Ver metadatos crudos</summary><pre>${escape(JSON.stringify(r.raw, jsonReplacer, 2))}</pre></details>
      `);
    } else {
      setCard('exif', `<p><span class="tag warn">Ausentes</span></p><p class="muted">${escape(r.summary)}</p><p class="small muted">Nota: las redes sociales suelen eliminar los EXIF. Su ausencia no prueba manipulación.</p>`);
    }
    return r;
  });

  // c2pa
  const c2paPromise = detectC2PA(file).then(r => {
    if (r.present) {
      setCard('c2pa', `<p><span class="tag ok">Detectadas</span></p><p>El archivo contiene marcas típicas de C2PA/JUMBF.</p><p class="small muted">${escape(r.details.note)}</p>`);
    } else {
      setCard('c2pa', `<p><span class="tag">No detectadas</span></p><p class="muted small">${escape(r.note || 'Sin marcas C2PA visibles.')}</p>`);
    }
    return r;
  });

  const [hash, exif, c2pa] = await Promise.all([hashPromise, exifPromise, c2paPromise]);

  // DB match
  let dbResult = null;
  if (hash) {
    dbResult = await findBySha256(hash);
    if (dbResult.matches.length > 0) {
      const list = dbResult.matches.map(c => `
        <li><a href="${c.ruta}" target="_blank"><strong>${escape(c.titulo)}</strong></a><br>
        <span class="small muted">${escape(c.fecha_analisis)} · conclusión: ${escape(c.conclusion)}</span></li>
      `).join('');
      setCard('db', `<p><span class="tag warn">Coincidencia encontrada</span></p><ul>${list}</ul>`);
    } else {
      setCard('db', `<p><span class="tag">Sin coincidencias</span></p><p class="small muted">Comparado con ${dbResult.total} caso(s) publicados. Si crees que este contenido merece un análisis, considera <a href="https://github.com/JFSAINTS/FREETRUE-IA/blob/main/CONTRIBUTING.md" target="_blank">aportarlo</a>.</p>`);
    }
  }

  lastReport = {
    source: sourceUrl ? 'url' : 'file',
    url: sourceUrl,
    file: { name: file.name, size: file.size, type: file.type },
    timestamp: new Date().toISOString(),
    sha256: hash,
    exif: exif.present ? { present: true, summary: exif.summary } : { present: false, note: exif.summary },
    c2pa: c2pa,
    coincidencias_base_publica: dbResult ? dbResult.matches : []
  };
  document.getElementById('download-report').onclick = downloadReport;
}

// ------- Rendering helpers -------
function showResults() {
  document.getElementById('resultados').hidden = false;
  document.getElementById('resultados').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderFileSummary(file, sourceUrl) {
  const summary = document.getElementById('file-summary');
  const isImage = file.type.startsWith('image');
  const preview = URL.createObjectURL(file);
  summary.innerHTML = `
    ${isImage
      ? `<img class="preview" src="${preview}" alt="Previsualización" />`
      : `<video class="preview" src="${preview}" muted></video>`}
    <div class="meta">
      <strong>${escape(file.name)}</strong>
      <span>${escape(file.type || 'tipo desconocido')} · ${formatSize(file.size)}</span>
      ${sourceUrl ? `<span>URL: ${escape(sourceUrl)}</span>` : ''}
    </div>
  `;
}

function renderFileSummaryFromUrl(url) {
  const summary = document.getElementById('file-summary');
  summary.innerHTML = `
    <img class="preview" src="${escape(url)}" alt="" onerror="this.style.display='none'" />
    <div class="meta">
      <strong>Análisis por URL</strong>
      <span class="mono">${escape(url)}</span>
    </div>
  `;
}

function setCard(id, html) {
  document.getElementById(`${id}-body`).innerHTML = html;
}

function renderReverseSearch(url) {
  const links = buildReverseSearchLinks(url);
  document.getElementById('reverse-links').innerHTML = links.map(l => `
    <a href="${escape(l.url)}" target="_blank" rel="noopener">
      ${escape(l.name)}
      <small>${escape(l.note)}</small>
    </a>
  `).join('');
}

function renderChecklist(kind) {
  const items = buildChecklist(kind);
  document.getElementById('checklist').innerHTML = items.map(i => `
    <li><strong>${escape(i.title)}</strong><span>${escape(i.hint)}</span></li>
  `).join('');
}

function downloadReport() {
  if (!lastReport) return;
  const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `freetrue-informe-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ------- utils -------
function escape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
function jsonReplacer(_, v) {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'bigint') return v.toString();
  return v;
}
function guessKindFromUrl(url) {
  return /\.(mp4|webm|mov|mkv|avi)(\?|$)/i.test(url) ? 'video' : 'image';
}
