import 'bootstrap-icons/font/bootstrap-icons.css';
import '../css/main.css';
import '../css/logo-creator.css';

const NS = 'http://www.w3.org/2000/svg';
const STORE = 'logo-creator-v4';
const app = document.querySelector('#app');
const clone = (value) => JSON.parse(JSON.stringify(value));
const round = (value) => Math.round(value * 100) / 100;
const bi = (name) => `<i class="bi bi-${name}" aria-hidden="true"></i>`;
let svg;
let gridLayer;
let shapeLayer;
let draftLayer;
let panel;
let hoverPoint = null;
let panDrag = null;
let moveDrag = null;
let clipboard = [];
let toastTimer = 0;
let idCounter = Date.now();
let undoStack = [];
let redoStack = [];

const defaults = {
  tool: 'draw',
  mode: 'draw',
  gridSize: 80,
  fill: '#000000',
  stroke: '#000000',
  strokeWidth: 0,
  opacity: 1,
  selectedIds: [],
  points: [],
  exportScope: 'all',
  camera: { x: 0, y: 0, zoom: 1 },
  panelCollapsed: false,
  shapes: [],
};

let state = loadState();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || localStorage.getItem('logo-creator-v3'));
    if (saved?.shapes) {
      return {
        ...clone(defaults),
        ...saved,
        points: [],
        selectedIds: saved.selectedIds || (saved.selectedId ? [saved.selectedId] : []),
        camera: clone(defaults.camera),
        shapes: saved.shapes.map((shape) => ({ holes: [], visible: true, ...shape })),
      };
    }
  } catch {
    // Ignore damaged saved data.
  }
  return clone(defaults);
}

function saveState() {
  const data = clone(state);
  data.points = [];
  localStorage.setItem(STORE, JSON.stringify(data));
}

function remember() {
  undoStack.push(clone({ ...state, points: [] }));
  undoStack = undoStack.slice(-100);
  redoStack = [];
}

function restore(snapshot) {
  state = clone(snapshot);
  state.points = [];
  hoverPoint = null;
  saveState();
  render();
}

