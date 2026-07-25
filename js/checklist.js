// Checklist de inspección manual, adaptada al tipo de contenido.

const IMAGE_CHECKS = [
  { title: 'Manos y dedos', hint: 'Número de dedos, longitudes anómalas, articulaciones raras.' },
  { title: 'Ojos y dientes', hint: 'Reflejos incoherentes entre ojos, dientes fusionados o dobles.' },
  { title: 'Orejas y joyería', hint: 'Asimetrías extrañas, pendientes distintos entre lados.' },
  { title: 'Texto en la imagen', hint: 'Carteles, matrículas, camisetas: la IA todavía falla con texto.' },
  { title: 'Fondos y multitudes', hint: 'Caras "derretidas", objetos que se funden entre sí.' },
  { title: 'Sombras y reflejos', hint: '¿Coinciden con la dirección de la luz? ¿Los espejos muestran lo esperado?' },
  { title: 'Continuidad de patrones', hint: 'Cadenas, gafas, correas: ¿continúan de forma coherente?' }
];

const VIDEO_CHECKS = [
  ...IMAGE_CHECKS,
  { title: 'Sincronía labial', hint: 'Micro-desfases entre voz y movimiento de labios.' },
  { title: 'Parpadeo', hint: 'Frecuencia y naturalidad; ausencia o rigidez del parpadeo.' },
  { title: '"Hervido" facial', hint: 'Halos y jitter alrededor del rostro entre frames.' },
  { title: 'Continuidad', hint: 'Objetos que aparecen/desaparecen sin motivo entre frames.' }
];

export function buildChecklist(kind) {
  return kind === 'video' ? VIDEO_CHECKS : IMAGE_CHECKS;
}
