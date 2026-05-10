import '../css/main.css';

const SVG_NS = 'http://www.w3.org/2000/svg';
const STORAGE_KEY = 'logo-lattice-state-v2';
const EXPORT_PADDING = 36;
const DEFAULT_STATE = {
  tool: 'draw',
  brush: 'draw',
  gridType: 'isometric',
  gridSize: 60,
  fill: '#000000',
  stroke: '#000000',
  strokeWidth: 0,
  opacity: 1,
  layers: [
    {
      id: 'sample-layer',
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
  selectedId: 'sample-layer',
  currentPoints: [],
  camera: { x: 0, y: 0, zoom: 1 },
};

const app = document.querySelector('#app');
let svg;
let gridGroup;
let shapeGroup;
let draftGroup;
let ui = {};
let state = loadState();
let history = [];
let future = [];
let hoverPoint = null;
let panStart = null;
let dragSelection = null;
let copiedLayer = null;
let toastTimer = 0;
let idCounter = Date.now();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeLayer(layer) {
  return { holes: [], visible: true, ...layer };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem('logo-lattice-state-v1'));
    if (saved && Array.isArray(saved.layers)) {
      return {
        ...clone(DEFAULT_STATE),
        ...saved,
        layers: saved.layers.map(normalizeLayer),
        currentPoints: [],
        camera: clone(DEFAULT_STATE.camera),
      };
    }
  } catch {
    // Ignore damaged localStorage data.
  }
  return clone(DEFAULT_STATE);
}

