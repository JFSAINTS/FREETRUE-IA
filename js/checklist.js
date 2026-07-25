// Checklist de inspección manual, adaptada al tipo de contenido.

const IMAGE_CHECKS = [
  { id: 'manos', title: 'Manos y dedos', hint: 'Número de dedos, longitudes anómalas, articulaciones raras.' },
  { id: 'ojos', title: 'Ojos y dientes', hint: 'Reflejos incoherentes entre ojos, dientes fusionados o dobles.' },
  { id: 'orejas', title: 'Orejas y joyería', hint: 'Asimetrías extrañas, pendientes distintos entre lados.' },
  { id: 'texto', title: 'Texto en la imagen', hint: 'Carteles, matrículas, camisetas: la IA todavía falla con texto.' },
  { id: 'fondos', title: 'Fondos y multitudes', hint: 'Caras "derretidas", objetos que se funden entre sí.' },
  { id: 'sombras', title: 'Sombras y reflejos', hint: '¿Coinciden con la dirección de la luz? ¿Los espejos muestran lo esperado?' },
  { id: 'patrones', title: 'Continuidad de patrones', hint: 'Cadenas, gafas, correas: ¿continúan de forma coherente?' }
];

const VIDEO_CHECKS = [
  ...IMAGE_CHECKS,
  { id: 'labios', title: 'Sincronía labial', hint: 'Micro-desfases entre voz y movimiento de labios.' },
  { id: 'parpadeo', title: 'Parpadeo', hint: 'Frecuencia y naturalidad; ausencia o rigidez del parpadeo.' },
  { id: 'hervido', title: '"Hervido" facial', hint: 'Halos y jitter alrededor del rostro entre frames.' },
  { id: 'continuidad', title: 'Continuidad', hint: 'Objetos que aparecen/desaparecen sin motivo entre frames.' }
];

export function buildChecklist(kind) {
  return kind === 'video' ? VIDEO_CHECKS : IMAGE_CHECKS;
}
