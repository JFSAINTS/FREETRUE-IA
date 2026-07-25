# Base pública de casos

Cada caso vive en su propia carpeta bajo `casos/`, con el patrón:

```
casos/
  AAAA-MM-DD-slug-corto/
    caso.json          ← análisis estructurado (obligatorio)
    evidencias/        ← capturas de búsquedas inversas, extractos, etc.
    analisis.md        ← redacción humana del análisis (opcional pero
                         recomendado)
```

## Formato `caso.json`

Ver [PLANTILLA.json](PLANTILLA.json) y el ejemplo en
[2026-07-25-ejemplo-inicial](2026-07-25-ejemplo-inicial/caso.json).

Campos:

| Campo               | Tipo    | Descripción                                                                 |
|---------------------|---------|-----------------------------------------------------------------------------|
| `id`                | string  | Igual al nombre de la carpeta.                                              |
| `fecha_analisis`    | string  | ISO 8601, día del análisis.                                                 |
| `titulo`            | string  | Descripción breve del contenido y por qué se analiza.                       |
| `tipo`              | string  | `imagen` \| `video` \| `audio` \| `multi`.                                  |
| `pais`              | string  | Código ISO 3166-1 alpha-2 o nombre corto del país donde circula o al que afecta el contenido. Usar `"—"` si no aplica. |
| `tags`              | array   | Etiquetas cortas para búsqueda y filtrado. Ej: `["elecciones", "sanidad"]`. |
| `hashes`            | object  | `{ "sha256": "…" }` del archivo analizado (si se ha podido obtener).        |
| `urls_origen`       | array   | URLs donde se detectó la difusión pública.                                  |
| `primera_aparicion` | string  | Fecha aproximada más temprana verificable, con enlace en `evidencias`.      |
| `viralidad`         | object  | Métricas conocidas: `{ "plataformas": [], "alcance_estimado": "…" }`.       |
| `senales`           | object  | Ver bloque «Señales» abajo.                                                 |
| `conclusion`        | string  | `manipulado_ia_probable` \| `manipulado_edicion_probable` \| `autentico_probable` \| `no_concluyente`. Nunca «falso» / «verdadero» a secas. |
| `confianza`         | string  | `alta` \| `media` \| `baja`, con justificación breve.                       |
| `autores`           | array   | Handles/nombres de quienes firman el análisis.                              |
| `conflictos_interes`| array   | Declarados. `[]` si ninguno.                                                |
| `revisado_por`      | array   | Handles de quien revisó el PR (se rellena en merge).                        |

### Bloque «Señales»

```json
{
  "exif": { "presente": true, "resumen": "…" },
  "c2pa": { "presente": false, "detalles": null },
  "busqueda_inversa": {
    "google_lens": "URL a la búsqueda",
    "tineye": "…",
    "yandex": "…"
  },
  "artefactos_ia": [
    "manos con seis dedos en frame 00:12",
    "reflejos incoherentes en ventana"
  ],
  "detectores_automaticos": [
    { "nombre": "detector_X", "score": 0.87, "version": "…" }
  ],
  "otros": []
}
```

## Criterios de admisión

Un caso es admisible si cumple **todo** lo siguiente:

1. **Difusión pública real.** El contenido ha circulado por al menos una
   plataforma pública (red social, medio, canal de mensajería con
   redistribución masiva demostrable). No aceptamos análisis preventivos de
   contenidos que nadie ha visto.
2. **Interés público.** Afecta a la percepción de hechos, personas o eventos
   de relevancia colectiva. Un meme humorístico obvio no es un caso; una
   supuesta declaración falsa atribuida a una figura pública sí.
3. **Análisis reproducible.** Todo lo que afirmes debe poder repetirse por un
   tercero con los enlaces y datos que aportas.
4. **Neutralidad en la redacción.** Describe evidencias, no intenciones.
   «Presenta artefactos típicos de generación por IA» ✅.
   «El autor es un mentiroso al servicio de X» ❌.
5. **No daño adicional.** No archivamos el contenido íntegro si su
   redistribución causa daño (CSAM, datos personales sensibles, incitación a
   la violencia). Documentamos su existencia con hash, descripción y
   evidencias parciales.
6. **Conflictos declarados.** Si el autor tiene relación con las partes,
   debe indicarlo.

## Proceso de revisión

1. Se abre PR.
2. Un mantenedor revisa formato y criterios (24-72h en el arranque).
3. Si procede, un segundo revisor independiente valida las señales técnicas.
4. Merge; el caso queda inmutable salvo correcciones registradas en el
   historial de Git.

## Corrección de casos

Si un caso publicado resulta erróneo, **no se borra**. Se abre un PR de
corrección que:
- Cambia `conclusion` a `no_concluyente` o al valor correcto.
- Añade un campo `correcciones` explicando qué cambió y por qué.
- Mantiene la historia completa visible en Git.

La transparencia sobre los propios errores es parte del valor del proyecto.