function init() {
  app.innerHTML = `
    <div class="top-left">
      <section class="floating-card brand-card">
        <span class="brand-mark">${bi('bounding-box-circles')}</span>
        <div>
          <h1 class="brand-title"><span>Logo Creator</span></h1>
          <p class="brand-meta">by AlonSofware</p>
          <p class="brand-subtitle">Une intersecciones para cerrar figuras</p>
        </div>
      </section>
    </div>
    <section class="canvas-wrap" id="canvasWrap"><svg id="workspace"></svg></section>
    <aside class="panel right-panel" id="panel">
      <div class="toolbar-header">
        <div class="toolbar-title"><strong>Herramientas</strong><span>Dibujo, selección múltiple y proyecto JSON</span></div>
        <button class="icon-button toolbar-collapse" id="togglePanel" type="button">${bi('layout-sidebar-inset-reverse')}</button>
      </div>
      <div class="toolbar-body">
        <section class="panel-section"><h2>Modo</h2>
          <div class="icon-only-grid">
            <button class="tool-button" data-tool="select" type="button" title="Seleccionar · V">${bi('cursor')}<span class="shortcut">V</span></button>
            <button class="tool-button" data-tool="draw" data-mode="draw" type="button" title="Dibujar · P">${bi('pencil')}<span class="shortcut">P</span></button>
            <button class="tool-button" data-tool="draw" data-mode="cutout" type="button" title="Recortar · C">${bi('scissors')}<span class="shortcut">C</span></button>
            <button class="tool-button" data-tool="pan" type="button" title="Mover vista · H">${bi('arrows-move')}<span class="shortcut">H</span></button>
          </div>
          <div class="tool-grid" style="margin-top:.6rem">
            <button class="icon-button" data-action="undo" type="button">${bi('arrow-counterclockwise')}<span class="shortcut">Ctrl+Z</span></button>
            <button class="icon-button" data-action="redo" type="button">${bi('arrow-clockwise')}<span class="shortcut">Ctrl+Y</span></button>
          </div>
        </section>
        <section class="panel-section"><h2>Estilo</h2>
          <div class="form-row"><span class="label">Relleno y trazo</span><div class="inline-row"><input id="fill" type="color"><input id="stroke" type="color"></div></div>
          <div class="form-row"><label>Grosor <strong id="strokeLabel"></strong></label><input id="strokeWidth" type="range" min="0" max="20" step="1"></div>
          <div class="form-row"><label>Opacidad <strong id="opacityLabel"></strong></label><input id="opacity" type="range" min="0.1" max="1" step="0.05"></div>
        </section>
        <section class="panel-section"><h2>Retícula</h2>
          <div class="form-row"><label>Tamaño <strong id="gridLabel"></strong></label><input id="gridSize" type="range" min="40" max="140" step="10"></div>
          <p class="empty-state">Puntos válidos: esquinas y centros donde se cruzan las diagonales.</p>
        </section>
        <section class="panel-section"><h2>Selección</h2>
          <p class="empty-state">Click selecciona. Shift+click añade o quita. Click vacío limpia selección. Arrastra para mover.</p>
          <div class="layer-list" id="shapeList"></div>
          <div class="inline-row" style="margin-top:.75rem"><button class="secondary-button" data-action="duplicate" type="button">${bi('copy')} Duplicar</button><button class="danger-button" data-action="delete" type="button">${bi('trash')} Borrar</button></div>
        </section>
        <section class="panel-section"><h2>Guardar / cargar</h2>
          <div class="form-row"><label for="exportScope">Ámbito de descarga</label><select id="exportScope"><option value="all">Todo el logo</option><option value="selection">Solo selección</option></select></div>
          <div class="export-row" style="margin-top:.75rem"><button class="export-button primary" data-export="svg" type="button">${bi('filetype-svg')} SVG</button><button class="export-button" data-export="png" type="button">${bi('filetype-png')} PNG</button></div>
          <div class="export-row" style="margin-top:.55rem"><button class="export-button" data-action="json" type="button">${bi('filetype-json')} JSON</button><button class="export-button" id="loadJsonButton" type="button">${bi('folder2-open')} Cargar</button></div>
          <input id="jsonInput" type="file" accept="application/json,.json" hidden>
          <div class="status-line"><span id="pointStatus"></span><span id="shapeStatus"></span></div>
        </section>
        <section class="panel-section"><h2>Atajos</h2><div class="dashed-help help-grid"><span><strong>Ctrl+Z</strong> quita el último punto</span><span><strong>Enter</strong> cerrar figura</span><span><strong>Esc</strong> cancelar puntos</span><span><strong>Flechas</strong> mover selección</span></div></section>
      </div>
    </aside>
    <button class="floating-card mobile-toggle" id="mobileToggle" type="button">${bi('sliders')} Panel</button>
    <div class="toast" id="toast"></div>`;

  svg = document.querySelector('#workspace');
  panel = document.querySelector('#panel');
  gridLayer = svgNode('g');
  shapeLayer = svgNode('g');
  draftLayer = svgNode('g');
  svg.append(gridLayer, shapeLayer, draftLayer);
  bindEvents();
  centerCamera();
  render();
}

function bindEvents() {
  const canvas = document.querySelector('#canvasWrap');
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', () => { hoverPoint = null; render(); });
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('dblclick', closePolygon);
  window.addEventListener('resize', render);
  document.addEventListener('keydown', onKeyDown);
  document.querySelectorAll('[data-tool]').forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.mode) state.mode = button.dataset.mode;
    setTool(button.dataset.tool);
  }));
  document.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => runAction(button.dataset.action)));
  document.querySelectorAll('[data-export]').forEach((button) => button.addEventListener('click', () => exportGraphic(button.dataset.export)));
  document.querySelector('#togglePanel').addEventListener('click', () => { state.panelCollapsed = !state.panelCollapsed; saveAndRender(); });
  document.querySelector('#mobileToggle').addEventListener('click', () => panel.classList.toggle('is-open'));
  document.querySelector('#loadJsonButton').addEventListener('click', () => document.querySelector('#jsonInput').click());
  document.querySelector('#jsonInput').addEventListener('change', loadJsonProject);
  document.querySelector('#exportScope').addEventListener('change', (event) => { state.exportScope = event.target.value; saveAndRender(); });
  document.querySelector('#fill').addEventListener('input', (event) => changeStyle('fill', event.target.value));
  document.querySelector('#stroke').addEventListener('input', (event) => changeStyle('stroke', event.target.value));
  document.querySelector('#strokeWidth').addEventListener('input', (event) => changeStyle('strokeWidth', Number(event.target.value)));
  document.querySelector('#opacity').addEventListener('input', (event) => changeStyle('opacity', Number(event.target.value)));
  document.querySelector('#gridSize').addEventListener('input', (event) => { state.gridSize = Number(event.target.value); saveAndRender(); });
}

