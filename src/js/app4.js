import 'bootstrap-icons/font/bootstrap-icons.css';
import '../css/main.css';
import '../css/logo-creator.css';

const NS = 'http://www.w3.org/2000/svg';
const STORE = 'logo-creator-state-v1';
const EXPORT_PADDING = 36;

const app = document.querySelector('#app');
const round = (n) => Math.round(n * 100) / 100;
const clone = (value) => JSON.parse(JSON.stringify(value));
let idCounter = Date.now();
let svg;
let gridGroup;
let shapeGroup;
let draftGroup;
let panel;
let hoverPoint = null;
let panDrag = null;
let selectionDrag = null;
let copiedLayer = null;
let toastTimer = 0;
let history = [];
let future = [];

const defaultState = {
  tool: 'draw',
  brush: 'draw',
  grid: 'isometric',
  gridSize: 60,
  fill: '#000000',
  stroke: '#000000',
  strokeWidth: 0,
  opacity: 1,
  selectedId: 'sample',
  draft: [],
  camera: { x: 0, y: 0, zoom: 1 },
  panelCollapsed: false,
  layers: [
    {
      id: 'sample',
      name: 'Figura 1',
      points: [
        { x: -60, y: -45 },
        { x: 0, y: -105 },
        { x: 0, y: 105 },
        { x: -60, y: 45 },
      ],
      holes: [],
      fill: '#000000',
      stroke: '#000000',
      strokeWidth: 0,
      opacity: 1,
      visible: true,
    },
  ],
};

let state = loadState();

function loadState() {
  try {
    const legacy = localStorage.getItem('logo-lattice-state-v3') || localStorage.getItem('logo-lattice-state-v2') || localStorage.getItem('logo-lattice-state-v1');
    const saved = JSON.parse(localStorage.getItem(STORE) || legacy);
    if (saved?.layers) {
      return {
        ...clone(defaultState),
        ...saved,
        draft: [],
        camera: clone(defaultState.camera),
        layers: saved.layers.map((layer) => ({ holes: [], visible: true, ...layer })),
      };
    }
  } catch {
    // Ignore localStorage errors.
  }
  return clone(defaultState);
}

function saveState() {
  const data = clone(state);
  data.draft = [];
  localStorage.setItem(STORE, JSON.stringify(data));
}

function pushHistory() {
  history.push(clone({ ...state, draft: [] }));
  history = history.slice(-80);
  future = [];
}

function restore(snapshot) {
  state = clone(snapshot);
  state.draft = [];
  hoverPoint = null;
  saveState();
  render();
}

function bi(name) {
  return `<i class="bi bi-${name}" aria-hidden="true"></i>`;
}

