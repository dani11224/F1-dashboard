# Box, box 🏎️

Un muro de boxes personal de la F1: próximo GP con cuenta regresiva, campeonato, resultados, comparador de pilotos, calendario, glosario y cada circuito en 3D con la vuelta más rápida animada.

## Cómo funciona

- Página estática, sin servidor ni instalación. Se publica con GitHub Pages.
- Los datos se piden desde el navegador a dos APIs públicas y gratuitas:
  - [Jolpica](https://github.com/jolpica/jolpica-f1): calendario, resultados y campeonatos.
  - [OpenF1](https://openf1.org): posiciones y telemetría para el circuito en 3D.
- Las respuestas se guardan un rato en el navegador para que cargue rápido.

## Archivos

```
index.html         Estructura de la página
css/style.css      Estilos
js/app.js          Lógica de cada sección
js/api.js          Llamadas a las APIs y cruce de datos
js/track3d.js      Visor 3D del circuito (Three.js)
js/mensajes.js     ✏️ Mensajes personales (edítalos aquí)
js/glosario.js     Términos de la F1
```

## Publicar

En GitHub: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save**.
