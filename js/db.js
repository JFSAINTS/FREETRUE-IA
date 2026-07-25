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
