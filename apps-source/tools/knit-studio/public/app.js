/* knit-studio UI wiring. Core logic lives in core.js (window.KS). */
'use strict';

var $ = function (id) { return document.getElementById(id); };

var S = {
  tab: 'lib', pat: null, id: null, viewPat: null,
  zoom: 12, ox: 40, oy: 40,
  tool: 'brush', code: 'k',
  hist: [], hi: -1, dirty: false,
  drag: null, libList: [], convImg: null, convName: '', rzAspect: null
};

var cv = $('cv'), ctx = cv.getContext('2d');
function dpr() { return window.devicePixelRatio || 1; }
function activePat() { return S.tab === 'view' ? (S.viewPat || S.pat) : S.pat; }

/* ---------- status line ---------- */
function status(msg, isErr) {
  var el = $('status');
  el.textContent = msg;
  el.classList.toggle('err', !!isErr);
  if (status._t) clearTimeout(status._t);
  if (msg) status._t = setTimeout(function () { el.textContent = ''; }, 7000);
}
window.addEventListener('error', function (e) { status('JS error: ' + e.message, true); });

/* ---------- api ---------- */
function api(method, url, body) {
  return fetch(url, {
    method: method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }
  }).then(function (res) {
    return res.json().catch(function () { return null; }).then(function (j) {
      if (!res.ok) throw new Error((j && j.error) || res.status + ' ' + res.statusText);
      return j;
    });
  });
}

/* ---------- tabs ---------- */
function setTab(t) {
  S.tab = t;
  document.querySelectorAll('#tabs .tab').forEach(function (b) {
    b.classList.toggle('active', b.dataset.tab === t);
  });
  $('lib').classList.toggle('hidden', t !== 'lib');
  $('conv').classList.toggle('hidden', t !== 'conv');
  $('stage').classList.toggle('hidden', t !== 'edit' && t !== 'view');
  $('toolbar').classList.toggle('hidden', t !== 'edit');
  $('side').classList.toggle('hidden', t !== 'edit' && t !== 'view');
  if (t === 'lib') loadLib();
  if (t === 'view' && !S.viewPat) status('Viewer: pick a pattern in the library and press View.');
  syncForm();
  if (activePat()) { S.zoom = -1; fit(); } // force refit on tab switch
  draw();
}

/* ---------- canvas ---------- */
function sizeCanvas() {
  var w = cv.clientWidth || 1, h = cv.clientHeight || 1;
  var W = Math.max(1, Math.round(w * dpr())), H = Math.max(1, Math.round(h * dpr()));
  if (cv.width !== W) cv.width = W;
  if (cv.height !== H) cv.height = H;
  return { w: w, h: h };
}

function draw() {
  var wh = sizeCanvas(), p = activePat();
  ctx.setTransform(dpr(), 0, 0, dpr(), 0, 0);
  ctx.fillStyle = '#262626';
  ctx.fillRect(0, 0, wh.w, wh.h);
  if (!p) return;
  KS.renderChart(ctx, p, {
    zoom: S.zoom, ox: S.ox, oy: S.oy,
    showGrid: $('tGrid').checked, showNumbers: $('tNums').checked,
    w: wh.w, h: wh.h
  });
  if (S.drag && S.drag.cells && S.drag.cells.length) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    S.drag.cells.forEach(function (c) {
      KS.drawCell(ctx, S.code,
        Math.round(S.ox + c[1] * S.zoom), Math.round(S.oy + c[0] * S.zoom), Math.ceil(S.zoom));
    });
    ctx.restore();
  }
  $('zLbl').textContent = '\u00d7' + (S.zoom >= 10 ? Math.round(S.zoom) : S.zoom.toFixed(1));
  $('btnUndo').disabled = S.hi <= 0;
  $('btnRedo').disabled = S.hi >= S.hist.length - 1;
}

