// Orquestador principal de la app FREETRUE-IA.

import { sha256 } from './hash.js';
import { extractExif } from './exif.js';
import { detectC2PA } from './c2pa.js';
import { buildReverseSearchLinks } from './reverse-search.js';
import { findBySha256 } from './db.js';
import { buildChecklist } from './checklist.js';
import { extractTextFromImage, buildQueryFromText, buildNewsSearchLinks, fetchPageMetadata } from './news-context.js';
import { getTiposAportacion, buildContribution, buildIssueUrl } from './community.js';
import { init as initI18n, setLang, currentLang, translateUrl, onLangChange, t } from './i18n.js';
import { suggestTags } from './tags.js';

// ------- i18n bootstrap -------
initI18n().then(() => {
  const sw = document.getElementById('lang-switcher');
  if (sw) {
    sw.value = currentLang();
    sw.addEventListener('change', () => setLang(sw.value));
  }
});
onLangChange(() => {
  // refrescar guía del tipo de aportación al cambiar idioma
  refreshTipoGuia();
  // regenerar checklist si hay resultados
  if (currentKind) renderChecklist(currentKind);
});

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
    // Además: si es HTML lo procesamos como página con metadata (raro pero puede pasar)
    return;
  }

  // Sin archivo: renderizar lo que se puede
  setCard('hash', `
    <p class="muted">No se pudo descargar el archivo por restricciones CORS del servidor.</p>
    <p class="small">Descárgalo manualmente y súbelo desde la pestaña <em>Archivo</em> para obtener hash, EXIF y detección C2PA.</p>
  `);
  setCard('exif', '<p class="muted">Requiere descarga local del archivo.</p>');
  setCard('c2pa', '<p class="muted">Requiere descarga local del archivo.</p>');
  setCard('db', '<p class="muted">Requiere hash del archivo.</p>');
  renderReverseSearch(url);
  currentKind = guessKindFromUrl(url);
  renderChecklist(currentKind);

  // Contexto de noticia: intentamos leer og:title/description de la URL
  resetNewsContext('');
  ocrBtn.disabled = true;
  ocrStatus.textContent = 'OCR requiere el archivo local (súbelo desde la pestaña Archivo).';
  const meta = await fetchPageMetadata(url);
  if (meta && (meta.title || meta.description)) {
    const claim = [meta.title, meta.description].filter(Boolean).join(' — ');
    claimInput.value = claim.slice(0, 300);
    renderNewsLinks(claimInput.value);
    const pm = document.getElementById('page-metadata');
    pm.hidden = false;
    pm.innerHTML = `
      <strong>Metadatos de la página:</strong>
      ${meta.site ? ` · Sitio: ${escape(meta.site)}` : ''}
      ${meta.title ? `<br><em>Título:</em> ${escape(meta.title)}` : ''}
      ${meta.description ? `<br><em>Descripción:</em> ${escape(meta.description)}` : ''}
    `;
  }

  lastReport = { source: 'url', url, timestamp: new Date().toISOString(), page_metadata: meta || null };
  document.getElementById('download-report').onclick = downloadReport;
}

// ------- News context wiring -------
const claimInput = document.getElementById('claim-input');
const ocrBtn = document.getElementById('ocr-btn');
const ocrStatus = document.getElementById('ocr-status');
const newsLinks = document.getElementById('news-links');
let currentFile = null;

claimInput.addEventListener('input', () => {
  renderNewsLinks(claimInput.value);
  updateTranslateLink(claimInput.value);
  renderSuggestedTags(claimInput.value);
});

function updateTranslateLink(text) {
  const link = document.getElementById('translate-claim');
  if (link) link.href = translateUrl(text || '');
}