function persist() {
  const data = clone(state);
  data.currentPoints = [];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function pushHistory() {
  history.push(clone({ ...state, currentPoints: [] }));
  if (history.length > 80) history = history.slice(-80);
  future = [];
}

function restore(snapshot) {
  state = clone(snapshot);
  state.currentPoints = [];
  hoverPoint = null;
  persist();
  render();
}

function makeId() {
  idCounter += 1;
  return `layer-${idCounter}`;
}

function icon(name) {
  const icons = {
    mark: '<path d="M5 14h5V9h5V4h4v9h-5v5H5z"/><path d="M5 10 2 7l5-5 3 3-2 2 2 2-3 3z" opacity=".75"/>',
    select: '<path d="m4 3 7 17 2-7 7-2Z" fill="none" stroke="currentColor" stroke-width="2"/>',
    pan: '<path d="M12 2v20M2 12h20M7 7l5-5 5 5M17 17l-5 5-5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    undo: '<path d="M3 7v6h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 13a8 8 0 1 0 2-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    redo: '<path d="M21 7v6h-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19 13a8 8 0 1 1-2-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    draw: '<path d="M4 20h4l10.5-10.5a2.8 2.8 0 0 0-4-4L4 16v4Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="m13.5 6.5 4 4" stroke="currentColor" stroke-width="2"/>',
    cut: '<path d="M4 19 19 4M6 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" fill="none" stroke="currentColor" stroke-width="2"/>',
    grid: '<path d="M4 4h16v16H4zM4 9h16M4 15h16M9 4v16M15 4v16" fill="none" stroke="currentColor" stroke-width="2"/>',
    iso: '<path d="M12 3 3 8l9 5 9-5-9-5ZM3 8v8l9 5 9-5V8" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3m-8 0 1 14h8l1-14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    download: '<path d="M12 3v12m0 0 5-5m-5 5-5-5M4 21h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  };
  return `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">${icons[name] ?? ''}</svg>`;
}

function init() {
  app.innerHTML = `
    <div class="top-left">
      <section class="floating-card brand-card" aria-label="Logo Lattice">
        <span class="brand-mark">${icon('mark')}</span>
        <div>
          <h1 class="brand-title"><span>Logo</span> Lattice</h1>
          <p class="brand-subtitle">Crea logos uniendo puntos en una retícula</p>
        </div>
      </section>
      <button class="floating-card whats-new" type="button">Atajos <span>⌄</span></button>
    </div>
    <section class="canvas-wrap" id="canvasWrap" aria-label="Área de dibujo">
      <svg id="workspace" role="img" aria-label="Editor vectorial de logos geométricos"></svg>
    </section>
    <aside class="panel right-panel" id="settingsPanel" aria-label="Herramientas del generador">
      <section class="panel-section">
        <div class="tool-grid">
          <button class="tool-button" data-tool="select" type="button">${icon('select')} Seleccionar <span class="shortcut">V / 1</span></button>
          <button class="tool-button" data-tool="pan" type="button">${icon('pan')} Mover vista <span class="shortcut">H / 3</span></button>
          <button class="icon-button" data-action="undo" type="button" aria-label="Deshacer">${icon('undo')}<span class="shortcut">Ctrl+Z</span></button>
          <button class="icon-button" data-action="redo" type="button" aria-label="Rehacer">${icon('redo')}<span class="shortcut">Ctrl+Y</span></button>
        </div>
        <div class="dashed-help" style="margin-top: .65rem">Dibujar: <strong>P / 2</strong> · Recortar: <strong>C</strong> · Flechas: mover selección · Shift+flechas: mover vista · Enter: cerrar · Esc: cancelar</div>
      </section>
      <section class="panel-section">
        <h2>Estilo del pincel</h2>
        <div class="segmented">
          <button class="mode-button" data-brush="draw" type="button">${icon('draw')} Dibujar</button>
          <button class="mode-button" data-brush="cutout" type="button">${icon('cut')} Recortar</button>
        </div>
        <div class="form-row">
          <span class="label">Relleno y trazo</span>
          <div class="inline-row">
            <input id="fillColor" type="color" aria-label="Color de relleno" />
            <input id="strokeColor" type="color" aria-label="Color de trazo" />
          </div>
        </div>
        <div class="form-row">
          <label for="strokeWidth">Grosor de línea <strong id="strokeLabel"></strong></label>
          <input id="strokeWidth" type="range" min="0" max="20" step="1" />
        </div>
        <div class="form-row">
          <label for="opacity">Opacidad <strong id="opacityLabel"></strong></label>
          <input id="opacity" type="range" min="0.1" max="1" step="0.05" />
        </div>
      </section>
      <section class="panel-section">
        <h2>Retícula</h2>
        <div class="segmented">
          <button class="mode-button" data-grid="square" type="button">${icon('grid')} Cuadrada</button>
          <button class="mode-button" data-grid="isometric" type="button">${icon('iso')} Isométrica</button>
        </div>
        <div class="form-row">
          <label for="gridSize">Tamaño <strong id="gridLabel"></strong></label>
          <input id="gridSize" type="range" min="20" max="120" step="5" />
        </div>
      </section>
      <section class="panel-section">
        <h2>Capas</h2>
        <div class="layer-list" id="layerList"></div>
        <div class="inline-row" style="margin-top: .75rem">
          <button class="secondary-button" data-action="front" type="button">Al frente</button>
          <button class="secondary-button" data-action="duplicate" type="button">Duplicar</button>
          <button class="danger-button" data-action="delete" type="button">${icon('trash')} Borrar</button>
        </div>
      </section>
      <section class="panel-section">
        <h2>Exportar</h2>
        <div class="export-row">
          <button class="export-button primary" data-export="svg" type="button">${icon('download')} SVG</button>
          <button class="export-button" data-export="png" type="button">${icon('download')} PNG</button>
        </div>
        <div class="status-line">
          <span id="pointStatus">0 puntos</span>
          <span id="shapeStatus">0 figuras</span>
        </div>
      </section>
    </aside>
    <div class="bottom-left">
      <button class="floating-card report-button" type="button">✕ Reportar un fallo</button>
      <div class="coffee-card"><strong>☕ Invítame a un café</strong>Logo Lattice será siempre gratis. Si te gusta, puedes apoyar el proyecto.</div>
    </div>
    <button class="floating-card mobile-toggle" id="mobileToggle" type="button">${icon('menu')} Panel</button>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
  `;

  ui = {
    wrap: document.querySelector('#canvasWrap'),
    panel: document.querySelector('#settingsPanel'),
    mobileToggle: document.querySelector('#mobileToggle'),
    toast: document.querySelector('#toast'),
    fillColor: document.querySelector('#fillColor'),
    strokeColor: document.querySelector('#strokeColor'),
    strokeWidth: document.querySelector('#strokeWidth'),
    opacity: document.querySelector('#opacity'),
    strokeLabel: document.querySelector('#strokeLabel'),
    opacityLabel: document.querySelector('#opacityLabel'),
    gridSize: document.querySelector('#gridSize'),
    gridLabel: document.querySelector('#gridLabel'),
    layerList: document.querySelector('#layerList'),
    pointStatus: document.querySelector('#pointStatus'),
    shapeStatus: document.querySelector('#shapeStatus'),
  };

  svg = document.querySelector('#workspace');
  gridGroup = createSvgElement('g', { id: 'grid' });
  shapeGroup = createSvgElement('g', { id: 'shapes' });
  draftGroup = createSvgElement('g', { id: 'draft' });
  svg.append(gridGroup, shapeGroup, draftGroup);

  attachEvents();
  centerCamera();
  render();
}

function attachEvents() {
  ui.wrap.addEventListener('pointerdown', onPointerDown);
  ui.wrap.addEventListener('pointermove', onPointerMove);
  ui.wrap.addEventListener('pointerleave', () => {
    hoverPoint = null;
    renderDraft();
  });
  ui.wrap.addEventListener('pointerup', onPointerUp);
  ui.wrap.addEventListener('pointercancel', onPointerUp);
  ui.wrap.addEventListener('dblclick', finishCurrentShape);
  ui.wrap.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('resize', render);
  document.addEventListener('keydown', onKeyDown);

  document.querySelectorAll('[data-tool]').forEach((button) => button.addEventListener('click', () => setTool(button.dataset.tool)));
  document.querySelectorAll('[data-brush]').forEach((button) => {
    button.addEventListener('click', () => {
      state.brush = button.dataset.brush;
      state.tool = 'draw';
      state.currentPoints = [];
      persist();
      render();
    });
  });
  document.querySelectorAll('[data-grid]').forEach((button) => {
    button.addEventListener('click', () => {
      state.gridType = button.dataset.grid;
      persist();
      render();
    });
  });
  document.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => runAction(button.dataset.action)));
  document.querySelectorAll('[data-export]').forEach((button) => button.addEventListener('click', () => exportLogo(button.dataset.export)));

  ui.fillColor.addEventListener('input', () => updateStyle('fill', ui.fillColor.value));
  ui.strokeColor.addEventListener('input', () => updateStyle('stroke', ui.strokeColor.value));
  ui.strokeWidth.addEventListener('input', () => updateStyle('strokeWidth', Number(ui.strokeWidth.value)));
  ui.opacity.addEventListener('input', () => updateStyle('opacity', Number(ui.opacity.value)));
  ui.gridSize.addEventListener('input', () => {
    state.gridSize = Number(ui.gridSize.value);
    persist();
    render();
  });
  ui.mobileToggle.addEventListener('click', () => ui.panel.classList.toggle('is-open'));
}

