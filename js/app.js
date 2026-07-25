// Orquestador principal de la app FREETRUE-IA.

import { sha256 } from './hash.js';
import { phashFromBlob, phashFromDrawable, hammingHex, PHASH_THRESHOLD } from './phash.js';
import { extractExif } from './exif.js';
import { detectC2PA } from './c2pa.js';
import { buildReverseSearchLinks } from './reverse-search.js';
import { findBySha256, findByPhash } from './db.js';
import { buildChecklist } from './checklist.js';
import { extractTextFromImage, buildQueryFromText, buildNewsSearchLinks, fetchPageMetadata, buildWaybackLinks } from './news-context.js';
import { getTiposAportacion, buildContribution, buildIssueUrl } from './community.js';
import { init as initI18n, setLang, currentLang, translateUrl, onLangChange, t } from './i18n.js';
import { suggestTags } from './tags.js';
import { computeAutoVerdict, STATES as VERDICT_STATES } from './verdict.js';
import { extractFrames } from './frames.js';
import { computeELA } from './ela.js';
import { initTheme } from './theme.js';

// ------- Bootstrap -------
initTheme();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
initI18n().then(() => {
  const sw = document.getElementById('lang-switcher');
  if (sw) {
    sw.value = currentLang();
    sw.addEventListener('change', () => setLang(sw.value));
  }
  loadSharedReportFromHash();
});
onLangChange(() => {
  // refrescar guía del tipo de aportación al cambiar idioma
  refreshTipoGuia();
  // regenerar checklist si hay resultados
  if (currentKind) renderChecklist(currentKind);
  // re-aplicar el semáforo para que la etiqueta refleje el estado real
  // (el elemento no lleva data-i18n precisamente por esto)
  applyVerdict(lastVerdictApplied.state, lastVerdictApplied.reasonKey);
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

// El <label> ya reenvía el clic al input de forma nativa — no añadir
// un listener de click aquí o el diálogo de archivo se abriría dos veces.
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
  renderWayback(url);
  document.getElementById('card-ela').hidden = true;
  document.getElementById('card-frames').hidden = true;
  currentKind = guessKindFromUrl(url);
  resetChecklist();
  renderChecklist(currentKind);

  // Semáforo: reset
  resetVerdict();

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

  lastReport = { source: 'url', url, timestamp: new Date().toISOString(), page_metadata: meta || null, coincidencias_base_publica: [] };
  refreshAutoVerdict();
  updateLastReportVerdict();
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

// ------- Verdict semáforo -------
let autoVerdict = { state: 'yellow', reasonKey: 'verdict.reason.default', reasonDetail: null };
let humanVerdict = null; // { state, modified_part? }

let lastVerdictApplied = { state: 'yellow', reasonKey: 'verdict.reason.default' };

function applyVerdict(state, reasonKey = null) {
  const card = document.getElementById('card-verdict');
  const light = document.getElementById('verdict-light');
  const label = document.getElementById('verdict-state-label');
  const reason = document.getElementById('verdict-reason');
  card.setAttribute('data-state', state);
  light.setAttribute('data-state', state);
  light.textContent = VERDICT_STATES[state].emoji;
  label.textContent = t(VERDICT_STATES[state].i18nKey, state);
  if (reasonKey) reason.textContent = t(reasonKey, '');
  lastVerdictApplied = { state, reasonKey: reasonKey || lastVerdictApplied.reasonKey };
}

function refreshAutoVerdict() {
  autoVerdict = computeAutoVerdict({
    dbMatches: lastReport?.coincidencias_base_publica || [],
    c2paDetails: lastReport?.c2pa?.details || null,
    exifPresent: lastReport?.exif?.present || false
  });
  // Solo aplicamos el auto si el usuario no ha marcado su propio veredicto todavía
  if (!humanVerdict) applyVerdict(autoVerdict.state, autoVerdict.reasonKey);
}

function bindVerdictButtons() {
  document.querySelectorAll('.v-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const state = btn.dataset.verdict;
      document.querySelectorAll('.v-btn').forEach(b => b.classList.toggle('selected', b === btn));
      document.getElementById('verdict-red-detail').hidden = state !== 'red';
      humanVerdict = { state, modified_part: state === 'red' ? (document.getElementById('verdict-modified-part').value.trim() || null) : null };
      applyVerdict(state, 'verdict.reason.human');
      updateLastReportVerdict();
      if (state === 'red') document.getElementById('verdict-modified-part').focus();
    });
  });
  document.getElementById('verdict-modified-part').addEventListener('input', e => {
    if (humanVerdict?.state === 'red') {
      humanVerdict.modified_part = e.target.value.trim() || null;
      updateLastReportVerdict();
    }
  });
}
bindVerdictButtons();