function renderSuggestedTags(text) {
  const el = document.getElementById('suggested-tags');
  if (!el) return;
  const tags = suggestTags(text || '', 8);
  if (!tags.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<span class="small muted">${t('tags.suggested')}</span> ` +
    tags.map(tg => `<button type="button" class="tag-chip mini" data-tag="${escape(tg)}">${escape(tg)}</button>`).join(' ');
  el.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', () => copyTagToClipboard(chip.dataset.tag));
  });
}

async function copyTagToClipboard(tag) {
  try { await navigator.clipboard.writeText(tag); } catch {}
}

ocrBtn.addEventListener('click', async () => {
  if (!currentFile || !currentFile.type.startsWith('image')) {
    ocrStatus.textContent = 'El OCR solo funciona con imágenes.';
    return;
  }
  ocrBtn.disabled = true;
  ocrStatus.textContent = 'Cargando motor OCR (~5 MB, primera vez)…';
  try {
    const res = await extractTextFromImage(currentFile, 'spa+eng', p => {
      ocrStatus.textContent = `Reconociendo texto… ${Math.round(p * 100)}%`;
    });
    if (!res.text) {
      ocrStatus.textContent = 'OCR completado: no se detectó texto legible.';
    } else {
      const query = buildQueryFromText(res.text);
      claimInput.value = query;
      renderNewsLinks(query);
      ocrStatus.textContent = `OCR completado (confianza media ${Math.round(res.confidence)}%). Edita el texto si es necesario.`;
    }
  } catch (err) {
    ocrStatus.textContent = `Error de OCR: ${err.message}`;
  } finally {
    ocrBtn.disabled = false;
  }
});

function renderNewsLinks(query) {
  const { general, factcheck } = buildNewsSearchLinks(query);
  if (general.length === 0) {
    newsLinks.hidden = true;
    return;
  }
  newsLinks.hidden = false;
  const linkHtml = arr => arr.map(l =>
    `<a href="${escape(l.url)}" target="_blank" rel="noopener">${escape(l.name)}</a>`
  ).join('');
  document.getElementById('news-general').innerHTML = linkHtml(general);
  document.getElementById('news-factcheck').innerHTML = linkHtml(factcheck);
}

function resetNewsContext(prefillClaim) {
  currentFile = null;
  claimInput.value = prefillClaim || '';
  ocrStatus.textContent = '';
  ocrBtn.disabled = false;
  document.getElementById('page-metadata').hidden = true;
  renderNewsLinks(claimInput.value);
  updateTranslateLink(claimInput.value);
  renderSuggestedTags(claimInput.value);
}

// ------- Community form -------
const TIPOS = getTiposAportacion();
const tipoSel = document.getElementById('ap-tipo');
const tipoGuia = document.getElementById('ap-guia');
const apStatus = document.getElementById('ap-status');

Object.entries(TIPOS).forEach(([key, t]) => {
  const opt = document.createElement('option');
  opt.value = key; opt.textContent = t.label;
  tipoSel.appendChild(opt);
});
function refreshTipoGuia() { tipoGuia.textContent = TIPOS[tipoSel.value].guia; }
tipoSel.addEventListener('change', refreshTipoGuia);
refreshTipoGuia();

function readContributionForm() {
  return {
    tipo: tipoSel.value,
    descripcion_breve: document.getElementById('ap-descripcion').value.trim(),
    aportacion: document.getElementById('ap-aportacion').value.trim(),
    evidencias: document.getElementById('ap-evidencias').value
      .split('\n').map(s => s.trim()).filter(Boolean),
    autor: document.getElementById('ap-autor').value.trim(),
    conflictos: document.getElementById('ap-conflictos').value.trim(),
    sha256: lastReport?.sha256 || null,
    url_origen: lastReport?.url || null,
    caso_id: null
  };
}

function validateContribution(data) {
  if (!data.aportacion) return 'Escribe tu aportación antes de enviarla.';
  if (data.aportacion.length < 20) return 'La aportación es muy corta — al menos 20 caracteres.';
  return null;
}

document.getElementById('ap-submit').addEventListener('click', () => {
  const data = readContributionForm();
  const err = validateContribution(data);
  if (err) { apStatus.textContent = err; return; }
  const contribution = buildContribution(data);
  const url = buildIssueUrl(contribution);
  window.open(url, '_blank', 'noopener');
  apStatus.textContent = 'Se ha abierto GitHub en una pestaña nueva. Revisa el contenido y pulsa «Submit new issue».';
});

document.getElementById('ap-copy').addEventListener('click', async () => {
  const data = readContributionForm();
  const err = validateContribution(data);
  if (err) { apStatus.textContent = err; return; }
  const c = buildContribution(data);
  const text = `# ${c.title}\n\n${c.body}`;
  try {
    await navigator.clipboard.writeText(text);
    apStatus.textContent = 'Aportación copiada al portapapeles.';
  } catch {
    apStatus.textContent = 'No se pudo copiar automáticamente. Descárgalo con el botón JSON.';
  }
});

document.getElementById('ap-download').addEventListener('click', () => {
  const data = readContributionForm();
  const err = validateContribution(data);
  if (err) { apStatus.textContent = err; return; }
  const payload = {
    ...data,
    formato: 'freetrue-ia/aportacion@1',
    timestamp: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `freetrue-aportacion-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  apStatus.textContent = 'JSON descargado. Puedes adjuntarlo a un PR o issue manualmente.';
});

// ------- File analysis -------
let lastReport = null;
let currentKind = null;

async function analyzeFile(file, sourceUrl) {
  if (file.size > 100 * 1024 * 1024) {
    alert('Archivo mayor de 100 MB — no soportado en esta versión.');
    return;
  }
  showResults();
  renderFileSummary(file, sourceUrl);

  const kind = file.type.startsWith('video') ? 'video' : 'image';
  currentKind = kind;
  renderChecklist(kind);
  renderReverseSearch(sourceUrl);

  // Contexto de noticia
  resetNewsContext('');
  currentFile = file;
  ocrBtn.disabled = kind !== 'image';
  if (kind !== 'image') {
    ocrStatus.textContent = 'OCR disponible solo para imágenes. Puedes escribir la afirmación manualmente abajo.';
  }

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
      setCard('db', `<p><span class="tag warn">Coincidencia encontrada</span></p><ul>${list}</ul>
        <p class="small"><a href="#card-community" onclick="document.getElementById('ap-tipo').value='contexto';document.getElementById('ap-tipo').dispatchEvent(new Event('change'));">🤝 Aportar contexto adicional a este caso</a></p>`);
    } else {
      setCard('db', `<p><span class="tag">Sin coincidencias</span></p>
        <p class="small muted">Comparado con ${dbResult.total} caso(s) publicados.</p>
        <p class="small"><a href="#card-community" onclick="document.getElementById('ap-tipo').value='nuevo';document.getElementById('ap-tipo').dispatchEvent(new Event('change'));">🤝 ¿Merece análisis? Propón el caso</a></p>`);
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
    coincidencias_base_publica: dbResult ? dbResult.matches : [],
    afirmacion_para_contraste: claimInput.value.trim() || null
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