function setTool(tool) {
  state.tool = tool;
  if (tool !== 'draw') state.currentPoints = [];
  persist();
  render();
}

function runAction(action) {
  if (action === 'undo') undo();
  if (action === 'redo') redo();
  if (action === 'delete') deleteSelected();
  if (action === 'duplicate') duplicateSelected();
  if (action === 'front') bringSelectedToFront();
}

function updateStyle(key, value) {
  const selected = getSelectedLayer();
  if (selected) {
    pushHistory();
    selected[key] = value;
  }
  state[key] = value;
  persist();
  render();
}

function centerCamera() {
  const rect = app.getBoundingClientRect();
  state.camera.x = rect.width / 2;
  state.camera.y = rect.height / 2;
}

function createSvgElement(tag, attrs = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function clear(element) {
  while (element.firstChild) element.firstChild.remove();
}

function render() {
  const rect = app.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
  ui.wrap.classList.toggle('is-panning', state.tool === 'pan');
  ui.wrap.classList.toggle('is-selecting', state.tool === 'select');
  renderGrid(rect);
  renderLayers();
  renderDraft();
  renderControls();
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
  if (state.gridType === 'square') return { x: Math.round(point.x / size) * size, y: Math.round(point.y / size) * size };
  const h = size * Math.sqrt(3) * 0.5;
  const row = Math.round(point.y / h);
  const offset = row % 2 === 0 ? 0 : size / 2;
  return { x: Math.round((point.x - offset) / size) * size + offset, y: row * h };
}

function getPointerWorld(event) {
  return snapPoint(screenToWorld(pointerPosition(event)));
}

function getVisibleGridPoints(rect) {
  const topLeft = screenToWorld({ x: -80, y: -80 });
  const bottomRight = screenToWorld({ x: rect.width + 80, y: rect.height + 80 });
  const size = state.gridSize;
  const points = [];
  if (state.gridType === 'square') {
    for (let x = Math.floor(topLeft.x / size) * size; x <= bottomRight.x; x += size) {
      for (let y = Math.floor(topLeft.y / size) * size; y <= bottomRight.y; y += size) points.push({ x, y });
    }
    return points;
  }
  const h = size * Math.sqrt(3) * 0.5;
  for (let row = Math.floor(topLeft.y / h) - 1; row <= Math.ceil(bottomRight.y / h) + 1; row += 1) {
    const y = row * h;
    const offset = row % 2 === 0 ? 0 : size / 2;
    for (let x = Math.floor((topLeft.x - offset) / size) * size + offset; x <= bottomRight.x + size; x += size) points.push({ x, y });
  }
  return points;
}

function renderGrid(rect) {
  clear(gridGroup);
  const gridColor = 'rgba(30, 29, 27, 0.11)';
  const pointColor = 'rgba(30, 29, 27, 0.28)';
  const points = getVisibleGridPoints(rect);
  if (state.gridType === 'square') {
    const xs = [...new Set(points.map((point) => round(worldToScreen(point).x)))];
    const ys = [...new Set(points.map((point) => round(worldToScreen(point).y)))];
    xs.forEach((x) => gridGroup.append(createSvgElement('line', { x1: x, y1: 0, x2: x, y2: rect.height, stroke: gridColor, 'stroke-width': 1 })));
    ys.forEach((y) => gridGroup.append(createSvgElement('line', { x1: 0, y1: y, x2: rect.width, y2: y, stroke: gridColor, 'stroke-width': 1 })));
  } else {
    const size = state.gridSize * state.camera.zoom;
    const h = size * Math.sqrt(3) * 0.5;
    const startY = state.camera.y % h;
    const startX = state.camera.x % size;
    for (let y = startY - h; y < rect.height + h; y += h) gridGroup.append(createSvgElement('line', { x1: 0, y1: y, x2: rect.width, y2: y, stroke: gridColor, 'stroke-width': 1 }));
    for (let x = -rect.height; x < rect.width + rect.height; x += size) {
      gridGroup.append(createSvgElement('line', { x1: x + startX, y1: 0, x2: x + startX + rect.height, y2: rect.height, stroke: gridColor, 'stroke-width': 1 }));
      gridGroup.append(createSvgElement('line', { x1: x + startX, y1: rect.height, x2: x + startX + rect.height, y2: 0, stroke: gridColor, 'stroke-width': 1 }));
    }
  }
  points.forEach((point) => {
    const p = worldToScreen(point);
    gridGroup.append(createSvgElement('circle', { cx: p.x, cy: p.y, r: 2.2, fill: pointColor }));
  });
  if (hoverPoint) {
    const h = worldToScreen(hoverPoint);
    gridGroup.append(createSvgElement('circle', { cx: h.x, cy: h.y, r: 7, fill: '#fff', stroke: '#111', 'stroke-width': 2 }));
  }
}

function pointsToAttribute(points, useCamera = true) {
  return points.map((point) => {
    const p = useCamera ? worldToScreen(point) : point;
    return `${round(p.x)},${round(p.y)}`;
  }).join(' ');
}

function layerToPath(layer, useCamera = true) {
  const rings = [layer.points, ...(layer.holes || [])];
  return rings
    .filter((ring) => ring.length >= 3)
    .map((ring) => {
      const first = useCamera ? worldToScreen(ring[0]) : ring[0];
      const rest = ring.slice(1).map((point) => {
        const p = useCamera ? worldToScreen(point) : point;
        return `L ${round(p.x)} ${round(p.y)}`;
      });
      return `M ${round(first.x)} ${round(first.y)} ${rest.join(' ')} Z`;
    })
    .join(' ');
}

function renderLayers() {
  clear(shapeGroup);
  state.layers.forEach((layer) => {
    if (!layer.visible) return;
    const path = createSvgElement('path', {
      d: layerToPath(layer),
      fill: layer.fill,
      'fill-rule': 'evenodd',
      stroke: layer.stroke,
      'stroke-width': layer.strokeWidth * state.camera.zoom,
      opacity: layer.opacity,
      'data-id': layer.id,
    });
    path.style.cursor = state.tool === 'select' ? 'move' : 'pointer';
    shapeGroup.append(path);

    if (layer.id === state.selectedId) renderSelection(layer);
  });
}

function renderSelection(layer) {
  const bounds = getBounds(layer.points.map(worldToScreen));
  shapeGroup.append(createSvgElement('rect', {
    x: bounds.minX - 8,
    y: bounds.minY - 8,
    width: bounds.width + 16,
    height: bounds.height + 16,
    fill: 'none',
    stroke: '#111111',
    'stroke-width': 1.5,
    'stroke-dasharray': '5 5',
    rx: 8,
  }));
  layer.points.forEach((point, index) => {
    const p = worldToScreen(point);
    const handle = createSvgElement('circle', {
      cx: p.x,
      cy: p.y,
      r: 5.5,
      fill: '#fff',
      stroke: '#111',
      'stroke-width': 1.7,
      'data-vertex': index,
    });
    handle.style.cursor = 'grab';
    shapeGroup.append(handle);
  });
}

function renderDraft() {
  clear(draftGroup);
  const livePoints = [...state.currentPoints];
  if (hoverPoint && state.tool === 'draw' && livePoints.length) livePoints.push(hoverPoint);
  if (livePoints.length) {
    draftGroup.append(createSvgElement('polyline', {
      points: pointsToAttribute(livePoints),
      fill: 'none',
      stroke: state.brush === 'cutout' ? '#dc2626' : state.fill,
      'stroke-width': Math.max(2, state.strokeWidth || 2),
      'stroke-dasharray': state.brush === 'cutout' ? '8 5' : 'none',
      'stroke-linejoin': 'round',
+      'stroke-linecap': 'round',
    }));
  }
  state.currentPoints.forEach((point, index) => {
    const p = worldToScreen(point);
    draftGroup.append(createSvgElement('circle', { cx: p.x, cy: p.y, r: index === 0 ? 6 : 4, fill: index === 0 ? '#ffd12e' : '#111', stroke: '#fff', 'stroke-width': 2 }));
  });
  if (hoverPoint && state.tool === 'draw') {
    const h = worldToScreen(hoverPoint);
    draftGroup.append(createSvgElement('circle', { cx: h.x, cy: h.y, r: 4, fill: state.brush === 'cutout' ? '#dc2626' : '#111', stroke: '#fff', 'stroke-width': 2 }));
  }
}

function renderControls() {
  document.querySelectorAll('[data-tool]').forEach((button) => button.classList.toggle('is-active', button.dataset.tool === state.tool));
  document.querySelectorAll('[data-brush]').forEach((button) => button.classList.toggle('is-active', button.dataset.brush === state.brush));
  document.querySelectorAll('[data-grid]').forEach((button) => button.classList.toggle('is-active', button.dataset.grid === state.gridType));
  ui.fillColor.value = state.fill;
  ui.strokeColor.value = state.stroke;
  ui.strokeWidth.value = state.strokeWidth;
  ui.opacity.value = state.opacity;
  ui.gridSize.value = state.gridSize;
  ui.strokeLabel.textContent = `${state.strokeWidth}px`;
  ui.opacityLabel.textContent = `${Math.round(state.opacity * 100)}%`;
  ui.gridLabel.textContent = `${state.gridSize}px`;
  ui.pointStatus.textContent = `${state.currentPoints.length} puntos activos`;
  ui.shapeStatus.textContent = `${state.layers.filter((layer) => layer.visible).length} figuras`;
  renderLayerList();
}

function renderLayerList() {
  clear(ui.layerList);
  if (!state.layers.length) {
    ui.layerList.innerHTML = '<p class="empty-state">Aún no hay figuras. Usa “Dibujar” y une varios puntos.</p>';
    return;
  }
  [...state.layers].reverse().forEach((layer) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `layer-item ${layer.id === state.selectedId ? 'is-active' : ''}`;
    item.innerHTML = `<span class="layer-swatch" style="background:${layer.fill}"></span><span>${layer.name}</span><span>${layer.points.length} pts</span>`;
    item.addEventListener('click', () => selectLayer(layer.id));
    ui.layerList.append(item);
  });
}