function init() {
  app.innerHTML = `
    <div class="top-left">
      <section class="floating-card brand-card" aria-label="Logo Creator by AlonSofware">
        <span class="brand-mark">${bi('bounding-box-circles')}</span>
        <div>
          <h1 class="brand-title"><span>Logo Creator</span></h1>
          <p class="brand-meta">by AlonSofware</p>
          <p class="brand-subtitle">Dibuja logos geométricos sobre retícula y exporta SVG/PNG</p>
        </div>
      </section>
    </div>

    <section class="canvas-wrap" id="canvasWrap" aria-label="Área de dibujo">
      <svg id="workspace" role="img" aria-label="Editor vectorial de Logo Creator"></svg>
    </section>

    <aside class="panel right-panel" id="panel" aria-label="Barra de herramientas">
      <div class="toolbar-header">
        <div class="toolbar-title">
          <strong>Herramientas</strong>
          <span>Atajos, edición y exportación</span>
        </div>
        <button class="icon-button toolbar-collapse" id="collapsePanel" type="button" title="Contraer o expandir barra">
          ${bi('layout-sidebar-inset-reverse')}
        </button>
      </div>

      <div class="toolbar-body">
        <section class="panel-section">
          <h2>Modo</h2>
          <div class="icon-only-grid">
            <button class="tool-button" data-tool="select" type="button" title="Seleccionar · V / 1">${bi('cursor')}<span class="shortcut">V</span></button>
            <button class="tool-button" data-tool="draw" data-brush="draw" type="button" title="Dibujar · P / 2">${bi('pencil')}<span class="shortcut">P</span></button>
            <button class="tool-button" data-tool="draw" data-brush="cutout" type="button" title="Recortar · C">${bi('scissors')}<span class="shortcut">C</span></button>
            <button class="tool-button" data-tool="pan" type="button" title="Mover vista · H / 3">${bi('arrows-move')}<span class="shortcut">H</span></button>
          </div>
          <div class="tool-grid" style="margin-top:.6rem">
            <button class="icon-button" data-action="undo" type="button" title="Deshacer · Ctrl/Cmd+Z">${bi('arrow-counterclockwise')}<span class="shortcut">Ctrl+Z</span></button>
            <button class="icon-button" data-action="redo" type="button" title="Rehacer · Ctrl/Cmd+Y">${bi('arrow-clockwise')}<span class="shortcut">Ctrl+Y</span></button>
          </div>
        </section>

        <section class="panel-section">
          <h2>Estilo</h2>
          <div class="form-row">
            <span class="label">Relleno y trazo</span>
            <div class="inline-row">
              <input id="fill" type="color" aria-label="Color de relleno">
              <input id="stroke" type="color" aria-label="Color de trazo">
            </div>
          </div>
          <div class="form-row">
            <label for="strokeWidth">Grosor <strong id="strokeLabel"></strong></label>
            <input id="strokeWidth" type="range" min="0" max="20" step="1">
          </div>
          <div class="form-row">
            <label for="opacity">Opacidad <strong id="opacityLabel"></strong></label>
            <input id="opacity" type="range" min="0.1" max="1" step="0.05">
          </div>
        </section>

        <section class="panel-section">
          <h2>Retícula</h2>
          <div class="segmented">
            <button class="mode-button" data-grid="square" type="button">${bi('grid-3x3')} Cuadrada</button>
            <button class="mode-button" data-grid="isometric" type="button">${bi('hexagon')} Isométrica</button>
          </div>
          <div class="form-row">
            <label for="gridSize">Tamaño <strong id="gridLabel"></strong></label>
            <input id="gridSize" type="range" min="20" max="120" step="5">
          </div>
        </section>

        <section class="panel-section">
          <h2>Capas</h2>
          <div class="layer-list" id="layers"></div>
          <div class="inline-row" style="margin-top:.75rem">
            <button class="secondary-button" data-action="front" type="button">${bi('front')} Al frente</button>
            <button class="secondary-button" data-action="duplicate" type="button">${bi('copy')} Duplicar</button>
            <button class="danger-button" data-action="delete" type="button">${bi('trash')} Borrar</button>
          </div>
        </section>

        <section class="panel-section">
          <h2>Exportar</h2>
          <div class="export-row">
            <button class="export-button primary" data-export="svg" type="button">${bi('filetype-svg')} SVG</button>
            <button class="export-button" data-export="png" type="button">${bi('filetype-png')} PNG</button>
          </div>
          <div class="status-line">
            <span id="points">0 puntos</span>
            <span id="figures">0 figuras</span>
          </div>
        </section>

        <section class="panel-section">
          <h2>Atajos</h2>
          <div class="dashed-help help-grid">
            <span><strong>Flechas</strong> mover selección</span>
            <span><strong>Shift + flechas</strong> mover vista</span>
            <span><strong>Alt + flechas</strong> paso fino</span>
            <span><strong>Enter / Esc</strong> cerrar / cancelar</span>
          </div>
        </section>
      </div>
    </aside>

    <button class="floating-card mobile-toggle" id="mobileToggle" type="button">${bi('sliders')} Panel</button>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>`;

  svg = $('#workspace');
  panel = $('#panel');
  gridGroup = createSvg('g');
  shapeGroup = createSvg('g');
  draftGroup = createSvg('g');
  svg.append(gridGroup, shapeGroup, draftGroup);
  bindEvents();
  centerCamera();
  render();
}

