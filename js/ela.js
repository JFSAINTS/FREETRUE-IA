// ELA — Error Level Analysis, en el navegador.
//
// Técnica forense clásica: se recomprime la imagen como JPEG y se amplifica
// la diferencia con el original. Las zonas editadas o pegadas suelen tener
// un nivel de error distinto al resto (brillan diferente en el mapa).
//
// LIMITACIONES (mostrar siempre al usuario):
// - Más fiable sobre JPEG originales; en PNG o imágenes muy recomprimidas
//   el resultado es difuso.
// - Un ELA "uniforme" no prueba autenticidad, y zonas brillantes pueden ser
//   bordes o texturas de alto contraste, no ediciones. Es UNA señal más.

export async function computeELA(file, { quality = 0.75, amplify = 20, maxW = 1000 } = {}) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxW / bmp.width);
  const w = Math.max(2, Math.round(bmp.width * scale));
  const h = Math.max(2, Math.round(bmp.height * scale));

  const c1 = document.createElement('canvas');
  c1.width = w; c1.height = h;
  const ctx1 = c1.getContext('2d', { willReadFrequently: true });
  ctx1.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();

  const jpegUrl = c1.toDataURL('image/jpeg', quality);
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = () => rej(new Error('No se pudo recomprimir la imagen'));
    img.src = jpegUrl;
  });

  const c2 = document.createElement('canvas');
  c2.width = w; c2.height = h;
  const ctx2 = c2.getContext('2d', { willReadFrequently: true });
  ctx2.drawImage(img, 0, 0, w, h);

  const d1 = ctx1.getImageData(0, 0, w, h);
  const d2 = ctx2.getImageData(0, 0, w, h);
  const out = ctx2.createImageData(w, h);
  for (let i = 0; i < d1.data.length; i += 4) {
    out.data[i]     = Math.min(255, Math.abs(d1.data[i]     - d2.data[i])     * amplify);
    out.data[i + 1] = Math.min(255, Math.abs(d1.data[i + 1] - d2.data[i + 1]) * amplify);
    out.data[i + 2] = Math.min(255, Math.abs(d1.data[i + 2] - d2.data[i + 2]) * amplify);
    out.data[i + 3] = 255;
  }
  ctx2.putImageData(out, 0, 0);

  return { dataUrl: c2.toDataURL('image/png'), width: w, height: h };
}