function selectLayer(id) {
  const layer = state.layers.find((item) => item.id === id);
  if (!layer) return;
  state.selectedId = id;
  state.fill = layer.fill;
  state.stroke = layer.stroke;
  state.strokeWidth = layer.strokeWidth;
  state.opacity = layer.opacity;
  persist();
  render();
}

function onPointerDown(event) {
  ui.wrap.setPointerCapture(event.pointerId);
  const pointer = pointerPosition(event);
  if (state.tool === 'pan' || event.button === 1 || event.shiftKey) {
    panStart = { pointer, camera: clone(state.camera) };
    return;
  }
  if (state.tool === 'select') {
    startSelectionDrag(pointer);
    return;
  }
  if (state.tool === 'draw') addDraftPoint(getPointerWorld(event));
}

function onPointerMove(event) {
  hoverPoint = getPointerWorld(event);
  if (panStart) {
    const current = pointerPosition(event);
    state.camera.x = panStart.camera.x + current.x - panStart.pointer.x;
    state.camera.y = panStart.camera.y + current.y - panStart.pointer.y;
    render();
    return;
  }
  if (dragSelection) {
    updateSelectionDrag(event);
    return;
  }
  renderGrid(app.getBoundingClientRect());
  renderDraft();
}

function onPointerUp(event) {
  if (ui.wrap.hasPointerCapture(event.pointerId)) ui.wrap.releasePointerCapture(event.pointerId);
  if (dragSelection?.changed) {
    persist();
    render();
  }
  panStart = null;
  dragSelection = null;
}

