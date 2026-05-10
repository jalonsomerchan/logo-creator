import '../css/main.css';

const SVG_NS = 'http://www.w3.org/2000/svg';
const STORAGE_KEY = 'logo-lattice-state-v1';
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
  showGrid: true,
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
let isPointerDown = false;
let panStart = null;
let pointerStart = null;
let toastTimer = 0;
let copiedLayer = null;
let idCounter = Date.now();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.layers)) {
      return { ...clone(DEFAULT_STATE), ...saved, currentPoints: [], camera: clone(DEFAULT_STATE.camera) };
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
      <button class="floating-card whats-new" type="button">Novedades <span>⌄</span></button>
    </div>

    <section class="canvas-wrap" id="canvasWrap" aria-label="Área de dibujo">
      <svg id="workspace" role="img" aria-label="Editor vectorial de logos geométricos"></svg>
    </section>

    <aside class="panel right-panel" id="settingsPanel" aria-label="Herramientas del generador">
      <section class="panel-section">
        <div class="tool-grid">
          <button class="tool-button" data-tool="select" type="button">${icon('select')} Seleccionar <span class="shortcut">1</span></button>
          <button class="tool-button" data-tool="pan" type="button">${icon('pan')} Mover <span class="shortcut">3 / Espacio</span></button>
          <button class="icon-button" data-action="undo" type="button" aria-label="Deshacer">${icon('undo')}<span class="shortcut">Ctrl+Z</span></button>
          <button class="icon-button" data-action="redo" type="button" aria-label="Rehacer">${icon('redo')}<span class="shortcut">Ctrl+Y</span></button>
        </div>
        <div class="dashed-help" style="margin-top: .65rem">Copiar: <strong>Ctrl/Cmd+C</strong> · Pegar: <strong>Ctrl/Cmd+V</strong> · Cerrar figura: doble clic o Enter</div>
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
  ui.wrap.addEventListener('pointerup', onPointerUp);
  ui.wrap.addEventListener('pointercancel', onPointerUp);
  ui.wrap.addEventListener('dblclick', finishCurrentShape);
  ui.wrap.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('resize', render);

  document.addEventListener('keydown', onKeyDown);

  document.querySelectorAll('[data-tool]').forEach((button) => {
    button.addEventListener('click', () => setTool(button.dataset.tool));
  });

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

  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => runAction(button.dataset.action));
  });

  document.querySelectorAll('[data-export]').forEach((button) => {
    button.addEventListener('click', () => exportLogo(button.dataset.export));
  });

  ui.fillColor.addEventListener('input', () => updateStyle('fill', ui.fillColor.value));
  ui.strokeColor.addEventListener('input', () => updateStyle('stroke', ui.strokeColor.value));
  ui.strokeWidth.addEventListener('input', () => updateStyle('strokeWidth', Number(ui.strokeWidth.value)));
  ui.opacity.addEventListener('input', () => updateStyle('opacity', Number(ui.opacity.value)));
  ui.gridSize.addEventListener('input', () => {
    state.gridSize = Number(ui.gridSize.value);
    persist();
    render();
  });

  ui.mobileToggle.addEventListener('click', () => {
    ui.panel.classList.toggle('is-open');
  });
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
  return {
    x: point.x * state.camera.zoom + state.camera.x,
    y: point.y * state.camera.zoom + state.camera.y,
  };
}

function screenToWorld(point) {
  return {
    x: (point.x - state.camera.x) / state.camera.zoom,
    y: (point.y - state.camera.y) / state.camera.zoom,
  };
}