function resetVerdict() {
  humanVerdict = null;
  document.querySelectorAll('.v-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('verdict-red-detail').hidden = true;
  document.getElementById('verdict-modified-part').value = '';
  applyVerdict('yellow', 'verdict.reason.default');
}

function updateLastReportVerdict() {
  if (!lastReport) return;
  lastReport.veredicto = {
    automatico: autoVerdict,
    humano: humanVerdict
  };
}

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
  resetChecklist();
  renderChecklist(kind);
  renderReverseSearch(sourceUrl);
  renderWayback(sourceUrl);

  // Tarjetas específicas por tipo de contenido
  document.getElementById('card-ela').hidden = kind !== 'image';
  resetElaCard();
  document.getElementById('card-frames').hidden = kind !== 'video';
  resetFramesCard();

  // Semáforo: reset al iniciar cada análisis
  resetVerdict();

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
    if (r.present && r.source === 'oficial') {
      const d = r.details;
      setCard('c2pa', `
        <p><span class="tag ok">Credenciales leídas (librería oficial)</span>${d.aiDeclared ? ' <span class="tag danger">Declara IA</span>' : ''}</p>
        <p class="small">
          ${d.generator ? `Generador: ${escape(d.generator)}<br>` : ''}
          ${d.issuer ? `Firmado por: ${escape(d.issuer)}<br>` : ''}
          ${d.time ? `Fecha de firma: ${escape(String(d.time))}<br>` : ''}
          ${d.validationIssues ? `Avisos de validación: ${d.validationIssues}` : ''}
        </p>
        <p class="small muted">${escape(d.note)}</p>`);
    } else if (r.present) {
      setCard('c2pa', `<p><span class="tag ok">Detectadas (heurística)</span></p><p>El archivo contiene marcas típicas de C2PA/JUMBF.</p><p class="small muted">${escape(r.details.note)}</p>`);
    } else {
      setCard('c2pa', `<p><span class="tag">No detectadas</span></p><p class="muted small">${escape(r.note || 'Sin marcas C2PA visibles.')}</p>`);
    }
    return r;
  });

  // pHash (solo imágenes; en vídeo se calcula por fotograma)
  const phashPromise = (kind === 'image' ? phashFromBlob(file) : Promise.resolve(null)).catch(() => null);

  // Hash y pHash resuelven en ~1s; no esperamos a C2PA (la librería WASM
  // puede tardar 15-20s la primera vez) para pintar la comparación con la base.
  const [hash, phash] = await Promise.all([hashPromise, phashPromise]);

  if (phash) {
    document.getElementById('hash-body').innerHTML += `
      <p class="small"><strong>pHash:</strong> <span class="mono">${phash}</span></p>
      <p class="small muted">${t('hash.phash', 'Hash perceptual: identifica la imagen aunque haya sido recomprimida o redimensionada.')}</p>`;
  }

  // DB match: exacto por SHA-256 + aproximado por pHash
  let dbResult = null;
  let similares = [];
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
  if (phash) {
    const simResult = await findByPhash(phash, hammingHex, PHASH_THRESHOLD);
    similares = simResult.similar.filter(s => !dbResult || !dbResult.matches.some(m => m.id === s.id));
    if (similares.length > 0) {
      const list = similares.map(c => `
        <li><a href="${c.ruta}" target="_blank"><strong>${escape(c.titulo)}</strong></a><br>
        <span class="small muted">${t('db.similar', 'Coincidencia aproximada por pHash')} · distancia ${c.distancia}/64 bits · ${escape(c.conclusion)}</span></li>
      `).join('');
      document.getElementById('db-body').innerHTML += `<p><span class="tag warn">≈ Coincidencia aproximada</span></p><ul>${list}</ul>`;
    }
  }

  const [exif, c2pa] = await Promise.all([exifPromise, c2paPromise]);

  lastReport = {
    source: sourceUrl ? 'url' : 'file',
    url: sourceUrl,
    file: { name: file.name, size: file.size, type: file.type },
    timestamp: new Date().toISOString(),
    sha256: hash,
    phash: phash,
    exif: exif.present ? { present: true, summary: exif.summary } : { present: false, note: exif.summary },
    c2pa: c2pa,
    coincidencias_base_publica: dbResult ? dbResult.matches : [],
    coincidencias_aproximadas: similares,
    afirmacion_para_contraste: claimInput.value.trim() || null
  };
  refreshAutoVerdict();
  updateLastReportVerdict();
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

