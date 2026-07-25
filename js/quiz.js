// Quiz educativo "¿Sabes mirar?" — preguntas por idioma, sin backend.

import { init as initI18n, setLang, currentLang, onLangChange, t } from './i18n.js';
import { initTheme } from './theme.js';

initTheme();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

const QUESTIONS = {
  es: [
    { q: 'Ves un vídeo indignante que te empuja a compartirlo YA. ¿Cuál es el primer paso correcto?',
      o: ['Compartirlo con un aviso de «no verificado»', 'Pausar 30 segundos antes de hacer nada', 'Preguntar en los comentarios si es real', 'Compartirlo solo con familiares'],
      c: 1, e: 'La desinformación viaja sobre la emoción. La pausa rompe el mecanismo: si algo te empuja fuerte a compartir, es el momento exacto de detenerte.' },
    { q: 'Una noticia bomba solo aparece en una cuenta anónima con 200 seguidores. Ningún medio la recoge. ¿Qué indica?',
      o: ['Que los medios la censuran', 'Nada, los medios tardan en llegar', 'Señal fuerte de que es falsa o no verificada', 'Que es una exclusiva'],
      c: 2, e: 'Una historia de gran impacto que ningún medio independiente recoge es la señal más simple y potente de alarma. Las exclusivas reales las confirman otros medios en horas.' },
    { q: 'En una foto, una persona tiene seis dedos y el texto de un cartel del fondo es ilegible. ¿Qué sugiere?',
      o: ['Un fallo de la cámara', 'Compresión de la imagen', 'Generación por IA', 'Nada relevante'],
      c: 2, e: 'Manos anómalas y texto incoherente son dos de los artefactos más típicos de los generadores de imagen por IA actuales.' },
    { q: 'Una imagen no tiene metadatos EXIF. ¿Qué prueba eso?',
      o: ['Que fue manipulada', 'Que es IA', 'Nada: las redes sociales los eliminan al subirla', 'Que es una captura de pantalla'],
      c: 2, e: 'La ausencia de EXIF no prueba nada — casi todas las plataformas los eliminan. La presencia de EXIF coherentes sí aporta pistas; su ausencia, no.' },
    { q: 'Haces búsqueda inversa de la foto de una «manifestación de ayer» y aparece publicada en 2019 en otro país. ¿Conclusión?',
      o: ['La foto de 2019 es la falsa', 'Contenido reciclado: real pero descontextualizado', 'Es una coincidencia', 'La búsqueda inversa falla a menudo'],
      c: 1, e: 'Es el tipo de bulo más común: una imagen real usada fuera de contexto. La búsqueda inversa es la herramienta que mejor lo destapa.' },
    { q: 'En un vídeo, los labios no cuadran del todo con el audio y hay un «halo» tembloroso alrededor de la cara. ¿Qué sospechas?',
      o: ['Mala conexión al grabarlo', 'Posible deepfake', 'Compresión del vídeo', 'Doblaje a otro idioma'],
      c: 1, e: 'Desincronía labial y jitter alrededor del rostro son artefactos clásicos de los deepfakes. No son prueba definitiva, pero obligan a verificar la fuente original.' },
    { q: 'Un archivo lleva credenciales C2PA válidas que declaran «generado con IA». ¿Qué fiabilidad tiene esa señal?',
      o: ['Ninguna, se pueden falsificar fácilmente', 'Alta: es una firma criptográfica del propio generador', 'Media: depende del país', 'Solo vale en fotos, no en vídeo'],
      c: 1, e: 'C2PA es una firma criptográfica embebida por la herramienta que creó el contenido. Puede eliminarse, pero no falsificarse fácilmente: si está y declara IA, es de las señales más fiables que existen.' },
    { q: 'Un tuit afirma: «El ministro dijo que subirá el IVA al 30%», sin vídeo ni enlace. ¿Qué exiges antes de creerlo?',
      o: ['Que tenga muchos retuits', 'Que lo diga una cuenta verificada', 'La fuente original: vídeo o transcripción completa en contexto', 'Que lo repitan varias cuentas'],
      c: 2, e: 'La cita sin fuente es la forma más barata de mentir. Ni viralidad ni insignias sustituyen a la fuente original completa y en contexto.' }
  ],
  en: [
    { q: 'You see an outrageous video pushing you to share it NOW. What is the correct first step?',
      o: ['Share it with an «unverified» warning', 'Pause 30 seconds before doing anything', 'Ask in the comments if it is real', 'Share it only with family'],
      c: 1, e: 'Disinformation travels on emotion. The pause breaks the mechanism: if something pushes you hard to share, that is exactly the moment to stop.' },
    { q: 'A bombshell story only appears on an anonymous account with 200 followers. No outlet covers it. What does that indicate?',
      o: ['The media are censoring it', 'Nothing, media are slow', 'Strong signal it is false or unverified', 'It is a scoop'],
      c: 2, e: 'A high-impact story no independent outlet picks up is the simplest and strongest red flag. Real scoops get confirmed by other outlets within hours.' },
    { q: 'In a photo, a person has six fingers and a background sign is unreadable. What does that suggest?',
      o: ['A camera glitch', 'Image compression', 'AI generation', 'Nothing relevant'],
      c: 2, e: 'Anomalous hands and incoherent text are two of the most typical artifacts of current AI image generators.' },
    { q: 'An image has no EXIF metadata. What does that prove?',
      o: ['It was manipulated', 'It is AI', 'Nothing: social networks strip them on upload', 'It is a screenshot'],
      c: 2, e: 'Missing EXIF proves nothing — almost every platform strips them. Coherent EXIF present is a clue; its absence is not.' },
    { q: 'Reverse-searching the photo of «yesterday\'s protest» shows it published in 2019 in another country. Conclusion?',
      o: ['The 2019 photo is the fake one', 'Recycled content: real but out of context', 'It is a coincidence', 'Reverse search often fails'],
      c: 1, e: 'The most common type of hoax: a real image used out of context. Reverse search is the tool that best exposes it.' },
    { q: 'In a video, lips do not quite match the audio and there is a shaky «halo» around the face. What do you suspect?',
      o: ['Bad connection while recording', 'Possible deepfake', 'Video compression', 'Dubbing into another language'],
      c: 1, e: 'Lip-sync mismatch and facial jitter are classic deepfake artifacts. Not definitive proof, but they demand verifying the original source.' },
    { q: 'A file carries valid C2PA credentials declaring «AI-generated». How reliable is that signal?',
      o: ['Not at all, easily forged', 'High: it is a cryptographic signature from the generator itself', 'Medium: depends on the country', 'Only valid for photos, not video'],
      c: 1, e: 'C2PA is a cryptographic signature embedded by the tool that created the content. It can be removed, but not easily forged: if present and declaring AI, it is among the most reliable signals.' },
    { q: 'A tweet claims: «The minister said VAT will rise to 30%», with no video or link. What do you demand before believing it?',
      o: ['Many retweets', 'A verified account saying it', 'The original source: full video or transcript in context', 'Several accounts repeating it'],
      c: 2, e: 'The unsourced quote is the cheapest way to lie. Neither virality nor badges substitute for the complete original source in context.' }
  ],
  ca: [
    { q: 'Veus un vídeo indignant que t\'empeny a compartir-lo JA. Quin és el primer pas correcte?',
      o: ['Compartir-lo amb un avís de «no verificat»', 'Fer una pausa de 30 segons abans de fer res', 'Preguntar als comentaris si és real', 'Compartir-lo només amb la família'],
      c: 1, e: 'La desinformació viatja sobre l\'emoció. La pausa trenca el mecanisme: si alguna cosa t\'empeny fort a compartir, és el moment exacte d\'aturar-te.' },
    { q: 'Una notícia bomba només apareix en un compte anònim amb 200 seguidors. Cap mitjà la recull. Què indica?',
      o: ['Que els mitjans la censuren', 'Res, els mitjans triguen', 'Senyal fort que és falsa o no verificada', 'Que és una exclusiva'],
      c: 2, e: 'Una història de gran impacte que cap mitjà independent recull és el senyal més simple i potent d\'alarma. Les exclusives reals es confirmen en hores.' },
    { q: 'En una foto, una persona té sis dits i el text d\'un cartell del fons és il·legible. Què suggereix?',
      o: ['Una fallada de la càmera', 'Compressió de la imatge', 'Generació per IA', 'Res rellevant'],
      c: 2, e: 'Mans anòmales i text incoherent són dos dels artefactes més típics dels generadors d\'imatge per IA actuals.' },
    { q: 'Una imatge no té metadades EXIF. Què prova això?',
      o: ['Que fou manipulada', 'Que és IA', 'Res: les xarxes socials les eliminen en pujar-la', 'Que és una captura de pantalla'],
      c: 2, e: 'L\'absència d\'EXIF no prova res — gairebé totes les plataformes les eliminen. La presència d\'EXIF coherents sí que aporta pistes; la seva absència, no.' },
    { q: 'Fas cerca inversa de la foto d\'una «manifestació d\'ahir» i apareix publicada el 2019 en un altre país. Conclusió?',
      o: ['La foto de 2019 és la falsa', 'Contingut reciclat: real però descontextualitzat', 'És una coincidència', 'La cerca inversa falla sovint'],
      c: 1, e: 'És el tipus de bulo més comú: una imatge real usada fora de context. La cerca inversa és l\'eina que millor ho destapa.' },
    { q: 'En un vídeo, els llavis no quadren del tot amb l\'àudio i hi ha un «halo» tremolós al voltant de la cara. Què sospites?',
      o: ['Mala connexió en gravar-lo', 'Possible deepfake', 'Compressió del vídeo', 'Doblatge a un altre idioma'],
      c: 1, e: 'Desincronia labial i jitter al voltant del rostre són artefactes clàssics dels deepfakes. No són prova definitiva, però obliguen a verificar la font original.' },
    { q: 'Un arxiu porta credencials C2PA vàlides que declaren «generat amb IA». Quina fiabilitat té aquest senyal?',
      o: ['Cap, es poden falsificar fàcilment', 'Alta: és una signatura criptogràfica del propi generador', 'Mitjana: depèn del país', 'Només val en fotos, no en vídeo'],
      c: 1, e: 'C2PA és una signatura criptogràfica incrustada per l\'eina que va crear el contingut. Es pot eliminar, però no falsificar fàcilment: si hi és i declara IA, és dels senyals més fiables.' },
    { q: 'Un tuit afirma: «El ministre va dir que apujarà l\'IVA al 30%», sense vídeo ni enllaç. Què exigeixes abans de creure-ho?',
      o: ['Que tingui molts retuits', 'Que ho digui un compte verificat', 'La font original: vídeo o transcripció completa en context', 'Que ho repeteixin diversos comptes'],
      c: 2, e: 'La cita sense font és la manera més barata de mentir. Ni viralitat ni insígnies substitueixen la font original completa i en context.' }
  ]
};

