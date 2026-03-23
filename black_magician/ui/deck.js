// ── State ──
let deckData = [];
let selectedSize = null;
let selectedTile = null;
let tileImages = [];
let loadedImages = {};

const BASE_PX_PER_MM = 4;
const MAX_CANVAS_PX = 4096;

// mixMode: 'none' | 'grid' | 'half' | 'third'
const edit = {
  rotation: 0,
  hue: 0,
  saturation: 100,
  brightness: 100,
  groutEnabled: false,
  groutColor: '#808080',
  groutThickness: 2.0,
  mixMode: 'none',
  mixSelections: []
};

// ── DOM refs ──
const folderBody  = document.querySelector('#folder-panel .panel-body');
const galleryBody = document.querySelector('#gallery-panel .panel-body');
const previewBody = document.querySelector('#preview-panel .panel-body');

// ── 크기 문자열 파싱 ──
function parseSizeMM(sizeStr) {
  const parts = sizeStr.split(/[x×]/).map(Number);
  if (parts.length < 2) return null;
  return { w: parts[0], h: parts[1] };
}

// ── Mix 그리드 설정 ──
function getMixGrid() {
  // grid: 3×3=9장, half: 4×4=16장, third: 4×6=24장
  switch (edit.mixMode) {
    case 'grid':  return { cols: 3, rows: 3 };
    case 'half':  return { cols: 4, rows: 8 };
    case 'third': return { cols: 4, rows: 9 };
    default:      return null;
  }
}

function getMixTileCount() {
  const isStagger = (edit.mixMode === 'half' || edit.mixMode === 'third');
  if (isStagger) {
    const sg = getStaggerGrid();
    return sg ? sg.cols * sg.rows : 0;
  }
  const g = getMixGrid();
  return g ? g.cols * g.rows : 0;
}

// ── Stagger 방향 판단: 긴 변 방향으로 엇갈림 ──
// portrait(h>w) → vertical stagger, landscape(w>=h) → horizontal stagger
function isVerticalStagger() {
  const base = parseSizeMM(selectedSize.size);
  return base && base.h > base.w;
}

// ── Stagger 그리드: 세로 엇갈림이면 cols/rows 전치 ──
function getStaggerGrid() {
  const grid = getMixGrid();
  if (!grid) return null;
  if (isVerticalStagger()) {
    // 전치: cols↔rows
    return { cols: grid.rows, rows: grid.cols };
  }
  return grid;
}

// ── 최종 머티리얼 크기 (mm) ──
function calcFinalSizeMM() {
  const base = parseSizeMM(selectedSize.size);
  if (!base) return null;

  const tw = base.w, th = base.h;
  const gMM = edit.groutEnabled ? edit.groutThickness : 0;
  const isStagger = (edit.mixMode === 'half' || edit.mixMode === 'third');

  let w, h;
  if (isStagger) {
    const sg = getStaggerGrid();
    w = (tw + gMM) * sg.cols;
    h = (th + gMM) * sg.rows;
  } else {
    const grid = getMixGrid();
    if (grid) {
      w = (tw + gMM) * grid.cols;
      h = (th + gMM) * grid.rows;
    } else {
      w = tw + gMM;
      h = th + gMM;
    }
  }

  const rotated = (edit.rotation === 90 || edit.rotation === 270);
  if (rotated) { const tmp = w; w = h; h = tmp; }

  return { w: w, h: h };
}

// ── Tab Switching ──
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ── Ruby → JS callbacks ──
function onDeckData(data) { deckData = data; renderFolderTree(); }
function onTileList(tiles) { renderGallery(tiles); }
function onTileImages(urls) {
  tileImages = urls;
  loadImage(urls[0]).then(() => { drawCanvas(); });
  updateMixButtons();
}

