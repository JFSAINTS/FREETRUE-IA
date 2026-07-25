// Extracción de metadatos EXIF usando exifr (CDN, sin build).
// Devuelve { present, summary, raw } — nunca lanza excepciones al llamador.

let exifrPromise = null;
function loadExifr() {
  if (!exifrPromise) {
    exifrPromise = import('https://cdn.jsdelivr.net/npm/exifr@7.1.3/dist/full.esm.mjs')
      .then(m => m.default || m);
  }
  return exifrPromise;
}

export async function extractExif(file) {
  try {
    const exifr = await loadExifr();
    const raw = await exifr.parse(file, {
      tiff: true, exif: true, gps: true, iptc: true, xmp: true,
      icc: false, jfif: true, ihdr: true, translateKeys: true, translateValues: true,
      reviveValues: true, mergeOutput: true, silentErrors: true
    });
    if (!raw || Object.keys(raw).length === 0) {
      return { present: false, summary: 'Sin metadatos EXIF/XMP legibles.', raw: null };
    }
    const summary = summarize(raw);
    return { present: true, summary, raw };
  } catch (err) {
    return {
      present: false,
      summary: `No se pudieron leer metadatos (${err.message || 'error desconocido'}).`,
      raw: null,
      error: err.message
    };
  }
}

function summarize(raw) {
  const parts = [];
  const cam = [raw.Make, raw.Model].filter(Boolean).join(' ');
  if (cam) parts.push(`Cámara: ${cam}`);
  const date = raw.DateTimeOriginal || raw.CreateDate || raw.ModifyDate;
  if (date) parts.push(`Fecha: ${formatDate(date)}`);
  if (raw.Software) parts.push(`Software: ${raw.Software}`);
  if (raw.latitude && raw.longitude) parts.push(`GPS: ${raw.latitude.toFixed(4)}, ${raw.longitude.toFixed(4)}`);
  if (raw.ImageWidth && raw.ImageHeight) parts.push(`Dimensiones: ${raw.ImageWidth}×${raw.ImageHeight}`);
  return parts.length ? parts.join(' · ') : 'Metadatos presentes, resumen no disponible.';
}

function formatDate(d) {
  if (d instanceof Date) return d.toISOString().replace('T', ' ').slice(0, 19);
  return String(d);
}