function fit() {
  var p = activePat();
  if (!p) return;
  var v = KS.fitView(p, cv.clientWidth, cv.clientHeight, 50);
  S.zoom = v.zoom; S.ox = v.ox; S.oy = v.oy;
}
function zoomAt(mx, my, f) {
  var nz = Math.min(64, Math.max(2, S.zoom * f)), k = nz / S.zoom;
  S.ox = mx - (mx - S.ox) * k;
  S.oy = my - (my - S.oy) * k;
  S.zoom = nz;
  draw();
}
function zoomBy(f) { zoomAt(cv.clientWidth / 2, cv.clientHeight / 2, f); }

/* ---------- history ---------- */
function resetHist() { S.hist = [S.pat ? S.pat.rows.join('\n') : '']; S.hi = 0; }
function pushHist() {
  if (!S.pat) return;
  var cur = S.pat.rows.join('\n');
  if (cur === S.hist[S.hi]) return;
  S.hist = S.hist.slice(0, S.hi + 1);
  S.hist.push(cur);
  if (S.hist.length > 60) S.hist.shift();
  S.hi = S.hist.length - 1;
  dirty(); draw();
}
function restore(i) {
  if (!S.pat || S.hist[i] == null) return;
  S.hi = i;
  S.pat.rows = S.hist[i].split('\n');
  syncForm(); draw();
}
function undo() { if (S.hi > 0) { S.hi--; restore(S.hi); dirty(); } }
function redo() { if (S.hi < S.hist.length - 1) { S.hi++; restore(S.hi); dirty(); } }
function dirty() { S.dirty = true; document.title = '\u25cf knit-studio'; }
function clean() { S.dirty = false; document.title = 'knit-studio'; }

/* ---------- tools & palette ---------- */
var TOOLS = [
  ['brush', '\u270e Brush', 'b'], ['eraser', '\u232b Eraser', 'e'],
  ['line', '\u2571 Line', 'l'], ['rect', '\u25af Rect', 'r'],
  ['rectfill', '\u25a0 Rect fill', 'a'], ['bucket', '\u26c2 Fill', 'f'],
  ['pick', '\ud80c\udc53 Pick', 'p']
];
function buildTools() {
  var host = $('tools');
  TOOLS.forEach(function (t) {
    var b = document.createElement('button');
    b.textContent = t[1];
    b.title = t[1] + '  [' + t[2] + ']';
    b.dataset.tool = t[0];
    b.onclick = function () { setTool(t[0]); };
    host.appendChild(b);
  });
  setTool('brush');
}
function setTool(t) {
  S.tool = t;
  document.querySelectorAll('#tools button').forEach(function (b) {
    b.classList.toggle('active', b.dataset.tool === t);
  });
  cv.style.cursor = t === 'pick' ? 'copy' : 'crosshair';
}
function buildPalette() {
  var host = $('palette');
  KS.PALETTE.forEach(function (code) {
    var b = document.createElement('button');
    b.title = KS.CODES[code].label + ' \u2014 ' + KS.CODES[code].hint;
    b.dataset.code = code;
    var c = document.createElement('canvas');
    c.width = c.height = 24;
    var g = c.getContext('2d');
    KS.drawCell(g, code, 0, 0, 24);
    if (code === '.') { g.strokeStyle = '#888'; g.strokeRect(0.5, 0.5, 23, 23); }
    b.appendChild(c);
    b.onclick = function () {
      S.code = code;
      if (S.tool === 'eraser' || S.tool === 'pick') setTool('brush');
      syncPalette();
    };
    host.appendChild(b);
  });
  syncPalette();
}
function syncPalette() {
  document.querySelectorAll('#palette button').forEach(function (b) {
    b.classList.toggle('active', b.dataset.code === S.code);
  });
  $('symHint').textContent = KS.CODES[S.code].label + ': ' + KS.CODES[S.code].hint;
}

