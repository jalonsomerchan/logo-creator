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