// Estado de la checklist manual: id -> 'revisado' | 'anomalia'
let checklistState = {};
let checklistKind = 'image';

function renderChecklist(kind) {
  checklistKind = kind;
  const items = buildChecklist(kind);
  const el = document.getElementById('checklist');
  el.innerHTML = items.map(i => {
    const st = checklistState[i.id] || '';
    const mark = st === 'revisado' ? '✓' : st === 'anomalia' ? '⚠' : '◻';
    return `<li class="check-item ${st}" data-id="${i.id}" role="checkbox" aria-checked="${st ? 'true' : 'false'}" tabindex="0">
      <span class="check-mark" aria-hidden="true">${mark}</span>
      <strong>${escape(i.title)}</strong><span>${escape(i.hint)}</span>
    </li>`;
  }).join('');
  el.querySelectorAll('.check-item').forEach(li => {
    const toggle = () => {
      const id = li.dataset.id;
      const cur = checklistState[id] || '';
      const next = cur === '' ? 'revisado' : cur === 'revisado' ? 'anomalia' : '';
      if (next) checklistState[id] = next; else delete checklistState[id];
      renderChecklist(checklistKind);
      updateChecklistReport();
    };
    li.addEventListener('click', toggle);
    li.addEventListener('keydown', e => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); }
    });
  });
}

function resetChecklist() {
  checklistState = {};
  const otros = document.getElementById('checklist-otros-input');
  if (otros) otros.value = '';
  const st = document.getElementById('checklist-status');
  if (st) st.textContent = '';
}

function checklistTitles() {
  const map = {};
  buildChecklist(checklistKind).forEach(i => { map[i.id] = i.title; });
  return map;
}

function updateChecklistReport() {
  if (!lastReport) return;
  const titles = checklistTitles();
  lastReport.checklist_manual = {
    marcados: Object.entries(checklistState).map(([id, estado]) => ({
      id, titulo: titles[id] || id, estado
    })),
    otros: document.getElementById('checklist-otros-input').value.trim() || null
  };
}

document.getElementById('checklist-otros-input').addEventListener('input', updateChecklistReport);

document.getElementById('checklist-to-aportacion').addEventListener('click', () => {
  const titles = checklistTitles();
  const anomalias = Object.entries(checklistState)
    .filter(([, e]) => e === 'anomalia')
    .map(([id]) => titles[id] || id);
  const otros = document.getElementById('checklist-otros-input').value.trim();
  const parts = [];
  if (anomalias.length) parts.push(`Anomalías observadas en la checklist: ${anomalias.join(', ')}.`);
  if (otros) parts.push(otros);
  const status = document.getElementById('checklist-status');
  if (!parts.length) {
    status.textContent = t('checklist.nada', 'Marca alguna anomalía (⚠) o escribe una observación primero.');
    return;
  }
  status.textContent = '';
  const ap = document.getElementById('ap-aportacion');
  ap.value = (ap.value.trim() ? ap.value.trim() + '\n\n' : '') + parts.join('\n');
  tipoSel.value = anomalias.length ? 'manipulado' : 'contexto';
  tipoSel.dispatchEvent(new Event('change'));
  updateChecklistReport();
  document.getElementById('card-community').scrollIntoView({ behavior: 'smooth' });
});

