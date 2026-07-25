// Extracción de fotogramas de un vídeo, 100% en el navegador.
// Cada fotograma puede entonces analizarse como una imagen: OCR,
// búsqueda inversa, hash perceptual…

export async function extractFrames(file, count = 6, maxW = 640) {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  try {
    await withTimeout(once(video, 'loadedmetadata'), 10000, 'metadatos del vídeo');
    let dur = video.duration;
    if (!isFinite(dur) || dur <= 0) {
      // Algunos WebM generados en el navegador reportan Infinity hasta hacer
      // un seek al final — truco estándar para forzar el cálculo.
      video.currentTime = 1e10;
      await withTimeout(once(video, 'seeked'), 8000, 'duración del vídeo');
      dur = video.duration;
      if (!isFinite(dur) || dur <= 0) dur = video.currentTime || 1;
    }
    const times = [...Array(count)].map((_, i) =>
      Math.min(dur * (i + 0.5) / count, Math.max(dur - 0.05, 0)));
    const scale = Math.min(1, maxW / (video.videoWidth || maxW));
    const w = Math.max(2, Math.round((video.videoWidth || 320) * scale));
    const h = Math.max(2, Math.round((video.videoHeight || 240) * scale));
    const frames = [];
    for (const t of times) {
      video.currentTime = t;
      await withTimeout(once(video, 'seeked'), 8000, `seek a ${t.toFixed(1)}s`);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(video, 0, 0, w, h);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
      if (blob) {
        frames.push({ time: t, blob, dataUrl: c.toDataURL('image/jpeg', 0.7), canvas: c });
      }
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute('src');
    video.load();
  }
}

function once(el, ev) {
  return new Promise((resolve, reject) => {
    const ok = () => { cleanup(); resolve(); };
    const err = () => { cleanup(); reject(new Error('error del elemento de vídeo')); };
    const cleanup = () => {
      el.removeEventListener(ev, ok);
      el.removeEventListener('error', err);
    };
    el.addEventListener(ev, ok, { once: true });
    el.addEventListener('error', err, { once: true });
  });
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`Timeout esperando ${label}`)), ms))
  ]);
}
