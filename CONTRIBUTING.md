# Cómo contribuir a FREETRUE-IA

Gracias por querer ayudar. Hay tres formas de aportar.

## 1. Aportar un caso a la base pública

Un caso es un contenido audiovisual que ha circulado públicamente y sobre el
cual aportas un análisis reproducible.

**Requisitos mínimos:**
- El contenido ha tenido difusión pública real (no un mensaje privado, no una
  prueba interna).
- Puedes documentar la primera aparición o una aparición temprana verificable.
- El análisis está basado en evidencias reproducibles: hashes, enlaces,
  capturas de resultados de búsqueda inversa, metadatos, etc.
- Sigues el formato descrito en [casos/README.md](casos/README.md).

**Proceso:**
1. Fork del repositorio.
2. Crea una carpeta en `casos/` con el patrón `AAAA-MM-DD-slug-corto/`.
3. Añade el archivo `caso.json` siguiendo la plantilla.
4. Opcionalmente añade capturas en `evidencias/` (sin redistribuir el contenido
   íntegro si es dañino).
5. Abre un Pull Request.

**Qué NO aceptamos:**
- Ataques personales a individuos privados.
- Contenido ilegal en sí mismo (documentamos su existencia con hash y
  descripción, nunca lo archivamos).
- Análisis basados en opinión sin evidencias técnicas.
- Casos donde el autor del PR tenga un conflicto de interés no declarado con
  el emisor o el afectado por el contenido.

## 2. Contribuir al código

- El proyecto es HTML + JavaScript vanilla, sin build step, sin dependencias
  de servidor.
- Prioridad: legibilidad, auditabilidad y ausencia de dependencias
  innecesarias.
- Antes de un cambio grande, abre un Issue para discutirlo.

## 3. Divulgación y educación

- Traducciones de la documentación a otros idiomas.
- Cápsulas de vídeo cortas sobre "cómo mirar".
- Talleres presenciales o en línea — enlázalos desde el README de la sección
  de comunidad (por crear).

## Código de conducta

- Respeto a las personas siempre; dureza sólo con las ideas y los contenidos
  analizados.
- Cero tolerancia con acoso, discurso de odio o intentos de instrumentalizar
  el proyecto con fines partidistas.
- Los mantenedores pueden rechazar aportaciones sin necesidad de justificar
  más allá de citar este documento y el [MANIFIESTO](MANIFIESTO.md).

## Declaración de conflicto de interés

Al abrir un PR de un caso, indica en la descripción si tienes relación
personal, profesional, económica o política con:
- El emisor original del contenido.
- La persona o colectivo afectado.
- Alguna organización que gane visibilidad o pierda con el análisis.

Tener un conflicto no descalifica automáticamente el PR, pero **ocultarlo sí**.