function downloadReport() {
  if (!lastReport) return;
  // El rojo exige aclarar qué parte está modificada antes de exportar
  if (humanVerdict?.state === 'red' && !humanVerdict.modified_part) {
    alert(t('verdict.modified.required', 'Has marcado «Falso o modificado»: describe qué parte está modificada antes de descargar el informe.'));
    document.getElementById('verdict-modified-part').focus();
    return;
  }
  const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `freetrue-informe-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ------- ELA -------
const elaBtn = document.getElementById('ela-run');
const elaStatus = document.getElementById('ela-status');

elaBtn.addEventListener('click', async () => {
  if (!currentFile || !currentFile.type.startsWith('image')) return;
  elaBtn.disabled = true;
  elaStatus.textContent = t('ela.running', 'Calculando mapa ELA…');
  try {
    const res = await computeELA(currentFile);
    document.getElementById('ela-original').src = URL.createObjectURL(currentFile);
    document.getElementById('ela-map').src = res.dataUrl;
    document.getElementById('ela-result').hidden = false;
    elaStatus.textContent = '';
    if (lastReport) lastReport.ela = { ejecutado: true, timestamp: new Date().toISOString() };
  } catch (e) {
    elaStatus.textContent = 'Error: ' + e.message;
  } finally {
    elaBtn.disabled = false;
  }
});

function resetElaCard() {
  document.getElementById('ela-result').hidden = true;
  elaStatus.textContent = '';
  elaBtn.disabled = false;
}

// ------- Fotogramas de vídeo -------
const framesBtn = document.getElementById('frames-run');
const framesStatus = document.getElementById('frames-status');
let currentFrames = [];

framesBtn.addEventListener('click', async () => {
  if (!currentFile || !currentFile.type.startsWith('video')) return;
  framesBtn.disabled = true;
  framesStatus.textContent = t('frames.running', 'Extrayendo fotogramas…');
  try {
    currentFrames = await extractFrames(currentFile, 6);
    await renderFramesStrip(currentFrames);
    framesStatus.textContent = '';
    if (lastReport) {
      lastReport.fotogramas = {
        extraidos: currentFrames.length,
        phashes: currentFrames.map(f => f.phash || null)
      };
    }
  } catch (e) {
    framesStatus.textContent = 'Error: ' + e.message;
  } finally {
    framesBtn.disabled = false;
  }
});

async function renderFramesStrip(frames) {
  const strip = document.getElementById('frames-strip');
  strip.innerHTML = '';
  for (const [i, f] of frames.entries()) {
    try { f.phash = phashFromDrawable(f.canvas); } catch { f.phash = null; }
    let similarNote = '';
    if (f.phash) {
      const sim = await findByPhash(f.phash, hammingHex, PHASH_THRESHOLD);
      if (sim.similar.length) {
        similarNote = `<div class="frame-meta">≈ ${escape(sim.similar[0].titulo)} (d=${sim.similar[0].distancia})</div>`;
      }
    }
    const div = document.createElement('div');
    div.className = 'frame-item';
    div.innerHTML = `
      <img src="${f.dataUrl}" alt="Fotograma ${i + 1}" />
      <div class="frame-meta">t=${f.time.toFixed(1)}s${f.phash ? ` · pHash ${f.phash.slice(0, 8)}…` : ''}</div>
      ${similarNote}
      <div class="frame-actions">
        <a href="${f.dataUrl}" download="frame-${i + 1}.jpg">${escape(t('frames.download', '⬇ Frame'))}</a>
        <button type="button" data-frame="${i}" class="frame-ocr">${escape(t('frames.ocr', 'OCR'))}</button>
      </div>`;
    strip.appendChild(div);
  }
  strip.querySelectorAll('.frame-ocr').forEach(btn => {
    btn.addEventListener('click', async () => {
      const f = currentFrames[Number(btn.dataset.frame)];
      if (!f) return;
      btn.disabled = true; btn.textContent = '…';
      try {
        const res = await extractTextFromImage(f.blob, 'spa+eng');
        const q = buildQueryFromText(res.text || '');
        if (q) {
          claimInput.value = q;
          claimInput.dispatchEvent(new Event('input'));
          document.getElementById('card-news').scrollIntoView({ behavior: 'smooth' });
        }
        btn.textContent = q ? 'OCR ✓' : 'sin texto';
      } catch {
        btn.textContent = 'error';
      } finally {
        btn.disabled = false;
      }
    });
  });
}

function resetFramesCard() {
  currentFrames = [];
  document.getElementById('frames-strip').innerHTML = '';
  framesStatus.textContent = '';
  framesBtn.disabled = false;
}

// ------- Wayback Machine -------
function renderWayback(url) {
  const sec = document.getElementById('wayback-section');
  if (!url || !/^https?:/i.test(url)) { sec.hidden = true; return; }
  const wb = buildWaybackLinks(url);
  sec.hidden = false;
  document.getElementById('wayback-links').innerHTML = `
    <a href="${escape(wb.history)}" target="_blank" rel="noopener">${escape(t('wayback.history', 'Ver historial archivado'))}</a>
    <a href="${escape(wb.save)}" target="_blank" rel="noopener">${escape(t('wayback.save', 'Archivar ahora (preservar evidencia)'))}</a>`;
}

// ------- Compartir informe por URL e imprimir -------
document.getElementById('print-report').addEventListener('click', () => window.print());

document.getElementById('share-report').addEventListener('click', async () => {
  if (!lastReport) return;
  const compact = {
    v: 1,
    ts: lastReport.timestamp,
    src: lastReport.source,
    url: lastReport.url || null,
    file: lastReport.file ? { name: lastReport.file.name, type: lastReport.file.type, size: lastReport.file.size } : null,
    sha: lastReport.sha256 || null,
    ph: lastReport.phash || null,
    exif: lastReport.exif?.present ? (lastReport.exif.summary || true) : false,
    c2pa: lastReport.c2pa?.present ? (lastReport.c2pa.source || true) : false,
    claim: claimInput.value.trim() || null,
    ver: lastReport.veredicto || null,
    chk: lastReport.checklist_manual || null
  };
  const shareUrl = location.origin + location.pathname + '#informe=' + b64uEncode(JSON.stringify(compact));
  try {
    await navigator.clipboard.writeText(shareUrl);
    flashButton('share-report', t('share.copied', '✓ Enlace copiado'));
  } catch {
    prompt('Copia el enlace:', shareUrl);
  }
});

function flashButton(id, msg) {
  const btn = document.getElementById(id);
  const orig = btn.textContent;
  btn.textContent = msg;
  setTimeout(() => { btn.textContent = orig; }, 2500);
}

function b64uEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64uDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  return new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0)));
}

async function loadSharedReportFromHash() {
  const m = location.hash.match(/^#informe=(.+)$/);
  if (!m) return;
  let data;
  try { data = JSON.parse(b64uDecode(m[1])); } catch { return; }
  showResults();
  document.getElementById('shared-banner').hidden = false;
  const summary = document.getElementById('file-summary');
  summary.innerHTML = `<div class="meta">
    <strong>${escape(t('share.sharedreport', 'Informe compartido'))}</strong>
    ${data.file ? `<span>${escape(data.file.name)} · ${escape(data.file.type || '')}</span>` : ''}
    ${data.url ? `<span class="mono">${escape(data.url)}</span>` : ''}
    <span class="small muted">${escape(data.ts || '')}</span></div>`;
  setCard('hash', data.sha
    ? `<p class="mono">${escape(data.sha)}</p>${data.ph ? `<p class="small"><strong>pHash:</strong> <span class="mono">${escape(data.ph)}</span></p>` : ''}`
    : '<p class="muted">—</p>');
  setCard('exif', data.exif
    ? `<p><span class="tag ok">Presentes</span></p>${typeof data.exif === 'string' ? `<p class="small">${escape(data.exif)}</p>` : ''}`
    : '<p><span class="tag warn">Ausentes</span></p>');
  setCard('c2pa', data.c2pa
    ? `<p><span class="tag ok">Detectadas</span></p><p class="small muted">Fuente: ${escape(String(data.c2pa))}</p>`
    : '<p><span class="tag">No detectadas</span></p>');
  renderReverseSearch(data.url || null);
  renderWayback(data.url || null);
  resetChecklist();
  if (data.chk) {
    checklistState = Object.fromEntries((data.chk.marcados || []).map(m => [m.id, m.estado]));
    if (data.chk.otros) document.getElementById('checklist-otros-input').value = data.chk.otros;
  }
  renderChecklist('image');
  document.getElementById('card-ela').hidden = true;
  document.getElementById('card-frames').hidden = true;
  if (data.claim) {
    claimInput.value = data.claim;
    claimInput.dispatchEvent(new Event('input'));
  }
  // Re-verificación EN VIVO contra la base pública actual
  let matches = [];
  if (data.sha) {
    const r = await findBySha256(data.sha);
    matches = r.matches;
  }
  let similarHtml = '';
  if (data.ph) {
    const s = await findByPhash(data.ph, hammingHex, PHASH_THRESHOLD);
    if (s.similar.length) {
      similarHtml = `<p><span class="tag warn">≈ pHash</span></p><ul>${s.similar.map(c =>
        `<li><a href="${c.ruta}" target="_blank">${escape(c.titulo)}</a> (distancia ${c.distancia}/64)</li>`).join('')}</ul>`;
    }
  }
  setCard('db', (matches.length
    ? `<p><span class="tag warn">Coincidencia exacta</span></p><ul>${matches.map(c =>
        `<li><a href="${c.ruta}" target="_blank">${escape(c.titulo)}</a></li>`).join('')}</ul>`
    : '<p><span class="tag">Sin coincidencias exactas</span></p>') + similarHtml);
  // Veredicto del informe compartido
  if (data.ver?.humano?.state) {
    applyVerdict(data.ver.humano.state, 'verdict.reason.human');
    if (data.ver.humano.state === 'red' && data.ver.humano.modified_part) {
      document.getElementById('verdict-red-detail').hidden = false;
      document.getElementById('verdict-modified-part').value = data.ver.humano.modified_part;
    }
  } else if (data.ver?.automatico?.state) {
    applyVerdict(data.ver.automatico.state, data.ver.automatico.reasonKey);
  }
  lastReport = { compartido: true, ...data };
  document.getElementById('download-report').onclick = downloadReport;
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
