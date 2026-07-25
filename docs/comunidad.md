# Verificación comunitaria

Un análisis nunca es solo tan bueno como quien lo escribe. Igual que en las
*notas de la comunidad* de X, **cualquier persona puede aportar contexto,
evidencia o corrección** a los casos publicados en FREETRUE-IA.

La diferencia: aquí **el sistema es transparente y no tiene dueño**. Cada
aportación queda como *issue* o *pull request* público en GitHub, revisable
por cualquiera, versionado, imposible de borrar en silencio.

## Cómo aportar

### La vía fácil (desde la app)

En [la app web](https://jfsaints.github.io/FREETRUE-IA/), al final del informe,
tienes el formulario **«¿No está claro? Aporta contexto»**. Rellénalo y pulsa
**«Abrir issue pre-rellenado en GitHub»**. Se abre GitHub en otra pestaña con
todo el texto ya escrito; tú solo revisas y pulsas *Submit*.

Si no tienes cuenta de GitHub o prefieres no usarla, puedes:
- Copiar el texto formateado y enviarlo por otro canal a un colaborador.
- Descargar el JSON de tu aportación para adjuntarla en otro sitio.

### La vía técnica (directamente en el repo)

Abre un PR sobre `casos/AAAA-MM-DD-slug/caso.json` añadiendo o modificando la
sección `aportaciones_comunidad`. Ver formato abajo.

## Tipos de aportación

| Tipo             | Cuándo usarlo                                                                 |
|------------------|-------------------------------------------------------------------------------|
| `contexto`       | Información útil que enriquece el análisis sin cambiar el veredicto.          |
| `autentico`      | Pruebas de que el contenido es real (fuente original, cadena de custodia).    |
| `manipulado`     | Pruebas técnicas de manipulación o generación por IA no detectadas antes.     |
| `correccion`     | El análisis publicado tiene un error concreto que hay que enmendar.           |
| `nuevo-caso`     | Contenido que aún no está en la base y merece análisis.                       |

## Cómo se revisan las aportaciones

FREETRUE-IA aplica reglas explícitas para evitar tanto la captura por un
colectivo como el bloqueo por indecisión.

### Umbrales de revisión

- **Aportación `contexto` o nuevo-caso admitido:** basta con **1 revisor
  independiente** que confirme que aporta valor y cumple criterios.
- **Aportación `autentico` o `manipulado` que confirma el veredicto actual:**
  **1 revisor independiente**.
- **Aportación que *cambia* la conclusión de un caso publicado** o **corrección
  sustantiva:** **2 revisores independientes**, con vínculos declarados
  distintos (no de la misma organización, no coautores habituales).

Los revisores dejan constancia en el hilo del issue/PR con el visto bueno y
una línea explicando *por qué*.

### Declaración de conflictos de interés

Quien aporta y quien revisa **debe declarar** cualquier relación:

- Personal, profesional, económica o política con las personas o entidades
  aparecidas en el contenido.
- Militancia o vinculación con colectivos que tengan interés en la
  conclusión.

Tener un conflicto **no descalifica automáticamente** — a veces quien más
sabe de un tema es también quien tiene relación con él. Pero **ocultarlo
descalifica siempre** y da pie a retirada de la aportación.

### Antisecuestro

Para evitar que un grupo organizado inunde el sistema con aportaciones
sesgadas:

- El histórico de aportaciones aceptadas es **público y auditable** por
  autor (`git log`).
- Cuando dos revisores de perfil similar validan reiteradamente aportaciones
  de la misma facción, el equipo de mantenimiento puede exigir que un
  tercer revisor de perfil claramente distinto valide antes de mergear.
- Los criterios para «perfiles distintos» se documentan y se refinan en el
  propio repositorio, en discusión pública.

## Formato en `caso.json`

Ampliamos [PLANTILLA.json](../casos/PLANTILLA.json) con un array opcional:

```json
"aportaciones_comunidad": [
  {
    "fecha": "AAAA-MM-DD",
    "tipo": "contexto",
    "autor": "@usuario",
    "resumen": "Aportó la fuente original del vídeo (canal oficial X, 2024-05-12).",
    "evidencias": ["https://…"],
    "revisado_por": ["@revisor1"],
    "conflictos_declarados": [],
    "issue": "https://github.com/JFSAINTS/FREETRUE-IA/issues/42",
    "impacto": "contexto_adicional"
  }
]
```

El campo `impacto` puede tomar los valores:
`contexto_adicional`, `refuerza_conclusion`, `cambia_conclusion`,
`correccion_menor`, `correccion_sustantiva`.

Cuando una aportación cambia la conclusión, se registra también un campo
`correcciones` en el caso, siguiendo la política de nunca borrar el
análisis previo — solo enmendarlo con historial visible.

## Qué no aceptamos

- Ataques personales o descalificaciones sin evidencia técnica.
- Aportaciones basadas exclusivamente en opinión o afiliación ideológica.
- Doxing (publicación de datos personales privados de nadie).
- Coordinación demostrable de campañas de aportaciones sesgadas (los
  responsables son bloqueados y sus aportaciones revisadas retroactivamente).

## En una frase

**La comunidad revisa, GitHub deja constancia, las reglas están escritas y
son las mismas para todos.**
