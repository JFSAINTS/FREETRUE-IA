// Generadores de URLs a buscadores de imagen inversa.
// Cuando tenemos URL, podemos pasarla directamente.
// Cuando tenemos solo archivo local, generamos enlaces a la home de cada
// buscador (el usuario sube manualmente — no podemos "subir por él" por
// razones obvias de seguridad/CORS).

export function buildReverseSearchLinks(imageUrl) {
  const enc = imageUrl ? encodeURIComponent(imageUrl) : '';
  return [
    {
      name: 'Google Lens',
      note: imageUrl ? 'búsqueda por URL' : 'sube la imagen manualmente',
      url: imageUrl
        ? `https://lens.google.com/uploadbyurl?url=${enc}`
        : 'https://lens.google.com/'
    },
    {
      name: 'TinEye',
      note: imageUrl ? 'búsqueda por URL' : 'sube la imagen manualmente',
      url: imageUrl
        ? `https://tineye.com/search?url=${enc}`
        : 'https://tineye.com/'
    },
    {
      name: 'Yandex Images',
      note: imageUrl ? 'búsqueda por URL' : 'sube la imagen manualmente',
      url: imageUrl
        ? `https://yandex.com/images/search?rpt=imageview&url=${enc}`
        : 'https://yandex.com/images/'
    },
    {
      name: 'Bing Visual',
      note: 'sube la imagen manualmente',
      url: 'https://www.bing.com/visualsearch'
    }
  ];
}