function onWheel(event) {
  event.preventDefault();
  const before = screenToWorld(pointerPosition(event));
  const direction = event.deltaY > 0 ? -1 : 1;
  state.camera.zoom = clamp(state.camera.zoom * (1 + direction * 0.08), 0.35, 3.2);
  const after = worldToScreen(before);
  const current = pointerPosition(event);
  state.camera.x += current.x - after.x;
  state.camera.y += current.y - after.y;
  render();
}

function startSelectionDrag(pointer) {
  const world = screenToWorld(pointer);
  const selected = getSelectedLayer();
  const vertexIndex = selected ? selected.points.findIndex((point) => distance(world, point) * state.camera.zoom <= 12) : -1;
  if (selected && vertexIndex >= 0) {
    pushHistory();
    dragSelection = { type: 'vertex', layerId: selected.id, vertexIndex, changed: false };
    return;
  }
  const hit = hitTestLayer(world);
  if (!hit) {
    state.selectedId = null;
    persist();
    render();
    return;
  }
  selectLayer(hit.id);
  pushHistory();
  dragSelection = { type: 'layer', layerId: hit.id, start: snapPoint(world), original: clone(hit.points), changed: false };
}

function updateSelectionDrag(event) {
  const layer = getSelectedLayer();
  if (!layer || layer.id !== dragSelection.layerId) return;
  const snapped = getPointerWorld(event);
  if (dragSelection.type === 'vertex') {
    layer.points[dragSelection.vertexIndex] = snapped;
  } else {
    const delta = { x: snapped.x - dragSelection.start.x, y: snapped.y - dragSelection.start.y };
    layer.points = dragSelection.original.map((point) => snapPoint({ x: point.x + delta.x, y: point.y + delta.y }));
  }
  dragSelection.changed = true;
  render();
}