function svgNode(tag, attrs = {}) {
  const node = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}
function clear(node) { while (node.firstChild) node.firstChild.remove(); }
function saveAndRender() { saveState(); render(); }
function centerCamera() { const rect = app.getBoundingClientRect(); state.camera.x = rect.width / 2; state.camera.y = rect.height / 2; }
function worldToScreen(point) { return { x: point.x * state.camera.zoom + state.camera.x, y: point.y * state.camera.zoom + state.camera.y }; }
function screenToWorld(point) { return { x: (point.x - state.camera.x) / state.camera.zoom, y: (point.y - state.camera.y) / state.camera.zoom }; }
function pointerPosition(event) { const rect = svg.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
function setTool(tool) { state.tool = tool; if (tool !== 'draw') state.points = []; saveAndRender(); }

function getIntersections(rect) {
  const topLeft = screenToWorld({ x: -120, y: -120 });
  const bottomRight = screenToWorld({ x: rect.width + 120, y: rect.height + 120 });
  const size = state.gridSize;
  const points = [];
  for (let x = Math.floor(topLeft.x / size) * size; x <= bottomRight.x + size; x += size) {
    for (let y = Math.floor(topLeft.y / size) * size; y <= bottomRight.y + size; y += size) {
      points.push({ x, y });
      points.push({ x: x + size / 2, y: y + size / 2 });
    }
  }
  return points;
}

function snapToIntersection(worldPoint) {
  const size = state.gridSize;
  const baseX = Math.round(worldPoint.x / size) * size;
  const baseY = Math.round(worldPoint.y / size) * size;
  const candidates = [];
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      const x = baseX + dx * size;
      const y = baseY + dy * size;
      candidates.push({ x, y }, { x: x + size / 2, y: y + size / 2 });
    }
  }
  return candidates.reduce((best, point) => (distance(worldPoint, point) < distance(worldPoint, best) ? point : best));
}
function snapPointer(event) { return snapToIntersection(screenToWorld(pointerPosition(event))); }

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
  clear(gridLayer);
  const size = state.gridSize;
  const points = getIntersections(rect);
  const corners = points.filter((point) => isMultiple(point.x, size) && isMultiple(point.y, size));
  [...new Set(corners.map((point) => round(worldToScreen(point).x)))].forEach((x) => gridLayer.append(svgNode('line', { x1: x, y1: 0, x2: x, y2: rect.height, stroke: 'rgba(30,29,27,.12)' })));
  [...new Set(corners.map((point) => round(worldToScreen(point).y)))].forEach((y) => gridLayer.append(svgNode('line', { x1: 0, y1: y, x2: rect.width, y2: y, stroke: 'rgba(30,29,27,.12)' })));
  corners.forEach((point) => {
    const a = worldToScreen(point);
    const b = worldToScreen({ x: point.x + size, y: point.y + size });
    const c = worldToScreen({ x: point.x + size, y: point.y });
    const d = worldToScreen({ x: point.x, y: point.y + size });
    gridLayer.append(svgNode('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: 'rgba(30,29,27,.12)' }));
    gridLayer.append(svgNode('line', { x1: c.x, y1: c.y, x2: d.x, y2: d.y, stroke: 'rgba(30,29,27,.12)' }));
  });
  points.forEach((point) => { const screen = worldToScreen(point); gridLayer.append(svgNode('circle', { cx: screen.x, cy: screen.y, r: 2.25, fill: 'rgba(30,29,27,.32)' })); });
  if (hoverPoint) { const screen = worldToScreen(hoverPoint); gridLayer.append(svgNode('circle', { cx: screen.x, cy: screen.y, r: 7, fill: '#fff', stroke: '#111', 'stroke-width': 2 })); }
}

function renderShapes() {
  clear(shapeLayer);
  state.shapes.forEach((shape) => {
    if (!shape.visible) return;
    shapeLayer.append(svgNode('path', { d: shapePath(shape), fill: shape.fill, 'fill-rule': 'evenodd', stroke: shape.stroke, 'stroke-width': shape.strokeWidth * state.camera.zoom, opacity: shape.opacity }));
    if (state.selectedIds.includes(shape.id)) renderSelection(shape);
  });
}
function shapePath(shape, useCamera = true) {
  return [shape.points, ...(shape.holes || [])].filter((ring) => ring.length >= 3).map((ring) => {
    const first = useCamera ? worldToScreen(ring[0]) : ring[0];
    const rest = ring.slice(1).map((point) => { const current = useCamera ? worldToScreen(point) : point; return `L ${round(current.x)} ${round(current.y)}`; }).join(' ');
    return `M ${round(first.x)} ${round(first.y)} ${rest} Z`;
  }).join(' ');
}
function renderSelection(shape) {
  const box = bounds(shape.points.map(worldToScreen));
  shapeLayer.append(svgNode('rect', { x: box.minX - 8, y: box.minY - 8, width: box.width + 16, height: box.height + 16, rx: 8, fill: 'none', stroke: '#111', 'stroke-width': 1.5, 'stroke-dasharray': '5 5' }));
  if (state.selectedIds.length === 1) shape.points.forEach((point) => { const screen = worldToScreen(point); shapeLayer.append(svgNode('circle', { cx: screen.x, cy: screen.y, r: 5.5, fill: '#fff', stroke: '#111', 'stroke-width': 1.7 })); });
}
function renderDraft() {
  clear(draftLayer);
  const live = [...state.points];
  if (hoverPoint && state.tool === 'draw' && live.length) live.push(hoverPoint);
  if (live.length) draftLayer.append(svgNode('polyline', { points: pointList(live), fill: 'none', stroke: state.mode === 'cutout' ? '#dc2626' : state.fill, 'stroke-width': Math.max(2, state.strokeWidth || 2), 'stroke-dasharray': state.mode === 'cutout' ? '8 5' : 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  state.points.forEach((point, index) => { const screen = worldToScreen(point); draftLayer.append(svgNode('circle', { cx: screen.x, cy: screen.y, r: index ? 4 : 6, fill: index ? '#111' : '#ffd12e', stroke: '#fff', 'stroke-width': 2 })); });
}
function pointList(points) { return points.map((point) => { const screen = worldToScreen(point); return `${round(screen.x)},${round(screen.y)}`; }).join(' '); }

function renderPanel() {
  document.querySelectorAll('[data-tool]').forEach((button) => button.classList.toggle('is-active', button.dataset.tool === state.tool && (!button.dataset.mode || button.dataset.mode === state.mode)));
  document.querySelector('#fill').value = state.fill;
  document.querySelector('#stroke').value = state.stroke;
  document.querySelector('#strokeWidth').value = state.strokeWidth;
  document.querySelector('#opacity').value = state.opacity;
  document.querySelector('#gridSize').value = state.gridSize;
  document.querySelector('#exportScope').value = state.exportScope;
  document.querySelector('#strokeLabel').textContent = `${state.strokeWidth}px`;
  document.querySelector('#opacityLabel').textContent = `${Math.round(state.opacity * 100)}%`;
  document.querySelector('#gridLabel').textContent = `${state.gridSize}px`;
  document.querySelector('#pointStatus').textContent = `${state.points.length} puntos`;
  document.querySelector('#shapeStatus').textContent = `${state.selectedIds.length} sel. / ${state.shapes.length} figuras`;
  const list = document.querySelector('#shapeList');
  clear(list);
  state.shapes.slice().reverse().forEach((shape) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `layer-item ${state.selectedIds.includes(shape.id) ? 'is-active' : ''}`;
    item.innerHTML = `<span class="layer-swatch" style="background:${shape.fill}"></span><span>${shape.name}</span><span>${shape.points.length} pts</span>`;
    item.addEventListener('click', (event) => selectShape(shape.id, event.shiftKey || event.metaKey || event.ctrlKey));
    list.append(item);
  });
}

function onPointerDown(event) {
  document.querySelector('#canvasWrap').setPointerCapture(event.pointerId);
  const screenPoint = pointerPosition(event);
  if (state.tool === 'pan' || event.button === 1) { panDrag = { screenPoint, camera: clone(state.camera) }; return; }
  if (state.tool === 'select') { startMove(screenPoint, event.shiftKey || event.metaKey || event.ctrlKey); return; }
  addPoint(snapPointer(event));
}
function onPointerMove(event) {
  hoverPoint = snapPointer(event);
  if (panDrag) { const screenPoint = pointerPosition(event); state.camera.x = panDrag.camera.x + screenPoint.x - panDrag.screenPoint.x; state.camera.y = panDrag.camera.y + screenPoint.y - panDrag.screenPoint.y; render(); return; }
  if (moveDrag) { moveSelectedByPointer(event); return; }
  render();
}
function onPointerUp(event) { const canvas = document.querySelector('#canvasWrap'); if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); if (moveDrag?.changed) saveAndRender(); panDrag = null; moveDrag = null; }
function onWheel(event) { event.preventDefault(); const before = screenToWorld(pointerPosition(event)); state.camera.zoom = Math.min(3.2, Math.max(0.35, state.camera.zoom * (event.deltaY > 0 ? 0.92 : 1.08))); const after = worldToScreen(before); const pointer = pointerPosition(event); state.camera.x += pointer.x - after.x; state.camera.y += pointer.y - after.y; render(); }

function addPoint(point) { const first = state.points[0]; if (first && samePoint(first, point) && state.points.length >= 3) { closePolygon(); return; } const last = state.points.at(-1); if (last && samePoint(last, point)) return; state.points.push(point); render(); }
function closePolygon() { if (state.points.length < 3) return; remember(); if (state.mode === 'cutout') cutOnly(state.points); else { const shape = { id: `shape-${++idCounter}`, name: `Figura ${state.shapes.length + 1}`, points: clone(state.points), holes: [], fill: state.fill, stroke: state.stroke, strokeWidth: state.strokeWidth, opacity: state.opacity, visible: true }; state.shapes.push(shape); state.selectedIds = [shape.id]; } state.points = []; hoverPoint = null; saveAndRender(); }
function cutOnly(points) { const samples = sampleClosedPath(points, Math.max(6, state.gridSize / 4)); for (let index = state.shapes.length - 1; index >= 0; index -= 1) { const shape = state.shapes[index]; const intersects = samples.some((point) => isInsidePolygon(point, shape.points) && !(shape.holes || []).some((hole) => isInsidePolygon(point, hole))); if (intersects) { shape.holes = [...(shape.holes || []), clone(points)]; state.selectedIds = [shape.id]; showToast('Recorte aplicado'); return; } } showToast('El recorte no toca ninguna figura'); }

function startMove(screenPoint, additive) {
  const worldPoint = screenToWorld(screenPoint);
  const single = state.selectedIds.length === 1 ? selectedShapes()[0] : null;
  const vertexIndex = single ? single.points.findIndex((point) => distance(worldPoint, point) * state.camera.zoom <= 12) : -1;
  if (single && vertexIndex >= 0) { remember(); moveDrag = { type: 'vertex', id: single.id, vertexIndex, changed: false }; return; }
  const hit = hitTest(worldPoint);
  if (!hit) { if (!additive) state.selectedIds = []; saveAndRender(); return; }
  selectShape(hit.id, additive);
  remember();
  moveDrag = { type: 'shapes', start: snapToIntersection(worldPoint), originals: selectedShapes().map((shape) => ({ id: shape.id, points: clone(shape.points), holes: clone(shape.holes || []) })), changed: false };
}
function moveSelectedByPointer(event) {
  const point = snapPointer(event);
  if (moveDrag.type === 'vertex') { const shape = state.shapes.find((item) => item.id === moveDrag.id); if (!shape) return; shape.points[moveDrag.vertexIndex] = point; }
  else { const delta = { x: point.x - moveDrag.start.x, y: point.y - moveDrag.start.y }; moveDrag.originals.forEach((original) => { const shape = state.shapes.find((item) => item.id === original.id); if (!shape) return; shape.points = original.points.map((source) => snapToIntersection({ x: source.x + delta.x, y: source.y + delta.y })); shape.holes = original.holes.map((hole) => hole.map((source) => snapToIntersection({ x: source.x + delta.x, y: source.y + delta.y }))); }); }
  moveDrag.changed = true;
  render();
}

function onKeyDown(event) {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
  const command = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  if (command && key === 'z') { event.preventDefault(); undo(); return; }
  if (command && key === 'y') { event.preventDefault(); redo(); return; }
  if (command && key === 'c') { event.preventDefault(); copySelection(); return; }
  if (command && key === 'v') { event.preventDefault(); pasteSelection(); return; }
  if (event.key.startsWith('Arrow')) { event.preventDefault(); moveByKey(event.key, event.shiftKey, event.altKey); return; }
  if (key === 'enter') closePolygon();
  else if (key === 'escape') { state.points = []; hoverPoint = null; render(); }
  else if (key === 'v' || key === '1') setTool('select');
  else if (key === 'p' || key === '2') { state.mode = 'draw'; setTool('draw'); }
  else if (key === 'c') { state.mode = 'cutout'; setTool('draw'); }
  else if (key === 'h' || key === '3') setTool('pan');
  else if (key === 'delete' || key === 'backspace') deleteSelected();
}
function moveByKey(key, shift, fine) { const dir = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } }[key]; const step = fine ? state.gridSize / 2 : state.gridSize; const delta = { x: dir.x * step, y: dir.y * step }; if (shift || !state.selectedIds.length) { state.camera.x -= delta.x * state.camera.zoom; state.camera.y -= delta.y * state.camera.zoom; render(); return; } remember(); selectedShapes().forEach((shape) => moveShape(shape, delta)); saveAndRender(); }

