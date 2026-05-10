import '../css/main.css';

const NS = 'http://www.w3.org/2000/svg';
const STORE = 'logo-lattice-state-v3';
const app = document.querySelector('#app');
const snap = (n) => Math.round(n * 100) / 100;
const clone = (v) => JSON.parse(JSON.stringify(v));
let id = Date.now();
let svg;
let grid;
let shapes;
let draft;
let panel;
let hover = null;
let pan = null;
let drag = null;
let copied = null;
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

let state = load();

function load() {
  try {
    const old = localStorage.getItem('logo-lattice-state-v2') || localStorage.getItem('logo-lattice-state-v1');
    const saved = JSON.parse(localStorage.getItem(STORE) || old);
    if (saved?.layers) {
      return {
        ...clone(defaultState),
        ...saved,
        draft: [],
        camera: clone(defaultState.camera),
        layers: saved.layers.map((l) => ({ holes: [], visible: true, ...l })),
      };
    }
  } catch {
    // Local state can be safely ignored.
  }
  return clone(defaultState);
}

function save() {
  const data = clone(state);
  data.draft = [];
  localStorage.setItem(STORE, JSON.stringify(data));
}

function remember() {
  history.push(clone({ ...state, draft: [] }));
  history = history.slice(-80);
  future = [];
}

function icon(name) {
  const i = {
    mark: '<path d="M5 14h5V9h5V4h4v9h-5v5H5z"/><path d="M5 10 2 7l5-5 3 3-2 2 2 2-3 3z" opacity=".75"/>',
    select: '<path d="m4 3 7 17 2-7 7-2Z" fill="none" stroke="currentColor" stroke-width="2"/>',
    pan: '<path d="M12 2v20M2 12h20M7 7l5-5 5 5M17 17l-5 5-5-5" fill="none" stroke="currentColor" stroke-width="2"/>',
    draw: '<path d="M4 20h4l10.5-10.5a2.8 2.8 0 0 0-4-4L4 16v4Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="m13.5 6.5 4 4" stroke="currentColor" stroke-width="2"/>',
    cut: '<path d="M4 19 19 4M6 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" fill="none" stroke="currentColor" stroke-width="2"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3m-8 0 1 14h8l1-14" fill="none" stroke="currentColor" stroke-width="2"/>',
    down: '<path d="M12 3v12m0 0 5-5m-5 5-5-5M4 21h16" fill="none" stroke="currentColor" stroke-width="2"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2"/>',
  };
  return `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">${i[name] || ''}</svg>`;
}

function init() {
  app.innerHTML = `
    <div class="top-left"><section class="floating-card brand-card"><span class="brand-mark">${icon('mark')}</span><div><h1 class="brand-title"><span>Logo</span> Lattice</h1><p class="brand-subtitle">Puntos de retícula, líneas guiadas y exportación SVG/PNG</p></div></section><button class="floating-card whats-new" type="button">Atajos <span>⌄</span></button></div>
    <section class="canvas-wrap" id="canvasWrap"><svg id="workspace"></svg></section>
    <aside class="panel right-panel" id="panel">
      <section class="panel-section"><div class="tool-grid"><button class="tool-button" data-tool="select">${icon('select')} Seleccionar <span class="shortcut">V / 1</span></button><button class="tool-button" data-tool="pan">${icon('pan')} Mover vista <span class="shortcut">H / 3</span></button><button class="icon-button" data-action="undo">↶ <span class="shortcut">Ctrl+Z</span></button><button class="icon-button" data-action="redo">↷ <span class="shortcut">Ctrl+Y</span></button></div><div class="dashed-help" style="margin-top:.65rem">Dibujar: <strong>P / 2</strong> · Recortar: <strong>C</strong> · Flechas: mover selección · Shift+flechas: mover vista · Alt+flechas: paso fino · G: cambiar retícula</div></section>
      <section class="panel-section"><h2>Estilo del pincel</h2><div class="segmented"><button class="mode-button" data-brush="draw">${icon('draw')} Dibujar</button><button class="mode-button" data-brush="cutout">${icon('cut')} Recortar</button></div><div class="form-row"><span class="label">Relleno y trazo</span><div class="inline-row"><input id="fill" type="color"><input id="stroke" type="color"></div></div><div class="form-row"><label>Grosor <strong id="strokeLabel"></strong></label><input id="strokeWidth" type="range" min="0" max="20" step="1"></div><div class="form-row"><label>Opacidad <strong id="opacityLabel"></strong></label><input id="opacity" type="range" min="0.1" max="1" step="0.05"></div></section>
      <section class="panel-section"><h2>Retícula</h2><div class="segmented"><button class="mode-button" data-grid="square">Cuadrada</button><button class="mode-button" data-grid="isometric">Isométrica</button></div><div class="form-row"><label>Tamaño <strong id="gridLabel"></strong></label><input id="gridSize" type="range" min="20" max="120" step="5"></div></section>
      <section class="panel-section"><h2>Capas</h2><div class="layer-list" id="layers"></div><div class="inline-row" style="margin-top:.75rem"><button class="secondary-button" data-action="front">Al frente</button><button class="secondary-button" data-action="duplicate">Duplicar</button><button class="danger-button" data-action="delete">${icon('trash')} Borrar</button></div></section>
      <section class="panel-section"><h2>Exportar</h2><div class="export-row"><button class="export-button primary" data-export="svg">${icon('down')} SVG</button><button class="export-button" data-export="png">${icon('down')} PNG</button></div><div class="status-line"><span id="points">0 puntos</span><span id="figures">0 figuras</span></div></section>
    </aside>
    <div class="bottom-left"><button class="floating-card report-button">✕ Reportar un fallo</button><div class="coffee-card"><strong>☕ Invítame a un café</strong>Logo Lattice será siempre gratis.</div></div>
    <button class="floating-card mobile-toggle" id="mobileToggle">${icon('menu')} Panel</button><div class="toast" id="toast"></div>`;

  svg = document.querySelector('#workspace');
  panel = document.querySelector('#panel');
  grid = el('g');
  shapes = el('g');
  draft = el('g');
  svg.append(grid, shapes, draft);
  bind();
  center();
  render();
}