function hitTestLayer(point) {
  for (let index = state.layers.length - 1; index >= 0; index -= 1) {
    const layer = state.layers[index];
    if (!layer.visible) continue;
    if (isPointInPolygon(point, layer.points) && !(layer.holes || []).some((hole) => isPointInPolygon(point, hole))) return layer;
  }
  return null;
}

function addDraftPoint(point) {
  const first = state.currentPoints[0];
  if (first && distance(point, first) < 1 && state.currentPoints.length >= 3) {
    finishCurrentShape();
    return;
  }
  const last = state.currentPoints[state.currentPoints.length - 1];
  if (last && distance(point, last) < 1) return;
  state.currentPoints.push(point);
  render();
}

function finishCurrentShape() {
  if (state.currentPoints.length < 3) return;
  pushHistory();
  if (state.brush === 'cutout') applyCutout(state.currentPoints);
  else {
    const layer = {
      id: makeId(),
      name: `Figura ${state.layers.length + 1}`,
      points: clone(state.currentPoints),
      holes: [],
      fill: state.fill,
      stroke: state.stroke,
      strokeWidth: state.strokeWidth,
      opacity: state.opacity,
      visible: true,
    };
    state.layers.push(layer);
    state.selectedId = layer.id;
  }
  state.currentPoints = [];
  hoverPoint = null;
  persist();
  render();
}

