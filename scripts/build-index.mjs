// Regenera casos/index.json a partir de los casos/*/caso.json.
// Uso: node scripts/build-index.mjs
// La app y el panel leen este índice; mantenerlo a mano es propenso a error,
// así que la CI lo regenera en cada push a main que toque casos/.

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CASOS_DIR = 'casos';

const dirs = readdirSync(CASOS_DIR)
  .filter(d => statSync(join(CASOS_DIR, d)).isDirectory())
  .sort();

const casos = [];
for (const dir of dirs) {
  const casoPath = join(CASOS_DIR, dir, 'caso.json');
  if (!existsSync(casoPath)) continue;
  const caso = JSON.parse(readFileSync(casoPath, 'utf8'));
  casos.push({
    id: caso.id,
    titulo: caso.titulo,
    tipo: caso.tipo,
    fecha_analisis: caso.fecha_analisis,
    conclusion: caso.conclusion,
    sha256: caso.hashes?.sha256 ?? null,
    phash: caso.hashes?.phash ?? null,
    pais: caso.pais ?? null,
    tags: Array.isArray(caso.tags) ? caso.tags : [],
    ruta: `casos/${dir}/caso.json`
  });
}

// Más recientes primero
casos.sort((a, b) => String(b.fecha_analisis).localeCompare(String(a.fecha_analisis)));

const index = {
  version: 3,
  actualizado: new Date().toISOString().slice(0, 10),
  casos
};

writeFileSync(join(CASOS_DIR, 'index.json'), JSON.stringify(index, null, 2) + '\n');
console.log(`index.json regenerado con ${casos.length} caso(s).`);
