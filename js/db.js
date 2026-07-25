// Carga el índice de la base de casos pública y busca coincidencias por hash.

let indexPromise = null;

async function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetch('casos/index.json', { cache: 'no-cache' })
      .then(r => r.ok ? r.json() : { casos: [] })
      .catch(() => ({ casos: [] }));
  }
  return indexPromise;
}

export async function findBySha256(sha) {
  const idx = await loadIndex();
  const matches = (idx.casos || []).filter(c => (c.sha256 || '').toLowerCase() === sha.toLowerCase());
  return {
    total: (idx.casos || []).length,
    matches,
    updated: idx.actualizado || null
  };
}

// Coincidencia aproximada por hash perceptual: encuentra casos cuya imagen
// es "la misma a ojo" aunque los bytes hayan cambiado (recompresión, resize).
export async function findByPhash(phash, hammingFn, threshold = 10) {
  const idx = await loadIndex();
  const similar = [];
  for (const c of (idx.casos || [])) {
    if (!c.phash) continue;
    const d = hammingFn(phash, c.phash);
    if (d <= threshold) similar.push({ ...c, distancia: d });
  }
  similar.sort((a, b) => a.distancia - b.distancia);
  return { total: (idx.casos || []).length, similar };
}