function pointerPosition(event) {
  const rect = svg.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function snapPoint(point) {
  const size = state.gridSize;
  if (state.gridType === 'square') {
    return {
      x: Math.round(point.x / size) * size,
      y: Math.round(point.y / size) * size,
    };
  }

  const h = size * Math.sqrt(3) * 0.5;
  const row = Math.round(point.y / h);
  const offset = row % 2 === 0 ? 0 : size / 2;
  return {
    x: Math.round((point.x - offset) / size) * size + offset,
    y: row * h,
  };
}

function getPointerWorld(event) {
  return snapPoint(screenToWorld(pointerPosition(event)));
}

function renderGrid(rect) {
  clear(gridGroup);
  const size = state.gridSize * state.camera.zoom;
  const originX = state.camera.x;
  const originY = state.camera.y;
  const startX = originX % size;
  const startY = originY % size;
  const gridColor = 'rgba(30, 29, 27, 0.11)';
  const strongColor = 'rgba(30, 29, 27, 0.16)';

  if (state.gridType === 'square') {
    for (let x = startX - size; x < rect.width + size; x += size) {
      gridGroup.append(createSvgElement('line', { x1: x, y1: 0, x2: x, y2: rect.height, stroke: gridColor, 'stroke-width': 1 }));
    }
    for (let y = startY - size; y < rect.height + size; y += size) {
      gridGroup.append(createSvgElement('line', { x1: 0, y1: y, x2: rect.width, y2: y, stroke: gridColor, 'stroke-width': 1 }));
    }
  } else {
    const h = size * Math.sqrt(3) * 0.5;
    const startIsoY = originY % h;
    for (let y = startIsoY - h; y < rect.height + h; y += h) {
      gridGroup.append(createSvgElement('line', { x1: 0, y1: y, x2: rect.width, y2: y, stroke: gridColor, 'stroke-width': 1 }));
    }
    const diagonalGap = size;
    for (let x = -rect.height; x < rect.width + rect.height; x += diagonalGap) {
      gridGroup.append(createSvgElement('line', { x1: x + startX, y1: 0, x2: x + startX + rect.height, y2: rect.height, stroke: gridColor, 'stroke-width': 1 }));
      gridGroup.append(createSvgElement('line', { x1: x + startX, y1: rect.height, x2: x + startX + rect.height, y2: 0, stroke: gridColor, 'stroke-width': 1 }));
    }
  }

  const center = createSvgElement('circle', { cx: state.camera.x, cy: state.camera.y, r: 2.5, fill: strongColor });
  gridGroup.append(center);
}

function pointsToAttribute(points, useCamera = true) {
  return points
    .map((point) => {
      const p = useCamera ? worldToScreen(point) : point;
      return `${round(p.x)},${round(p.y)}`;
    })
    .join(' ');
}

function renderLayers() {
  clear(shapeGroup);
  state.layers.forEach((layer) => {
    if (!layer.visible) return;
    const polygon = createSvgElement('polygon', {
      points: pointsToAttribute(layer.points),
      fill: layer.fill,
      stroke: layer.stroke,
      'stroke-width': layer.strokeWidth * state.camera.zoom,
      opacity: layer.opacity,
      'data-id': layer.id,
    });
    polygon.style.cursor = 'pointer';
    polygon.addEventListener('pointerdown', (event) => {
      if (state.tool !== 'select') return;
      event.stopPropagation();
      state.selectedId = layer.id;
      persist();
      render();
    });
    shapeGroup.append(polygon);

    if (layer.id === state.selectedId) {
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
      layer.points.forEach((point) => {
        const p = worldToScreen(point);
        shapeGroup.append(createSvgElement('circle', { cx: p.x, cy: p.y, r: 4.5, fill: '#fff', stroke: '#111', 'stroke-width': 1.5 }));
      });
    }
  });
}

function renderDraft() {
  clear(draftGroup);
  if (!state.currentPoints.length) return;

  const polyline = createSvgElement('polyline', {
    points: pointsToAttribute(state.currentPoints),
    fill: 'none',
    stroke: state.brush === 'cutout' ? '#dc2626' : state.fill,
    'stroke-width': Math.max(2, state.strokeWidth || 2),
    'stroke-dasharray': state.brush === 'cutout' ? '8 5' : 'none',
  });
  draftGroup.append(polyline);

  state.currentPoints.forEach((point, index) => {
    const p = worldToScreen(point);
    draftGroup.append(createSvgElement('circle', {
      cx: p.x,
      cy: p.y,
      r: index === 0 ? 6 : 4,
      fill: index === 0 ? '#ffd12e' : '#111',
      stroke: '#fff',
      'stroke-width': 2,
    }));
  });
}

function renderControls() {
  document.querySelectorAll('[data-tool]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.tool === state.tool);
  });
  document.querySelectorAll('[data-brush]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.brush === state.brush);
  });
  document.querySelectorAll('[data-grid]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.grid === state.gridType);
  });

  ui.fillColor.value = state.fill;
  ui.strokeColor.value = state.stroke;
  ui.strokeWidth.value = state.strokeWidth;
  ui.opacity.value = state.opacity;
  ui.gridSize.value = state.gridSize;
  ui.strokeLabel.textContent = `${state.strokeWidth}px`;
  ui.opacityLabel.textContent = `${Math.round(state.opacity * 100)}%`;
  ui.gridLabel.textContent = `${state.gridSize}px`;
  ui.pointStatus.textContent = `${state.currentPoints.length} puntos activos`;
  ui.shapeStatus.textContent = `${state.layers.length} figuras`;

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
    item.innerHTML = `
      <span class="layer-swatch" style="background:${layer.fill}"></span>
      <span>${layer.name}</span>
      <span>${layer.points.length} pts</span>
    `;
    item.addEventListener('click', () => {
      state.selectedId = layer.id;
      state.fill = layer.fill;
      state.stroke = layer.stroke;
      state.strokeWidth = layer.strokeWidth;
      state.opacity = layer.opacity;
      persist();
      render();
    });
    ui.layerList.append(item);
  });
}

