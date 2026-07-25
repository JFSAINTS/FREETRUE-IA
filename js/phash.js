// Hash perceptual (dHash 64-bit).
//
// A diferencia del SHA-256 (que cambia con un solo byte), el dHash captura
// la ESTRUCTURA visual de la imagen: sobrevive a recompresiones, cambios de
// tamaño y pequeños recortes — exactamente lo que le ocurre a un contenido
// al viralizarse. Dos imágenes "iguales a ojo" tienen hashes a distancia de
// Hamming pequeña.

const W = 9, H = 8; // 8x8 comparaciones horizontales = 64 bits

export async function phashFromBlob(blob) {
  const bmp = await createImageBitmap(blob);
  try {
    return phashFromDrawable(bmp);
  } finally {
    bmp.close?.();
  }
}

// drawable: ImageBitmap, HTMLCanvasElement, HTMLImageElement o HTMLVideoElement
export function phashFromDrawable(drawable) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(drawable, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);
  let bits = '';
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W - 1; x++) {
      const i = (y * W + x) * 4;
      const j = i + 4;
      const l1 = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const l2 = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
      bits += l1 > l2 ? '1' : '0';
    }
  }
  let hex = '';
  for (let k = 0; k < 64; k += 4) {
    hex += parseInt(bits.slice(k, k + 4), 2).toString(16);
  }
  return hex;
}

// Distancia de Hamming entre dos hashes hex de igual longitud.
export function hammingHex(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

// Umbral orientativo: ≤ 10 bits de 64 suele indicar "misma imagen
// recomprimida/redimensionada". Entre 11 y 16, parecido sospechoso.
export const PHASH_THRESHOLD = 10;