function applyCutout(points) {
  const target = findCutoutTarget(points);
  if (!target) {
    showToast('El recorte no pasa por ninguna figura');
    return;
  }
  target.holes = [...(target.holes || []), clone(points)];
  target.name = `${target.name} recortada`;
  state.selectedId = target.id;
  showToast('Recorte aplicado a la figura inferior');
}

function findCutoutTarget(points) {
  const samples = samplePolyline(points, Math.max(6, state.gridSize / 4));
  for (let index = state.layers.length - 1; index >= 0; index -= 1) {
    const layer = state.layers[index];
    if (!layer.visible) continue;
    const crossesLayer = samples.some((point) => isPointInPolygon(point, layer.points) && !(layer.holes || []).some((hole) => isPointInPolygon(point, hole)));
    if (crossesLayer) return layer;
  }
  return null;
}

function samplePolyline(points, step) {
  const samples = [];
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const length = Math.max(step, distance(a, b));
    const count = Math.ceil(length / step);
    for (let j = 0; j <= count; j += 1) samples.push({ x: a.x + ((b.x - a.x) * j) / count, y: a.y + ((b.y - a.y) * j) / count });
  }
  return samples;
}

function onKeyDown(event) {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return;
  const cmd = event.metaKey || event.ctrlKey;
  const key = event.key.toLowerCase();
  if (cmd && key === 'z') {
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
    return;
  }
  if (cmd && key === 'y') {
    event.preventDefault();
    redo();
    return;
  }
  if (cmd && key === 'c') {
    event.preventDefault();
    copySelected();
    return;
  }
  if (cmd && key === 'v') {
    event.preventDefault();
    pasteLayer();
    return;
  }
  if (event.key.startsWith('Arrow')) {
    event.preventDefault();
    handleArrowKey(event.key, event.shiftKey, event.altKey);
    return;
  }
  if (key === 'enter') finishCurrentShape();
  if (key === 'escape') {
    state.currentPoints = [];
    hoverPoint = null;
    render();
  }
  if (key === 'v' || key === '1') setTool('select');
  if (key === 'p' || key === '2') {
    state.brush = 'draw';
    setTool('draw');
  }
  if (key === 'c') {
    state.brush = 'cutout';
    setTool('draw');
  }
  if (key === 'h' || key === '3') setTool('pan');
  if (key === 'g') {
    state.gridType = state.gridType === 'square' ? 'isometric' : 'square';
    persist();
    render();
  }
  if (key === 'delete' || key === 'backspace') deleteSelected();
  if (key === ']') bringSelectedToFront();
}

function handleArrowKey(key, shift, alt) {
  const directions = {
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
  };
  const direction = directions[key];
  const step = alt ? Math.max(1, state.gridSize / 4) : state.gridSize;
  const delta = { x: direction.x * step, y: direction.y * step };
  if (shift || !state.selectedId) {
    state.camera.x -= delta.x * state.camera.zoom;
    state.camera.y -= delta.y * state.camera.zoom;
    render();
    return;
  }
  moveSelected(delta);
}

function moveSelected(delta) {
  const layer = getSelectedLayer();
  if (!layer) return;
  pushHistory();
  layer.points = layer.points.map((point) => snapPoint({ x: point.x + delta.x, y: point.y + delta.y }));
  layer.holes = (layer.holes || []).map((hole) => hole.map((point) => snapPoint({ x: point.x + delta.x, y: point.y + delta.y })));
  persist();
  render();
}