function runAction(action) { if (action === 'undo') undo(); if (action === 'redo') redo(); if (action === 'delete') deleteSelected(); if (action === 'duplicate') duplicateSelection(); if (action === 'json') exportJson(); }
function selectedShapes() { return state.shapes.filter((shape) => state.selectedIds.includes(shape.id)); }
function selectShape(id, additive = false) { if (additive) state.selectedIds = state.selectedIds.includes(id) ? state.selectedIds.filter((item) => item !== id) : [...state.selectedIds, id]; else state.selectedIds = [id]; const first = selectedShapes()[0]; if (first) { state.fill = first.fill; state.stroke = first.stroke; state.strokeWidth = first.strokeWidth; state.opacity = first.opacity; } saveAndRender(); }
function changeStyle(key, value) { const shapes = selectedShapes(); if (shapes.length) { remember(); shapes.forEach((shape) => { shape[key] = value; }); } state[key] = value; saveAndRender(); }
function moveShape(shape, delta) { shape.points = shape.points.map((point) => snapToIntersection({ x: point.x + delta.x, y: point.y + delta.y })); shape.holes = (shape.holes || []).map((hole) => hole.map((point) => snapToIntersection({ x: point.x + delta.x, y: point.y + delta.y }))); }
function deleteSelected() { if (!state.selectedIds.length) return; remember(); state.shapes = state.shapes.filter((shape) => !state.selectedIds.includes(shape.id)); state.selectedIds = []; saveAndRender(); }
function duplicateSelection() { clipboard = clone(selectedShapes()); pasteSelection(); }
function copySelection() { clipboard = clone(selectedShapes()); if (clipboard.length) showToast(`${clipboard.length} figura(s) copiadas`); }
function pasteSelection() { if (!clipboard.length) return; remember(); const created = clipboard.map((source) => { const shape = clone(source); shape.id = `shape-${++idCounter}`; shape.name = `${source.name} copia`; moveShape(shape, { x: state.gridSize, y: state.gridSize }); return shape; }); state.shapes.push(...created); state.selectedIds = created.map((shape) => shape.id); saveAndRender(); }
function undo() { if (state.points.length) { state.points.pop(); render(); return; } if (!undoStack.length) return; redoStack.push(clone({ ...state, points: [] })); restore(undoStack.pop()); }
function redo() { if (!redoStack.length) return; undoStack.push(clone({ ...state, points: [] })); restore(redoStack.pop()); }

