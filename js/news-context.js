// Contexto de la noticia: OCR + búsqueda en medios y verificadores.
//
// OCR usando Tesseract.js (~5 MB, se carga bajo demanda al pulsar el botón).
// Los enlaces se generan sobre la afirmación detectada o escrita por el usuario.

let tesseractPromise = null;
function loadTesseract() {
  if (!tesseractPromise) {
    tesseractPromise = import('https://esm.sh/tesseract.js@5.1.1')
      .then(m => m.default || m);
  }
  return tesseractPromise;
}

export async function extractTextFromImage(file, lang = 'spa+eng', onProgress) {
  const Tesseract = await loadTesseract();
  const worker = await Tesseract.createWorker(lang, 1, {
    logger: m => {
      if (onProgress && m.status === 'recognizing text') {
        onProgress(m.progress);
      }
    }
  });
  try {
    const { data } = await worker.recognize(file);
    return {
      text: (data.text || '').trim(),
      confidence: data.confidence || 0
    };
  } finally {
    await worker.terminate();
  }
}

// Extrae una consulta razonable a partir de un bloque de texto largo:
// - toma las 2-3 líneas más cargadas de información
// - o hasta ~180 caracteres para que quepa en un buscador
export function buildQueryFromText(text) {
  if (!text) return '';
  const clean = text
    .replace(/[\r\t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 12); // descartar líneas muy cortas (ruido de OCR)
  if (clean.length === 0) return text.slice(0, 180).trim();
  // Prioriza líneas con verbos comunes o cifras
  const scored = clean.map(l => ({
    line: l,
    score: (l.match(/\d/g) || []).length
         + (/\b(dice|declara|afirma|anuncia|confirma|niega|denuncia|acusa|revela|advierte|asegura|says|announces|denies|confirms)\b/i.test(l) ? 5 : 0)
         + Math.min(l.length / 40, 3)
  })).sort((a, b) => b.score - a.score);
  let query = '';
  for (const s of scored) {
    if ((query + ' ' + s.line).length > 200) break;
    query = query ? query + ' ' + s.line : s.line;
  }
  return query.slice(0, 200).trim();
}

// Genera enlaces de búsqueda en medios generalistas + verificadores.
// La query se codifica una sola vez.
export function buildNewsSearchLinks(query) {
  const q = (query || '').trim();
  if (!q) return { general: [], factcheck: [] };
  const enc = encodeURIComponent(q);
  const encQuoted = encodeURIComponent(`"${q.slice(0, 90)}"`);

  const general = [
    { name: 'Google News',   url: `https://news.google.com/search?q=${enc}&hl=es` },
    { name: 'Google (web)',  url: `https://www.google.com/search?q=${encQuoted}` },
    { name: 'Bing News',     url: `https://www.bing.com/news/search?q=${enc}` },
    { name: 'DuckDuckGo',    url: `https://duckduckgo.com/?q=${enc}&iar=news` },
    { name: 'Yandex News',   url: `https://yandex.com/news/search?text=${enc}` }
  ];

  // Verificadores de bulos (España, Latinoamérica e internacionales).
  // Usamos site: en Google porque la mayoría no tienen buscador embebible.
  const factcheck = [
    { name: 'Maldita.es',        url: `https://www.google.com/search?q=site:maldita.es+${enc}` },
    { name: 'Newtral',           url: `https://www.google.com/search?q=site:newtral.es+${enc}` },
    { name: 'EFE Verifica',      url: `https://www.google.com/search?q=site:verifica.efe.com+${enc}` },
    { name: 'AFP Factual',       url: `https://www.google.com/search?q=site:factual.afp.com+${enc}` },
    { name: 'Verificat',         url: `https://www.google.com/search?q=site:verificat.cat+${enc}` },
    { name: 'Chequeado (AR)',    url: `https://www.google.com/search?q=site:chequeado.com+${enc}` },
    { name: 'El Sabueso (MX)',   url: `https://www.google.com/search?q=site:animalpolitico.com+${enc}` },
    { name: 'Colombiacheck',     url: `https://www.google.com/search?q=site:colombiacheck.com+${enc}` },
    { name: 'Aos Fatos (BR)',    url: `https://www.google.com/search?q=site:aosfatos.org+${enc}` },
    { name: 'Agência Lupa (BR)', url: `https://www.google.com/search?q=site:lupa.uol.com.br+${enc}` },
    { name: 'Snopes',            url: `https://www.snopes.com/?s=${enc}` },
    { name: 'PolitiFact',        url: `https://www.politifact.com/search/?q=${enc}` },
    { name: 'Full Fact (UK)',    url: `https://fullfact.org/search/?q=${enc}` }
  ];

  return { general, factcheck };
}

// Enlaces a la Wayback Machine: ver el historial archivado de una URL y
// archivarla ahora mismo para preservar la evidencia antes de que cambie.
export function buildWaybackLinks(url) {
  if (!url) return null;
  return {
    history: `https://web.archive.org/web/*/${url}`,
    save: `https://web.archive.org/save/${encodeURIComponent(url)}`
  };
}

// Para URLs: intento obtener título / descripción de la página.
// Bloqueado por CORS en la mayoría de sitios; degradación silenciosa.
export async function fetchPageMetadata(url) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return null;
    const html = await res.text();
    const pick = (re) => {
      const m = html.match(re);
      return m ? decodeHTMLEntities(m[1].trim()) : null;
    };
    return {
      title:
        pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
        pick(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i) ||
        pick(/<title[^>]*>([^<]+)<\/title>/i),
      description:
        pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
        pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i),
      site:
        pick(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
    };
  } catch {
    return null;
  }
}

function decodeHTMLEntities(s) {
  const el = document.createElement('textarea');
  el.innerHTML = s;
  return el.value;
}
