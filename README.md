# Logo Lattice

Generador de logos geométricos inspirado en editores de retícula. Permite crear figuras vectoriales uniendo puntos, trabajar sobre una cuadrícula cuadrada o isométrica y exportar el resultado como SVG o PNG.

## Funcionalidades

- Editor visual a pantalla completa.
- Retícula cuadrada o isométrica con tamaño configurable.
- Herramientas de dibujo, recorte, selección y desplazamiento.
- Capas de figuras con duplicado, borrado, copiar y pegar.
- Personalización de relleno, trazo, grosor y opacidad.
- Zoom con rueda y desplazamiento de la vista.
- Exportación limpia a SVG y PNG.
- Persistencia automática en `localStorage`.
- Interfaz responsive con panel inferior en móvil.

## Stack

- Vite
- JavaScript ES Modules
- SVG nativo para edición vectorial
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

- `1`: seleccionar.
- `2`: dibujar.
- `3` o `Espacio`: mover la vista.
- `Enter`: cerrar la figura activa.
- `Esc`: cancelar la figura activa.
- `Ctrl/Cmd + Z`: deshacer.
- `Ctrl/Cmd + Y`: rehacer.
- `Ctrl/Cmd + C`: copiar figura seleccionada.
- `Ctrl/Cmd + V`: pegar figura copiada.

## Licencia

MIT
