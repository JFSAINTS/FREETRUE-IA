// Generación básica de etiquetas a partir de texto libre.
// Sin ML: extrae entidades candidatas (mayúsculas seguidas), números con
// unidad, y palabras clave de un vocabulario de dominio. Suficiente como
// sugerencia — el usuario refina.

const STOPWORDS = new Set([
  // ES
  'el','la','los','las','un','una','de','del','y','o','a','en','por','para','con','sin','sobre','este','esta','estos','estas','es','son','fue','ha','han','no','sí','que','se','ya','al','le','les','su','sus','pero','como','muy','más','menos','esto','eso','aquel','aquella',
  // EN
  'the','a','an','of','and','or','to','in','on','for','with','without','about','this','these','those','is','are','was','were','has','have','not','no','yes','that','which','be','by','at','from','as','it','its','it\'s','but','so','if','than',
  // CA
  'el','la','els','les','un','una','de','del','i','o','a','en','per','amb','sense','sobre','aquest','aquesta','aquests','aquestes','és','són','ha','han','no','sí','que','es','ja','però','com','molt','més','menys'
]);

const DOMAIN_KEYWORDS = [
  'deepfake','ia','ai','generado','generated','manipulado','edited','edicion','gobierno','goverment','elecciones','election','vacuna','vaccine','guerra','war','migracion','migration','clima','climate','economia','economy','presidente','president','ministra','ministro','minister','parlamento','parliament','policia','police','ejercito','army','religion','iglesia','church','deportes','sports','ciencia','science','tecnologia','technology','judicial','justicia','crisis','protesta','manifestacion','protest','ataque','attack'
];

export function suggestTags(text, max = 8) {
  if (!text) return [];
  const clean = text.replace(/[«»"'“”‘’()\[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();

  const candidates = new Map(); // tag -> score

  // Entidades: secuencias de palabras capitalizadas (1-3 palabras)
  const propRe = /\b[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]+(?:\s+[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]+){0,2}\b/g;
  let m;
  while ((m = propRe.exec(clean)) !== null) {
    const tag = m[0].trim();
    if (tag.length < 3) continue;
    candidates.set(tag, (candidates.get(tag) || 0) + 3);
  }

  // Palabras del vocabulario de dominio
  const words = clean.toLowerCase().split(/\s+/);
  words.forEach(w => {
    const clean = w.replace(/[.,;:!¡?¿]/g, '');
    if (DOMAIN_KEYWORDS.includes(clean)) {
      candidates.set(clean, (candidates.get(clean) || 0) + 2);
    }
  });

  // Números con unidad monetaria/temporal
  const numRe = /\b\d+(?:[.,]\d+)?\s?(€|\$|USD|EUR|%|años|years|meses|months)\b/gi;
  while ((m = numRe.exec(clean)) !== null) {
    candidates.set(m[0].trim(), (candidates.get(m[0].trim()) || 0) + 1);
  }

  // Filtrar stopwords y ordenar
  const ranked = [...candidates.entries()]
    .filter(([tag]) => !STOPWORDS.has(tag.toLowerCase()) && tag.length >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([tag]) => tag);

  return ranked;
}