/* ---------- cell geometry ---------- */
function lineCells(x0, y0, x1, y1) {
  var out = [], dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx - dy;
  for (var guard = 0; guard < 1e6; guard++) {
    out.push([y0, x0]);
    if (x0 === x1 && y0 === y1) break;
    var e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
  return out;
}
function rectCells(x0, y0, x1, y1, fill) {
  var ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1);
  var out = [];
  for (var y = ay; y <= by; y++) {
    for (var x = ax; x <= bx; x++) {
      if (fill || x === ax || x === bx || y === ay || y === by) out.push([y, x]);
    }
  }
  return out;
}
function applyCells(cells, code) {
  var p = S.pat, n = 0;
  for (var i = 0; i < cells.length; i++) {
    var y = cells[i][0], x = cells[i][1];
    if (KS.getCell(p, y, x) !== null && KS.getCell(p, y, x) !== code) n++;
    KS.setCell(p, y, x, code);
  }
  if (n) pushHist();
}

/* ---------- pointer ---------- */
function cellAt(e) {
  var r = cv.getBoundingClientRect();
  var mx = e.clientX - r.left, my = e.clientY - r.top;
  return {
    x: Math.floor((mx - S.ox) / S.zoom), y: Math.floor((my - S.oy) / S.zoom), mx: mx, my: my
  };
}
function inBounds(c) { var p = S.pat; return p && c.x >= 0 && c.y >= 0 && c.x < p.width && c.y < p.height; }

cv.addEventListener('pointerdown', function (e) {
  if (!activePat()) return;
  if (S.tab === 'view' || e.button === 1 || e.button === 2 || e.shiftKey) {
    S.drag = { pan: true, sx: e.clientX, sy: e.clientY, ox: S.ox, oy: S.oy };
    cv.setPointerCapture(e.pointerId);
    return;
  }
  var c = cellAt(e);
  if (S.tool === 'pick') {
    var code = KS.getCell(S.pat, c.y, c.x);
    if (code) { S.code = code; syncPalette(); }
    return;
  }
  cv.setPointerCapture(e.pointerId);
  if (S.tool === 'bucket') {
    if (inBounds(c)) { KS.floodFill(S.pat, c.y, c.x, S.code); pushHist(); }
    return;
  }
  if (S.tool === 'line' || S.tool === 'rect' || S.tool === 'rectfill') {
    S.drag = { shape: S.tool, x0: c.x, y0: c.y, cells: [] };
    return;
  }
  S.drag = { paint: true };
  paintAt(c);
});

cv.addEventListener('pointermove', function (e) {
  if (!S.drag) return;
  if (S.drag.pan) {
    S.ox = S.drag.ox + (e.clientX - S.drag.sx);
    S.oy = S.drag.oy + (e.clientY - S.drag.sy);
    draw();
    return;
  }
  var c = cellAt(e);
  if (S.drag.paint) { paintAt(c); return; }
  if (S.drag.shape) {
    S.drag.cells = S.drag.shape === 'line'
      ? lineCells(S.drag.x0, S.drag.y0, c.x, c.y)
      : rectCells(S.drag.x0, S.drag.y0, c.x, c.y, S.drag.shape === 'rectfill');
    draw();
  }
});

function endDrag(e) {
  if (!S.drag) return;
  if (S.drag.shape && S.drag.cells.length) applyCells(S.drag.cells, S.code);
  S.drag = null;
  draw();
}
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', endDrag);
cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
cv.addEventListener('wheel', function (e) {
  if (!activePat()) return;
  e.preventDefault();
  var r = cv.getBoundingClientRect();
  zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.18 : 1 / 1.18);
}, { passive: false });

function paintAt(c) {
  if (!inBounds(c)) return;
  KS.setCell(S.pat, c.y, c.x, S.tool === 'eraser' ? '.' : S.code);
  draw();
}

