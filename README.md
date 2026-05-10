# Logo Creator by AlonSofware

Generador de logos geométricos inspirado en editores de retícula. Permite crear figuras vectoriales uniendo puntos, trabajar sobre una cuadrícula cuadrada o isométrica y exportar el resultado como SVG o PNG.

## Funcionalidades

- Editor visual a pantalla completa.
- Retícula cuadrada o isométrica con tamaño configurable.
- Ajuste automático al punto más cercano de la retícula.
- Vista previa de la línea mientras mueves el ratón.
- Herramientas de dibujo, recorte, selección y desplazamiento.
- Barra de herramientas con iconos de Bootstrap Icons.
- Barra de herramientas contraíble y expandible.
- Capas de figuras con duplicado, borrado, copiar, pegar y mandar al frente.
- Personalización de relleno, trazo, grosor y opacidad.
- Zoom con rueda y desplazamiento de la vista.
- Exportación limpia a SVG y PNG.
- Persistencia automática en `localStorage`.
- Interfaz responsive con panel inferior en móvil.

## Stack

- Vite
- JavaScript ES Modules
- SVG nativo para edición vectorial
- Bootstrap Icons
- Tailwind CSS v4
- ESLint
- Prettier

## Instalación

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Lint

```bash
npm run lint
```

## Despliegue en GitHub Pages

El repositorio está preparado para publicarse en:

```txt
https://jalonsomerchan.github.io/logo-creator/
```

La configuración ya incluida es:

- `vite.config.js` usa `base: '/logo-creator/'` para que los assets carguen bien bajo GitHub Pages.
- `.github/workflows/deploy.yml` compila el proyecto y publica la carpeta `dist` con GitHub Actions Pages.
- `public/.nojekyll` evita el procesamiento de Jekyll en Pages.

### Configuración necesaria en GitHub

En el repositorio, entra en:

```txt
Settings → Pages → Build and deployment
```

Y selecciona:

```txt
Source: GitHub Actions
```

No uses `Deploy from a branch`, porque eso publicaría el código fuente sin compilar en vez de la carpeta `dist` generada por Vite.

Después, puedes lanzar el despliegue desde:

```txt
Actions → Deploy to GitHub Pages → Run workflow
```

También se ejecutará automáticamente con cada push a `main`.

### Si usas dominio personalizado

Si más adelante quieres usar un dominio propio, cambia en `vite.config.js`:

```js
base: '/logo-creator/',
```

por:

```js
base: '/',
```

Y añade `public/CNAME` con el dominio, por ejemplo:

```txt
logos.alon.one
```

## Atajos

- `V` o `1`: seleccionar.
- `P` o `2`: dibujar.
- `C`: recortar.
- `H` o `3`: mover la vista.
- `G`: alternar retícula cuadrada/isométrica.
- Flechas: mover figura seleccionada.
- `Shift + flechas`: mover la vista.
- `Alt + flechas`: movimiento fino.
- `Enter`: cerrar figura o recorte activo.
- `Esc`: cancelar puntos activos.
- `Ctrl/Cmd + Z`: deshacer.
- `Ctrl/Cmd + Y`: rehacer.
- `Ctrl/Cmd + C`: copiar figura seleccionada.
- `Ctrl/Cmd + V`: pegar figura copiada.
- `Delete`: borrar figura seleccionada.
- `]`: mandar la figura seleccionada al frente.

## Licencia

MIT
