// Verificación comunitaria: genera issues de GitHub pre-rellenados
// a partir del formulario. Funciona sin backend usando los parámetros
// ?title=&body=&labels= del formulario de nuevo issue de GitHub.

const REPO = 'JFSAINTS/FREETRUE-IA';
const NEW_ISSUE = `https://github.com/${REPO}/issues/new`;

const TIPOS = {
  contexto: {
    label: 'Aporto contexto adicional',
    tag: 'aportacion:contexto',
    guia: 'Información útil que enriquece el análisis, sin cambiar necesariamente la conclusión.'
  },
  autentico: {
    label: 'Aporto pruebas de que es auténtico',
    tag: 'aportacion:autentico',
    guia: 'Fuentes originales, fecha de captura, contexto verificable que respalda que el contenido es real.'
  },
  manipulado: {
    label: 'Aporto pruebas de que es manipulado o generado por IA',
    tag: 'aportacion:manipulado',
    guia: 'Comparaciones, análisis técnicos, herramientas específicas que evidencian la manipulación.'
  },
  correccion: {
    label: 'Corrección de un análisis previo',
    tag: 'aportacion:correccion',
    guia: 'El caso ya publicado contiene un error. Explica qué y aporta la evidencia.'
  },
  nuevo: {
    label: 'Propongo un caso nuevo (aún no está en la base)',
    tag: 'aportacion:nuevo-caso',
    guia: 'El contenido ha circulado públicamente y merece análisis. Aporta lo que tengas.'
  }
};

export function getTiposAportacion() { return TIPOS; }

export function buildContribution(data) {
  const tipo = TIPOS[data.tipo] || TIPOS.contexto;
  const parts = [];

  parts.push(`### Tipo de aportación`);
  parts.push(tipo.label);
  parts.push('');

  parts.push('### Identificación del contenido');
  if (data.sha256) parts.push(`- **SHA-256:** \`${data.sha256}\``);
  if (data.url_origen) parts.push(`- **URL de origen:** ${data.url_origen}`);
  if (data.caso_id) parts.push(`- **Caso relacionado:** \`${data.caso_id}\``);
  if (data.descripcion_breve) parts.push(`- **Descripción:** ${data.descripcion_breve}`);
  parts.push('');

  parts.push('### Tu aportación');
  parts.push(data.aportacion || '_(vacío)_');
  parts.push('');

  parts.push('### Evidencias');
  if (data.evidencias && data.evidencias.length) {
    data.evidencias.forEach(e => parts.push(`- ${e}`));
  } else {
    parts.push('_(sin URLs de evidencia — considera añadir alguna)_');
  }
  parts.push('');

  parts.push('### Autoría y conflictos de interés');
  parts.push(`- **Nombre / handle:** ${data.autor || '_(anónimo)_'}`);
  parts.push(`- **Conflictos de interés:** ${data.conflictos || '_ninguno declarado_'}`);
  parts.push('');

  parts.push('---');
  parts.push('');
  parts.push('_Enviado desde el formulario de aportación de FREETRUE-IA. Un mantenedor revisará esta contribución siguiendo el proceso descrito en [`docs/comunidad.md`](../blob/main/docs/comunidad.md)._');

  const body = parts.join('\n');
  const title = data.titulo || `[${tipo.tag}] ${data.descripcion_breve || 'Aportación de la comunidad'}`.slice(0, 100);

  return { title, body, labels: [tipo.tag] };
}

export function buildIssueUrl(contribution) {
  const params = new URLSearchParams({
    title: contribution.title,
    body: contribution.body,
    labels: contribution.labels.join(',')
  });
  return `${NEW_ISSUE}?${params.toString()}`;
}