function scopedShapes() { const selected = selectedShapes(); return state.exportScope === 'selection' ? selected : state.shapes; }
function makeProject(shapes) { return { app: 'Logo Creator by AlonSofware', version: 1, gridSize: state.gridSize, shapes: clone(shapes), selectedIds: state.exportScope === 'selection' ? shapes.map((shape) => shape.id) : clone(state.selectedIds) }; }
function exportJson() { const shapes = scopedShapes(); if (!shapes.length) { showToast('No hay figuras para descargar'); return; } download('logo-creator-project.json', new Blob([JSON.stringify(makeProject(shapes), null, 2)], { type: 'application/json' })); }
function loadJsonProject(event) { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const data = JSON.parse(reader.result); if (!Array.isArray(data.shapes)) throw new Error('Formato inválido'); remember(); state.gridSize = Number(data.gridSize || state.gridSize); state.shapes = data.shapes.map((shape) => ({ id: shape.id || `shape-${++idCounter}`, name: shape.name || `Figura ${idCounter}`, points: shape.points || [], holes: shape.holes || [], fill: shape.fill || '#000000', stroke: shape.stroke || '#000000', strokeWidth: Number(shape.strokeWidth || 0), opacity: Number(shape.opacity || 1), visible: shape.visible !== false })); state.selectedIds = data.selectedIds || []; saveAndRender(); showToast('Proyecto cargado'); } catch { showToast('No se pudo cargar el JSON'); } finally { event.target.value = ''; } }; reader.readAsText(file); }