function onPointerDown(event) {
  ui.wrap.setPointerCapture(event.pointerId);
  isPointerDown = true;
  pointerStart = pointerPosition(event);

  if (state.tool === 'pan' || event.button === 1 || event.shiftKey) {
    panStart = { pointer: pointerStart, camera: clone(state.camera) };
    return;
  }

  if (state.tool === 'select') {
    state.selectedId = null;
    render();
    return;
  }

  if (state.tool === 'draw') {
    const point = getPointerWorld(event);
    addDraftPoint(point);
  }
}

function onPointerMove(event) {
  if (!isPointerDown || !panStart) return;
  const current = pointerPosition(event);
  state.camera.x = panStart.camera.x + current.x - panStart.pointer.x;
  state.camera.y = panStart.camera.y + current.y - panStart.pointer.y;
  render();
}

function onPointerUp(event) {
  if (ui.wrap.hasPointerCapture(event.pointerId)) {
    ui.wrap.releasePointerCapture(event.pointerId);
  }
  isPointerDown = false;
  panStart = null;
}

function onWheel(event) {
  event.preventDefault();
  const before = screenToWorld(pointerPosition(event));
  const direction = event.deltaY > 0 ? -1 : 1;
  const zoom = clamp(state.camera.zoom * (1 + direction * 0.08), 0.35, 3.2);
  state.camera.zoom = zoom;
  const after = worldToScreen(before);
  const current = pointerPosition(event);
  state.camera.x += current.x - after.x;
  state.camera.y += current.y - after.y;
  render();
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
  if (state.brush === 'cutout') {
    applyCutout(state.currentPoints);
  } else {
    const layer = {
      id: makeId(),
      name: `Figura ${state.layers.length + 1}`,
      points: clone(state.currentPoints),
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
  persist();
  render();
}

function applyCutout(points) {
  const selected = getSelectedLayer();
  if (!selected) {
    showToast('Selecciona una figura para recortar');
    return;
  }
  selected.points = selected.points.filter((point) => !isPointInPolygon(point, points));
  if (selected.points.length < 3) {
    selected.visible = false;
  }
  selected.name = `${selected.name} recortada`;
  showToast('Recorte aplicado');
}

function onKeyDown(event) {
  const cmd = event.metaKey || event.ctrlKey;
  if (cmd && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
  }
  if (cmd && event.key.toLowerCase() === 'y') {
    event.preventDefault();
    redo();
  }
  if (cmd && event.key.toLowerCase() === 'c') {
    event.preventDefault();
    copySelected();
  }
  if (cmd && event.key.toLowerCase() === 'v') {
    event.preventDefault();
    pasteLayer();
  }
  if (event.key === 'Enter') finishCurrentShape();
  if (event.key === 'Escape') {
    state.currentPoints = [];
    render();
  }
  if (event.key === '1') setTool('select');
  if (event.key === '2') setTool('draw');
  if (event.key === '3' || event.code === 'Space') {
    event.preventDefault();
    setTool('pan');
  }
  if (event.key === 'Delete' || event.key === 'Backspace') deleteSelected();
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
  layer.points = layer.points.map((point) => ({ x: point.x + 30, y: point.y + 30 }));
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

  const allPoints = visibleLayers.flatMap((layer) => layer.points);
  const bounds = getBounds(allPoints);
  const width = Math.max(1, bounds.width + EXPORT_PADDING * 2);
  const height = Math.max(1, bounds.height + EXPORT_PADDING * 2);
  const polygons = visibleLayers
    .map((layer) => {
      const points = layer.points.map((point) => ({ x: point.x - bounds.minX + EXPORT_PADDING, y: point.y - bounds.minY + EXPORT_PADDING }));
      return `<polygon points="${pointsToAttribute(points, false)}" fill="${layer.fill}" stroke="${layer.stroke}" stroke-width="${layer.strokeWidth}" opacity="${layer.opacity}"/>`;
    })
    .join('\n  ');
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