/* ---------- side panel / form ---------- */
function syncForm() {
  var p = activePat(), editable = S.tab === 'edit' && !!p;
  ['pName', 'pTags', 'pGSts', 'pGRows', 'pNotes', 'rzW', 'rzH', 'btnResize', 'btnDup']
    .forEach(function (id) { $(id).disabled = !editable; });
  ['btnSave', 'btnSaveAs'].forEach(function (id) { $(id).disabled = S.tab !== 'edit'; });
  ['btnExJson', 'btnExPng', 'btnExSvg', 'btnExTxt'].forEach(function (id) { $(id).disabled = !p; });
  if (!p) return;
  $('pName').value = p.name || '';
  $('pW').value = p.width;
  $('pH').value = p.height;
  $('pTags').value = (p.meta && p.meta.tags ? p.meta.tags : []).join(', ');
  $('pGSts').value = p.gauge ? p.gauge.stsPer10cm : '';
  $('pGRows').value = p.gauge ? p.gauge.rowsPer10cm : '';
  $('pNotes').value = (p.meta && p.meta.notes) || '';
  $('rzW').value = p.width;
  $('rzH').value = p.height;
  S.rzAspect = p.width / p.height;
}

function syncFromForm() {
  var p = S.pat;
  if (!p || S.tab !== 'edit') return;
  p.name = $('pName').value.trim() || 'untitled';
  p.meta = p.meta || {};
  p.meta.tags = $('pTags').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  p.meta.notes = $('pNotes').value;
  var st = Number($('pGSts').value), rw = Number($('pGRows').value);
  p.gauge = st > 0 && rw > 0 ? { stsPer10cm: st, rowsPer10cm: rw } : null;
}

/* ---------- resize ---------- */
function doResize() {
  syncFromForm();
  var p = S.pat;
  if (!p) return;
  var nw = Number($('rzW').value), nh = Number($('rzH').value);
  if (!(nw >= 1 && nh >= 1 && nw <= 4000 && nh <= 4000)) return status('Resize: need 1-4000 cells', true);
  if (nw === p.width && nh === p.height) return status('Already that size.');
  var fw = nw / p.width, fh = nh / p.height;
  var q = KS.resample(p, nw, nh);
  if (p.gauge) {
    q.gauge = {
      stsPer10cm: Math.max(1, Math.round(p.gauge.stsPer10cm * fw)),
      rowsPer10cm: Math.max(1, Math.round(p.gauge.rowsPer10cm * fh))
    };
  }
  S.pat = q;
  resetHist(); syncForm(); fit(); draw();
  status('Resampled ' + p.width + '\u00d7' + p.height + ' \u2192 ' + nw + '\u00d7' + nh +
    (q.gauge ? ' (gauge ' + q.gauge.stsPer10cm + '/' + q.gauge.rowsPer10cm + ' keeps physical size)' : ''));
}

/* ---------- library ---------- */
function loadLib() {
  api('GET', '/api/patterns').then(function (j) {
    S.libList = j.patterns || [];
    renderCards();
  }).catch(function (e) { status('Library: ' + e.message, true); });
}

function renderCards() {
  var q = $('libSearch').value.trim().toLowerCase();
  var host = $('cards');
  host.innerHTML = '';
  var items = S.libList.filter(function (p) {
    if (!q) return true;
    return (p.name + ' ' + (p.tags || []).join(' ')).toLowerCase().indexOf(q) >= 0;
  });
  $('libEmpty').classList.toggle('hidden', items.length > 0);
  items.forEach(function (p) {
    var card = document.createElement('div');
    card.className = 'card';
    var thumb = document.createElement('div');
    thumb.className = 'thumb';
    if (p.thumb) thumb.style.backgroundImage = 'url(' + p.thumb + ')';
    var body = document.createElement('div');
    body.className = 'body';
    var when = p.updatedAt ? new Date(p.updatedAt).toLocaleString() : 'never';
    body.innerHTML = '<div class="name"></div><div class="meta">' + p.width + ' st \u00d7 ' + p.height +
      ' rows &middot; ' + when + '</div><div class="tags"></div>';
    body.querySelector('.name').textContent = p.name;
    var tags = body.querySelector('.tags');
    (p.tags || []).forEach(function (t) {
      var c = document.createElement('span'); c.className = 'chip'; c.textContent = t; tags.appendChild(c);
    });
    var acts = document.createElement('div');
    acts.className = 'acts';
    [['edit', 'Edit'], ['view', 'View'], ['json', '\u2913'], ['dup', '\u29c9'], ['del', '\u2715']]
      .forEach(function (a) {
        var b = document.createElement('button');
        b.textContent = a[1];
        b.title = a[0] === 'del' ? 'Delete' : a[0];
        if (a[0] === 'del') b.className = 'danger';
        b.onclick = function () { libAction(a[0], p.id); };
        acts.appendChild(b);
      });
    card.appendChild(thumb); card.appendChild(body); card.appendChild(acts);
    host.appendChild(card);
  });
}

