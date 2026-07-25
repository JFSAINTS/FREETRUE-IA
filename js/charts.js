// Mini librería de gráficos SVG sin dependencias.
// Todos los charts respetan variables CSS del tema.

const COLORS = {
  autentico_probable: '#4fc3a1',
  manipulado_ia_probable: '#f16b6b',
  manipulado_edicion_probable: '#f0b429',
  no_concluyente: '#8a94a6'
};

export function colorFor(conclusion) {
  return COLORS[conclusion] || 'var(--text-muted)';
}

// -------- Doughnut chart --------
// data: [{ label, value, color }]
export function doughnut(data, { size = 220, thickness = 34, centerText } = {}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  let acc = 0;
  const arcs = data.map(d => {
    const startAngle = (acc / total) * 2 * Math.PI - Math.PI / 2;
    acc += d.value;
    const endAngle = (acc / total) * 2 * Math.PI - Math.PI / 2;
    const large = endAngle - startAngle > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    if (d.value === 0) return '';
    if (data.length === 1 || d.value === total) {
      // círculo completo
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${d.color}" stroke-width="${thickness}" />`;
    }
    return `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}" fill="none" stroke="${d.color}" stroke-width="${thickness}" stroke-linecap="butt" />`;
  }).join('');

  const legend = data.map(d => `
    <li>
      <span class="swatch" style="background:${d.color}"></span>
      <span class="lg-label">${escape(d.label)}</span>
      <span class="lg-value">${d.value}</span>
    </li>
  `).join('');

  const center = centerText
    ? `<text x="${cx}" y="${cy - 4}" text-anchor="middle" class="donut-num">${total}</text>
       <text x="${cx}" y="${cy + 16}" text-anchor="middle" class="donut-lbl">${escape(centerText)}</text>`
    : '';

  return `
    <div class="chart-wrap">
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="donut">
        ${arcs}
        ${center}
      </svg>
      <ul class="chart-legend">${legend}</ul>
    </div>
  `;
}

// -------- Horizontal bar list --------
// data: [{ label, value, color? }]
export function hbars(data, { max, showValue = true } = {}) {
  if (!data.length) return '<p class="muted small">—</p>';
  const m = max || Math.max(...data.map(d => d.value)) || 1;
  return `<ul class="hbars">${data.map(d => {
    const pct = (d.value / m) * 100;
    return `
      <li>
        <span class="hb-label">${escape(d.label)}</span>
        <span class="hb-track"><span class="hb-fill" style="width:${pct}%;background:${d.color || 'var(--accent)'}"></span></span>
        ${showValue ? `<span class="hb-value">${d.value}</span>` : ''}
      </li>
    `;
  }).join('')}</ul>`;
}

// -------- Line chart (timeline) --------
// data: [{ label, value }]
export function line(data, { width = 560, height = 180, padding = 30 } = {}) {
  if (!data.length) return '<p class="muted small">—</p>';
  const max = Math.max(...data.map(d => d.value)) || 1;
  const step = (width - 2 * padding) / Math.max(data.length - 1, 1);
  const points = data.map((d, i) => {
    const x = padding + i * step;
    const y = height - padding - (d.value / max) * (height - 2 * padding);
    return [x, y];
  });
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const dots = points.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="var(--accent)"><title>${escape(data[i].label)}: ${data[i].value}</title></circle>`).join('');
  const xLabels = data.map((d, i) => {
    const x = padding + i * step;
    return `<text x="${x}" y="${height - 8}" text-anchor="middle" class="axis-lbl">${escape(d.label)}</text>`;
  }).join('');
  return `
    <div class="chart-wrap wide">
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" class="line-chart" preserveAspectRatio="xMidYMid meet">
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="var(--border)" />
        <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2" />
        ${dots}
        ${xLabels}
      </svg>
    </div>
  `;
}

// -------- Tag cloud --------
// tags: [{ tag, count }]
export function tagCloud(tags, { onClick } = {}) {
  if (!tags.length) return '<p class="muted small">—</p>';
  const max = Math.max(...tags.map(t => t.count));
  const min = Math.min(...tags.map(t => t.count));
  const range = max - min || 1;
  return `<div class="tag-cloud">${tags.map(t => {
    const size = 0.85 + ((t.count - min) / range) * 1.15; // 0.85rem — 2rem
    return `<button type="button" class="tag-chip" data-tag="${escape(t.tag)}" style="font-size:${size.toFixed(2)}rem">${escape(t.tag)}<sup>${t.count}</sup></button>`;
  }).join('')}</div>`;
}

function escape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