function bindEvents() {
  const wrap = $('#canvasWrap');
  wrap.addEventListener('pointerdown', onPointerDown);
  wrap.addEventListener('pointermove', onPointerMove);
  wrap.addEventListener('pointerup', onPointerUp);
  wrap.addEventListener('pointercancel', onPointerUp);
  wrap.addEventListener('pointerleave', () => {
    hoverPoint = null;
    render();
  });
  wrap.addEventListener('dblclick', finishDraft);
  wrap.addEventListener('wheel', onWheel, { passive: false });

  window.addEventListener('resize', render);
  document.addEventListener('keydown', onKeyDown);

  document.querySelectorAll('[data-tool]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.brush) state.brush = button.dataset.brush;
      setTool(button.dataset.tool);
    });
  });

  document.querySelectorAll('[data-grid]').forEach((button) => {
    button.addEventListener('click', () => {
      state.grid = button.dataset.grid;
      saveAndRender();
    });
  });

  document.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => runAction(button.dataset.action)));
  document.querySelectorAll('[data-export]').forEach((button) => button.addEventListener('click', () => exportLogo(button.dataset.export)));
  $('#collapsePanel').addEventListener('click', togglePanel);
  $('#mobileToggle').addEventListener('click', () => panel.classList.toggle('is-open'));

  $('#fill').addEventListener('input', (event) => updateStyle('fill', event.target.value));
  $('#stroke').addEventListener('input', (event) => updateStyle('stroke', event.target.value));
  $('#strokeWidth').addEventListener('input', (event) => updateStyle('strokeWidth', Number(event.target.value)));
  $('#opacity').addEventListener('input', (event) => updateStyle('opacity', Number(event.target.value)));
  $('#gridSize').addEventListener('input', (event) => {
    state.gridSize = Number(event.target.value);
    saveAndRender();
  });
}

function $(selector) {
  return document.querySelector(selector);
}