function bind() {
  const wrap = document.querySelector('#canvasWrap');
  wrap.addEventListener('pointerdown', pointerDown);
  wrap.addEventListener('pointermove', pointerMove);
  wrap.addEventListener('pointerup', pointerUp);
  wrap.addEventListener('pointercancel', pointerUp);
  wrap.addEventListener('pointerleave', () => {
    hover = null;
    render();
  });
  wrap.addEventListener('dblclick', finish);
  wrap.addEventListener('wheel', zoom, { passive: false });
  window.addEventListener('resize', render);
  document.addEventListener('keydown', keys);
  document.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
  document.querySelectorAll('[data-brush]').forEach((b) => b.addEventListener('click', () => {
    state.brush = b.dataset.brush;
    setTool('draw');
  }));
  document.querySelectorAll('[data-grid]').forEach((b) => b.addEventListener('click', () => {
    state.grid = b.dataset.grid;
    saveRender();
  }));
  document.querySelectorAll('[data-action]').forEach((b) => b.addEventListener('click', () => action(b.dataset.action)));
  document.querySelectorAll('[data-export]').forEach((b) => b.addEventListener('click', () => exportLogo(b.dataset.export)));
  $('#fill').addEventListener('input', (e) => style('fill', e.target.value));
  $('#stroke').addEventListener('input', (e) => style('stroke', e.target.value));
  $('#strokeWidth').addEventListener('input', (e) => style('strokeWidth', Number(e.target.value)));
  $('#opacity').addEventListener('input', (e) => style('opacity', Number(e.target.value)));
  $('#gridSize').addEventListener('input', (e) => {
    state.gridSize = Number(e.target.value);
    saveRender();
  });
  $('#mobileToggle').addEventListener('click', () => panel.classList.toggle('is-open'));
}