function exportGraphic(type) { const shapes = scopedShapes().filter((shape) => shape.visible && shape.points.length >= 3); if (!shapes.length) { showToast('No hay figuras para exportar'); return; } const allPoints = shapes.flatMap((shape) => [shape.points, ...(shape.holes || [])].flat()); const box = bounds(allPoints); const width = box.width + 72; const height = box.height + 72; const body = shapes.map((shape) => { const moved = { ...shape, points: shiftPoints(shape.points, box), holes: (shape.holes || []).map((hole) => shiftPoints(hole, box)) }; return `<path d="${shapePath(moved, false)}" fill="${shape.fill}" fill-rule="evenodd" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}" opacity="${shape.opacity}"/>`; }).join('\n  '); const text = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(width)} ${round(height)}" width="${round(width)}" height="${round(height)}">\n  ${body}\n</svg>`; if (type === 'svg') { download('logo-creator.svg', new Blob([text], { type: 'image/svg+xml' })); return; } const image = new Image(); const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' })); image.onload = () => { const scale = Math.max(2, Math.min(4, 1024 / Math.max(width, height))); const canvas = document.createElement('canvas'); canvas.width = Math.ceil(width * scale); canvas.height = Math.ceil(height * scale); canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); canvas.toBlob((blob) => { if (blob) download('logo-creator.png', blob); URL.revokeObjectURL(url); }, 'image/png'); }; image.src = url; }
function download(filename, blob) { const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); URL.revokeObjectURL(link.href); showToast(`${filename} descargado`); }

