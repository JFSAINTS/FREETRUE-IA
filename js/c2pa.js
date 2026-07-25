// Detección de C2PA / Content Credentials.
//
// Estrategia en dos niveles:
//   1. Librería OFICIAL c2pa-js (WASM desde CDN): lee y valida el manifiesto
//      de verdad — quién firmó, con qué herramienta, si declara IA.
//   2. Si la librería no carga (sin red al CDN, formato no soportado…),
//      caemos a la detección heurística de firmas JUMBF en los primeros 2 MB.
//
// El resultado siempre indica `source: 'oficial' | 'heuristica'` para que
// la UI pueda explicar el nivel de confianza de la señal.

const SIGNATURES = ['c2pa', 'jumdc2pa', 'urn:uuid:C2PA', 'jumb'];

let officialPromise = null;
function loadOfficial() {
  if (!officialPromise) {
    officialPromise = (async () => {
      const mod = await import('https://cdn.jsdelivr.net/npm/c2pa@0/+esm');
      const create = mod.createC2pa || mod.default?.createC2pa;
      if (!create) throw new Error('API createC2pa no disponible');
      return create({
        wasmSrc: 'https://cdn.jsdelivr.net/npm/c2pa@0/dist/assets/wasm/toolkit_bg.wasm',
        workerSrc: 'https://cdn.jsdelivr.net/npm/c2pa@0/dist/c2pa.worker.min.js'
      });
    })();
    // si falla, permitir reintento en el siguiente análisis
    officialPromise.catch(() => { officialPromise = null; });
  }
  return officialPromise;
}

export async function detectC2PA(file) {
  // ---- Nivel 1: librería oficial ----
  try {
    const c2pa = await withTimeout(loadOfficial(), 20000);
    const result = await withTimeout(c2pa.read(file), 20000);
    const store = result?.manifestStore;
    const active = store?.activeManifest;
    if (active) {
      const generator = active.claimGenerator || null;
      const issuer = active.signatureInfo?.issuer || null;
      const time = active.signatureInfo?.time || null;
      const title = active.title || null;
      // Buscar declaración de IA en las aserciones (digitalSourceType)
      let aiDeclared = false;
      try {
        const raw = JSON.stringify(active.assertions?.data ?? active.assertions ?? {});
        aiDeclared = /trainedAlgorithmicMedia|compositeWithTrainedAlgorithmicMedia/i.test(raw);
      } catch { /* sin aserciones legibles */ }
      return {
        present: true,
        source: 'oficial',
        details: {
          title,
          generator,
          issuer,
          time,
          aiDeclared,
          validationIssues: (store.validationStatus || []).length,
          note: aiDeclared
            ? 'El manifiesto C2PA declara contenido generado o compuesto con IA.'
            : 'Credenciales C2PA presentes y leídas con la librería oficial.'
        }
      };
    }
    return {
      present: false,
      source: 'oficial',
      details: null,
      note: 'La librería oficial C2PA no encontró credenciales en el archivo. La mayoría del contenido en circulación aún no las lleva; su ausencia no prueba nada.'
    };
  } catch {
    // caer a la heurística
  }

  // ---- Nivel 2: heurística JUMBF ----
  try {
    const sliceSize = Math.min(file.size, 2 * 1024 * 1024);
    const buf = await file.slice(0, sliceSize).arrayBuffer();
    const text = new TextDecoder('latin1').decode(new Uint8Array(buf));
    const hits = SIGNATURES.filter(sig => text.includes(sig));
    if (hits.length === 0) {
      return {
        present: false,
        source: 'heuristica',
        details: null,
        note: 'No se detectan marcas C2PA en los primeros 2 MB (detección heurística; la librería oficial no pudo cargarse). Ausencia no prueba nada.'
      };
    }
    return {
      present: true,
      source: 'heuristica',
      details: {
        signaturesFound: hits,
        note: 'El archivo contiene marcas típicas de C2PA/JUMBF (detección heurística sin validación de firma).'
      }
    };
  } catch (err) {
    return { present: false, source: 'heuristica', details: null, error: err.message };
  }
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout C2PA')), ms))
  ]);
}
