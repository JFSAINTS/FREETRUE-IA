// Detección heurística de C2PA / Content Credentials.
//
// C2PA firma el contenido embebiendo una caja JUMBF (ISO 19566-5) que contiene
// un manifiesto CBOR firmado. Detectar la presencia de estas marcas no valida
// la firma criptográficamente (para eso hace falta la librería oficial de C2PA
// y una raíz de confianza), pero sí indica que el archivo declara credenciales
// de contenido — señal muy relevante.
//
// Firmas conocidas que buscamos en los primeros ~2 MB del archivo:
//   - "c2pa"    → marcador comúnmente presente en el manifiesto
//   - "jumb"    → cabecera de caja JUMBF
//   - "jumdc2pa" → tipo JUMBF específico de C2PA
//   - "urn:uuid:C2PA" → referencia a manifiestos

const SIGNATURES = ['c2pa', 'jumdc2pa', 'urn:uuid:C2PA', 'jumb'];

export async function detectC2PA(file) {
  try {
    const sliceSize = Math.min(file.size, 2 * 1024 * 1024); // 2 MB
    const buf = await file.slice(0, sliceSize).arrayBuffer();
    const bytes = new Uint8Array(buf);
    const text = new TextDecoder('latin1').decode(bytes);
    const hits = SIGNATURES.filter(sig => text.includes(sig));
    if (hits.length === 0) {
      return {
        present: false,
        details: null,
        note: 'No se detectan marcas C2PA en los primeros 2 MB. Ausencia no prueba nada: la mayoría de contenido en circulación aún no lleva C2PA.'
      };
    }
    return {
      present: true,
      details: {
        signaturesFound: hits,
        note: 'El archivo contiene marcas típicas de C2PA/JUMBF. Para verificar la firma criptográficamente hace falta la librería oficial de C2PA (fuera del alcance de esta detección heurística).'
      }
    };
  } catch (err) {
    return { present: false, details: null, error: err.message };
  }
}
