// Valida todos los casos/*/caso.json contra el formato del proyecto.
// Uso: node scripts/validate-casos.mjs
// Sale con código 1 si hay errores (pensado para CI).

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CASOS_DIR = 'casos';
const CONCLUSIONES = ['manipulado_ia_probable', 'manipulado_edicion_probable', 'autentico_probable', 'no_concluyente'];
const TIPOS = ['imagen', 'video', 'audio', 'multi'];
const REQUIRED = ['id', 'fecha_analisis', 'titulo', 'tipo', 'hashes', 'urls_origen', 'senales', 'conclusion', 'confianza', 'autores'];

const errors = [];
const warn = [];

const dirs = readdirSync(CASOS_DIR).filter(d => {
  const p = join(CASOS_DIR, d);
  return statSync(p).isDirectory();
});

for (const dir of dirs) {
  const casoPath = join(CASOS_DIR, dir, 'caso.json');
  const label = `casos/${dir}`;
  if (!existsSync(casoPath)) {
    errors.push(`${label}: falta caso.json`);
    continue;
  }
  let caso;
  try {
    caso = JSON.parse(readFileSync(casoPath, 'utf8'));
  } catch (e) {
    errors.push(`${label}: JSON inválido — ${e.message}`);
    continue;
  }
  for (const field of REQUIRED) {
    if (!(field in caso)) errors.push(`${label}: falta el campo obligatorio «${field}»`);
  }
  if (caso.id && caso.id !== dir) {
    errors.push(`${label}: el campo id («${caso.id}») no coincide con el nombre de la carpeta`);
  }
  if (caso.conclusion && !CONCLUSIONES.includes(caso.conclusion)) {
    errors.push(`${label}: conclusión «${caso.conclusion}» no válida (${CONCLUSIONES.join(' | ')})`);
  }
  if (caso.tipo && !TIPOS.includes(caso.tipo)) {
    errors.push(`${label}: tipo «${caso.tipo}» no válido (${TIPOS.join(' | ')})`);
  }
  if (caso.fecha_analisis && !/^\d{4}-\d{2}-\d{2}$/.test(caso.fecha_analisis)) {
    errors.push(`${label}: fecha_analisis debe ser AAAA-MM-DD`);
  }
  const sha = caso.hashes?.sha256;
  if (sha != null && !/^[0-9a-f]{64}$/i.test(sha)) {
    errors.push(`${label}: sha256 no es un hash hexadecimal de 64 caracteres`);
  }
  const ph = caso.hashes?.phash;
  if (ph != null && !/^[0-9a-f]{16}$/i.test(ph)) {
    errors.push(`${label}: phash no es un hash hexadecimal de 16 caracteres`);
  }
  if (!Array.isArray(caso.tags)) {
    warn.push(`${label}: sin campo tags (recomendado para búsqueda)`);
  }
  if (!caso.pais) {
    warn.push(`${label}: sin campo pais (recomendado para estadísticas)`);
  }
  if (Array.isArray(caso.conflictos_interes) === false) {
    warn.push(`${label}: conflictos_interes debería ser un array (aunque esté vacío)`);
  }
}

warn.forEach(w => console.log(`AVISO  ${w}`));
if (errors.length) {
  errors.forEach(e => console.error(`ERROR  ${e}`));
  console.error(`\n${errors.length} error(es) de validación.`);
  process.exit(1);
}
console.log(`OK — ${dirs.length} caso(s) validados sin errores.`);