function $(q) { return document.querySelector(q); }
function el(tag, attrs = {}) { const n = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, String(v))); return n; }
function clear(n) { while (n.firstChild) n.firstChild.remove(); }
function center() { const r = app.getBoundingClientRect(); state.camera.x = r.width / 2; state.camera.y = r.height / 2; }
function saveRender() { save(); render(); }
function setTool(tool) { state.tool = tool; if (tool !== 'draw') state.draft = []; saveRender(); }
function selected() { return state.layers.find((l) => l.id === state.selectedId); }
function toScreen(p) { return { x: p.x * state.camera.zoom + state.camera.x, y: p.y * state.camera.zoom + state.camera.y }; }
function toWorld(p) { return { x: (p.x - state.camera.x) / state.camera.zoom, y: (p.y - state.camera.y) / state.camera.zoom }; }
function pointer(e) { const r = svg.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

function snapPoint(p) {
  const s = state.gridSize;
  if (state.grid === 'square') return { x: Math.round(p.x / s) * s, y: Math.round(p.y / s) * s };
  const h = (s * Math.sqrt(3)) / 2;
  const row = Math.round(p.y / h);
  const off = row % 2 ? s / 2 : 0;
  return { x: Math.round((p.x - off) / s) * s + off, y: row * h };
}

function snappedPointer(e) { return snapPoint(toWorld(pointer(e))); }
function path(layer, camera = true) {
  return [layer.points, ...(layer.holes || [])].filter((ring) => ring.length >= 3).map((ring) => {
    const first = camera ? toScreen(ring[0]) : ring[0];
    return `M ${snap(first.x)} ${snap(first.y)} ${ring.slice(1).map((p) => { const q = camera ? toScreen(p) : p; return `L ${snap(q.x)} ${snap(q.y)}`; }).join(' ')} Z`;
  }).join(' ');
}

function attrPoints(points) { return points.map((p) => { const q = toScreen(p); return `${snap(q.x)},${snap(q.y)}`; }).join(' '); }

function visibleGridPoints(rect) {
  const a = toWorld({ x: -80, y: -80 });
  const b = toWorld({ x: rect.width + 80, y: rect.height + 80 });
  const s = state.gridSize;
  const pts = [];
  if (state.grid === 'square') {
    for (let x = Math.floor(a.x / s) * s; x <= b.x; x += s) for (let y = Math.floor(a.y / s) * s; y <= b.y; y += s) pts.push({ x, y });
    return pts;
  }
  const h = (s * Math.sqrt(3)) / 2;
  for (let row = Math.floor(a.y / h) - 1; row <= Math.ceil(b.y / h) + 1; row += 1) {
    const y = row * h;
    const off = row % 2 ? s / 2 : 0;
    for (let x = Math.floor((a.x - off) / s) * s + off; x <= b.x + s; x += s) pts.push({ x, y });
  }
  return pts;
}

function render() {
  const rect = app.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
  renderGrid(rect);
  renderShapes();
  renderDraft();
  renderPanel();
}

function renderGrid(rect) {
  clear(grid);
  const pts = visibleGridPoints(rect);
  if (state.grid === 'square') {
    [...new Set(pts.map((p) => snap(toScreen(p).x)))].forEach((x) => grid.append(el('line', { x1: x, y1: 0, x2: x, y2: rect.height, stroke: 'rgba(30,29,27,.11)' })));
    [...new Set(pts.map((p) => snap(toScreen(p).y)))].forEach((y) => grid.append(el('line', { x1: 0, y1: y, x2: rect.width, y2: y, stroke: 'rgba(30,29,27,.11)' })));
  } else {
    const size = state.gridSize * state.camera.zoom;
    const h = (size * Math.sqrt(3)) / 2;
    for (let y = state.camera.y % h - h; y < rect.height + h; y += h) grid.append(el('line', { x1: 0, y1: y, x2: rect.width, y2: y, stroke: 'rgba(30,29,27,.11)' }));
    for (let x = -rect.height; x < rect.width + rect.height; x += size) {
      grid.append(el('line', { x1: x + (state.camera.x % size), y1: 0, x2: x + (state.camera.x % size) + rect.height, y2: rect.height, stroke: 'rgba(30,29,27,.11)' }));
      grid.append(el('line', { x1: x + (state.camera.x % size), y1: rect.height, x2: x + (state.camera.x % size) + rect.height, y2: 0, stroke: 'rgba(30,29,27,.11)' }));
    }
  }
  pts.forEach((p) => { const q = toScreen(p); grid.append(el('circle', { cx: q.x, cy: q.y, r: 2.2, fill: 'rgba(30,29,27,.28)' })); });
  if (hover) { const h = toScreen(hover); grid.append(el('circle', { cx: h.x, cy: h.y, r: 7, fill: '#fff', stroke: '#111', 'stroke-width': 2 })); }
}

function renderShapes() {
  clear(shapes);
  state.layers.forEach((layer) => {
    if (!layer.visible) return;
    shapes.append(el('path', { d: path(layer), fill: layer.fill, 'fill-rule': 'evenodd', stroke: layer.stroke, 'stroke-width': layer.strokeWidth * state.camera.zoom, opacity: layer.opacity }));
    if (layer.id === state.selectedId) renderSelection(layer);
  });
}

function renderSelection(layer) {
  const b = bounds(layer.points.map(toScreen));
  shapes.append(el('rect', { x: b.minX - 8, y: b.minY - 8, width: b.width + 16, height: b.height + 16, rx: 8, fill: 'none', stroke: '#111', 'stroke-width': 1.5, 'stroke-dasharray': '5 5' }));
  layer.points.forEach((p) => { const q = toScreen(p); shapes.append(el('circle', { cx: q.x, cy: q.y, r: 5.5, fill: '#fff', stroke: '#111', 'stroke-width': 1.7 })); });
}

function renderDraft() {
  clear(draft);
  const live = [...state.draft];
  if (hover && state.tool === 'draw' && live.length) live.push(hover);
  if (live.length) draft.append(el('polyline', { points: attrPoints(live), fill: 'none', stroke: state.brush === 'cutout' ? '#dc2626' : state.fill, 'stroke-width': Math.max(2, state.strokeWidth || 2), 'stroke-dasharray': state.brush === 'cutout' ? '8 5' : 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  state.draft.forEach((p, i) => { const q = toScreen(p); draft.append(el('circle', { cx: q.x, cy: q.y, r: i ? 4 : 6, fill: i ? '#111' : '#ffd12e', stroke: '#fff', 'stroke-width': 2 })); });
  if (hover && state.tool === 'draw') { const q = toScreen(hover); draft.append(el('circle', { cx: q.x, cy: q.y, r: 4, fill: state.brush === 'cutout' ? '#dc2626' : '#111', stroke: '#fff', 'stroke-width': 2 })); }
}

function renderPanel() {
  document.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('is-active', b.dataset.tool === state.tool));
  document.querySelectorAll('[data-brush]').forEach((b) => b.classList.toggle('is-active', b.dataset.brush === state.brush));
  document.querySelectorAll('[data-grid]').forEach((b) => b.classList.toggle('is-active', b.dataset.grid === state.grid));
  $('#fill').value = state.fill; $('#stroke').value = state.stroke; $('#strokeWidth').value = state.strokeWidth; $('#opacity').value = state.opacity; $('#gridSize').value = state.gridSize;
  $('#strokeLabel').textContent = `${state.strokeWidth}px`; $('#opacityLabel').textContent = `${Math.round(state.opacity * 100)}%`; $('#gridLabel').textContent = `${state.gridSize}px`; $('#points').textContent = `${state.draft.length} puntos activos`; $('#figures').textContent = `${state.layers.filter((l) => l.visible).length} figuras`;
  const list = $('#layers'); clear(list);
  [...state.layers].reverse().forEach((l) => { const b = document.createElement('button'); b.className = `layer-item ${l.id === state.selectedId ? 'is-active' : ''}`; b.innerHTML = `<span class="layer-swatch" style="background:${l.fill}"></span><span>${l.name}</span><span>${l.points.length} pts</span>`; b.onclick = () => select(l.id); list.append(b); });
}

function pointerDown(e) {
  document.querySelector('#canvasWrap').setPointerCapture(e.pointerId);
  const p = pointer(e);
  if (state.tool === 'pan' || e.shiftKey || e.button === 1) { pan = { p, cam: clone(state.camera) }; return; }
  if (state.tool === 'select') { startDrag(p); return; }
  addPoint(snappedPointer(e));
}

function pointerMove(e) {
  hover = snappedPointer(e);
  if (pan) { const p = pointer(e); state.camera.x = pan.cam.x + p.x - pan.p.x; state.camera.y = pan.cam.y + p.y - pan.p.y; render(); return; }
  if (drag) { moveDrag(e); return; }
  render();
}

function pointerUp(e) {
  if (document.querySelector('#canvasWrap').hasPointerCapture(e.pointerId)) document.querySelector('#canvasWrap').releasePointerCapture(e.pointerId);
  if (drag?.changed) saveRender();
  pan = null; drag = null;
}

function zoom(e) {
  e.preventDefault();
  const before = toWorld(pointer(e));
  state.camera.zoom = Math.min(3.2, Math.max(0.35, state.camera.zoom * (e.deltaY > 0 ? 0.92 : 1.08)));
  const after = toScreen(before); const p = pointer(e);
  state.camera.x += p.x - after.x; state.camera.y += p.y - after.y;
  render();
}

function startDrag(screenPoint) {
  const w = toWorld(screenPoint);
  const sel = selected();
  const vi = sel ? sel.points.findIndex((p) => dist(w, p) * state.camera.zoom <= 12) : -1;
  if (sel && vi >= 0) { remember(); drag = { type: 'vertex', id: sel.id, vi, changed: false }; return; }
  const hit = hit(w);
  if (!hit) { state.selectedId = null; saveRender(); return; }
  select(hit.id); remember(); drag = { type: 'layer', id: hit.id, start: snapPoint(w), original: clone(hit.points), holes: clone(hit.holes || []), changed: false };
}

function moveDrag(e) {
  const layer = selected(); if (!layer || layer.id !== drag.id) return;
  const p = snappedPointer(e);
  if (drag.type === 'vertex') layer.points[drag.vi] = p;
  else {
    const d = { x: p.x - drag.start.x, y: p.y - drag.start.y };
    layer.points = drag.original.map((q) => snapPoint({ x: q.x + d.x, y: q.y + d.y }));
    layer.holes = drag.holes.map((hole) => hole.map((q) => snapPoint({ x: q.x + d.x, y: q.y + d.y })));
  }
  drag.changed = true; render();
}

function addPoint(p) {
  const first = state.draft[0];
  if (first && dist(first, p) < 1 && state.draft.length >= 3) { finish(); return; }
  const last = state.draft.at(-1);
  if (last && dist(last, p) < 1) return;
  state.draft.push(p); render();
}

function finish() {
  if (state.draft.length < 3) return;
  remember();
  if (state.brush === 'cutout') cut(state.draft);
  else {
    const layer = { id: `layer-${++id}`, name: `Figura ${state.layers.length + 1}`, points: clone(state.draft), holes: [], fill: state.fill, stroke: state.stroke, strokeWidth: state.strokeWidth, opacity: state.opacity, visible: true };
    state.layers.push(layer); state.selectedId = layer.id;
  }
  state.draft = []; hover = null; saveRender();
}

function cut(points) {
  const samples = sample(points, Math.max(6, state.gridSize / 4));
  for (let i = state.layers.length - 1; i >= 0; i -= 1) {
    const l = state.layers[i];
    if (samples.some((p) => inside(p, l.points) && !(l.holes || []).some((h) => inside(p, h)))) { l.holes = [...(l.holes || []), clone(points)]; state.selectedId = l.id; toast('Recorte aplicado'); return; }
  }
  toast('El recorte no pasa por ninguna figura');
}

function sample(points, step) {
  const out = [];
  points.forEach((a, i) => { const b = points[(i + 1) % points.length]; const n = Math.ceil(Math.max(step, dist(a, b)) / step); for (let j = 0; j <= n; j += 1) out.push({ x: a.x + ((b.x - a.x) * j) / n, y: a.y + ((b.y - a.y) * j) / n }); });
  return out;
}

function keys(e) {
  if (e.target instanceof HTMLInputElement) return;
  const cmd = e.ctrlKey || e.metaKey; const k = e.key.toLowerCase();
  if (cmd && k === 'z') { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
  if (cmd && k === 'y') { e.preventDefault(); return redo(); }
  if (cmd && k === 'c') { e.preventDefault(); copied = clone(selected()); return toast('Figura copiada'); }
  if (cmd && k === 'v') { e.preventDefault(); return paste(); }
  if (e.key.startsWith('Arrow')) { e.preventDefault(); return arrows(e.key, e.shiftKey, e.altKey); }
  if (k === 'enter') return finish();
  if (k === 'escape') { state.draft = []; hover = null; return render(); }
  if (k === 'v' || k === '1') return setTool('select');
  if (k === 'p' || k === '2') { state.brush = 'draw'; return setTool('draw'); }
  if (k === 'c') { state.brush = 'cutout'; return setTool('draw'); }
  if (k === 'h' || k === '3') return setTool('pan');
  if (k === 'g') { state.grid = state.grid === 'square' ? 'isometric' : 'square'; return saveRender(); }
  if (k === 'delete' || k === 'backspace') return remove();
  if (k === ']') return front();
  return undefined;
}

function arrows(key, shift, fine) {
  const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
  const step = fine ? state.gridSize / 4 : state.gridSize;
  const delta = { x: d[0] * step, y: d[1] * step };
  if (shift || !selected()) { state.camera.x -= delta.x * state.camera.zoom; state.camera.y -= delta.y * state.camera.zoom; return render(); }
  remember(); moveSelected(delta); saveRender();
}

function action(a) { if (a === 'undo') undo(); if (a === 'redo') redo(); if (a === 'delete') remove(); if (a === 'duplicate') duplicate(); if (a === 'front') front(); }
function style(k, v) { const s = selected(); if (s) { remember(); s[k] = v; } state[k] = v; saveRender(); }
function select(layerId) { const l = state.layers.find((x) => x.id === layerId); if (!l) return; state.selectedId = l.id; state.fill = l.fill; state.stroke = l.stroke; state.strokeWidth = l.strokeWidth; state.opacity = l.opacity; saveRender(); }
function moveSelected(d) { const l = selected(); if (!l) return; l.points = l.points.map((p) => snapPoint({ x: p.x + d.x, y: p.y + d.y })); l.holes = (l.holes || []).map((h) => h.map((p) => snapPoint({ x: p.x + d.x, y: p.y + d.y }))); }
function remove() { if (!selected()) return; remember(); state.layers = state.layers.filter((l) => l.id !== state.selectedId); state.selectedId = state.layers.at(-1)?.id || null; saveRender(); }
function duplicate() { copied = clone(selected()); paste(); }
function paste() { if (!copied) return; remember(); const l = clone(copied); l.id = `layer-${++id}`; l.name = `${copied.name} copia`; l.points = l.points.map((p) => snapPoint({ x: p.x + state.gridSize, y: p.y + state.gridSize })); l.holes = (l.holes || []).map((h) => h.map((p) => snapPoint({ x: p.x + state.gridSize, y: p.y + state.gridSize }))); state.layers.push(l); state.selectedId = l.id; saveRender(); }
function front() { const l = selected(); if (!l) return; remember(); state.layers = state.layers.filter((x) => x.id !== l.id); state.layers.push(l); saveRender(); }
function undo() { if (!history.length) return; future.push(clone({ ...state, draft: [] })); state = history.pop(); saveRender(); }
function redo() { if (!future.length) return; history.push(clone({ ...state, draft: [] })); state = future.pop(); saveRender(); }
function hit(p) { for (let i = state.layers.length - 1; i >= 0; i -= 1) { const l = state.layers[i]; if (l.visible && inside(p, l.points) && !(l.holes || []).some((h) => inside(p, h))) return l; } return null; }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function inside(p, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) { if (poly[i].y > p.y !== poly[j].y > p.y && p.x < ((poly[j].x - poly[i].x) * (p.y - poly[i].y)) / (poly[j].y - poly[i].y) + poly[i].x) c = !c; } return c; }
function bounds(points) { const xs = points.map((p) => p.x); const ys = points.map((p) => p.y); const minX = Math.min(...xs); const minY = Math.min(...ys); const maxX = Math.max(...xs); const maxY = Math.max(...ys); return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }; }
function shift(points, b) { return points.map((p) => ({ x: p.x - b.minX + 36, y: p.y - b.minY + 36 })); }

function exportLogo(type) {
  const layers = state.layers.filter((l) => l.visible && l.points.length >= 3);
  const all = layers.flatMap((l) => [l.points, ...(l.holes || [])].flat());
  const b = bounds(all); const w = b.width + 72; const h = b.height + 72;
  const body = layers.map((l) => { const shifted = { ...l, points: shift(l.points, b), holes: (l.holes || []).map((x) => shift(x, b)) }; return `<path d="${path(shifted, false)}" fill="${l.fill}" fill-rule="evenodd" stroke="${l.stroke}" stroke-width="${l.strokeWidth}" opacity="${l.opacity}"/>`; }).join('\n  ');
  const txt = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${snap(w)} ${snap(h)}" width="${snap(w)}" height="${snap(h)}">\n  ${body}\n</svg>`;
  if (type === 'svg') return download('logo-lattice.svg', new Blob([txt], { type: 'image/svg+xml' }));
  const img = new Image(); const url = URL.createObjectURL(new Blob([txt], { type: 'image/svg+xml' }));
  img.onload = () => { const sc = Math.max(2, Math.min(4, 1024 / Math.max(w, h))); const c = document.createElement('canvas'); c.width = Math.ceil(w * sc); c.height = Math.ceil(h * sc); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); c.toBlob((blob) => download('logo-lattice.png', blob), 'image/png'); URL.revokeObjectURL(url); };
  img.src = url;
  return undefined;
}

function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href); toast(`${name} descargado`); }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('is-visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('is-visible'), 1800); }

init();