function libAction(act, id) {
  if (act === 'del') {
    if (!confirm('Delete "' + id + '"? Cannot be undone.')) return;
    api('DELETE', '/api/patterns/' + encodeURIComponent(id))
      .then(loadLib).catch(function (e) { status(e.message, true); });
    return;
  }
  api('GET', '/api/patterns/' + encodeURIComponent(id)).then(function (json) {
    var p = KS.validate(json);
    if (act === 'json') {
      download(id + '.json', JSON.stringify(p, null, 1), 'application/json');
      return;
    }
    if (act === 'dup') {
      var nid = KS.slug(p.name + '-copy');
      var tries = 0;
      while (S.libList.some(function (x) { return x.id === nid; }) && tries++ < 50) nid += '-2';
      return api('PUT', '/api/patterns/' + nid, p).then(function () {
        status('Duplicated as "' + nid + '".'); loadLib();
      });
    }
    if (act === 'view') { S.viewPat = p; setTab('view'); return; }
    S.pat = p; S.id = id; resetHist(); clean(); setTab('edit');
  }).catch(function (e) { status(e.message, true); });
}

/* ---------- new / open ---------- */
function newPattern() {
  var w = Number(prompt('Width in stitches?', '60'));
  if (!(w >= 1 && w <= 4000)) return;
  var h = Number(prompt('Height in rows?', '80'));
  if (!(h >= 1 && h <= 4000)) return;
  S.pat = KS.blank('untitled', w, h);
  S.id = null;
  resetHist(); clean(); setTab('edit');
}

function openFile(file) {
  if (/\.json$/i.test(file.name) || file.type === 'application/json') {
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var p = KS.validate(JSON.parse(fr.result));
        S.pat = p; S.id = KS.slug(p.name); resetHist(); clean(); setTab('edit');
        status('Opened ' + file.name + ' \u2014 save to add it to the library.');
      } catch (e) { status('Bad pattern file: ' + e.message, true); }
    };
    fr.readAsText(file);
    return;
  }
  KS.loadImageFile(file).then(function (img) {
    S.convImg = img;
    S.convName = file.name.replace(/\.[^.]+$/i, '');
    $('convSrc').textContent = file.name + ' (' + img.naturalWidth + '\u00d7' + img.naturalHeight + ')';
    applyAspect();
    setTab('conv');
    preview();
  }).catch(function (e) { status(e.message, true); });
}

/* ---------- save ---------- */
function makeThumb(p) {
  try {
    var cell = Math.max(1, Math.floor(220 / Math.max(p.width, p.height)));
    var c = document.createElement('canvas');
    c.width = p.width * cell; c.height = p.height * cell;
    var g = c.getContext('2d');
    g.fillStyle = '#2e2e2e';
    g.fillRect(0, 0, c.width, c.height);
    for (var y = 0; y < p.height; y++)
      for (var x = 0; x < p.width; x++)
        KS.drawCell(g, p.rows[y][x], x * cell, y * cell, cell);
    var url = c.toDataURL('image/jpeg', 0.75);
    return url.length > 400000 ? null : url;
  } catch (e) { return null; }
}

function savePat(asNew) {
  syncFromForm();
  if (!S.pat) return;
  var id = asNew ? '' : S.id;
  if (!id) {
    id = prompt('Save under which library id?', KS.slug(S.pat.name));
    if (!id) return;
    id = KS.slug(id);
  }
  var body = KS.clone(S.pat);
  body.thumb = makeThumb(S.pat);
  api('PUT', '/api/patterns/' + encodeURIComponent(id), body).then(function (sum) {
    S.id = sum.id;
    clean();
    status('Saved "' + sum.id + '" to library.');
  }).catch(function (e) { status('Save failed: ' + e.message, true); });
}