function getSelectedLayer() {
  return state.layers.find((layer) => layer.id === state.selectedId);
}

function copySelected() {
  const selected = getSelectedLayer();
  if (!selected) return;
  copiedLayer = clone(selected);
  showToast('Figura copiada');
}

function pasteLayer() {
  if (!copiedLayer) return;
  pushHistory();
  const layer = clone(copiedLayer);
  layer.id = makeId();
  layer.name = `${copiedLayer.name} copia`;
  layer.points = layer.points.map((point) => snapPoint({ x: point.x + state.gridSize, y: point.y + state.gridSize }));
  layer.holes = (layer.holes || []).map((hole) => hole.map((point) => snapPoint({ x: point.x + state.gridSize, y: point.y + state.gridSize })));
  state.layers.push(layer);
  state.selectedId = layer.id;
  persist();
  render();
  showToast('Figura pegada');
}

function duplicateSelected() {
  copySelected();
  pasteLayer();
}

function deleteSelected() {
  if (!state.selectedId) return;
  pushHistory();
  state.layers = state.layers.filter((layer) => layer.id !== state.selectedId);
  state.selectedId = state.layers.at(-1)?.id ?? null;
  persist();
  render();
}

function bringSelectedToFront() {
  const selected = getSelectedLayer();
  if (!selected) return;
  pushHistory();
  state.layers = state.layers.filter((layer) => layer.id !== selected.id);
  state.layers.push(selected);
  persist();
  render();
}

function undo() {
  if (!history.length) return;
  future.push(clone({ ...state, currentPoints: [] }));
  restore(history.pop());
}

function redo() {
  if (!future.length) return;
  history.push(clone({ ...state, currentPoints: [] }));
  restore(future.pop());
}

function getBounds(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

function exportLogo(type) {
  const visibleLayers = state.layers.filter((layer) => layer.visible && layer.points.length >= 3);
  if (!visibleLayers.length) {
    showToast('Dibuja al menos una figura');
    return;
  }
  const allPoints = visibleLayers.flatMap((layer) => [layer.points, ...(layer.holes || [])].flat());
  const bounds = getBounds(allPoints);
  const width = Math.max(1, bounds.width + EXPORT_PADDING * 2);
  const height = Math.max(1, bounds.height + EXPORT_PADDING * 2);
  const polygons = visibleLayers.map((layer) => {
    const shifted = {
      ...layer,
      points: shiftPoints(layer.points, bounds),
      holes: (layer.holes || []).map((hole) => shiftPoints(hole, bounds)),
    };
    return `<path d="${layerToPath(shifted, false)}" fill="${layer.fill}" fill-rule="evenodd" stroke="${layer.stroke}" stroke-width="${layer.strokeWidth}" opacity="${layer.opacity}"/>`;
  }).join('\n  ');
  const svgText = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(width)} ${round(height)}" width="${round(width)}" height="${round(height)}" role="img" aria-label="Logo exportado desde Logo Lattice">\n  ${polygons}\n</svg>`;
  if (type === 'svg') {
    downloadFile('logo-lattice.svg', 'image/svg+xml;charset=utf-8', svgText);
    return;
  }
  const img = new Image();
  const blob = new Blob([svgText], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  img.onload = () => {
    const scale = Math.max(2, Math.min(4, 1024 / Math.max(width, height)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((pngBlob) => {
      if (!pngBlob) return;
      downloadBlob('logo-lattice.png', pngBlob);
      URL.revokeObjectURL(url);
    }, 'image/png');
  };
  img.src = url;
}

function shiftPoints(points, bounds) {
  return points.map((point) => ({ x: point.x - bounds.minX + EXPORT_PADDING, y: point.y - bounds.minY + EXPORT_PADDING }));
}

function downloadFile(filename, type, content) {
  downloadBlob(filename, new Blob([content], { type }));
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  showToast(`${filename} descargado`);
}

function isPointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function round(number) {
  return Math.round(number * 100) / 100;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('is-visible'), 1800);
}

init();