function createSvg(tag, attrs = {}) {
  const node = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

function clear(node) {
  while (node.firstChild) node.firstChild.remove();
}

function saveAndRender() {
  saveState();
  render();
}

function centerCamera() {
  const rect = app.getBoundingClientRect();
  state.camera.x = rect.width / 2;
  state.camera.y = rect.height / 2;
}

function setTool(tool) {
  state.tool = tool;
  if (tool !== 'draw') state.draft = [];
  saveAndRender();
}

function selectedLayer() {
  return state.layers.find((layer) => layer.id === state.selectedId);
}

function worldToScreen(point) {
  return { x: point.x * state.camera.zoom + state.camera.x, y: point.y * state.camera.zoom + state.camera.y };
}

function screenToWorld(point) {
  return { x: (point.x - state.camera.x) / state.camera.zoom, y: (point.y - state.camera.y) / state.camera.zoom };
}

function pointerPosition(event) {
  const rect = svg.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function snapPoint(point) {
  const size = state.gridSize;
  if (state.grid === 'square') return { x: Math.round(point.x / size) * size, y: Math.round(point.y / size) * size };

  const rowHeight = (size * Math.sqrt(3)) / 2;
  const row = Math.round(point.y / rowHeight);
  const offset = row % 2 ? size / 2 : 0;
  return { x: Math.round((point.x - offset) / size) * size + offset, y: row * rowHeight };
}

function snappedPointer(event) {
  return snapPoint(screenToWorld(pointerPosition(event)));
}

function layerPath(layer, useCamera = true) {
  return [layer.points, ...(layer.holes || [])]
    .filter((ring) => ring.length >= 3)
    .map((ring) => {
      const first = useCamera ? worldToScreen(ring[0]) : ring[0];
      const rest = ring
        .slice(1)
        .map((point) => {
          const current = useCamera ? worldToScreen(point) : point;
          return `L ${round(current.x)} ${round(current.y)}`;
        })
        .join(' ');
      return `M ${round(first.x)} ${round(first.y)} ${rest} Z`;
    })
    .join(' ');
}

function pointList(points) {
  return points
    .map((point) => {
      const current = worldToScreen(point);
      return `${round(current.x)},${round(current.y)}`;
    })
    .join(' ');
}

function visibleGridPoints(rect) {
  const topLeft = screenToWorld({ x: -80, y: -80 });
  const bottomRight = screenToWorld({ x: rect.width + 80, y: rect.height + 80 });
  const size = state.gridSize;
  const points = [];

  if (state.grid === 'square') {
    for (let x = Math.floor(topLeft.x / size) * size; x <= bottomRight.x; x += size) {
      for (let y = Math.floor(topLeft.y / size) * size; y <= bottomRight.y; y += size) points.push({ x, y });
    }
    return points;
  }

  const rowHeight = (size * Math.sqrt(3)) / 2;
  for (let row = Math.floor(topLeft.y / rowHeight) - 1; row <= Math.ceil(bottomRight.y / rowHeight) + 1; row += 1) {
    const y = row * rowHeight;
    const offset = row % 2 ? size / 2 : 0;
    for (let x = Math.floor((topLeft.x - offset) / size) * size + offset; x <= bottomRight.x + size; x += size) points.push({ x, y });
  }
  return points;
}

function render() {
  const rect = app.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
  panel.classList.toggle('is-collapsed', state.panelCollapsed);
  renderGrid(rect);
  renderShapes();
  renderDraft();
  renderPanel();
}

function renderGrid(rect) {
  clear(gridGroup);
  const points = visibleGridPoints(rect);

  if (state.grid === 'square') {
    [...new Set(points.map((point) => round(worldToScreen(point).x)))].forEach((x) => gridGroup.append(createSvg('line', { x1: x, y1: 0, x2: x, y2: rect.height, stroke: 'rgba(30,29,27,.11)' })));
    [...new Set(points.map((point) => round(worldToScreen(point).y)))].forEach((y) => gridGroup.append(createSvg('line', { x1: 0, y1: y, x2: rect.width, y2: y, stroke: 'rgba(30,29,27,.11)' })));
  } else {
    const size = state.gridSize * state.camera.zoom;
    const rowHeight = (size * Math.sqrt(3)) / 2;
    for (let y = (state.camera.y % rowHeight) - rowHeight; y < rect.height + rowHeight; y += rowHeight) {
      gridGroup.append(createSvg('line', { x1: 0, y1: y, x2: rect.width, y2: y, stroke: 'rgba(30,29,27,.11)' }));
    }
    for (let x = -rect.height; x < rect.width + rect.height; x += size) {
      const start = x + (state.camera.x % size);
      gridGroup.append(createSvg('line', { x1: start, y1: 0, x2: start + rect.height, y2: rect.height, stroke: 'rgba(30,29,27,.11)' }));
      gridGroup.append(createSvg('line', { x1: start, y1: rect.height, x2: start + rect.height, y2: 0, stroke: 'rgba(30,29,27,.11)' }));
    }
  }

  points.forEach((point) => {
    const screen = worldToScreen(point);
    gridGroup.append(createSvg('circle', { cx: screen.x, cy: screen.y, r: 2.2, fill: 'rgba(30,29,27,.28)' }));
  });

  if (hoverPoint) {
    const screen = worldToScreen(hoverPoint);
    gridGroup.append(createSvg('circle', { cx: screen.x, cy: screen.y, r: 7, fill: '#fff', stroke: '#111', 'stroke-width': 2 }));
  }
}

function renderShapes() {
  clear(shapeGroup);
  state.layers.forEach((layer) => {
    if (!layer.visible) return;
    shapeGroup.append(createSvg('path', {
      d: layerPath(layer),
      fill: layer.fill,
      'fill-rule': 'evenodd',
      stroke: layer.stroke,
      'stroke-width': layer.strokeWidth * state.camera.zoom,
      opacity: layer.opacity,
    }));
    if (layer.id === state.selectedId) renderSelection(layer);
  });
}

function renderSelection(layer) {
  const box = getBounds(layer.points.map(worldToScreen));
  shapeGroup.append(createSvg('rect', { x: box.minX - 8, y: box.minY - 8, width: box.width + 16, height: box.height + 16, rx: 8, fill: 'none', stroke: '#111', 'stroke-width': 1.5, 'stroke-dasharray': '5 5' }));
  layer.points.forEach((point) => {
    const screen = worldToScreen(point);
    shapeGroup.append(createSvg('circle', { cx: screen.x, cy: screen.y, r: 5.5, fill: '#fff', stroke: '#111', 'stroke-width': 1.7 }));
  });
}

function renderDraft() {
  clear(draftGroup);
  const livePoints = [...state.draft];
  if (hoverPoint && state.tool === 'draw' && livePoints.length) livePoints.push(hoverPoint);

  if (livePoints.length) {
    draftGroup.append(createSvg('polyline', {
      points: pointList(livePoints),
      fill: 'none',
      stroke: state.brush === 'cutout' ? '#dc2626' : state.fill,
      'stroke-width': Math.max(2, state.strokeWidth || 2),
      'stroke-dasharray': state.brush === 'cutout' ? '8 5' : 'none',
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round',
    }));
  }

  state.draft.forEach((point, index) => {
    const screen = worldToScreen(point);
    draftGroup.append(createSvg('circle', { cx: screen.x, cy: screen.y, r: index ? 4 : 6, fill: index ? '#111' : '#ffd12e', stroke: '#fff', 'stroke-width': 2 }));
  });

  if (hoverPoint && state.tool === 'draw') {
    const screen = worldToScreen(hoverPoint);
    draftGroup.append(createSvg('circle', { cx: screen.x, cy: screen.y, r: 4, fill: state.brush === 'cutout' ? '#dc2626' : '#111', stroke: '#fff', 'stroke-width': 2 }));
  }
}

function renderPanel() {
  document.querySelectorAll('[data-tool]').forEach((button) => button.classList.toggle('is-active', button.dataset.tool === state.tool && (!button.dataset.brush || button.dataset.brush === state.brush)));
  document.querySelectorAll('[data-grid]').forEach((button) => button.classList.toggle('is-active', button.dataset.grid === state.grid));

  $('#fill').value = state.fill;
  $('#stroke').value = state.stroke;
  $('#strokeWidth').value = state.strokeWidth;
  $('#opacity').value = state.opacity;
  $('#gridSize').value = state.gridSize;
  $('#strokeLabel').textContent = `${state.strokeWidth}px`;
  $('#opacityLabel').textContent = `${Math.round(state.opacity * 100)}%`;
  $('#gridLabel').textContent = `${state.gridSize}px`;
  $('#points').textContent = `${state.draft.length} puntos activos`;
  $('#figures').textContent = `${state.layers.filter((layer) => layer.visible).length} figuras`;

  const list = $('#layers');
  clear(list);
  if (!state.layers.length) {
    list.innerHTML = '<p class="empty-state">Dibuja una figura para crear la primera capa.</p>';
    return;
  }

  [...state.layers].reverse().forEach((layer) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `layer-item ${layer.id === state.selectedId ? 'is-active' : ''}`;
    item.innerHTML = `<span class="layer-swatch" style="background:${layer.fill}"></span><span>${layer.name}</span><span>${layer.points.length} pts</span>`;
    item.addEventListener('click', () => selectLayer(layer.id));
    list.append(item);
  });
}

function onPointerDown(event) {
  $('#canvasWrap').setPointerCapture(event.pointerId);
  const screenPoint = pointerPosition(event);
  if (state.tool === 'pan' || event.shiftKey || event.button === 1) {
    panDrag = { screenPoint, camera: clone(state.camera) };
    return;
  }
  if (state.tool === 'select') {
    startSelectionDrag(screenPoint);
    return;
  }
  addDraftPoint(snappedPointer(event));
}

function onPointerMove(event) {
  hoverPoint = snappedPointer(event);
  if (panDrag) {
    const screenPoint = pointerPosition(event);
    state.camera.x = panDrag.camera.x + screenPoint.x - panDrag.screenPoint.x;
    state.camera.y = panDrag.camera.y + screenPoint.y - panDrag.screenPoint.y;
    render();
    return;
  }
  if (selectionDrag) {
    updateSelectionDrag(event);
    return;
  }
  render();
}

function onPointerUp(event) {
  const wrap = $('#canvasWrap');
  if (wrap.hasPointerCapture(event.pointerId)) wrap.releasePointerCapture(event.pointerId);
  if (selectionDrag?.changed) saveAndRender();
  panDrag = null;
  selectionDrag = null;
}

function onWheel(event) {
  event.preventDefault();
  const before = screenToWorld(pointerPosition(event));
  state.camera.zoom = Math.min(3.2, Math.max(0.35, state.camera.zoom * (event.deltaY > 0 ? 0.92 : 1.08)));
  const after = worldToScreen(before);
  const pointer = pointerPosition(event);
  state.camera.x += pointer.x - after.x;
  state.camera.y += pointer.y - after.y;
  render();
}

function startSelectionDrag(screenPoint) {
  const worldPoint = screenToWorld(screenPoint);
  const currentLayer = selectedLayer();
  const vertexIndex = currentLayer ? currentLayer.points.findIndex((point) => distance(worldPoint, point) * state.camera.zoom <= 12) : -1;

  if (currentLayer && vertexIndex >= 0) {
    pushHistory();
    selectionDrag = { type: 'vertex', layerId: currentLayer.id, vertexIndex, changed: false };
    return;
  }

  const target = hitLayer(worldPoint);
  if (!target) {
    state.selectedId = null;
    saveAndRender();
    return;
  }

  selectLayer(target.id);
  pushHistory();
  selectionDrag = { type: 'layer', layerId: target.id, start: snapPoint(worldPoint), original: clone(target.points), holes: clone(target.holes || []), changed: false };
}

function updateSelectionDrag(event) {
  const layer = selectedLayer();
  if (!layer || layer.id !== selectionDrag.layerId) return;
  const point = snappedPointer(event);

  if (selectionDrag.type === 'vertex') {
    layer.points[selectionDrag.vertexIndex] = point;
  } else {
    const delta = { x: point.x - selectionDrag.start.x, y: point.y - selectionDrag.start.y };
    layer.points = selectionDrag.original.map((original) => snapPoint({ x: original.x + delta.x, y: original.y + delta.y }));
    layer.holes = selectionDrag.holes.map((hole) => hole.map((original) => snapPoint({ x: original.x + delta.x, y: original.y + delta.y })));
  }

  selectionDrag.changed = true;
  render();
}

function addDraftPoint(point) {
  const first = state.draft[0];
  if (first && distance(first, point) < 1 && state.draft.length >= 3) {
    finishDraft();
    return;
  }
  const last = state.draft.at(-1);
  if (last && distance(last, point) < 1) return;
  state.draft.push(point);
  render();
}

function finishDraft() {
  if (state.draft.length < 3) return;
  pushHistory();

  if (state.brush === 'cutout') {
    cutLayer(state.draft);
  } else {
    const layer = { id: `layer-${++idCounter}`, name: `Figura ${state.layers.length + 1}`, points: clone(state.draft), holes: [], fill: state.fill, stroke: state.stroke, strokeWidth: state.strokeWidth, opacity: state.opacity, visible: true };
    state.layers.push(layer);
    state.selectedId = layer.id;
  }

  state.draft = [];
  hoverPoint = null;
  saveAndRender();
}

function cutLayer(points) {
  const samples = sampleClosedPath(points, Math.max(6, state.gridSize / 4));
  for (let index = state.layers.length - 1; index >= 0; index -= 1) {
    const layer = state.layers[index];
    if (!layer.visible) continue;
    const intersects = samples.some((point) => isInsidePolygon(point, layer.points) && !(layer.holes || []).some((hole) => isInsidePolygon(point, hole)));
    if (intersects) {
      layer.holes = [...(layer.holes || []), clone(points)];
      state.selectedId = layer.id;
      showToast('Recorte aplicado');
      return;
    }
  }
  showToast('El recorte no pasa por ninguna figura');
}

function sampleClosedPath(points, step) {
  const result = [];
  points.forEach((from, index) => {
    const to = points[(index + 1) % points.length];
    const count = Math.ceil(Math.max(step, distance(from, to)) / step);
    for (let i = 0; i <= count; i += 1) {
      result.push({ x: from.x + ((to.x - from.x) * i) / count, y: from.y + ((to.y - from.y) * i) / count });
    }
  });
  return result;
}

function onKeyDown(event) {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
  const command = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();

  if (command && key === 'z') {
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
    return;
  }
  if (command && key === 'y') {
    event.preventDefault();
    redo();
    return;
  }
  if (command && key === 'c') {
    event.preventDefault();
    copySelected();
    return;
  }
  if (command && key === 'v') {
    event.preventDefault();
    pasteLayer();
    return;
  }
  if (event.key.startsWith('Arrow')) {
    event.preventDefault();
    handleArrowKey(event.key, event.shiftKey, event.altKey);
    return;
  }

  if (key === 'enter') finishDraft();
  else if (key === 'escape') cancelDraft();
  else if (key === 'v' || key === '1') setTool('select');
  else if (key === 'p' || key === '2') {
    state.brush = 'draw';
    setTool('draw');
  } else if (key === 'c') {
    state.brush = 'cutout';
    setTool('draw');
  } else if (key === 'h' || key === '3') setTool('pan');
  else if (key === 'g') toggleGrid();
  else if (key === 'delete' || key === 'backspace') deleteSelected();
  else if (key === ']') bringSelectedToFront();
}

function handleArrowKey(key, shift, fine) {
  const direction = {
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
  }[key];
  const step = fine ? state.gridSize / 4 : state.gridSize;
  const delta = { x: direction.x * step, y: direction.y * step };

  if (shift || !selectedLayer()) {
    state.camera.x -= delta.x * state.camera.zoom;
    state.camera.y -= delta.y * state.camera.zoom;
    render();
    return;
  }

  pushHistory();
  moveSelected(delta);
  saveAndRender();
}

function runAction(action) {
  if (action === 'undo') undo();
  if (action === 'redo') redo();
  if (action === 'delete') deleteSelected();
  if (action === 'duplicate') duplicateSelected();
  if (action === 'front') bringSelectedToFront();
}

function updateStyle(key, value) {
  const layer = selectedLayer();
  if (layer) {
    pushHistory();
    layer[key] = value;
  }
  state[key] = value;
  saveAndRender();
}

function selectLayer(layerId) {
  const layer = state.layers.find((item) => item.id === layerId);
  if (!layer) return;
  state.selectedId = layer.id;
  state.fill = layer.fill;
  state.stroke = layer.stroke;
  state.strokeWidth = layer.strokeWidth;
  state.opacity = layer.opacity;
  saveAndRender();
}

function moveSelected(delta) {
  const layer = selectedLayer();
  if (!layer) return;
  layer.points = layer.points.map((point) => snapPoint({ x: point.x + delta.x, y: point.y + delta.y }));
  layer.holes = (layer.holes || []).map((hole) => hole.map((point) => snapPoint({ x: point.x + delta.x, y: point.y + delta.y })));
}

function deleteSelected() {
  if (!selectedLayer()) return;
  pushHistory();
  state.layers = state.layers.filter((layer) => layer.id !== state.selectedId);
  state.selectedId = state.layers.at(-1)?.id || null;
  saveAndRender();
}

function duplicateSelected() {
  copiedLayer = clone(selectedLayer());
  pasteLayer();
}

function copySelected() {
  const layer = selectedLayer();
  if (!layer) return;
  copiedLayer = clone(layer);
  showToast('Figura copiada');
}

function pasteLayer() {
  if (!copiedLayer) return;
  pushHistory();
  const layer = clone(copiedLayer);
  layer.id = `layer-${++idCounter}`;
  layer.name = `${copiedLayer.name} copia`;
  layer.points = layer.points.map((point) => snapPoint({ x: point.x + state.gridSize, y: point.y + state.gridSize }));
  layer.holes = (layer.holes || []).map((hole) => hole.map((point) => snapPoint({ x: point.x + state.gridSize, y: point.y + state.gridSize })));
  state.layers.push(layer);
  state.selectedId = layer.id;
  saveAndRender();
}

function bringSelectedToFront() {
  const layer = selectedLayer();
  if (!layer) return;
  pushHistory();
  state.layers = state.layers.filter((item) => item.id !== layer.id);
  state.layers.push(layer);
  saveAndRender();
}

function undo() {
  if (!history.length) return;
  future.push(clone({ ...state, draft: [] }));
  restore(history.pop());
}

function redo() {
  if (!future.length) return;
  history.push(clone({ ...state, draft: [] }));
  restore(future.pop());
}

function cancelDraft() {
  state.draft = [];
  hoverPoint = null;
  render();
}

function toggleGrid() {
  state.grid = state.grid === 'square' ? 'isometric' : 'square';
  saveAndRender();
}

function togglePanel() {
  state.panelCollapsed = !state.panelCollapsed;
  saveAndRender();
}

function hitLayer(point) {
  for (let index = state.layers.length - 1; index >= 0; index -= 1) {
    const layer = state.layers[index];
    if (layer.visible && isInsidePolygon(point, layer.points) && !(layer.holes || []).some((hole) => isInsidePolygon(point, hole))) return layer;
  }
  return null;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isInsidePolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const intersects = polygon[i].y > point.y !== polygon[j].y > point.y && point.x < ((polygon[j].x - polygon[i].x) * (point.y - polygon[i].y)) / (polygon[j].y - polygon[i].y) + polygon[i].x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function getBounds(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function shiftPoints(points, box) {
  return points.map((point) => ({ x: point.x - box.minX + EXPORT_PADDING, y: point.y - box.minY + EXPORT_PADDING }));
}

function exportLogo(type) {
  const layers = state.layers.filter((layer) => layer.visible && layer.points.length >= 3);
  if (!layers.length) {
    showToast('Dibuja al menos una figura');
    return;
  }

  const allPoints = layers.flatMap((layer) => [layer.points, ...(layer.holes || [])].flat());
  const box = getBounds(allPoints);
  const width = box.width + EXPORT_PADDING * 2;
  const height = box.height + EXPORT_PADDING * 2;
  const body = layers
    .map((layer) => {
      const shifted = { ...layer, points: shiftPoints(layer.points, box), holes: (layer.holes || []).map((hole) => shiftPoints(hole, box)) };
      return `<path d="${layerPath(shifted, false)}" fill="${layer.fill}" fill-rule="evenodd" stroke="${layer.stroke}" stroke-width="${layer.strokeWidth}" opacity="${layer.opacity}"/>`;
    })
    .join('\n  ');
  const svgText = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(width)} ${round(height)}" width="${round(width)}" height="${round(height)}" role="img" aria-label="Logo creado con Logo Creator by AlonSofware">\n  ${body}\n</svg>`;

  if (type === 'svg') {
    download('logo-creator.svg', new Blob([svgText], { type: 'image/svg+xml' }));
    return;
  }

  const image = new Image();
  const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
  image.onload = () => {
    const scale = Math.max(2, Math.min(4, 1024 / Math.max(width, height)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) download('logo-creator.png', blob);
      URL.revokeObjectURL(url);
    }, 'image/png');
  };
  image.src = url;
}

function download(filename, blob) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast(`${filename} descargado`);
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 1800);
}

init();