function duplicateCurrent() {
  syncFromForm();
  if (!S.pat) return;
  var nid = KS.slug(S.pat.name + '-copy');
  var body = KS.clone(S.pat);
  body.thumb = makeThumb(S.pat);
  api('PUT', '/api/patterns/' + nid, body).then(function () {
    S.id = nid; S.pat.name = nid;
    status('Duplicated to "' + nid + '".');
    syncForm();
  }).catch(function (e) { status(e.message, true); });
}

/* ---------- exports ---------- */
function download(name, data, type) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: type }));
  a.download = name;
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 30000);
}
function exportPng() {
  var p = activePat();
  if (!p) return;
  var cell = 16;
  var c = document.createElement('canvas');
  c.width = p.width * cell; c.height = p.height * cell;
  var g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  for (var y = 0; y < p.height; y++)
    for (var x = 0; x < p.width; x++)
      KS.drawCell(g, p.rows[y][x], x * cell, y * cell, cell);
  g.strokeStyle = '#000';
  g.strokeRect(0.5, 0.5, c.width - 1, c.height - 1);
  var a = document.createElement('a');
  a.href = c.toDataURL('image/png');
  a.download = KS.slug(p.name) + '.png';
  a.click();
}

/* ---------- convert tab ---------- */
function applyAspect() {
  if (!S.convImg || !$('convLock').checked) return;
  var r = S.convImg.naturalHeight / S.convImg.naturalWidth;
  var w = Number($('convW').value);
  if (w > 0) $('convH').value = Math.max(1, Math.round(w * r));
}
function convChart() {
  if (!S.convImg) return null;
  var w = Number($('convW').value), h = Number($('convH').value);
  if (!(w >= 1 && h >= 1)) { status('Convert: bad size', true); return null; }
  var s = KS.sampleImage(S.convImg, Math.min(w, 4000), Math.min(h, 4000));
  return KS.imageToChart(s.lum, s.w, s.h, {
    threshold: Number($('convThr').value),
    invert: $('convInv').checked,
    dither: $('convDither').checked
  });
}
function preview() {
  var chart = convChart();
  if (!chart) return;
  var p = KS.validate({ format: 'knit-studio/1', name: S.convName || 'converted',
    width: chart.width, height: chart.height, rows: chart.rows, gauge: null, meta: {} });
  var cell = Math.max(2, Math.min(14, Math.floor(900 / Math.max(p.width, p.height))));
  var c = $('convCv');
  c.width = p.width * cell; c.height = p.height * cell;
  var g = c.getContext('2d');
  g.fillStyle = '#2e2e2e';
  g.fillRect(0, 0, c.width, c.height);
  for (var y = 0; y < p.height; y++)
    for (var x = 0; x < p.width; x++)
      KS.drawCell(g, p.rows[y][x], x * cell, y * cell, cell);
  var all = p.rows.join(''), dark = (all.match(/x/g) || []).length;
  $('convInfo').textContent = p.width + ' \u00d7 ' + p.height + ' cells \u00b7 ' +
    Math.round(100 * dark / (p.width * p.height)) + '% dark';
}
function convMake() {
  var chart = convChart();
  if (!chart) return;
  var p = KS.blank(S.convName || 'converted', 1, 1);
  p.width = chart.width; p.height = chart.height; p.rows = chart.rows;
  S.pat = p; S.id = null;
  resetHist(); clean(); setTab('edit');
  status('Converted ' + p.width + '\u00d7' + p.height + ' \u2014 edit or save.');
}