function hitTest(point) { for (let i = state.shapes.length - 1; i >= 0; i -= 1) { const shape = state.shapes[i]; if (isInsidePolygon(point, shape.points) && !(shape.holes || []).some((hole) => isInsidePolygon(point, hole))) return shape; } return null; }
function sampleClosedPath(points, step) { const samples = []; points.forEach((from, index) => { const to = points[(index + 1) % points.length]; const count = Math.ceil(Math.max(step, distance(from, to)) / step); for (let i = 0; i <= count; i += 1) samples.push({ x: from.x + ((to.x - from.x) * i) / count, y: from.y + ((to.y - from.y) * i) / count }); }); return samples; }
function isInsidePolygon(point, polygon) { let inside = false; for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) { const crosses = polygon[i].y > point.y !== polygon[j].y > point.y && point.x < ((polygon[j].x - polygon[i].x) * (point.y - polygon[i].y)) / (polygon[j].y - polygon[i].y) + polygon[i].x; if (crosses) inside = !inside; } return inside; }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function samePoint(a, b) { return distance(a, b) < 0.001; }
function isMultiple(value, size) { return Math.abs(value / size - Math.round(value / size)) < 0.001; }
function bounds(points) { const xs = points.map((point) => point.x); const ys = points.map((point) => point.y); const minX = Math.min(...xs); const minY = Math.min(...ys); const maxX = Math.max(...xs); const maxY = Math.max(...ys); return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }; }
function shiftPoints(points, box) { return points.map((point) => ({ x: point.x - box.minX + 36, y: point.y - box.minY + 36 })); }
function showToast(message) { const toast = document.querySelector('#toast'); toast.textContent = message; toast.classList.add('is-visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 1800); }

init();