// ── Image Loader ──
function loadImage(url) {
  return new Promise((resolve, reject) => {
    if (loadedImages[url]) { resolve(loadedImages[url]); return; }
    const img = new Image();
    img.onload = () => { loadedImages[url] = img; resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

// ── Folder Tree ──
function renderFolderTree() {
  if (!deckData.length) {
    folderBody.classList.remove('has-content');
    folderBody.innerHTML =
      '<div class="placeholder">' +
        '<div class="placeholder-icon">&#128193;</div>' +
        '<span>Library에서 마감재를<br>다운로드하세요</span>' +
      '</div>';
    return;
  }

  folderBody.classList.add('has-content');
  let html = '<div class="folder-tree">';

  deckData.forEach(cat => {
    html += '<div class="tree-node">' +
      '<div class="tree-label tree-l1" data-toggle>' +
        '<span class="tree-arrow">&#9654;</span>' + cat.category +
      '</div>' +
      '<div class="tree-children">';

    cat.vendors.forEach(vendor => {
      html += '<div class="tree-node">' +
        '<div class="tree-label tree-l2" data-toggle>' +
          '<span class="tree-arrow">&#9654;</span>' + vendor.name +
        '</div>' +
        '<div class="tree-children">';

      vendor.sizes.forEach(size => {
        html += '<div class="tree-leaf" ' +
          'data-category="' + cat.category + '" ' +
          'data-vendor="' + vendor.name + '" ' +
          'data-size="' + size.name + '">' +
          size.name +
        '</div>';
      });

      html += '</div></div>';
    });

    html += '</div></div>';
  });

  html += '</div>';
  folderBody.innerHTML = html;

  folderBody.querySelectorAll('[data-toggle]').forEach(label => {
    label.addEventListener('click', () => { label.parentElement.classList.toggle('open'); });
  });

  folderBody.querySelectorAll('.tree-leaf').forEach(el => {
    el.addEventListener('click', () => {
      folderBody.querySelectorAll('.tree-leaf').forEach(l => l.classList.remove('active'));
      el.classList.add('active');
      selectedSize = { category: el.dataset.category, vendor: el.dataset.vendor, size: el.dataset.size };
      selectedTile = null;
      tileImages = [];
      resetEdit();
      renderPreviewEmpty();
      sketchup.get_tiles(selectedSize.category, selectedSize.vendor, selectedSize.size);
    });
  });
}

// ── Gallery ──
function renderGallery(tiles) {
  if (!tiles || !tiles.length) {
    galleryBody.classList.remove('has-content');
    galleryBody.innerHTML = '<div class="placeholder"><div class="placeholder-icon">&#128444;</div><span>No tiles</span></div>';
    return;
  }

  galleryBody.classList.add('has-content');
  let html = '<div class="gallery-grid">';
  tiles.forEach(tile => {
    html += '<div class="gallery-item" data-tile="' + tile.name + '" data-count="' + tile.count + '" title="' + tile.name + '">' +
      '<img src="' + tile.thumb + '" alt="' + tile.name + '" loading="lazy">' +
      '<div class="gallery-label">' + tile.name + '</div>' +
      (tile.count > 1 ? '<div class="gallery-badge">' + tile.count + ' patterns</div>' : '') +
    '</div>';
  });
  html += '</div>';
  galleryBody.innerHTML = html;

  galleryBody.querySelectorAll('.gallery-item').forEach(item => {
    item.addEventListener('click', () => {
      galleryBody.querySelectorAll('.gallery-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      selectedTile = { name: item.dataset.tile, count: parseInt(item.dataset.count) };
      resetEdit();
      renderPreview();
      sketchup.get_tile_images(selectedSize.category, selectedSize.vendor, selectedSize.size, selectedTile.name);
    });
  });
}

// ── Reset ──
function resetEdit() {
  edit.rotation = 0;
  edit.hue = 0;
  edit.saturation = 100;
  edit.brightness = 100;
  edit.groutEnabled = false;
  edit.groutColor = '#808080';
  edit.groutThickness = 2.0;
  edit.mixMode = 'none';
  edit.mixSelections = [];
}

// ── Preview ──
function renderPreview() {
  if (!selectedTile) { renderPreviewEmpty(); return; }

  previewBody.classList.add('has-content');
  previewBody.innerHTML =
    '<div class="preview-content">' +
      '<div class="preview-canvas-wrap"><canvas id="preview-canvas"></canvas></div>' +
      '<div class="preview-info">' +
        '<span class="preview-filename">' + selectedTile.name + '</span>' +
        '<span id="preview-size"></span>' +
      '</div>' +
      // Tool row 1: Rotate, Color, Grout
      '<div class="tool-row">' +
        '<button class="tool-btn" id="btn-rotate" title="Rotate 90°">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>' +
          '<span>Rotate</span>' +
        '</button>' +
        '<button class="tool-btn" id="btn-color" title="Color">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a7 7 0 0 0 0 14 3.5 3.5 0 0 1 0 7 10 10 0 1 0 0-20z"/></svg>' +
          '<span>Color</span>' +
        '</button>' +
        '<button class="tool-btn" id="btn-grout" title="Grout">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>' +
          '<span>Grout</span>' +
        '</button>' +
      '</div>' +
      // Tool row 2: Mix modes
      '<div class="tool-row">' +
        '<button class="tool-btn mix-btn" id="btn-mix-grid" data-mix="grid" title="Mix 3×3 Grid" disabled>' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="6" height="6"/><rect x="9" y="2" width="6" height="6"/><rect x="16" y="2" width="6" height="6"/><rect x="2" y="9" width="6" height="6"/><rect x="9" y="9" width="6" height="6"/><rect x="16" y="9" width="6" height="6"/><rect x="2" y="16" width="6" height="6"/><rect x="9" y="16" width="6" height="6"/><rect x="16" y="16" width="6" height="6"/></svg>' +
          '<span>Mix</span>' +
        '</button>' +
        '<button class="tool-btn mix-btn" id="btn-mix-half" data-mix="half" title="1/2 Stagger" disabled>' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="2" width="10" height="8"/><rect x="12" y="2" width="10" height="8"/><rect x="6" y="12" width="10" height="8"/><rect x="17" y="12" width="6" height="8"/><rect x="1" y="12" width="4" height="8"/></svg>' +
          '<span>1/2</span>' +
        '</button>' +
        '<button class="tool-btn mix-btn" id="btn-mix-third" data-mix="third" title="1/3 Stagger" disabled>' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="1" width="7" height="6"/><rect x="9" y="1" width="7" height="6"/><rect x="17" y="1" width="6" height="6"/><rect x="3" y="8.5" width="7" height="6"/><rect x="11" y="8.5" width="7" height="6"/><rect x="19" y="8.5" width="4" height="6"/><rect x="1" y="8.5" width="1" height="6"/><rect x="6" y="16" width="7" height="6"/><rect x="14" y="16" width="7" height="6"/><rect x="1" y="16" width="4" height="6"/></svg>' +
          '<span>1/3</span>' +
        '</button>' +
      '</div>' +
      // Sub-panels
      '<div id="panel-color" class="sub-panel" style="display:none">' +
        '<label>Hue <input type="range" id="sl-hue" min="-180" max="180" value="0"><span id="val-hue">0</span>°</label>' +
        '<label>Saturation <input type="range" id="sl-sat" min="0" max="200" value="100"><span id="val-sat">100</span>%</label>' +
        '<label>Brightness <input type="range" id="sl-bri" min="0" max="200" value="100"><span id="val-bri">100</span>%</label>' +
      '</div>' +
      '<div id="panel-grout" class="sub-panel" style="display:none">' +
        '<label>Thickness <input type="range" id="sl-grout-mm" min="0.5" max="10" step="0.5" value="2"><span id="val-grout-mm">2.0</span>mm</label>' +
        '<label>Color <input type="color" id="pick-grout-color" value="#808080"></label>' +
      '</div>' +
      '<button class="insert-btn" id="btn-insert">Insert Material</button>' +
    '</div>';

  document.getElementById('btn-rotate').onclick = onRotate;
  document.getElementById('btn-color').onclick = () => togglePanel('panel-color', 'btn-color');
  document.getElementById('btn-grout').onclick = () => togglePanel('panel-grout', 'btn-grout');
  document.getElementById('btn-insert').onclick = onInsert;

  // Mix mode buttons
  document.querySelectorAll('.mix-btn').forEach(btn => {
    btn.addEventListener('click', () => onToggleMix(btn.dataset.mix));
  });

  bindSlider('sl-hue', 'val-hue', v => { edit.hue = v; drawCanvas(); });
  bindSlider('sl-sat', 'val-sat', v => { edit.saturation = v; drawCanvas(); });
  bindSlider('sl-bri', 'val-bri', v => { edit.brightness = v; drawCanvas(); });

  const slGrout = document.getElementById('sl-grout-mm');
  const valGrout = document.getElementById('val-grout-mm');
  slGrout.oninput = function() {
    edit.groutThickness = parseFloat(this.value);
    valGrout.textContent = parseFloat(this.value).toFixed(1);
    drawCanvas();
  };

  document.getElementById('pick-grout-color').oninput = function() {
    edit.groutColor = this.value;
    drawCanvas();
  };

  loadImage(tileImages[0] || '').then(() => { drawCanvas(); }).catch(() => {});
}

function renderPreviewEmpty() {
  previewBody.classList.remove('has-content');
  previewBody.innerHTML = '<div class="placeholder"><div class="placeholder-icon">&#128065;</div><span>Select a material</span></div>';
}

// ── Mix buttons: 패턴 2장 이상일 때만 활성화 ──
function updateMixButtons() {
  document.querySelectorAll('.mix-btn').forEach(btn => {
    if (tileImages.length > 1) {
      btn.disabled = false;
    } else {
      btn.disabled = true;
      btn.classList.remove('active');
    }
  });
  if (tileImages.length <= 1) {
    edit.mixMode = 'none';
    edit.mixSelections = [];
  }
}

// ── Tool actions ──
function onRotate() {
  edit.rotation = (edit.rotation + 90) % 360;
  drawCanvas();
}

function togglePanel(panelId, btnId) {
  const panel = document.getElementById(panelId);
  const btn = document.getElementById(btnId);
  const isOpen = panel.style.display !== 'none';

  document.querySelectorAll('.sub-panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.tool-btn:not(.mix-btn)').forEach(b => b.classList.remove('active'));

  if (!isOpen) {
    panel.style.display = 'flex';
    btn.classList.add('active');
  }

  if (panelId === 'panel-grout') {
    edit.groutEnabled = !isOpen;
    drawCanvas();
  }
}

function onToggleMix(mode) {
  // 같은 버튼 다시 누르면 OFF
  if (edit.mixMode === mode) {
    edit.mixMode = 'none';
    edit.mixSelections = [];
    document.querySelectorAll('.mix-btn').forEach(b => b.classList.remove('active'));
    drawCanvas();
    return;
  }

  edit.mixMode = mode;
  document.querySelectorAll('.mix-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-mix="' + mode + '"]').classList.add('active');

  if (tileImages.length > 1) {
    const count = getMixTileCount();
    const picks = [];
    for (let i = 0; i < count; i++) {
      picks.push(tileImages[Math.floor(Math.random() * tileImages.length)]);
    }
    Promise.all(picks.map(url => loadImage(url))).then(imgs => {
      edit.mixSelections = imgs;
      drawCanvas();
    });
  }
}

function bindSlider(sliderId, valId, onChange) {
  const sl = document.getElementById(sliderId);
  const valEl = document.getElementById(valId);
  sl.oninput = function() {
    valEl.textContent = this.value;
    onChange(parseInt(this.value));
  };
}

// ── Canvas Rendering ──
function drawCanvas() {
  const canvas = document.getElementById('preview-canvas');
  if (!canvas || !tileImages.length) return;
  const ctx = canvas.getContext('2d');

  const img = loadedImages[tileImages[0]];
  if (!img) return;

  const finalMM = calcFinalSizeMM();
  const sizeEl = document.getElementById('preview-size');
  if (sizeEl && finalMM) {
    sizeEl.textContent = Math.round(finalMM.w) + ' × ' + Math.round(finalMM.h) + ' mm';
  }

  const grid = getMixGrid();
  if (grid && edit.mixSelections.length >= getMixTileCount()) {
    if (edit.mixMode === 'grid') {
      drawMixGrid(canvas, ctx);
    } else {
      drawMixStagger(canvas, ctx);
    }
  } else {
    drawSingle(canvas, ctx);
  }
}

function drawSingle(canvas, ctx) {
  const base = parseSizeMM(selectedSize.size);
  if (!base) return;

  const tileW_mm = base.w, tileH_mm = base.h;
  const gMM = edit.groutEnabled ? edit.groutThickness : 0;
  const totalW_mm = tileW_mm + gMM, totalH_mm = tileH_mm + gMM;

  const ppm = calcPxPerMM(totalW_mm, totalH_mm);
  const totalW_px = Math.round(totalW_mm * ppm);
  const totalH_px = Math.round(totalH_mm * ppm);
  const tileW_px = Math.round(tileW_mm * ppm);
  const tileH_px = Math.round(tileH_mm * ppm);

  const rotated = (edit.rotation === 90 || edit.rotation === 270);
  canvas.width = rotated ? totalH_px : totalW_px;
  canvas.height = rotated ? totalW_px : totalH_px;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(edit.rotation * Math.PI / 180);

  if (gMM > 0) {
    ctx.fillStyle = edit.groutColor;
    ctx.fillRect(-totalW_px / 2, -totalH_px / 2, totalW_px, totalH_px);
  }

  ctx.filter = buildFilter();
  ctx.drawImage(loadedImages[tileImages[0]], -tileW_px / 2, -tileH_px / 2, tileW_px, tileH_px);
  ctx.restore();
}

function drawMixGrid(canvas, ctx) {
  const base = parseSizeMM(selectedSize.size);
  if (!base) return;

  const imgs = edit.mixSelections;
  const tileW_mm = base.w, tileH_mm = base.h;
  const gMM = edit.groutEnabled ? edit.groutThickness : 0;
  const { cols, rows } = getMixGrid();

  const cellW_mm = tileW_mm + gMM, cellH_mm = tileH_mm + gMM;
  const totalW_mm = cellW_mm * cols, totalH_mm = cellH_mm * rows;

  const ppm = calcPxPerMM(totalW_mm, totalH_mm);
  const totalW_px = Math.round(totalW_mm * ppm);
  const totalH_px = Math.round(totalH_mm * ppm);
  const tileW_px = Math.round(tileW_mm * ppm);
  const tileH_px = Math.round(tileH_mm * ppm);
  const cellW_px = Math.round(cellW_mm * ppm);
  const cellH_px = Math.round(cellH_mm * ppm);
  const gPx = Math.round(gMM * ppm);

  const rotated = (edit.rotation === 90 || edit.rotation === 270);
  canvas.width = rotated ? totalH_px : totalW_px;
  canvas.height = rotated ? totalW_px : totalH_px;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(edit.rotation * Math.PI / 180);

  if (gPx > 0) {
    ctx.fillStyle = edit.groutColor;
    ctx.fillRect(-totalW_px / 2, -totalH_px / 2, totalW_px, totalH_px);
  }

  ctx.filter = buildFilter();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const img = imgs[r * cols + c];
      const x = -totalW_px / 2 + c * cellW_px + gPx / 2;
      const y = -totalH_px / 2 + r * cellH_px + gPx / 2;
      ctx.drawImage(img, x, y, tileW_px, tileH_px);
    }
  }

  ctx.restore();
}

// ── Stagger (1/2, 1/3) — 심리스 엇갈림 패턴 ──
// 타일 원본 방향 유지. 긴 변 방향으로 엇갈림.
// landscape(w>=h): 가로 엇갈림 (행마다 우측 shift)
// portrait(h>w): 세로 엇갈림 (열마다 아래 shift)
function drawMixStagger(canvas, ctx) {
  const base = parseSizeMM(selectedSize.size);
  if (!base) return;

  const imgs = edit.mixSelections;
  const tileW_mm = base.w, tileH_mm = base.h;
  const gMM = edit.groutEnabled ? edit.groutThickness : 0;
  const vertical = isVerticalStagger();
  const sg = getStaggerGrid();
  const { cols, rows } = sg;

  const cellW_mm = tileW_mm + gMM;
  const cellH_mm = tileH_mm + gMM;
  const totalW_mm = cellW_mm * cols;
  const totalH_mm = cellH_mm * rows;

  const ppm = calcPxPerMM(totalW_mm, totalH_mm);
  const totalW_px = Math.round(totalW_mm * ppm);
  const totalH_px = Math.round(totalH_mm * ppm);
  const tileW_px = Math.round(tileW_mm * ppm);
  const tileH_px = Math.round(tileH_mm * ppm);
  const cellW_px = Math.round(cellW_mm * ppm);
  const cellH_px = Math.round(cellH_mm * ppm);
  const gPx = Math.round(gMM * ppm);

  const offsetFraction = (edit.mixMode === 'half') ? 0.5 : (1.0 / 3.0);

  const rotated = (edit.rotation === 90 || edit.rotation === 270);
  canvas.width = rotated ? totalH_px : totalW_px;
  canvas.height = rotated ? totalW_px : totalH_px;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(edit.rotation * Math.PI / 180);

  if (gPx > 0) {
    ctx.fillStyle = edit.groutColor;
    ctx.fillRect(-totalW_px / 2, -totalH_px / 2, totalW_px, totalH_px);
  }

  ctx.filter = buildFilter();

  // 클리핑
  ctx.beginPath();
  ctx.rect(-totalW_px / 2, -totalH_px / 2, totalW_px, totalH_px);
  ctx.clip();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const img = imgs[r * cols + c];

      let x, y;
      if (vertical) {
        // 세로 엇갈림: 열마다 아래로 shift
        const colShift_px = Math.round(c * offsetFraction * cellH_px);
        x = -totalW_px / 2 + c * cellW_px + gPx / 2;
        y = -totalH_px / 2 + r * cellH_px + gPx / 2 + colShift_px;
      } else {
        // 가로 엇갈림: 행마다 오른쪽으로 shift
        const rowShift_px = Math.round(r * offsetFraction * cellW_px);
        x = -totalW_px / 2 + c * cellW_px + gPx / 2 + rowShift_px;
        y = -totalH_px / 2 + r * cellH_px + gPx / 2;
      }

      // 메인 타일
      ctx.drawImage(img, x, y, tileW_px, tileH_px);

      // Wrap 처리
      if (vertical) {
        // 아래 오버플로우 → 위로 wrap
        if (y + cellH_px > totalH_px / 2) {
          if (gPx > 0) {
            ctx.filter = 'none';
            ctx.fillStyle = edit.groutColor;
            ctx.fillRect(x - gPx / 2, y - totalH_px, cellW_px, cellH_px);
            ctx.filter = buildFilter();
          }
          ctx.drawImage(img, x, y - totalH_px, tileW_px, tileH_px);
        }
      } else {
        // 오른쪽 오버플로우 → 왼쪽으로 wrap
        if (x + cellW_px > totalW_px / 2) {
          if (gPx > 0) {
            ctx.filter = 'none';
            ctx.fillStyle = edit.groutColor;
            ctx.fillRect(x - totalW_px, y - gPx / 2, cellW_px, cellH_px);
            ctx.filter = buildFilter();
          }
          ctx.drawImage(img, x - totalW_px, y, tileW_px, tileH_px);
        }
      }
    }
  }

  ctx.restore();
}

// ── 동적 해상도: 캔버스가 MAX_CANVAS_PX를 넘지 않도록 스케일 ──
function calcPxPerMM(totalW_mm, totalH_mm) {
  const maxDim = Math.max(totalW_mm, totalH_mm);
  const ideal = BASE_PX_PER_MM;
  if (maxDim * ideal > MAX_CANVAS_PX) {
    return MAX_CANVAS_PX / maxDim;
  }
  return ideal;
}

function buildFilter() {
  return 'hue-rotate(' + edit.hue + 'deg) saturate(' + edit.saturation + '%) brightness(' + (edit.brightness / 100) + ')';
}

// ── Insert ──
function onInsert() {
  const canvas = document.getElementById('preview-canvas');
  if (!canvas || !selectedTile || !selectedSize) return;

  const btn = document.getElementById('btn-insert');
  btn.disabled = true;
  btn.textContent = 'Inserting...';

  try {
    const dataUrl = canvas.toDataURL('image/png');
    const finalMM = calcFinalSizeMM();
    const finalSizeStr = Math.round(finalMM.w) + 'x' + Math.round(finalMM.h);

    sketchup.insert_material(dataUrl, selectedSize.vendor, selectedTile.name, finalSizeStr);
  } catch(e) {
    btn.disabled = false;
    btn.textContent = 'Insert Material';
    showToast('Error: ' + e.message, true);
  }
}

function onInsertResult(success, message) {
  const btn = document.getElementById('btn-insert');
  if (btn) { btn.disabled = false; btn.textContent = 'Insert Material'; }
  if (success) {
    showToast('머티리얼이 등록되었습니다. 페인트 버킷으로 적용하세요. (' + message + ')');
  } else {
    showToast('오류: ' + message, true);
  }
}

// ── Toast ──
function showToast(msg, isError) {
  const old = document.getElementById('toast');
  if (old) old.remove();
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = 'toast' + (isError ? ' toast-error' : '');
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.classList.add('show'); });
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

// ── Library iframe postMessage 수신 ──
window.addEventListener('message', function(event) {
  var msg = event.data;
  if (!msg || msg.type !== 'bm-download') return;

  var p = msg.payload;
  if (!p || !p.files || p.files.length === 0) return;

  showToast('다운로드 중: ' + p.vendor + ' / ' + p.tile + ' (' + p.files.length + '장)');

  // Ruby에 다운로드 요청 전달
  sketchup.download_library_files(
    p.category,
    p.vendor,
    p.size,
    p.tile,
    JSON.stringify(p.files)
  );
});

// Library 다운로드 완료 콜백 (Ruby → JS)
function onLibraryDownloadResult(success, message) {
  if (success) {
    showToast('다운로드 완료: ' + message);
    // deck 폴더 구조 새로고침
    sketchup.scan_deck();
  } else {
    showToast('다운로드 실패: ' + message, true);
  }
}

// ── Init ──
sketchup.scan_deck();