/* ---------- keyboard ---------- */
window.addEventListener('keydown', function (e) {
  if (e.target.matches('input, textarea')) return;
  var k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); if (S.tab === 'edit') savePat(); return; }
  if (k === '+' || k === '=') { zoomBy(1.25); return; }
  if (k === '-' || k === '_') { zoomBy(1 / 1.25); return; }
  if (k === '0') { fit(); draw(); return; }
  if (S.tab !== 'edit') return;
  var map = { b: 'brush', e: 'eraser', l: 'line', r: 'rect', a: 'rectfill', f: 'bucket', p: 'pick' };
  if (map[k]) setTool(map[k]);
});

/* ---------- boot ---------- */
function bind(id, ev, fn) { $(id).addEventListener(ev, fn); }

buildTools();
buildPalette();
document.querySelectorAll('#tabs .tab').forEach(function (b) {
  b.onclick = function () { setTab(b.dataset.tab); };
});
bind('tGrid', 'change', draw);
bind('tNums', 'change', draw);
$('btnUndo').onclick = undo;
$('btnRedo').onclick = redo;
$('zIn').onclick = function () { zoomBy(1.25); };
$('zOut').onclick = function () { zoomBy(1 / 1.25); };
$('zFit').onclick = function () { fit(); draw(); };
$('btnNew').onclick = newPattern;
$('btnOpenFile').onclick = function () { $('fileOpen').click(); };
bind('fileOpen', 'change', function (e) { if (e.target.files[0]) openFile(e.target.files[0]); e.target.value = ''; });
bind('libSearch', 'input', renderCards);
['pName', 'pTags', 'pGSts', 'pGRows', 'pNotes'].forEach(function (id) {
  bind(id, 'change', function () { syncFromForm(); dirty(); });
});
$('btnResize').onclick = doResize;
bind('rzW', 'input', function () {
  if ($('rzLock').checked && S.rzAspect) $('rzH').value = Math.max(1, Math.round(Number($('rzW').value) / S.rzAspect));
});
bind('rzH', 'input', function () {
  if ($('rzLock').checked && S.rzAspect) $('rzW').value = Math.max(1, Math.round(Number($('rzH').value) * S.rzAspect));
});
$('btnSave').onclick = function () { savePat(false); };
$('btnSaveAs').onclick = function () { savePat(true); };
$('btnDup').onclick = duplicateCurrent;
$('btnExJson').onclick = function () { var p = activePat(); if (p) download(KS.slug(p.name) + '.json', JSON.stringify(p, null, 1), 'application/json'); };
$('btnExPng').onclick = exportPng;
$('btnExSvg').onclick = function () { var p = activePat(); if (p) download(KS.slug(p.name) + '-chart.svg', KS.toSvg(p, 14), 'image/svg+xml'); };
$('btnExTxt').onclick = function () { var p = activePat(); if (p) download(KS.slug(p.name) + '.txt', KS.toText(p), 'text/plain'); };
$('pW').readOnly = true;
$('pH').readOnly = true;
bind('convFile', 'change', function (e) {
  var f = e.target.files[0];
  if (!f) return;
  KS.loadImageFile(f).then(function (img) {
    S.convImg = img;
    S.convName = f.name.replace(/\.[^.]+$/i, '');
    $('convSrc').textContent = f.name + ' (' + img.naturalWidth + '\u00d7' + img.naturalHeight + ')';
    applyAspect();
    preview();
  }).catch(function (e2) { status(e2.message, true); });
  e.target.value = '';
});
bind('convW', 'input', function () { applyAspect(); if (S.convImg) preview(); });
bind('convH', 'input', function () { if (!$('convLock').checked && S.convImg) preview(); });
bind('convThr', 'input', function () { $('convThrLbl').textContent = Number($('convThr').value).toFixed(2); if (S.convImg) preview(); });
['convInv', 'convDither', 'convLock'].forEach(function (id) {
  bind(id, 'change', function () { if (id === 'convLock') applyAspect(); if (S.convImg) preview(); });
});
$('convPrev').onclick = preview;
$('convMake').onclick = convMake;

window.addEventListener('beforeunload', function (e) {
  if (S.dirty) { e.preventDefault(); e.returnValue = ''; }
});
new ResizeObserver(function () { draw(); }).observe($('stage'));

setTab('lib');
draw();