let idx = 0;
let score = 0;
let selected = null;
let answered = false;

const $ = id => document.getElementById(id);

function questions() {
  return QUESTIONS[currentLang()] || QUESTIONS.es;
}

function renderQuestion() {
  const qs = questions();
  const q = qs[idx];
  $('quiz-final').hidden = true;
  $('quiz-card').hidden = false;
  $('quiz-progress').textContent = `${idx + 1} / ${qs.length} · ${t('quiz.score', 'Aciertos')}: ${score}`;
  $('quiz-question').textContent = q.q;
  $('quiz-feedback').hidden = true;
  $('quiz-check').hidden = false;
  $('quiz-check').disabled = false;
  $('quiz-next').hidden = true;
  selected = null;
  answered = false;
  $('quiz-options').innerHTML = q.o.map((opt, i) =>
    `<button type="button" class="quiz-opt" data-i="${i}">${escapeHtml(opt)}</button>`).join('');
  $('quiz-options').querySelectorAll('.quiz-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      if (answered) return;
      selected = Number(btn.dataset.i);
      $('quiz-options').querySelectorAll('.quiz-opt').forEach(b =>
        b.classList.toggle('selected', b === btn));
    });
  });
}

function check() {
  if (selected == null || answered) return;
  answered = true;
  const q = questions()[idx];
  const ok = selected === q.c;
  if (ok) score++;
  $('quiz-options').querySelectorAll('.quiz-opt').forEach((b, i) => {
    b.classList.toggle('correct', i === q.c);
    b.classList.toggle('incorrect', i === selected && !ok);
    b.disabled = true;
  });
  const fb = $('quiz-feedback');
  fb.hidden = false;
  fb.innerHTML = `<strong>${ok ? t('quiz.correct', '✓ Correcto') : t('quiz.incorrect', '✗ No exactamente')}</strong><br>${escapeHtml(q.e)}`;
  fb.className = 'quiz-feedback ' + (ok ? 'ok' : 'ko');
  $('quiz-check').hidden = true;
  $('quiz-next').hidden = false;
  $('quiz-progress').textContent = `${idx + 1} / ${questions().length} · ${t('quiz.score', 'Aciertos')}: ${score}`;
}

function next() {
  idx++;
  if (idx >= questions().length) {
    finish();
  } else {
    renderQuestion();
  }
}

function finish() {
  const total = questions().length;
  $('quiz-card').hidden = true;
  $('quiz-final').hidden = false;
  $('quiz-score').textContent = `${t('quiz.score', 'Aciertos')}: ${score} / ${total}`;
  const ratio = score / total;
  $('quiz-final-msg').textContent =
    ratio >= 0.85 ? t('quiz.final.good', '') :
    ratio >= 0.5 ? t('quiz.final.mid', '') :
    t('quiz.final.low', '');
}

function restart() {
  idx = 0; score = 0;
  renderQuestion();
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

$('quiz-check').addEventListener('click', check);
$('quiz-next').addEventListener('click', next);
$('quiz-retry').addEventListener('click', restart);

initI18n().then(() => {
  const sw = $('lang-switcher');
  if (sw) {
    sw.value = currentLang();
    sw.addEventListener('change', () => setLang(sw.value));
  }
  restart();
});
onLangChange(() => restart());
