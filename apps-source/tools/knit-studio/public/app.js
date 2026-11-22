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

/* ---------- project templates ---------- */
var STpl = { sel: null };

function tplStoreKey(id) { return 'ks-tpl-' + id; }

function tplGetSpec(id) {
  return String(id).indexOf('c-') === 0 ? KS.customTpl.get(id) : KS.templates.get(id);
}

/* ---------- custom template editor ---------- */
var CEd = { spec: null };

function cTplOpen(id) {
  CEd.spec = id ? JSON.parse(JSON.stringify(KS.customTpl.get(id) || 'null')) : null;
  if (!CEd.spec || !CEd.spec.panels) CEd.spec = KS.customTpl.blank();
  renderCEditor();
  $('cTplEdit').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function ctTxt(val, ph, fn) {
  var i = document.createElement('input');
  if (ph) i.placeholder = ph;
  i.value = val;
  i.oninput = function () { fn(i.value); };
  return i;
}
function ctNum(val, fn) {
  var i = document.createElement('input');
  i.type = 'number'; i.value = val;
  i.oninput = function () { fn(Number(i.value)); };
  return i;
}
function ctLbl(txt) {
  var b = document.createElement('b');
  b.className = 'ctl'; b.textContent = txt;
  return b;
}

function renderCEditor() {
  var t = CEd.spec;
  if (!t) { $('cTplEdit').classList.add('hidden'); return; }
  $('cTplEdit').classList.remove('hidden');
  $('cTplTitle').textContent = t.id ? 'Edit: ' + t.name : 'New custom template';
  $('ctName').value = t.name;
  $('ctIcon').value = t.icon;
  $('ctBlurb').value = t.blurb;
  $('ctDelete').classList.toggle('hidden', !t.id);
  var fh = $('ctFields');
  fh.innerHTML = '';
  t.fields.forEach(function (f, i) {
    var row = document.createElement('div');
    row.className = 'ct-row';
    row.appendChild(ctLbl('label'));
    row.appendChild(ctTxt(f.label, 'Neck width', function (v) { f.label = v; }));
    var k = ctTxt(f.key, 'key', function (v) {
      f.key = v.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
    });
    k.className = 'ct-key'; k.title = 'field key (a-z, 0-9, _)';
    row.appendChild(ctLbl('key')); row.appendChild(k);
    row.appendChild(ctLbl('def')); row.appendChild(ctNum(f.def, function (v) { f.def = v; }));
    row.appendChild(ctLbl('min')); row.appendChild(ctNum(f.min, function (v) { f.min = v; }));
    row.appendChild(ctLbl('max')); row.appendChild(ctNum(f.max, function (v) { f.max = v; }));
    var x = document.createElement('button');
    x.className = 'secondary'; x.textContent = '\u2715'; x.title = 'remove field';
    x.onclick = function () { t.fields.splice(i, 1); renderCEditor(); };
    row.appendChild(x);
    fh.appendChild(row);
  });
  var ph2 = $('ctPanels');
  ph2.innerHTML = '';
  t.panels.forEach(function (p, i) {
    var row = document.createElement('div');
    row.className = 'ct-row';
    row.appendChild(ctLbl('name'));
    row.appendChild(ctTxt(p.name, 'Panel A', function (v) { p.name = v; }));
    var role = document.createElement('select');
    KS.customTpl.ROLES.forEach(function (r) {
      var o = document.createElement('option'); o.value = r; o.textContent = r;
      role.appendChild(o);
    });
    role.value = p.role;
    role.onchange = function () { p.role = role.value; };
    row.appendChild(ctLbl('role')); row.appendChild(role);
    [['width', 'w'], ['length', 'len']].forEach(function (pair) {
      var key = pair[0], v = p[key];
      var sel = document.createElement('select');
      t.fields.forEach(function (f) {
        var o = document.createElement('option'); o.value = f.key; o.textContent = f.key;
        sel.appendChild(o);
      });
      var fixed = document.createElement('option');
      fixed.value = 'cm'; fixed.textContent = 'fixed';
      sel.appendChild(fixed);
      var known = t.fields.some(function (f) { return f.key === v.key; });
      sel.value = v.mode === 'field' && known ? v.key : 'cm';
      if (v.mode === 'field' && !known) v.mode = 'cm';
      sel.onchange = function () {
        if (sel.value === 'cm') v.mode = 'cm';
        else { v.mode = 'field'; v.key = sel.value; }
        renderCEditor();
      };
      row.appendChild(ctLbl(pair[1]));
      row.appendChild(sel);
      var num = ctNum(v.cm || (key === 'width' ? 40 : 50), function (x2) { v.cm = x2; });
      num.title = 'used when "fixed"';
      row.appendChild(num);
    });
    row.appendChild(ctLbl('top\u2192')); row.appendChild(ctNum(p.topCm, function (v2) { p.topCm = v2; }));
    row.appendChild(ctLbl('bot\u2192')); row.appendChild(ctNum(p.bottomCm, function (v2) { p.bottomCm = v2; }));
    row.appendChild(ctLbl('bandT')); row.appendChild(ctNum(p.bandTop, function (v2) { p.bandTop = v2; }));
    row.appendChild(ctLbl('bandB')); row.appendChild(ctNum(p.bandBottom, function (v2) { p.bandBottom = v2; }));
    var cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = !!p.mirror;
    cb.onchange = function () { p.mirror = cb.checked; };
    row.appendChild(ctLbl('mirror')); row.appendChild(cb);
    var x = document.createElement('button');
    x.className = 'secondary'; x.textContent = '\u2715'; x.title = 'remove panel';
    x.onclick = function () { t.panels.splice(i, 1); renderCEditor(); };
    row.appendChild(x);
    ph2.appendChild(row);
  });
}


function renderTpl() {
  var grid = $('tplGrid');
  grid.innerHTML = '';
  function card(t, onOpen, editFn) {
    var b = document.createElement('button');
    b.className = 'secondary tpl-card';
    var ico = document.createElement('span');
    ico.className = 'tpl-ico'; ico.textContent = t.icon;
    var nm = document.createElement('b');
    nm.textContent = t.name;
    var bl = document.createElement('span');
    bl.className = 'tpl-blurb'; bl.textContent = t.blurb;
    b.appendChild(ico); b.appendChild(nm); b.appendChild(bl);
    b.onclick = onOpen;
    if (editFn) {
      var e = document.createElement('span');
      e.className = 'tpl-edit'; e.textContent = '\u270e'; e.title = 'edit template';
      e.onclick = function (ev) { ev.stopPropagation(); editFn(); };
      b.appendChild(e);
    }
    grid.appendChild(b);
  }
  KS.templates.TEMPLATES.forEach(function (t) {
    card(t, function () { openTplForm(t.id); });
  });
  KS.customTpl.list().forEach(function (t) {
    card(t, function () { openTplForm(t.id); }, function () { cTplOpen(t.id); });
  });
  var ncard = document.createElement('button');
  ncard.className = 'secondary tpl-card tpl-new';
  var ni = document.createElement('span'); ni.className = 'tpl-ico'; ni.textContent = '\u271a';
  var nb = document.createElement('b'); nb.textContent = 'New custom template';
  var nbl = document.createElement('span'); nbl.className = 'tpl-blurb';
  nbl.textContent = 'Your own shapes and measurements, saved in this browser.';
  ncard.appendChild(ni); ncard.appendChild(nb); ncard.appendChild(nbl);
  ncard.onclick = function () { cTplOpen(null); };
  grid.appendChild(ncard);
  var icard = document.createElement('button');
  icard.className = 'secondary tpl-card tpl-new';
  var ii = document.createElement('span'); ii.className = 'tpl-ico'; ii.textContent = '\uD83D\uDCE5';
  var ib = document.createElement('b'); ib.textContent = 'Import JSON';
  var ible = document.createElement('span'); ible.className = 'tpl-blurb';
  ible.textContent = 'Load a custom template file.';
  icard.appendChild(ii); icard.appendChild(ib); icard.appendChild(ible);
  icard.onclick = function () { var f = $('cTplFile'); if (f) f.click(); };
  grid.appendChild(icard);
  $('tplForm').classList.toggle('hidden', !STpl.sel);
  if (STpl.sel) renderTplForm();
}

function openTplForm(id) {
  STpl.sel = id;
  var t = tplGetSpec(id);
  if (!t) { STpl.sel = null; renderTpl(); return status('Template no longer exists', true); }
  $('tplFormTitle').textContent = t.icon + ' ' + t.name + ' \u2014 wearer measurements';
  if (!$('tplName').value) $('tplName').value = id + '-1';
  try {
    var saved = JSON.parse(localStorage.getItem(tplStoreKey(id)) || 'null');
    if (saved) {
      if (saved.gauge) {
        $('tplSts').value = saved.gauge.stsPer10cm || '';
        $('tplRows').value = saved.gauge.rowsPer10cm || '';
      }
      if (saved.units) $('tplUnits').value = saved.units;
    }
  } catch (e) { /* fresh defaults */ }
  renderTpl();
  $('tplForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderTplForm() {
  var t = tplGetSpec(STpl.sel);
  if (!t) return;
  var host = $('tplDims');
  host.innerHTML = '';
  var inches = $('tplUnits').value === 'in';
  var saved = {};
  try { saved = (JSON.parse(localStorage.getItem(tplStoreKey(t.id)) || '{}').dims) || {}; } catch (e) { saved = {}; }
  t.fields.forEach(function (f) {
    var lab = document.createElement('label');
    var inp;
    if (f.type === 'select') {
      lab.textContent = f.label;
      inp = document.createElement('select');
      inp.id = 'tplDim-' + f.key;
      f.options.forEach(function (opt) {
        var op = document.createElement('option');
        op.value = opt; op.textContent = opt;
        inp.appendChild(op);
      });
      inp.value = saved[f.key] !== undefined ? String(saved[f.key]) : f.def;
    } else {
      lab.textContent = f.label + (inches ? ' (in)' : ' (cm)');
      inp = document.createElement('input');
      inp.type = 'number'; inp.id = 'tplDim-' + f.key;
      inp.step = '0.5'; inp.min = String(inches ? Math.round(f.min / 2.54 * 10) / 10 : f.min);
      var cm = saved[f.key] !== undefined ? Number(saved[f.key]) : f.def;
      inp.value = inches ? KS.templates.cmToIn(cm) : cm;
    }
    lab.appendChild(inp);
    host.appendChild(lab);
  });
}

function tplCollectDims() {
  var t = tplGetSpec(STpl.sel);
  var inches = $('tplUnits').value === 'in';
  var dims = {};
  t.fields.forEach(function (f) {
    if (f.type === 'select') { dims[f.key] = $('tplDim-' + f.key).value; return; }
    var v = Number($('tplDim-' + f.key).value);
    dims[f.key] = inches ? Math.round(v * 25.4 * 10) / 10 : v;
  });
  return dims;
}

function tplBuild() {
  var id = STpl.sel;
  if (!id) return;
  var dims = tplCollectDims();
  var gauge = { stsPer10cm: Number($('tplSts').value), rowsPer10cm: Number($('tplRows').value) };
  var custom = String(id).indexOf('c-') === 0;
  var errs = custom ? KS.customTpl.validate(KS.customTpl.get(id))
    : KS.templates.validate(id, dims, gauge);
  if (errs.length) return status(errs.join(' \u00b7 '), true);
  var built;
  try {
    built = custom
      ? KS.customTpl.build(KS.customTpl.get(id), dims, gauge, { name: $('tplName').value.trim() || id })
      : KS.templates.build(id, dims, gauge, { name: $('tplName').value.trim() || id });
  } catch (e) { return status('Template failed: ' + e.message, true); }
  var proj = KS.blankProject(built.name);
  proj.gauge = gauge;
  var failed = [];
  built.panels.forEach(function (pn) {
    try {
      var shape = KS.shaping.normalize(pn.shape);
      var chart = KS.shaping.toPattern(shape, pn.name);
      KS.addPanel(proj, chart, pn.name, pn.role, shape);
    } catch (e) { failed.push(pn.name + ': ' + e.message); }
  });
  if (!proj.panels.length) return status('All panels failed: ' + failed.join(' | '), true);
  proj.meta = proj.meta || {};
  proj.meta.tags = ['template', id];
  proj.meta.notes = (built.notes || []).join(' ');
  try {
    localStorage.setItem(tplStoreKey(id), JSON.stringify({
      dims: dims, gauge: gauge, units: $('tplUnits').value
    }));
  } catch (e) { /* storage optional */ }
  S.project = proj;
  S.projectId = null;
  S.boundPanel = null; S.shapeBind = null;
  setTab('proj');
  renderProjectDetail();
  dirty();
  status('Built ' + proj.name + ': ' + proj.panels.length + ' panels' +
    (failed.length ? ' (' + failed.join('; ') + ')' : '') + ' \u2014 save to persist.');
}

function bindTpl() {
  $('tplUnits').addEventListener('change', renderTplForm);
  $('tplCancel').addEventListener('click', function () { STpl.sel = null; renderTpl(); });
  $('ctAddField').addEventListener('click', function () {
    if (!CEd.spec) return;
    var n = CEd.spec.fields.length + 1;
    CEd.spec.fields.push({ key: 'field' + n, label: 'Measurement ' + n, def: 40, min: 5, max: 200 });
    renderCEditor();
  });
  $('ctAddPanel').addEventListener('click', function () {
    if (!CEd.spec) return;
    var idx = CEd.spec.panels.length;
    CEd.spec.panels.push({
      name: 'Panel ' + String.fromCharCode(65 + idx), role: 'other',
      width: { mode: 'cm', cm: 40 }, length: { mode: 'cm', cm: 50 },
      topCm: 0, bottomCm: 0, bandTop: 0, bandBottom: 0, mirror: false
    });
    renderCEditor();
  });
  $('ctSave').addEventListener('click', function () {
    if (!CEd.spec) return;
    CEd.spec.name = $('ctName').value.trim() || 'My template';
    CEd.spec.icon = $('ctIcon').value || '\u2702\ufe0f';
    CEd.spec.blurb = $('ctBlurb').value.trim();
    try {
      var saved = KS.customTpl.save(CEd.spec);
      status('Custom template "' + saved.name + '" saved.');
      CEd.spec = null;
      renderCEditor();
      renderTpl();
    } catch (e) { status(e.message, true); }
  });
  $('ctDelete').addEventListener('click', function () {
    if (!CEd.spec || !CEd.spec.id) return;
    if (!confirm('Delete custom template "' + CEd.spec.name + '"?')) return;
    KS.customTpl.remove(CEd.spec.id);
    CEd.spec = null;
    renderCEditor();
    renderTpl();
    status('Custom template deleted.');
  });
  $('ctExport').addEventListener('click', function () {
    if (!CEd.spec) return;
    download(KS.slug(CEd.spec.name || 'template') + '.json',
      JSON.stringify(CEd.spec, null, 2), 'application/json');
  });
  $('ctCancel').addEventListener('click', function () { CEd.spec = null; renderCEditor(); });
  var ctf = document.createElement('input');
  ctf.type = 'file'; ctf.id = 'cTplFile'; ctf.accept = '.json,application/json';
  ctf.className = 'hidden';
  document.body.appendChild(ctf);
  ctf.onchange = function () {
    var f = ctf.files && ctf.files[0];
    ctf.value = '';
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        CEd.spec = KS.customTpl.fromJson(r.result);
        renderCEditor();
        status('Template imported \u2014 review and save.');
      } catch (e) { status('Import failed: ' + e.message, true); }
    };
    r.readAsText(f);
  };
  $('tplBuild').addEventListener('click', tplBuild);
}
/* ---------- tabs ---------- */
function setTab(t) {
  S.tab = t;
  document.querySelectorAll('#tabs .tab').forEach(function (b) {
    b.classList.toggle('active', b.dataset.tab === t);
  });
  $('lib').classList.toggle('hidden', t !== 'lib');
  $('conv').classList.toggle('hidden', t !== 'conv');
  $('shape').classList.toggle('hidden', t !== 'shape');
  $('proj').classList.toggle('hidden', t !== 'proj');
  $('tpl').classList.toggle('hidden', t !== 'tpl');
  $('cam').classList.toggle('hidden', t !== 'cam');
  $('ami').classList.toggle('hidden', t !== 'ami');
  $('stamp').classList.toggle('hidden', t !== 'stamp');
  $('stage').classList.toggle('hidden', t !== 'edit' && t !== 'view');
  $('toolbar').classList.toggle('hidden', t !== 'edit');
  $('side').classList.toggle('hidden', t !== 'edit' && t !== 'view');
  if (t === 'lib') loadLib();
  if (t === 'proj') loadProjects();
  if (t === 'tpl') renderTpl();
  if (t === 'cam') camDraw();
  if (t === 'ami') renderAmi();
  if (t === 'stamp') renderStampTab();
  if (t === 'shape') { renderShapeForm(); renderShapeView(); updateShapeBindBox(); }
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
  paletteAutoRefresh();
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
        Math.round(S.ox + c[1] * S.zoom), Math.round(S.oy + c[0] * S.zoom), Math.ceil(S.zoom), activePat());
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
  ['pick', '\ud80c\udc53 Pick', 'p'],
  ['stamp', '\ud83d\udcec Stamp', 's'],
  ['patrect', '\u25a8 Pattern', 'g']
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
/* ---------- color slots (intarsia) ---------- */
var _palPatRef = null, _palColRef = null;

function paletteAutoRefresh() {
  var p = activePat() || null;
  if (p !== _palPatRef || (p && p.colors && p.colors !== _palColRef)) {
    _palPatRef = p; _palColRef = p ? p.colors : null;
    refreshColorSwatches();
    updatePatColorSelects();
  }
}

function refreshColorSwatches() {
  var host = $('palette');
  Array.prototype.forEach.call(host.querySelectorAll('[data-colorslot]'), function (b) { b.remove(); });
  var p = activePat();
  var count = Math.max(2, KS.colorsOf(p || {}).length);
  for (var i = 0; i < count; i++) {
    (function (idx) {
      var code = KS.COLOR_CODES[idx];
      var b = document.createElement('button');
      b.dataset.colorslot = idx;
      b.dataset.code = code;
      var col = KS.colorAt(p, idx);
      b.title = col.name + ' \u2014 ' + col.hex;
      var c = document.createElement('canvas');
      c.width = c.height = 24;
      KS.drawCell(c.getContext('2d'), code, 0, 0, 24, p);
      b.appendChild(c);
      b.onclick = function () {
        S.code = code;
        if (S.tool === 'eraser' || S.tool === 'pick') setTool('brush');
        syncPalette();
      };
      host.appendChild(b);
    })(i);
  }
  var edit = document.createElement('button');
  edit.dataset.colorslot = 'edit';
  edit.textContent = '\u270E';
  edit.title = 'Edit colors \u2014 names, swatches, add, remove';
  edit.onclick = toggleColorPanel;
  host.appendChild(edit);
  syncPalette();
}

function toggleColorPanel() {
  var host = $('colorPanel');
  if (!host) return;
  if (host.classList.contains('hidden')) {
    renderColorPanel();
    host.classList.remove('hidden');
  } else {
    host.classList.add('hidden');
  }
}

function renderColorPanel() {
  var host = $('colorPanel');
  host.innerHTML = '';
  var p = activePat();
  if (!p) return;
  var stored = KS.colorsOf(p);
  var need = Math.max(2, stored.length);
  var rows = [];
  for (var i = 0; i < need; i++) rows.push(stored[i] || { name: null, hex: KS.COLOR_RAMP[i] });
  var used = {};
  KS.usedColorCodes(p).forEach(function (code) { used[code] = true; });
  function write() {
    p.colors = rows.map(function (r) { return { name: r.name || '', hex: r.hex }; });
    _palColRef = p.colors;
    dirty();
    draw();
    renderColorPanel();
    status('Colors updated \u2014 save to persist.');
  }
  rows.forEach(function (r, i) {
    var code = KS.COLOR_CODES[i];
    var row = document.createElement('div');
    row.className = 'color-row';
    var sw = document.createElement('input');
    sw.type = 'color'; sw.value = r.hex;
    sw.title = 'Color for chart code "' + code + '"';
    sw.onchange = function () { r.hex = sw.value.toLowerCase(); write(); };
    var nm = document.createElement('input');
    nm.type = 'text'; nm.maxLength = 24;
    nm.value = r.name || ''; nm.placeholder = 'Color ' + (i + 1);
    nm.onchange = function () { r.name = nm.value.trim(); write(); };
    var del = document.createElement('button');
    del.textContent = '\u2715';
    del.disabled = !!used[code];
    del.title = used[code] ? 'in use in this chart' : 'remove color';
    del.onclick = function () { rows.splice(i, 1); write(); };
    row.appendChild(sw); row.appendChild(nm); row.appendChild(del);
    host.appendChild(row);
  });
  var add = document.createElement('button');
  add.textContent = '+ add color';
  add.disabled = rows.length >= KS.COLOR_CODES.length;
  add.onclick = function () {
    rows.push({ name: null, hex: KS.COLOR_RAMP[rows.length] || '#888888' });
    write();
  };
  host.appendChild(add);
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
  refreshColorSwatches();
}
function syncPalette() {
  var p = activePat();
  document.querySelectorAll('#palette button').forEach(function (b) {
    b.classList.toggle('active', b.dataset.code === S.code);
  });
  var ci = KS.colorIndex(S.code);
  if (ci >= 0) {
    var col = KS.colorAt(p, ci);
    $('symHint').textContent = col.name + ' (code "' + S.code + '"): ' + col.hex;
  } else {
    $('symHint').textContent = KS.CODES[S.code].label + ': ' + KS.CODES[S.code].hint;
  }
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
  if (S.tool === 'stamp') { stPlace(S.pat, c.x, c.y, S.stWork || KS.stamps.library()[0], true); return; }
  cv.setPointerCapture(e.pointerId);
  if (S.tool === 'bucket') {
    if (inBounds(c)) { KS.floodFill(S.pat, c.y, c.x, S.code); pushHist(); }
    return;
  }
  if (S.tool === 'line' || S.tool === 'rect' || S.tool === 'rectfill' || S.tool === 'patrect') {
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
  if (S.drag.shape && S.drag.cells.length) {
    if (S.drag.shape === 'patrect') patFillCells(S.drag.cells);
    else applyCells(S.drag.cells, S.code);
  }
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
  $('projBindBox').classList.toggle('hidden', !(S.tab === 'edit' && S.project && S.boundPanel));
  if (S.tab === 'edit' && S.project && S.boundPanel) {
    var pn = KS.getPanel(S.project, S.boundPanel);
    $('projBindLbl').textContent = pn
      ? 'Open chart belongs to project "' + S.project.name + '" \u00b7 panel "' + pn.name + '"'
      : '';
  }
  ['pName', 'pTags', 'pGSts', 'pGRows', 'pNotes', 'rzW', 'rzH', 'btnResize', 'btnDup', 'btnPatFill']
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
        KS.drawCell(g, p.rows[y][x], x * cell, y * cell, cell, p);
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
      KS.drawCell(g, p.rows[y][x], x * cell, y * cell, cell, p);
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
      KS.drawCell(g, p.rows[y][x], x * cell, y * cell, cell, p);
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

/* ---------- shaping designer ---------- */
var SShape = null;
var sView = { cell: 8, ox: 35, oy: 20, H: 0, gridW: 0, minX: 0, handles: [] };
var sDrag = null;
var sNote = null;

function shapeDefault() {
  return KS.shaping.normalize({
    name: 'panel-1', width: 80, gauge: null, mirror: true,
    edges: {
      left:  [{ kind: 'straight', rows: 6 }, { kind: 'dec', every: 4, each: 1, times: 6 }, { kind: 'straight', rows: 14 }],
      right: [{ kind: 'straight', rows: 6 }, { kind: 'dec', every: 4, each: 1, times: 6 }, { kind: 'straight', rows: 14 }]
    }
  });
}
function shapeState() { if (!SShape) SShape = shapeDefault(); return SShape; }

function shapeApply(msg) {
  SShape = KS.shaping.normalize(SShape);
  renderShapeForm();
  renderShapeView();
  if (msg) status(msg);
}

function shapeMirrorSync(srcSide) {
  if (!SShape.mirror) return;
  var other = srcSide === 'left' ? 'right' : 'left';
  SShape.edges[other] = JSON.parse(JSON.stringify(SShape.edges[srcSide]));
}

function setVal(id, v) { var el = $(id); if (document.activeElement !== el) el.value = v; }

function segRow(side, seg, i) {
  var row = document.createElement('div');
  row.className = 'seg-row';
  var sel = document.createElement('select');
  [['straight', 'rows'], ['dec', 'decrease'], ['inc', 'increase'],
   ['sr', 'short rows'], ['hold', 'hold sts'], ['twist', 'twist (spiral)']].forEach(function (o) {
    var op = document.createElement('option');
    op.value = o[0]; op.textContent = o[1];
    sel.appendChild(op);
  });
  sel.value = seg.kind;
  sel.onchange = function () {
    var edges = SShape.edges[side], old = edges[i];
    var repl;
    if (sel.value === 'straight') repl = { kind: 'straight', rows: Math.max(1, KS.shaping.edgeRows([old])) };
    else if (sel.value === 'hold') repl = { kind: 'hold', each: 6, rows: KS.shaping.edgeRows([old]), release: false };
    else if (sel.value === 'twist') repl = { kind: 'twist', every: 2, at: Math.max(1, Math.round(SShape.width / 4)), rows: Math.max(2, KS.shaping.edgeRows([old])) };
    else if (sel.value === 'sr') repl = { kind: 'sr', every: 2, turn: 1, times: Math.max(1, Math.round(KS.shaping.edgeRows([old]) / 2)) };
    else if (old.kind === 'straight') repl = { kind: sel.value, every: Math.max(1, old.rows), each: 1, times: 1, transfer: false };
    else { repl = Object.assign({}, old); repl.kind = sel.value; }
    edges[i] = repl;
    shapeMirrorSync(side); shapeApply();
  };
  row.appendChild(sel);
  function num(field, val, min, max, label) {
    if (label) { var s = document.createElement('span'); s.textContent = label; row.appendChild(s); }
    var n = document.createElement('input');
    n.type = 'number'; n.min = min; n.max = max; n.value = val;
    n.title = field;
    n.onchange = function () {
      var v = Math.max(min, Math.min(max, Number(n.value) | 0));
      SShape.edges[side][i][field] = v;
      shapeMirrorSync(side); shapeApply();
    };
    row.appendChild(n);
  }
  if (seg.kind === 'straight') num('rows', seg.rows, 1, 999, 'rows');
  else if (seg.kind === 'sr') {
    num('every', seg.every, 1, 99, 'every');
    num('turn', seg.turn, 1, 99, 'st before edge, w&t');
    num('times', seg.times, 1, 999, '\u00d7 n');
  } else if (seg.kind === 'twist') {
    num('every', seg.every, 1, 99, 'every');
    num('at', seg.at, 1, 999, 'st from edge, w&t');
    num('rows', seg.rows, 1, 999, 'rows');
  } else if (seg.kind === 'hold') {
    num('each', seg.each, 1, 999, 'sts on holder');
    num('rows', seg.rows, 1, 999, 'rows held');
    var rl = document.createElement('label');
    rl.className = 'checkrow';
    var rc = document.createElement('input');
    rc.type = 'checkbox'; rc.checked = !!seg.release;
    rc.onchange = function () { SShape.edges[side][i].release = rc.checked; shapeMirrorSync(side); shapeApply(); };
    rl.appendChild(rc); rl.appendChild(document.createTextNode('bind off'));
    row.appendChild(rl);
  } else {
    num('every', seg.every, 1, 99, 'every');
    num('each', seg.each, 1, 99, '\u00d7 st');
    num('times', seg.times, 1, 999, '\u00d7 n');
    if (seg.kind === 'dec') {
      var t = document.createElement('label');
      t.className = 'checkrow';
      var tc = document.createElement('input');
      tc.type = 'checkbox'; tc.checked = !!seg.transfer;
      tc.onchange = function () { SShape.edges[side][i].transfer = tc.checked; shapeMirrorSync(side); shapeApply(); };
      t.appendChild(tc); t.appendChild(document.createTextNode('transfer'));
      row.appendChild(t);
    }
  }
  var g = SShape.gauge;
  if (g) {
    var ang = KS.shaping.segAngle(seg, g);
    if (ang) {
      var ab = document.createElement('span');
      ab.className = 'ang-badge';
      ab.textContent = '\u2248 ' + ang.deg.toFixed(0) + '\u00b0';
      ab.title = 'slope ' + ang.deg.toFixed(1) + '\u00b0 from vertical \u2014 ' + ang.runMm.toFixed(1) +
        ' mm in over ' + ang.riseMm.toFixed(1) + ' mm up; edge per event ' + ang.hypMm.toFixed(1) + ' mm';
      row.appendChild(ab);
    }
  }
  var spacer = document.createElement('span'); spacer.className = 'grow'; row.appendChild(spacer);
  function btn(txt, title, fn) {
    var b = document.createElement('button');
    b.textContent = txt; b.title = title; b.onclick = fn;
    row.appendChild(b);
  }
  btn('\u2191', 'move up', function () {
    var e = SShape.edges[side];
    if (i === 0) return;
    var tmp = e[i]; e[i] = e[i - 1]; e[i - 1] = tmp;
    shapeMirrorSync(side); shapeApply();
  });
  btn('\u2193', 'move down', function () {
    var e = SShape.edges[side];
    if (i === e.length - 1) return;
    var tmp = e[i]; e[i] = e[i + 1]; e[i + 1] = tmp;
    shapeMirrorSync(side); shapeApply();
  });
  btn('\u2715', 'remove segment', function () {
    var e = SShape.edges[side];
    if (e.length > 1) e.splice(i, 1);
    else e[0] = { kind: 'straight', rows: KS.shaping.edgeRows(e) };
    shapeMirrorSync(side); shapeApply();
  });
  return row;
}

function addSeg(side, kind) {
  var seg = kind === 'straight' ? { kind: 'straight', rows: 10 }
    : kind === 'sr' ? { kind: 'sr', every: 2, turn: 1, times: 4 }
    : kind === 'twist' ? { kind: 'twist', every: 2, at: Math.max(1, Math.round(SShape.width / 4)), rows: 20 }
    : kind === 'hold' ? { kind: 'hold', each: 6, rows: 10, release: false }
    : { kind: kind, every: 1, each: 1, times: 1, transfer: false };
  SShape.edges[side].push(seg);
  shapeMirrorSync(side); shapeApply();
}

function renderShapeForm() {
  var sh = shapeState();
  setVal('shName', sh.name);
  setVal('shWidth', sh.width);
  setVal('shGSts', sh.gauge ? sh.gauge.stsPer10cm : '');
  setVal('shGRows', sh.gauge ? sh.gauge.rowsPer10cm : '');
  $('shMirror').checked = !!sh.mirror;
  var host = $('shEdges');
  host.innerHTML = '';
  ['left', 'right'].forEach(function (side) {
    var blk = document.createElement('div');
    blk.className = 'edge-block';
    var head = document.createElement('div');
    head.className = 'edge-head';
    var b = document.createElement('b');
    b.textContent = side + ' edge';
    head.appendChild(b);
    [['straight', '+ rows'], ['dec', '\u2212 st'], ['inc', '+ st'],
     ['sr', 'w&t'], ['hold', 'holder'], ['twist', '\u2937 twist']].forEach(function (spec) {
      var btn = document.createElement('button');
      btn.textContent = spec[1];
      btn.onclick = function () { addSeg(side, spec[0]); };
      head.appendChild(btn);
    });
    blk.appendChild(head);
    sh.edges[side].forEach(function (seg, i) { blk.appendChild(segRow(side, seg, i)); });
    host.appendChild(blk);
  });
  var nh = $('shNotes');
  if (nh) {
    nh.innerHTML = '';
    var anns = sh.annotations || [];
    if (!anns.length) {
      var hint2 = document.createElement('div');
      hint2.className = 'hint';
      hint2.textContent = 'No notes yet \u2014 click anywhere on the diagram to pin one.';
      nh.appendChild(hint2);
    }
    anns.forEach(function (a, i) {
      var row = document.createElement('div');
      row.className = 'note-row';
      var tag = document.createElement('span');
      tag.className = 'note-tag';
      tag.textContent = 'row ' + a.row;
      var inp = document.createElement('input');
      inp.type = 'text'; inp.maxLength = 120; inp.value = a.text;
      inp.onchange = function () {
        a.text = inp.value.trim();
        if (!a.text) SShape.annotations.splice(i, 1);
        shapeApply();
      };
      var x = document.createElement('button');
      x.textContent = '\u2715'; x.title = 'delete note';
      x.onclick = function () { SShape.annotations.splice(i, 1); shapeApply('Note removed.'); };
      row.appendChild(tag); row.appendChild(inp); row.appendChild(x);
      nh.appendChild(row);
    });
  }
}

function shapePat() { return KS.shaping.toPattern(shapeState()); }

function renderShapeView() {
  var cv = $('shapeCv');
  if (!cv || $('shape').classList.contains('hidden')) return;
  var sh = shapeState();
  var e = KS.shaping.extents(sh), p = e.prof;
  var boxW = Math.max(280, (cv.parentElement.clientWidth || 600) - 26);
  var boxH = Math.max(340, Math.min(760, window.innerHeight - 180));
  var cell = Math.max(3, Math.min(18, Math.floor(Math.min((boxW - 80) / e.gridW, (boxH - 60) / p.H))));
  var W = e.gridW * cell, Hh = p.H * cell;
  cv.width = W + 80; cv.height = Hh + 40;
  cv.style.width = cv.width + 'px'; cv.style.height = cv.height + 'px';
  var ctx = cv.getContext('2d');
  ctx.fillStyle = '#1e1e1e';
  ctx.fillRect(0, 0, cv.width, cv.height);
  var ox = sView.ox, oy = 20;
  sView.cell = cell; sView.H = p.H; sView.gridW = e.gridW; sView.minX = e.minX;
  // fabric rows
  ctx.fillStyle = 'rgba(232,228,220,0.92)';
  for (var r = 0; r < p.H; r++) {
    var x0 = ox + (p.lo[r] - e.minX) * cell;
    var w = (p.hi[r] - p.lo[r]) * cell;
    ctx.fillRect(x0, oy + (p.H - 1 - r) * cell, w, cell);
  }
  // 10-grid
  if (cell >= 5) {
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var gx = 0; gx <= e.gridW; gx += 10) { ctx.moveTo(ox + gx * cell + 0.5, oy); ctx.lineTo(ox + gx * cell + 0.5, oy + Hh); }
    for (var gr = 0; gr <= p.H; gr += 10) { ctx.moveTo(ox, oy + gr * cell + 0.5); ctx.lineTo(ox + W, oy + gr * cell + 0.5); }
    ctx.stroke();
    ctx.fillStyle = '#8a8a8a';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    for (var nr = 10; nr <= p.H; nr += 10) {
      ctx.fillText(String(nr), ox + W + 6, oy + (p.H - nr) * cell + 3);
    }
  }
  // shaping event glyphs
  function tri(x, y, dir, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    if (dir === 'down') { ctx.moveTo(x - cell * 0.3, y - cell * 0.28); ctx.lineTo(x + cell * 0.3, y - cell * 0.28); ctx.lineTo(x, y + cell * 0.34); }
    else { ctx.moveTo(x - cell * 0.3, y + cell * 0.28); ctx.lineTo(x + cell * 0.3, y + cell * 0.28); ctx.lineTo(x, y - cell * 0.34); }
    ctx.closePath(); ctx.fill();
  }
  function glyph(x, y, ch) {
    ctx.strokeStyle = ch === '>' ? '#b58900' : '#cb4b16';
    ctx.lineWidth = Math.max(1, cell * 0.14);
    ctx.beginPath();
    if (ch === '>') { ctx.moveTo(x - cell * 0.3, y + cell * 0.3); ctx.lineTo(x + cell * 0.3, y - cell * 0.3); }
    else { ctx.moveTo(x + cell * 0.3, y + cell * 0.3); ctx.lineTo(x - cell * 0.3, y - cell * 0.3); }
    ctx.stroke();
  }
  function drawEvents(evs, side) {
    (evs || []).forEach(function (ev) {
      var r = ev.row - 1;
      var y = oy + (p.H - 1 - r) * cell + cell / 2;
      var lo = p.lo[r], hi = p.hi[r];
      if (ev.dir === 1) {
        var x = side === 'left' ? ox + (lo - e.minX) * cell - cell * 0.5 : ox + (hi - e.minX) * cell + cell * 0.5;
        if (ev.transfer) glyph(x, y, side === 'left' ? '>' : '<');
        else tri(x, y, 'down', '#dc322f');
      } else {
        var x2 = side === 'left' ? ox + (lo - e.minX) * cell + cell * 0.5 : ox + (hi - e.minX) * cell - cell * 0.5;
        tri(x2, y, 'up', '#2aa198');
      }
    });
  }
  drawEvents(KS.shaping.events(p.edges.left), 'left');
  drawEvents(KS.shaping.events(p.edges.right), 'right');
  // short-row wraps + held stitches: small squares, same idiom as the 'h' glyph
  function hmark(x, y) {
    ctx.fillStyle = '#b58900';
    var q = Math.max(2.5, cell * 0.36);
    ctx.fillRect(x - q / 2, y - q / 2, q, q);
  }
  function drawWedges(segs, side) {
    var row = 0;
    (segs || []).forEach(function (sg) {
      if (sg.kind === 'sr') {
        for (var k = 0; k < sg.times; k++) {
          var er = row + sg.every * k + (sg.every - 1);
          if (er >= p.H) break;
          var y = oy + (p.H - 1 - er) * cell + cell / 2;
          hmark(side === 'left' ? ox + (p.lo[er] - e.minX) * cell - cell * 0.5 : ox + (p.hi[er] - e.minX) * cell + cell * 0.5, y);
        }
        row += sg.every * sg.times;
      } else if (sg.kind === 'twist') {
        var nEv = Math.floor(sg.rows / sg.every);
        for (var k3 = 0; k3 < nEv; k3++) {
          var er3 = row + sg.every * k3 + (sg.every - 1);
          if (er3 >= p.H) break;
          var y3 = oy + (p.H - 1 - er3) * cell + cell / 2;
          var hx3 = side === 'left'
            ? ox + (p.lo[er3] + sg.at - 1 - e.minX + 0.5) * cell
            : ox + (p.hi[er3] - sg.at - e.minX + 0.5) * cell;
          hmark(hx3, y3);
        }
        row += sg.rows;
      } else if (sg.kind === 'hold') {
        for (var r = row; r < row + sg.rows && r < p.H; r++) {
          var y2 = oy + (p.H - 1 - r) * cell + cell / 2;
          for (var q2 = 0; q2 < Math.min(sg.each, 6); q2++) {
            var hx = side === 'left'
              ? ox + (p.lo[r] - e.minX) * cell - cell * (q2 + 0.5)
              : ox + (p.hi[r] - e.minX) * cell + cell * (q2 + 0.5);
            hmark(hx, y2);
          }
        }
        row += sg.rows;
      } else if (sg.kind === 'straight') { row += sg.rows; }
      else { row += sg.every * sg.times; }
    });
  }
  drawWedges(p.edges.left, 'left');
  drawWedges(p.edges.right, 'right');
  // outline
  ctx.strokeStyle = '#58a6ff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  var first = true;
  for (var lr = 0; lr < p.H; lr++) {
    var lx = ox + (p.lo[lr] - e.minX) * cell, ly = oy + (p.H - lr) * cell;
    if (first) { ctx.moveTo(lx, oy + p.H * cell); first = false; }
    ctx.lineTo(lx, ly); ctx.lineTo(lx + (p.hi[lr] - p.lo[lr]) * cell, ly);
  }
  var topY = oy;
  ctx.lineTo(ox + (p.hi[p.H - 1] - e.minX) * cell, oy + p.H * cell);
  ctx.lineTo(ox + (p.lo[0] - e.minX) * cell, oy + p.H * cell);
  ctx.stroke();
  void topY;
  // handles at segment boundaries (shaped segments get diamonds)
  sView.handles = [];
  ['left', 'right'].forEach(function (side) {
    var cum = 0;
    sh.edges[side].forEach(function (seg, i) {
      cum += KS.shaping.edgeRows([seg]);
      if (seg.kind === 'straight') return;
      var rowIdx = Math.min(p.H - 1, cum - 1);
      var x = side === 'left'
        ? ox + (p.lo[rowIdx] - e.minX) * cell
        : ox + (p.hi[rowIdx] - e.minX) * cell;
      var y = oy + (p.H - cum) * cell;
      sView.handles.push({ side: side, i: i, x: x, y: y });
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#f0a030';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.fillRect(-4.5, -4.5, 9, 9);
      ctx.strokeRect(-4.5, -4.5, 9, 9);
      ctx.restore();
    });
  });
  // annotations: amber dot + leader + text, anchored row/off-from-left-edge
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
  (sh.annotations || []).forEach(function (a) {
    var r = a.row - 1;
    if (r < 0 || r >= p.H) return;
    var ax = ox + (p.lo[r] + (a.off || 0) - e.minX) * cell + cell * 0.5;
    var ay = oy + (p.H - 1 - r) * cell + cell * 0.5;
    ctx.fillStyle = '#f0a030';
    ctx.beginPath(); ctx.arc(ax, ay, 3, 0, 6.2832); ctx.fill();
    var tw = ctx.measureText(a.text).width;
    var tx = ax + 10;
    if (tx + tw > cv.width - 4) tx = Math.max(4, ax - 12 - tw);
    ctx.strokeStyle = 'rgba(240,160,48,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(tx > ax ? tx : tx + tw, ay + 4); ctx.stroke();
    ctx.fillStyle = '#f0a030';
    ctx.fillText(a.text, tx, ay - 2);
  });
  if (sNote && sNote.row >= 1 && sNote.row <= p.H) {
    var nr = sNote.row - 1;
    var nx = ox + (p.lo[nr] + sNote.off - e.minX) * cell + cell * 0.5;
    var ny = oy + (p.H - 1 - nr) * cell + cell * 0.5;
    ctx.strokeStyle = '#f0a030';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(nx, ny, 5, 0, 6.2832); ctx.stroke();
  }
  var errs = KS.shaping.check(sh);
  var topW = p.hi[p.H - 1] - p.lo[p.H - 1];
  $('shapeInfo').innerHTML = p.H + ' rows \u00b7 base ' + sh.width + ' st \u00b7 top ' + topW + ' st'
    + (errs.length ? ' <span class="shape-err">' + errs.join(' ') + '</span>' : '');
}

function shapePt(ev) {
  var cv = $('shapeCv');
  var r = cv.getBoundingClientRect();
  return { mx: ev.clientX - r.left, my: ev.clientY - r.top };
}

function placeNote(m) {
  var sh = shapeState();
  var p = KS.shaping.profile(sh);
  var r = sView.H - 1 - Math.floor((m.my - sView.oy) / sView.cell);
  r = Math.max(0, Math.min(sView.H - 1, r));
  var gx = Math.floor((m.mx - sView.ox) / sView.cell) + sView.minX;
  sNote = { row: r + 1, off: Math.max(0, gx - p.lo[r]) };
  renderShapeView();
  showNoteInput();
}

function hideNoteInput() {
  var box = $('shNoteBox');
  if (box) box.style.display = 'none';
}

function commitNote() {
  var pending = sNote;
  var box = $('shNoteBox');
  sNote = null;
  hideNoteInput();
  if (pending && box) {
    var txt = box.value.trim();
    if (txt) {
      SShape.annotations = SShape.annotations || [];
      SShape.annotations.push({ row: pending.row, off: pending.off, text: txt });
      shapeApply('Note pinned at row ' + pending.row + '.');
      return;
    }
  }
  renderShapeView();
}

function showNoteInput() {
  var cv = $('shapeCv');
  var host = cv.parentElement;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  var box = $('shNoteBox');
  if (!box) {
    box = document.createElement('input');
    box.id = 'shNoteBox';
    box.type = 'text'; box.maxLength = 120; box.className = 'note-input';
    box.placeholder = 'note for this row\u2026 (Enter pins, Esc cancels)';
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commitNote(); }
      else if (e.key === 'Escape') { sNote = null; hideNoteInput(); renderShapeView(); }
    });
    box.addEventListener('blur', function () { if (sNote) commitNote(); });
    host.appendChild(box);
  }
  var sh = shapeState();
  var p = KS.shaping.profile(sh);
  var r = sNote.row - 1;
  var ax = sView.ox + (p.lo[r] + sNote.off - sView.minX) * sView.cell + sView.cell * 0.5;
  var ay = sView.oy + (sView.H - 1 - r) * sView.cell + sView.cell * 0.5;
  box.style.left = (cv.offsetLeft + Math.min(ax + 8, cv.width - 240)) + 'px';
  box.style.top = (cv.offsetTop + ay - 8) + 'px';
  box.value = '';
  box.style.display = 'block';
  setTimeout(function () { box.focus(); }, 0);
}

function bindShapeCanvas() {
  var cv = $('shapeCv');
  cv.addEventListener('pointerdown', function (ev) {
    var m = shapePt(ev);
    var best = null, bd = 1e9;
    sView.handles.forEach(function (h) {
      var d = Math.abs(h.x - m.mx) + Math.abs(h.y - m.my);
      if (d < bd) { bd = d; best = h; }
    });
    if (best && bd <= 14) {
      sDrag = best;
      cv.setPointerCapture(ev.pointerId);
      ev.preventDefault();
      return;
    }
    placeNote(m);
    ev.preventDefault();
  });
  cv.addEventListener('pointermove', function (ev) {
    if (!sDrag) return;
    var m = shapePt(ev);
    var sh = shapeState();
    var seg = sh.edges[sDrag.side][sDrag.i];
    var p = KS.shaping.profile(sh);
    var prevRows = 0;
    for (var k = 0; k < sDrag.i; k++) prevRows += KS.shaping.edgeRows([sh.edges[sDrag.side][k]]);
    var prevOff = prevRows > 0
      ? (sDrag.side === 'left' ? p.leftOff[prevRows - 1] : p.rightOff[prevRows - 1])
      : 0;
    var col = (m.mx - sView.ox) / sView.cell;
    var targetOff = sDrag.side === 'left'
      ? Math.round(col + sView.minX)
      : sh.width - Math.round(col + sView.minX);
    var targetRow = Math.max(1, Math.min(sView.H, Math.round(sView.H - (m.my - 20) / sView.cell)));
    if (seg.kind === 'straight') {
      seg.rows = Math.max(1, targetRow - prevRows);
    } else {
      var total = targetOff - prevOff;
      if (seg.kind === 'dec' && total < 0) total = seg.each * seg.times;
      if (seg.kind === 'inc' && total > 0) total = -seg.each * seg.times;
      seg.each = Math.max(1, Math.min(99, Math.round(Math.abs(total) / seg.times)));
      seg.every = Math.max(1, Math.min(99, Math.ceil((targetRow - prevRows) / seg.times)));
    }
    shapeMirrorSync(sDrag.side);
    renderShapeForm();
    renderShapeView();
  });
  var end = function () { sDrag = null; };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
}

function bindShapeUI() {
  bind('shName', 'input', function () { SShape.name = $('shName').value.trim() || 'panel'; });
  bind('shWidth', 'change', function () { SShape.width = Number($('shWidth').value) || 80; shapeApply(); });
  bind('shGSts', 'change', function () { shapeGaugeFromForm(); });
  bind('shGRows', 'change', function () { shapeGaugeFromForm(); });
  bind('shMirror', 'change', function () {
    SShape.mirror = $('shMirror').checked;
    if (SShape.mirror) shapeMirrorSync('left');
    shapeApply();
  });
  bind('shLoad', 'click', function () {
    if (S.pat && S.pat.meta && S.pat.meta.shape) {
      SShape = KS.shaping.normalize(S.pat.meta.shape);
      renderShapeForm(); renderShapeView();
      status('Loaded shaping from "' + (S.pat.name || 'pattern') + '".');
    } else status('Open pattern has no shaping data.', true);
  });
  bind('shClear', 'click', function () { SShape = shapeDefault(); shapeApply('New blank panel.'); });
  function loadPreset(fn, note) {
    return function () {
      var w = Math.max(2, Number($('shWidth').value) || 60);
      SShape = KS.shaping.normalize(fn(w));
      shapeApply(note);
    };
  }
  bind('presetHeel', 'click', loadPreset(function (w) { return KS.shaping.sockHeel(Math.round(w / 2)); },
    'Heel: straight flap over half the leg sts, wedge turn (w&t 1 st earlier every 2 rows), live sts for gusset.'));
  bind('presetToe', 'click', loadPreset(KS.shaping.sockToe,
    'Toe: short-row wedge at both edges to a grafting point.'));
  bind('presetShoulder', 'click', loadPreset(KS.shaping.shoulderSlope,
    'Shoulder: short-row slope at one edge \u2014 turn Mirror for both shoulders.'));
  bind('presetEar', 'click', loadPreset(function (w) { return KS.shaping.earFlap(Math.round(w / 2)); },
    'Ear flap: one edge short-rows into a rounded point.'));
  bind('presetTentacle', 'click', loadPreset(KS.shaping.tentacle,
    'Tentacle: spiral short rows (\u2937) keep turning while the tip tapers closed.'));
  bind('angApply', 'click', function () {
    var g = shapeState().gauge;
    if (!g) return status('Angle needs gauge (sts + rows / 10cm).', true);
    var deg = Number($('angDeg').value), every = Math.max(1, Number($('angEvery').value) | 0);
    if (!(deg > 0 && deg < 90)) return status('Target angle must be 1-89\u00b0.', true);
    var mk = KS.shaping.segFromAngle(deg, g, every, 'sr');
    SShape.edges.left.push({ kind: 'sr', every: every, turn: mk.turn, times: 4 });
    shapeMirrorSync('left');
    shapeApply('w&t seg: turn ' + mk.turn + ' st every ' + every + ' rows \u2248 ' + mk.achievedDeg.toFixed(1) +
      '\u00b0 (target ' + deg + '\u00b0).');
  });
  bind('shToChart', 'click', function () {
    var pat = KS.shaping.toPattern(shapeState());
    S.pat = pat; S.id = null;
    resetHist(); clean(); setTab('edit');
    status('Shaping chart generated \u2014 freehand edits welcome now.');
  });
  bind('shSave', 'click', function () {
    var pat = shapePat();
    var id = prompt('Save chart to library as:', KS.slug(pat.name));
    if (!id) return;
    id = KS.slug(id);
    var body = KS.clone(pat);
    body.thumb = makeThumb(pat);
    api('PUT', '/api/patterns/' + encodeURIComponent(id), body).then(function (sum) {
      status('Saved "' + sum.id + '" to library.');
    }).catch(function (e) { status('Save failed: ' + e.message, true); });
  });
  bind('shExportTxt', 'click', function () {
    var pat = shapePat();
    download(KS.slug(shapeState().name) + '-shaping.txt',
      KS.shaping.toText(shapeState()) + '\n\n' + KS.toText(pat), 'text/plain');
  });
  bind('shExportSvg', 'click', function () {
    var pat = shapePat();
    download(KS.slug(shapeState().name) + '-chart.svg', KS.toSvg(pat, 14), 'image/svg+xml');
  });
  bindShapeCanvas();
  new ResizeObserver(function () { renderShapeView(); }).observe($('shape'));
  window.addEventListener('resize', function () { if (S.tab === 'shape') renderShapeView(); });
}

function shapeGaugeFromForm() {
  var st = Number($('shGSts').value), rw = Number($('shGRows').value);
  SShape.gauge = st > 0 && rw > 0 ? { stsPer10cm: st, rowsPer10cm: rw } : null;
  renderShapeView();
}

/* ---------- projects (multi-panel) ---------- */
S.project = null;      // knit-studio-project/1 being edited
S.projectId = null;    // server id once saved
S.boundPanel = null; S.shapeBind = null;   // panel id whose chart is open in the editor
S.projList = [];

function projectDirty() { dirty(); }

function loadProjects() {
  api('GET', '/api/projects').then(function (j) {
    S.projList = j.projects || [];
    renderProjCards();
  }).catch(function (e) { status('Projects: ' + e.message, true); });
}

function renderProjCards() {
  var q = $('projSearch').value.trim().toLowerCase();
  var host = $('projCards');
  host.innerHTML = '';
  var items = S.projList.filter(function (p) {
    if (!q) return true;
    return (p.name + ' ' + (p.tags || []).join(' ')).toLowerCase().indexOf(q) >= 0;
  });
  $('projEmpty').classList.toggle('hidden', items.length > 0 || !!S.project);
  items.forEach(function (p) {
    var card = document.createElement('div');
    card.className = 'card';
    var body = document.createElement('div');
    body.className = 'body';
    var when = p.updatedAt ? new Date(p.updatedAt).toLocaleString() : 'never';
    body.innerHTML = '<div class="name"></div><div class="meta"></div><div class="tags"></div>';
    body.querySelector('.name').textContent = p.name;
    body.querySelector('.meta').textContent = p.panels + ' panel' + (p.panels === 1 ? '' : 's') + ' \u00b7 ' + when;
    var tags = body.querySelector('.tags');
    (p.tags || []).forEach(function (t) {
      var c = document.createElement('span'); c.className = 'chip'; c.textContent = t; tags.appendChild(c);
    });
    var acts = document.createElement('div');
    acts.className = 'acts';
    [['open', 'Open'], ['json', '\u2913'], ['del', '\u2715']].forEach(function (a) {
      var b = document.createElement('button');
      b.textContent = a[1];
      if (a[0] === 'del') b.className = 'danger';
      b.onclick = function () { projCardAction(a[0], p.id); };
      acts.appendChild(b);
    });
    card.appendChild(body); card.appendChild(acts);
    host.appendChild(card);
  });
}

function projCardAction(act, id) {
  if (act === 'del') {
    if (!confirm('Delete project "' + id + '"? Cannot be undone.')) return;
    api('DELETE', '/api/projects/' + encodeURIComponent(id)).then(function () {
      if (S.projectId === id) { S.project = null; S.projectId = null; S.boundPanel = null; S.shapeBind = null; renderProjectDetail(); }
      loadProjects();
    }).catch(function (e) { status(e.message, true); });
    return;
  }
  api('GET', '/api/projects/' + encodeURIComponent(id)).then(function (json) {
    var p = KS.validateProject(json);
    if (act === 'json') { download(id + '.project.json', JSON.stringify(p, null, 1), 'application/json'); return; }
    S.project = p; S.projectId = id; S.boundPanel = null; S.shapeBind = null;
    renderProjectDetail();
    status('Opened project "' + p.name + '".');
  }).catch(function (e) { status(e.message, true); });
}

function newProjectFlow() {
  var name = prompt('Project name?', 'my-sweater');
  if (!name) return;
  S.project = KS.blankProject(name.trim());
  S.projectId = null; S.boundPanel = null; S.shapeBind = null;
  renderProjectDetail();
  status('New project \u2014 add panels, then save.');
}

function projectFromForm() {
  var p = S.project;
  if (!p) return p;
  p.name = $('pjName').value.trim() || 'untitled project';
  p.meta = p.meta || {};
  p.meta.tags = $('pjTags').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  p.meta.notes = $('pjNotes').value;
  var st = Number($('pjGSts').value), rw = Number($('pjGRows').value);
  p.gauge = st > 0 && rw > 0 ? { stsPer10cm: st, rowsPer10cm: rw } : null;
  return p;
}

function renderProjectDetail() {
  var p = S.project;
  $('projEdit').classList.toggle('hidden', !p);
  if (!p) return;
  $('pjName').value = p.name || '';
  $('pjTags').value = (p.meta && p.meta.tags ? p.meta.tags : []).join(', ');
  $('pjNotes').value = (p.meta && p.meta.notes) || '';
  $('pjGSts').value = p.gauge ? p.gauge.stsPer10cm : '';
  $('pjGRows').value = p.gauge ? p.gauge.rowsPer10cm : '';
  var host = $('pjPanelList');
  host.innerHTML = '';
  var fabric = (p.meta && p.meta.fabric) || 'stockinette';
  var yarn = KS.projectYarn(p, fabric);
  p.panels.forEach(function (pn, i) {
    var row = document.createElement('div');
    row.className = 'panel-row' + (S.boundPanel === pn.id ? ' bound' : '');
    var letter = document.createElement('b');
    letter.className = 'pl';
    letter.textContent = String.fromCharCode(65 + i);
    row.appendChild(letter);
    var nm = document.createElement('input');
    nm.className = 'pname'; nm.value = pn.name; nm.maxLength = 60;
    nm.onchange = function () { pn.name = nm.value.trim() || pn.id; projectDirty(); };
    row.appendChild(nm);
    var role = document.createElement('select');
    KS.PANEL_ROLES.forEach(function (r) {
      var o = document.createElement('option'); o.value = r; o.textContent = r; role.appendChild(o);
    });
    role.value = pn.role || 'other';
    role.onchange = function () { pn.role = role.value; projectDirty(); };
    row.appendChild(role);
    var d = KS.panelDims(pn);
    var dims = document.createElement('span');
    dims.className = 'dims';
    dims.textContent = pn.chart ? d.width + ' st \u00d7 ' + d.height + ' rows' : 'no chart';
    if (yarn.panels[i] && yarn.panels[i].meters !== null) {
      dims.textContent += ' \u00b7 ~' + yarn.panels[i].meters + ' m';
      dims.title = 'yarn estimate at gauge' + (p.gauge ? ' ' + p.gauge.stsPer10cm + '/' + p.gauge.rowsPer10cm : '');
    }
    row.appendChild(dims);
    var grow = document.createElement('span'); grow.className = 'grow'; row.appendChild(grow);
    function btn(txt, title, fn, cls) {
      var b = document.createElement('button');
      b.textContent = txt; b.title = title; if (cls) b.className = cls;
      b.onclick = fn; row.appendChild(b);
    }
    btn('\u270e', 'open chart in editor', function () { editPanel(pn.id); });
    btn('\u223f', pn.shape ? 'edit this panel\u2019s shaping model in the Shaping tab'
      : 'shape it from the chart size (panel has no shaping model yet)', function () { openShapePanel(pn.id); });
    btn('\u2191', 'move up', function () {
      if (i === 0) return;
      p.panels.splice(i, 1); p.panels.splice(i - 1, 0, pn);
      projectDirty(); renderProjectDetail();
    });
    btn('\u2193', 'move down', function () {
      if (i === p.panels.length - 1) return;
      p.panels.splice(i, 1); p.panels.splice(i + 1, 0, pn);
      projectDirty(); renderProjectDetail();
    });
    btn('\u2715', 'remove panel', function () {
      if (!confirm('Remove panel ' + String.fromCharCode(65 + i) + ' "' + pn.name + '"?')) return;
      if (S.boundPanel === pn.id) S.boundPanel = null; S.shapeBind = null;
      KS.removePanel(p, pn.id);
      projectDirty(); renderProjectDetail();
    }, 'danger');
    host.appendChild(row);
  });
  var yh = $('pjYarn');
  yh.innerHTML = '';
  if (yarn.total !== null) {
    yh.appendChild(document.createTextNode('Yarn estimate: ~' + yarn.total + ' m of '));
    var sel = document.createElement('select');
    sel.title = 'stitch pattern changes yarn usage a lot; estimate is rough - swatch and weigh';
    Object.keys(KS.FABRICS).forEach(function (f) {
      var o = document.createElement('option');
      o.value = f; o.textContent = f; sel.appendChild(o);
    });
    sel.value = fabric;
    sel.onchange = function () {
      p.meta = p.meta || {}; p.meta.fabric = sel.value;
      projectDirty(); renderProjectDetail();
    };
    yh.appendChild(sel);
    var tail = document.createElement('span');
    tail.textContent = ' fabric' + (yarn.missingGauge ?
      ' (' + yarn.missingGauge + ' panel(s) skipped: no gauge)' : ' \u2014 rough; weigh your swatch');
    yh.appendChild(tail);
  } else if (p.panels.length) {
    yh.textContent = 'Yarn estimate: set a gauge above to see yardage.';
  }
}

function editPanel(id) {
  var p = S.project, pn = KS.getPanel(p, id);
  if (!pn) return;
  if (!pn.chart) pn.chart = KS.blank(pn.name, 60, 80);
  S.pat = KS.clone(pn.chart);
  S.id = null; S.boundPanel = pn.id;
  resetHist(); clean(); setTab('edit');
  status('Editing panel "' + pn.name + '" \u2014 push it back into the project when done.');
}

function pushPanelToProject() {
  var p = S.project;
  if (!p || !S.boundPanel || !S.pat) return;
  syncFromForm();
  var pn = KS.setPanelChart(p, S.boundPanel, KS.clone(S.pat));
  if (pn) {
    projectDirty();
    status('Panel "' + pn.name + '" updated \u2014 save the project.');
    if (S.tab !== 'proj') renderProjectDetail();
  }
}

function addPanelFrom(kind) {
  var p = S.project;
  if (!p) return;
  projectFromForm();
  var chart = null, shape = null, name = '';
  if (kind === 'blank') {
    var w = Number(prompt('Panel width (stitches)?', '80'));
    if (!(w >= 1 && w <= 4000)) return;
    var h = Number(prompt('Panel height (rows)?', '100'));
    if (!(h >= 1 && h <= 4000)) return;
    name = 'Panel ' + String.fromCharCode(65 + p.panels.length);
    chart = KS.blank(name, w, h);
  } else if (kind === 'shape') {
    var sh = shapeState();
    chart = KS.shaping.toPattern(sh);
    shape = JSON.parse(JSON.stringify(sh));
    name = sh.name || 'shaped panel';
  } else if (kind === 'editor') {
    if (!S.pat) return status('No chart open in the editor.', true);
    chart = KS.clone(S.pat);
    name = S.pat.name || 'chart panel';
    if (S.pat.meta && S.pat.meta.shape) shape = JSON.parse(JSON.stringify(S.pat.meta.shape));
  }
  KS.addPanel(p, chart, name, 'other', shape);
  projectDirty();
  renderProjectDetail();
  status('Panel added \u2014 save the project.');
}

function saveProject() {
  var p = projectFromForm();
  if (!p) return;
  var id = S.projectId || prompt('Save project under which id?', KS.slug(p.name));
  if (!id) return;
  id = KS.slug(id);
  api('PUT', '/api/projects/' + encodeURIComponent(id), KS.clone(p)).then(function (sum) {
    S.projectId = sum.id;
    clean();
    status('Saved project "' + sum.id + '" (' + sum.panels + ' panels).');
    loadProjects();
  }).catch(function (e) { status('Save failed: ' + e.message, true); });
}

function bindProjUI() {
  bind('btnNewProj', 'click', newProjectFlow);
  bind('btnProjFile', 'click', function () { $('projFileOpen').click(); });
  bind('projFileOpen', 'change', function (e) {
    var f = e.target.files[0];
    if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      try {
        S.project = KS.validateProject(JSON.parse(fr.result));
        S.projectId = null; S.boundPanel = null; S.shapeBind = null;
        renderProjectDetail();
        status('Imported ' + f.name + ' \u2014 save to add it to the list.');
      } catch (err) { status('Bad project file: ' + err.message, true); }
    };
    fr.readAsText(f);
    e.target.value = '';
  });
  bind('projSearch', 'input', renderProjCards);
  ['pjName', 'pjTags', 'pjNotes', 'pjGSts', 'pjGRows'].forEach(function (id) {
    bind(id, 'change', function () { projectFromForm(); projectDirty(); });
  });
  $('pjSave').onclick = saveProject;
  $('pjClose').onclick = function () {
    S.project = null; S.projectId = null; S.boundPanel = null; S.shapeBind = null;
    renderProjectDetail(); loadProjects();
  };
  $('pjExportTxt').onclick = function () {
    var p = projectFromForm();
    if (!p) return;
    download(KS.slug(p.name) + '-project.txt', KS.projectToText(p), 'text/plain');
  };
  $('pjExportJson').onclick = function () {
    var p = projectFromForm();
    if (!p) return;
    download(KS.slug(p.name) + '.project.json', JSON.stringify(p, null, 1), 'application/json');
  };
  $('pjAddBlank').onclick = function () { addPanelFrom('blank'); };
  $('pjAddFromShape').onclick = function () { addPanelFrom('shape'); };
  $('pjAddFromEditor').onclick = function () { addPanelFrom('editor'); };
  $('btnPushPanel').onclick = pushPanelToProject;

  /* shaping round-trip: project panel <-> Shaping tab */
  function openShapePanel(id) {
    if (!S.project) return;
    var pn = KS.getPanel(S.project, id);
    if (!pn) return;
    if (pn.shape) {
      SShape = JSON.parse(JSON.stringify(pn.shape));
      S.shapeBind = id;
      setTab('shape');
      status('Editing shaping of panel "' + pn.name + '" \u2014 use Save shaping to panel when done.');
      return;
    }
    var d = KS.panelDims(pn);
    var segs = [{ kind: 'straight', rows: Math.max(2, d.height) }];
    SShape = KS.shaping.normalize({
      name: pn.name, width: Math.max(2, d.width), gauge: S.project.gauge || null, mirror: false,
      edges: { left: segs.slice(), right: segs.slice() }
    });
    S.shapeBind = id;
    setTab('shape');
    status('Panel "' + pn.name + '" had no shaping model: started flat at ' + d.width + ' st \u00d7 ' + d.height + ' rows. Saving replaces its chart.');
  }
  function updateShapeBindBox() {
    var box = $('shapeBindBox');
    if (!box) return;
    var pn = S.project && S.shapeBind ? KS.getPanel(S.project, S.shapeBind) : null;
    box.classList.toggle('hidden', !pn);
    if (pn) $('shapeBindLbl').textContent = 'Shaping belongs to project "' + S.project.name +
      '" \u00b7 panel "' + pn.name + '"';
  }
  window.updateShapeBindBox = updateShapeBindBox;
  $('btnPushShape').onclick = function () {
    if (!S.project || !S.shapeBind) return;
    var pn = KS.getPanel(S.project, S.shapeBind);
    if (!pn) return status('Bound panel is gone.', true);
    var sh;
    try { sh = KS.shaping.normalize(SShape); } catch (e) { return status(e.message, true); }
    var errs = KS.shaping.check(sh);
    if (errs.length) return status(errs.join(' \u00b7 '), true);
    try { pn.chart = KS.shaping.toPattern(sh, pn.name); } catch (e) { return status('Chart failed: ' + e.message, true); }
    pn.shape = sh;
    SShape = sh;
    projectDirty();
    renderShapeForm();
    renderShapeView();
    updateShapeBindBox();
    status('Saved shaping to panel "' + pn.name + '" \u2014 chart regenerated; save the project to keep it');
  };
}

/* ---------- CAM slicer (S2S tracker port) ---------- */
var C = {
  text: null, shapes: null, data: null, name: 'sliced', mmPerUnit: 1, detected: null,
  panelIdx: -1, rows: [], ptr: 0,
  scale: 25, ox: 40, oy: 40, drag: null
};
var camCv = $('camCv'), camCtx = camCv.getContext('2d');

function camPanelLetters() {
  return (C.data ? C.data.panels : []).map(function (_, i) {
    return String.fromCharCode(65 + i);
  });
}

function camRowsOf(i) {
  if (!C.data || i < 0 || !C.data.panels[i]) return [];
  return Object.keys(C.data.panels[i].segments).map(Number).sort(function (a, b) { return a - b; });
}

function camSelectPanel(i) {
  C.panelIdx = i;
  C.rows = camRowsOf(i);
  C.ptr = 0;
  renderCamTrack();
  camDraw();
}

function camFit() {
  if (!C.data) return;
  var w = camCv.clientWidth || 600, h = camCv.clientHeight || 400;
  var b = C.data.bounds;
  var zx = (w - 60) / Math.max(1, b[2] - b[0]);
  var zy = (h - 60) / Math.max(1, b[3] - b[1]);
  C.scale = Math.max(2, Math.min(40, Math.floor(Math.min(zx, zy))));
  C.ox = (w - (b[0] + b[2]) * C.scale) / 2;
  C.oy = (h - (b[1] + b[3]) * C.scale) / 2;
}

function camDraw() {
  if (!camCv.clientWidth) return;
  var w = camCv.clientWidth, h = camCv.clientHeight;
  var W = Math.round(w * dpr()), H = Math.round(h * dpr());
  if (camCv.width !== W) camCv.width = W;
  if (camCv.height !== H) camCv.height = H;
  camCtx.setTransform(dpr(), 0, 0, dpr(), 0, 0);
  camCtx.fillStyle = '#121212';
  camCtx.fillRect(0, 0, w, h);
  if (!C.data) {
    camCtx.fillStyle = '#666';
    camCtx.font = '13px sans-serif';
    camCtx.fillText('Upload an SVG outline and slice it to see panels here.', 14, 26);
    return;
  }
  var z = C.scale, curRowY = C.panelIdx !== -1 ? C.rows[C.ptr] : null;
  var letters = camPanelLetters();
  C.data.panels.forEach(function (panel, pi) {
    var base = KS.slicer.COLORS[pi % KS.slicer.COLORS.length];
    var rows = camRowsOf(pi);
    var prevS = null, prevE = null;
    rows.forEach(function (y) {
      var seg = panel.segments[y], sX = seg[0], eX = seg[1];
      var width = eX - sX;
      var px = sX * z + C.ox;
      var py = h - (y * z + C.oy);
      var even = Math.abs(y) % 2 === 0;
      var fill = base, alpha = even ? 0.6 : 0.3, outline = true;
      if (C.panelIdx !== -1) {
        if (pi < C.panelIdx) { fill = '#333'; }
        else if (pi === C.panelIdx) {
          if (y < curRowY) { fill = '#555'; alpha = even ? 0.8 : 0.5; }
          else if (y === curRowY) { fill = '#ff4d4d'; alpha = 0.9; }
          else { alpha = even ? 0.4 : 0.15; }
        } else alpha = even ? 0.15 : 0.05;
      }
      camCtx.globalAlpha = alpha;
      camCtx.fillStyle = fill;
      camCtx.fillRect(px, py - z, width * z, z);
      if (C.panelIdx === -1 || pi === C.panelIdx) {
        camCtx.globalAlpha = 0.8;
        camCtx.strokeStyle = '#444'; camCtx.lineWidth = 1;
        camCtx.strokeRect(px, py - z, width * z, z);
      }
      void outline;
      if (z > 10 && (C.panelIdx === -1 || pi === C.panelIdx)) {
        camCtx.globalAlpha = (C.panelIdx === pi && y === curRowY) ? 1 : (even ? 0.6 : 0.3);
        camCtx.fillStyle = '#fff';
        camCtx.font = Math.max(8, z * 0.4) + 'px monospace';
        camCtx.textAlign = 'center';
        camCtx.textBaseline = 'middle';
        for (var x = sX; x < eX; x++) {
          var ch = 'X';
          if (prevS === null) ch = 'C';
          else {
            var leftI = Math.max(0, prevS - sX), leftD = Math.max(0, sX - prevS);
            var rightI = Math.max(0, eX - prevE), rightD = Math.max(0, prevE - eX);
            var idx = x - sX;
            if (idx < leftI) ch = 'I';
            else if (idx < leftD) ch = 'D';
            else if (idx >= width - rightI) ch = 'I';
            else if (idx >= width - rightD) ch = 'D';
          }
          camCtx.fillText(ch, x * z + C.ox + z / 2, h - (y * z + C.oy) - z / 2);
        }
      }
      prevS = sX; prevE = eX;
    });
    // panel letters at first row
    if (rows.length && z > 10) {
      var y0 = rows[0], seg0 = panel.segments[y0];
      camCtx.globalAlpha = 0.9; camCtx.fillStyle = '#fff';
      camCtx.font = 'bold ' + Math.max(10, z * 0.6) + 'px sans-serif';
      camCtx.textAlign = 'left';
      camCtx.fillText(letters[pi], seg0[0] * z + C.ox, h - (y0 * z + C.oy) + Math.max(10, z * 0.6));
    }
  });
  camCtx.globalAlpha = 1;
}

function renderCamTrack() {
  var box = $('camTrack');
  if (C.panelIdx === -1 || !C.data) {
    box.innerHTML = '';
    var t = document.createElement('div');
    t.textContent = C.data
      ? '--- All Panels View --- pick a panel above to track rows and nudge edges.'
      : 'Slice an SVG to begin.';
    box.appendChild(t);
    $('camRow').textContent = 'Row: - / -';
    return;
  }
  var panel = C.data.panels[C.panelIdx];
  var groups = KS.slicer.condensedGroups(panel);
  $('camRow').textContent = 'Row: ' + (C.ptr + 1) + ' / ' + C.rows.length;
  box.innerHTML = '';
  groups.forEach(function (g) {
    var d = document.createElement('div');
    d.textContent = KS.slicer.groupLine(g);
    if (g.rowIndices.indexOf(C.ptr) >= 0) {
      d.className = 'active-instruction';
      box.appendChild(d);
      d.scrollIntoView({ block: 'nearest' });
    } else box.appendChild(d);
  });
}

function camAfterEdit() {
  C.rows = camRowsOf(C.panelIdx);
  if (!C.rows.length) { C.panelIdx = -1; }
  if (C.ptr >= C.rows.length) C.ptr = Math.max(0, C.rows.length - 1);
  renderCamTrack();
  camDraw();
}

function camSlice() {
  if (!C.shapes) return status('CAM: load an SVG first.', true);
  var sel = Number($('camShape').value) || 0;
  var shape = C.shapes[sel] || C.shapes[0];
  var st = Number($('camSts').value), rw = Number($('camRows').value);
  if (!(st > 0 && rw > 0)) return status('CAM: bad gauge.', true);
  var g = KS.slicer.gaugePerInch(st, rw, $('camUnit').value);
  try {
    var data = KS.slicer.slicePolygon(shape.points, g.sts, g.rows);
    if (!data.panels.length) return status('CAM: shape sliced into zero panels \u2014 too small for this gauge?', true);
    C.data = data;
    C.panelIdx = -1; C.rows = []; C.ptr = 0;
    var sel2 = $('camPanel');
    sel2.innerHTML = '';
    var all = document.createElement('option');
    all.value = '-1'; all.textContent = 'All panels';
    sel2.appendChild(all);
    camPanelLetters().forEach(function (L, i) {
      var o = document.createElement('option');
      o.value = String(i); o.textContent = 'Panel ' + L;
      sel2.appendChild(o);
    });
    camFit();
    renderCamTrack();
    camDraw();
    var wCm = (data.bounds[2] - data.bounds[0]) / g.sts * 2.54;
    var hCm = (data.bounds[3] - data.bounds[1]) / g.rows * 2.54;
    status('Sliced ' + data.panels.length + ' panel' + (data.panels.length === 1 ? '' : 's') +
      ' \u00b7 ' + Math.round(wCm) + ' x ' + Math.round(hCm) + ' cm at this gauge \u00b7 scale ' + C.mmPerUnit.toFixed(3) + ' mm/unit.');
  } catch (e) { status('CAM: ' + e.message, true); }
}

function camParse() {
  var res = KS.slicer.svgToShapes(C.text, { units: $('camUnits').value });
  C.shapes = res.shapes;
  C.mmPerUnit = res.mmPerUnit;
  C.detected = res.detected;
  var sel = $('camShape');
  sel.innerHTML = '';
  C.shapes.forEach(function (sh, i) {
    var o = document.createElement('option');
    o.value = String(i);
    o.textContent = sh.id ? (i + 1) + ': ' + sh.id : 'Shape ' + (i + 1) + ' (' + sh.tag + ')';
    sel.appendChild(o);
  });
  return res;
}

function bindCamUI() {
  bind('camFile', 'change', function (e) {
    var f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      try {
        C.text = String(fr.result);
        camParse();
        C.name = f.name.replace(/\.svg$/i, '') || 'sliced';
        $('camSrc').textContent = f.name + ' \u2014 ' + C.shapes.length + ' shape' + (C.shapes.length === 1 ? '' : 's') +
          ' \u00b7 scale: ' + C.mmPerUnit.toFixed(3) + ' mm/unit';
        C.data = null; C.panelIdx = -1; C.rows = [];
        renderCamTrack();
        camDraw();
        status('Loaded \u00b7 scale ' + C.mmPerUnit.toFixed(3) + ' mm/unit \u2014 ' + C.detected.source + '. Set gauge and slice.');
      } catch (err) { C.text = null; C.shapes = null; status('CAM: ' + err.message, true); }
    };
    fr.readAsText(f);
  });
  bind('camSlice', 'click', camSlice);
  bind('camUnits', 'change', function () {
    if (!C.text) return;
    try { camParse(); } catch (e) { return status('CAM: ' + e.message, true); }
    C.data = null; C.panelIdx = -1; C.rows = [];
    $('camSrc').textContent = $('camSrc').textContent.replace(/\u00b7 scale:.*$/,
      '\u00b7 scale: ' + C.mmPerUnit.toFixed(3) + ' mm/unit');
    renderCamTrack(); camDraw();
    status('Scale ' + C.mmPerUnit.toFixed(3) + ' mm/unit \u2014 ' + C.detected.source + '.');
  });
  $('camPanel').onchange = function () { camSelectPanel(Number(this.value)); };
  $('camPrev').onclick = function () { if (C.ptr > 0) { C.ptr--; renderCamTrack(); camDraw(); } };
  $('camNext').onclick = function () { if (C.ptr < C.rows.length - 1) { C.ptr++; renderCamTrack(); camDraw(); } };
  $('camExportTxt').onclick = function () {
    if (!C.data) return status('CAM: nothing sliced yet.', true);
    download(KS.slug(C.name) + '-panels.txt', KS.slicer.instructionsText(C.data, C.name), 'text/plain');
  };
  $('camToProject').onclick = function () {
    if (!C.data) return status('CAM: nothing sliced yet.', true);
    var name = prompt('Project name from these panels?', C.name);
    if (!name) return;
    var proj = KS.projectFromSlicer(C.data, name.trim());
    var id = KS.slug(name);
    api('PUT', '/api/projects/' + encodeURIComponent(id), proj).then(function (sum) {
      S.project = proj; S.projectId = sum.id; S.boundPanel = null; S.shapeBind = null;
      status('Project "' + sum.id + '" saved with ' + sum.panels + ' panels.');
      setTab('proj');
      renderProjectDetail();
      loadProjects();
    }).catch(function (e) { status('CAM save failed: ' + e.message, true); });
  };
  $('camOpenChart').onclick = function () {
    if (!C.data) return status('CAM: nothing sliced yet.', true);
    if (C.panelIdx === -1) return status('CAM: pick a panel to open as a chart.', true);
    var pats = KS.fromSlicer(C.data, C.name);
    S.pat = pats[C.panelIdx]; S.id = null; S.boundPanel = null; S.shapeBind = null;
    resetHist(); clean(); setTab('edit');
    status('Panel ' + String.fromCharCode(65 + C.panelIdx) + ' opened as a chart.');
  };

  camCv.addEventListener('pointerdown', function (e) {
    if (!C.data) return;
    if (e.shiftKey || e.button === 1 || e.button === 2) {
      C.drag = { pan: true, sx: e.clientX, sy: e.clientY, ox: C.ox, oy: C.oy };
      camCv.setPointerCapture(e.pointerId);
      return;
    }
    if (C.panelIdx === -1) return;
    var r = camCv.getBoundingClientRect();
    var z = C.scale, h = camCv.clientHeight;
    var mathX = Math.floor((e.clientX - r.left - C.ox) / z);
    var mathY = Math.floor((h - (e.clientY - r.top) - C.oy) / z);
    var panel = C.data.panels[C.panelIdx];
    var mod = false;
    var seg = panel.segments[mathY];
    if (seg !== undefined) {
      var sX = seg[0], eX = seg[1];
      if (mathX === sX) sX++;
      else if (mathX === eX - 1) eX--;
      else if (mathX === sX - 1) sX--;
      else if (mathX === eX) eX++;
      else mod = false;
      if (mod || true) {
        if (sX !== seg[0] || eX !== seg[1]) {
          mod = true;
          if (sX >= eX) delete panel.segments[mathY];
          else panel.segments[mathY] = [sX, eX];
        }
      }
    } else if (panel.segments[mathY - 1] !== undefined || panel.segments[mathY + 1] !== undefined) {
      panel.segments[mathY] = [mathX, mathX + 1];
      mod = true;
    }
    if (mod) {
      camCv.setPointerCapture(e.pointerId);
      camAfterEdit();
    }
  });
  camCv.addEventListener('pointermove', function (e) {
    if (!C.drag || !C.drag.pan) return;
    C.ox = C.drag.ox + (e.clientX - C.drag.sx);
    C.oy = C.drag.oy + (e.clientY - C.drag.sy);
    camDraw();
  });
  function camEnd() { C.drag = null; }
  camCv.addEventListener('pointerup', camEnd);
  camCv.addEventListener('pointercancel', camEnd);
  camCv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  camCv.addEventListener('wheel', function (e) {
    if (!C.data) return;
    e.preventDefault();
    var r = camCv.getBoundingClientRect();
    var mx = e.clientX - r.left, my = e.clientY - r.top;
    var h = camCv.clientHeight;
    var old = C.scale;
    C.scale = Math.max(2, Math.min(150, C.scale + e.deltaY * -0.05));
    C.ox = mx - (mx - C.ox) * (C.scale / old);
    C.oy = (h - my) - ((h - my) - C.oy) * (C.scale / old);
    camDraw();
  }, { passive: false });
  new ResizeObserver(function () { camDraw(); }).observe($('cam'));
  renderCamTrack();
}

/* ---------- amigurumi importer ---------- */
S.ami = { parsed: null };

function amiCounts() {
  return S.ami.parsed ? S.ami.parsed.rounds.map(function (r) { return r.sts; }) : [];
}

function renderAmi() {
  var p = S.ami.parsed, host = $('amiRounds'), box = $('amiSummary');
  if (!p || !p.rounds.length) {
    host.innerHTML = '';
    box.textContent = 'Parse a pattern to see its rounds.';
    return;
  }
  var counts = amiCounts();
  var max = Math.max.apply(null, counts), min = Math.min.apply(null, counts);
  box.textContent = p.rounds.length + ' rounds \u00b7 ' + min + '\u2013' + max + ' sts' +
    (p.errors.length ? ' \u00b7 ' + p.errors.length + ' line(s) skipped' : '');
  host.innerHTML = '';
  p.rounds.forEach(function (r, i) {
    var d = i > 0 ? r.sts - p.rounds[i - 1].sts : r.sts;
    var row = document.createElement('div');
    row.className = 'ami-row';
    var n = document.createElement('span'); n.className = 'rn'; n.textContent = r.label;
    var st = document.createElement('span'); st.className = 'st'; st.textContent = r.sts + ' sts';
    var dl = document.createElement('span'); dl.className = 'dl';
    if (i === 0) dl.textContent = 'cast on';
    else if (d > 0) { dl.textContent = '+' + d; dl.className = 'dl inc'; }
    else if (d < 0) { dl.textContent = String(d); dl.className = 'dl dec'; }
    else dl.textContent = 'even';
    row.appendChild(n); row.appendChild(st); row.appendChild(dl);
    host.appendChild(row);
  });
}

function amiConvert(quiet) {
  if (!S.ami.parsed || !S.ami.parsed.rounds.length) {
    if (!quiet) status('Ami: parse a pattern first.', true);
    return null;
  }
  var g1 = Number($('amiG1').value) || 0, g2 = Number($('amiG2').value) || 0;
  try {
    var res = KS.ami.amiToShape(amiCounts(), {
      split: Number($('amiSplit').value),
      amiSts10: g1 > 0 ? g1 : undefined,
      knitSts10: g2 > 0 ? g2 : undefined,
      name: 'ami-piece'
    });
    if (res.warnings.length) $('amiConv').textContent = 'Notes: ' + res.warnings.join(' \u00b7 ');
    else $('amiConv').textContent = '';
    return res;
  } catch (e) {
    if (!quiet) status('Ami: ' + e.message, true);
    return null;
  }
}

function bindAmiUI() {
  $('amiParse').onclick = function () {
    var txt = $('amiText').value;
    if (!txt.trim()) return status('Ami: paste a pattern first.', true);
    var parsed = KS.ami.parseRoundText(txt);
    if (!parsed.rounds.length) {
      S.ami.parsed = null;
      renderAmi();
      return status('Ami: no rounds recognized. Expected lines like "R2: inc x6 (12)".', true);
    }
    S.ami.parsed = parsed;
    renderAmi();
    status('Parsed ' + parsed.rounds.length + ' rounds' +
      (parsed.errors.length ? ' \u2014 ' + parsed.errors.length + ' line(s) skipped: ' + parsed.errors[0] : '.'));
  };
  $('amiToShape').onclick = function () {
    var res = amiConvert();
    if (!res) return;
    SShape = KS.shaping.normalize(res.shape);
    setTab('shape');
    status('Amigurumi shaping loaded \u2014 adjust edges, then generate a chart.');
  };
  $('amiOpenChart').onclick = function () {
    var res = amiConvert();
    if (!res) return;
    S.pat = KS.shaping.toPattern(res.shape);
    S.id = null; S.boundPanel = null; S.shapeBind = null;
    resetHist(); clean(); setTab('edit');
    status('Flat chart generated from ' + amiCounts().length + ' rounds.');
  };
  $('amiProject').onclick = function () {
    var res = amiConvert();
    if (!res) return;
    var name = prompt('Project name for this piece?', 'ami-piece');
    if (!name) return;
    var proj = KS.blankProject(name.trim());
    var pat = KS.shaping.toPattern(res.shape);
    KS.addPanel(proj, pat, 'Piece', 'other', JSON.parse(JSON.stringify(res.shape)));
    var id = KS.slug(name);
    api('PUT', '/api/projects/' + encodeURIComponent(id), proj).then(function (sum) {
      S.project = proj; S.projectId = sum.id; S.boundPanel = null; S.shapeBind = null;
      status('Project "' + sum.id + '" saved from amigurumi pattern.');
      setTab('proj');
      renderProjectDetail();
      loadProjects();
    }).catch(function (e) { status('Ami save failed: ' + e.message, true); });
  };
  $('amiExport').onclick = function () {
    if (!S.ami.parsed || !S.ami.parsed.rounds.length) return status('Ami: parse a pattern first.', true);
    var res = amiConvert(true);
    var txt = KS.ami.amiToText(S.ami.parsed, res ? res.widths : null, res ? res.warnings : []);
    if (res) {
      txt += '\n\n' + KS.shaping.toText(res.shape);
      txt += '\n\n' + KS.toText(KS.shaping.toPattern(res.shape));
    }
    download('amigurumi-knitting.txt', txt, 'text/plain');
  };
}

/* ---------- keyboard ---------- */
window.addEventListener('keydown', function (e) {
  if (e.target.matches('input, textarea')) return;
  var k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 's') {
    e.preventDefault();
    if (S.tab === 'edit') savePat();
    else if (S.tab === 'proj') saveProject();
    return;
  }
  if (k === '+' || k === '=') { zoomBy(1.25); return; }
  if (k === '-' || k === '_') { zoomBy(1 / 1.25); return; }
  if (k === '0') { fit(); draw(); return; }
  if (S.tab !== 'edit') return;
  var map = { b: 'brush', e: 'eraser', l: 'line', r: 'rect', a: 'rectfill', f: 'bucket', p: 'pick', s: 'stamp', g: 'patrect' };
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
bindTpl();
bindShapeUI();
bindProjUI();

/* ---------- stamps (intarsia pixel art) ---------- */
S.stWork = null; S.stSlot = 0; S.stErasing = false; S.stDrag = null;
var ST_CELL = 20;

function stEnsure() {
  if (!S.stWork) S.stWork = JSON.parse(JSON.stringify(KS.stamps.library()[0]));
  if (S.stWork.colors.length === 0) KS.stamps.slotColor(S.stWork, 0);
  return S.stWork;
}
function stCanvasDraw() {
  var st = stEnsure(), c = $('stCv'), cx = c.getContext('2d');
  c.width = st.w * ST_CELL; c.height = st.h * ST_CELL;
  for (var y = 0; y < st.h; y++) for (var x = 0; x < st.w; x++) {
    var px = x * ST_CELL, py = y * ST_CELL, ch = st.rows[y][x];
    cx.fillStyle = ((x + y) % 2) ? '#d9d9d9' : '#f4f4f4';
    cx.fillRect(px, py, ST_CELL, ST_CELL);
    if (ch !== '.') {
      cx.fillStyle = KS.colorAt(st, KS.colorIndex(ch)).hex;
      cx.fillRect(px + 1, py + 1, ST_CELL - 2, ST_CELL - 2);
    }
    cx.strokeStyle = 'rgba(0,0,0,.12)';
    cx.strokeRect(px + 0.5, py + 0.5, ST_CELL, ST_CELL);
  }
}
function stChips() {
  var st = stEnsure(), host = $('stChips');
  host.innerHTML = '';
  for (var i = 0; i < st.colors.length; i++) (function (idx) {
    var b = document.createElement('button');
    b.style.background = KS.colorAt(st, idx).hex;
    b.title = (st.colors[idx] && st.colors[idx].name) || ('Color ' + (idx + 1));
    b.classList.toggle('active', !S.stErasing && S.stSlot === idx);
    b.onclick = function () { S.stErasing = false; S.stSlot = idx; renderStampTab(); };
    host.appendChild(b);
  })(i);
  var col = KS.stamps.slotColor(st, S.stSlot);
  $('stHex').value = col.hex;
  $('stColName').value = col.name || '';
}
function stMini(st) {
  var c = document.createElement('canvas');
  var cell = Math.max(2, Math.floor(96 / Math.max(st.w, st.h)));
  c.width = st.w * cell; c.height = st.h * cell;
  var cx = c.getContext('2d');
  for (var y = 0; y < st.h; y++) for (var x = 0; x < st.w; x++) {
    var ch = st.rows[y][x];
    if (ch === '.') continue;
    cx.fillStyle = KS.colorAt(st, KS.colorIndex(ch)).hex;
    cx.fillRect(x * cell, y * cell, cell, cell);
  }
  return c;
}
function stampToActive(st) {
  var p = activePat();
  if (!p) { status('Open a chart in the Editor first (Library \u2192 open, or New).', true); return; }
  stPlace(p, Math.round(p.width / 2), Math.round(p.height / 2), st, false);
}
// Place centered on (cx, cy); underClick=true keeps the motif under the
// cursor and clips at the chart edge, centered placement refuses overflow.
function stPlace(p, cx, cy, st, underClick) {
  var x = cx - Math.floor(st.w / 2), y = cy - Math.floor(st.h / 2);
  if (!underClick && (x < 0 || y < 0 || x + st.w > p.width || y + st.h > p.height)) {
    status('Stamp "' + st.name + '" (' + st.w + '\u00d7' + st.h + ') does not fit "' + p.name +
      '" (' + p.width + '\u00d7' + p.height + ').', true);
    return;
  }
  var before = p.rows.join('\n');
  var r;
  try {
    r = KS.stamps.apply(p, x, y, st, { clip: !!underClick });
  } catch (e) { status(e.message, true); return; }
  if (p.rows.join('\n') === before) { status('Stamped nothing new from "' + st.name + '".'); return; }
  if (p === S.pat) pushHist();
  refreshColorSwatches();
  status('Stamped "' + st.name + '" on "' + p.name + '": ' + r.written + ' cells, ' +
    r.slots.length + ' color' + (r.slots.length === 1 ? '' : 's') +
    (S.project && S.boundPanel ? ' \u2014 save the project to keep it' : ''));
  draw();
}
function renderStampGallery() {
  var host = $('stGallery');
  host.innerHTML = '';
  function card(st, saved) {
    var d = document.createElement('div'); d.className = 'st-card';
    d.appendChild(stMini(st));
    var nm = document.createElement('div'); nm.className = 'st-name';
    nm.textContent = st.name; d.appendChild(nm);
    var sz = document.createElement('div'); sz.className = 'hint';
    sz.textContent = st.w + ' \u00d7 ' + st.h + ' \u00b7 ' + KS.stamps.usedSlots(st).length + ' colors';
    d.appendChild(sz);
    var row = document.createElement('div'); row.className = 'btn-row';
    function btn(label, title, fn) {
      var b = document.createElement('button'); b.textContent = label; b.title = title;
      b.onclick = fn; row.appendChild(b);
    }
    btn('\u270e', 'edit this stamp', function () {
      S.stWork = JSON.parse(JSON.stringify(st)); S.stSlot = 0; S.stErasing = false;
      renderStampTab();
    });
    btn('\ud83d\udcec', 'stamp onto the open chart', function () { stampToActive(st); });
    if (saved) btn('\ud83d\uddd1', 'delete saved stamp', function () {
      KS.stamps.remove(st.id);
      if (S.stWork && S.stWork.id === st.id) S.stWork.id = null;
      renderStampGallery();
    });
    d.appendChild(row);
    host.appendChild(d);
  }
  KS.stamps.library().forEach(function (st) { card(st, false); });
  KS.stamps.list().forEach(function (row) { card(KS.stamps.getStamp(row.id), true); });
}
function renderStampTab() {
  var st = stEnsure();
  $('stName').value = st.name;
  $('stW').value = st.w;
  $('stH').value = st.h;
  $('stErase').classList.toggle('active', S.stErasing);
  stCanvasDraw();
  stChips();
  renderStampGallery();
}
function bindStampUI() {
  var c = $('stCv');
  function cellAt(ev) {
    var r = c.getBoundingClientRect();
    return { x: Math.floor((ev.clientX - r.left) / ST_CELL), y: Math.floor((ev.clientY - r.top) / ST_CELL) };
  }
  function paint(ev) {
    var st = stEnsure(), pt = cellAt(ev);
    if (pt.x < 0 || pt.y < 0 || pt.x >= st.w || pt.y >= st.h) return;
    KS.stamps.paint(st, pt.y, pt.x, S.stErasing ? null : S.stSlot);
    stCanvasDraw();
  }
  c.addEventListener('pointerdown', function (ev) {
    ev.preventDefault();
    c.setPointerCapture(ev.pointerId);
    S.stDrag = true;
    if (ev.button === 2) {
      var st = stEnsure(), pt = cellAt(ev);
      if (pt.x >= 0 && pt.y >= 0 && pt.x < st.w && pt.y < st.h) KS.stamps.paint(st, pt.y, pt.x, null);
      stCanvasDraw();
      return;
    }
    paint(ev);
  });
  c.addEventListener('pointermove', function (ev) { if (S.stDrag) paint(ev); });
  c.addEventListener('pointerup', function () { S.stDrag = null; });
  c.addEventListener('pointercancel', function () { S.stDrag = null; });
  c.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });

  $('stNew').onclick = function () {
    S.stWork = KS.stamps.create($('stName').value || 'My stamp', +$('stW').value || 12, +$('stH').value || 12);
    S.stSlot = 0; S.stErasing = false;
    renderStampTab();
  };
  $('stAddColor').onclick = function () {
    var st = stEnsure();
    if (st.colors.length >= KS.COLOR_CODES.length) { status('All 38 color slots used', true); return; }
    KS.stamps.slotColor(st, st.colors.length);
    S.stSlot = st.colors.length - 1; S.stErasing = false;
    renderStampTab();
  };
  $('stErase').onclick = function () { S.stErasing = !S.stErasing; renderStampTab(); };
  $('stFlipH').onclick = function () { KS.stamps.flipH(stEnsure()); renderStampTab(); };
  $('stFlipV').onclick = function () { KS.stamps.flipV(stEnsure()); renderStampTab(); };
  $('stRot').onclick = function () { S.stWork = KS.stamps.rotate90(stEnsure()); renderStampTab(); };
  $('stZoom2').onclick = function () {
    var st = stEnsure();
    if (st.w * 2 > KS.stamps.MAXDIM || st.h * 2 > KS.stamps.MAXDIM) { status('Already at max stamp size', true); return; }
    S.stWork = KS.stamps.zoom(st, 2);
    renderStampTab();
  };
  $('stClear').onclick = function () { S.stWork = KS.stamps.clear(stEnsure()); renderStampTab(); };
  $('stHex').oninput = function () {
    var st = stEnsure();
    KS.stamps.slotColor(st, S.stSlot).hex = $('stHex').value.toLowerCase();
    stCanvasDraw(); stChips(); renderStampGallery();
  };
  $('stColName').onchange = function () {
    var st = stEnsure();
    KS.stamps.slotColor(st, S.stSlot).name = $('stColName').value.trim().substring(0, 24) || null;
    stChips();
  };
  $('stSave').onclick = function () {
    var st = stEnsure();
    st.name = $('stName').value.trim() || st.name;
    try {
      st.id = KS.stamps.save(st);
      S.stWork = JSON.parse(JSON.stringify(st));
      status('Saved stamp "' + st.name + '"');
      renderStampGallery();
    } catch (e) { status(e.message, true); }
  };
  $('stApplyChart').onclick = function () {
    var st = stEnsure();
    st.name = $('stName').value.trim() || st.name;
    stampToActive(st);
  };
  $('stExportTxt').onclick = function () {
    var st = stEnsure();
    download(KS.slug(st.name || 'stamp') + '.txt', KS.stamps.exportText(st), 'text/plain');
  };
  $('stImportBtn').onclick = function () {
    try {
      var st = KS.stamps.importText($('stName').value.trim() || 'imported', $('stImportText').value);
      S.stWork = st; S.stSlot = 0; S.stErasing = false;
      $('stImportText').value = '';
      status('Imported "' + st.name + '" (' + st.w + '\u00d7' + st.h + ')');
      renderStampTab();
    } catch (e) { status(e.message, true); }
  };
}


/* ---------- patterning tools ---------- */
function patKindSel() { return $('patKind').value; }
function patParamEl(key) { return $('patP_' + key); }
function patSpecFromUI() {
  var kd = KS.patterns.kind(patKindSel());
  var spec = { kind: kd.id };
  (kd.params || []).forEach(function (par) {
    var el = patParamEl(par.key);
    if (el) spec[par.key] = el.value;
  });
  return spec;
}
function renderPatParams() {
  var kd = KS.patterns.kind(patKindSel());
  var host = $('patParams');
  host.innerHTML = '';
  (kd.params || []).forEach(function (par) {
    var lab = document.createElement('label');
    lab.textContent = par.label + ' ';
    var el;
    if (par.type === 'color') {
      el = document.createElement('select');
      patColorOptions(el, par.def);
    } else if (par.type === 'int') {
      el = document.createElement('input');
      el.type = 'number';
      el.min = par.min; el.max = par.max; el.value = par.def;
      el.style.width = '64px';
    } else {
      el = document.createElement('input');
      el.type = 'text';
      el.value = par.def;
      el.placeholder = 'a,b,7';
    }
    el.id = 'patP_' + par.key;
    lab.appendChild(el);
    host.appendChild(lab);
  });
}
function patColorOptions(sel, def) {
  var p = activePat();
  sel.innerHTML = '';
  var n = Math.max(2, KS.colorsOf(p || {}).length);
  n = Math.min(KS.COLOR_CODES.length, Math.max(n + 1, 3)); // room to pick new-ish slots
  for (var i = 0; i < n; i++) {
    var code = KS.COLOR_CODES[i];
    var o = document.createElement('option');
    o.value = code;
    var col = KS.colorAt(p, i);
    o.textContent = code + ' \u2014 ' + col.name;
    if (code === def) o.selected = true;
    sel.appendChild(o);
  }
}
function updatePatColorSelects() {
  var host = $('patParams');
  if (!host) return;
  Array.prototype.forEach.call(host.querySelectorAll('select'), function (sel) {
    var was = sel.value;
    patColorOptions(sel, was);
  });
}
function patApply(count, specLabel, n, x, y) {
  var p = S.pat;
  if (n > 0) {
    pushHist();
    refreshColorSwatches();
    status(count + ': ' + n + ' cells' + (x !== undefined ? ' at (' + x + ',' + y + ')' : '') + ' \u2014 ctrl+Z restores');
  } else {
    status('Pattern filled nothing new.');
  }
}
function patFillCells(cells) {
  var xs = cells.map(function (c) { return c.x; }), ys = cells.map(function (c) { return c.y; });
  var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs) + 1;
  var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys) + 1;
  var spec;
  try { spec = patSpecFromUI(); } catch (e) { status(e.message, true); return; }
  try {
    var n = KS.patterns.fillRect(S.pat, x0, y0, x1, y1, spec);
    patApply('Patterned region', spec.kind, n, x0, y0);
  } catch (e) { status(e.message, true); }
}
function bindPatUI() {
  var sel = $('patKind');
  ['colorwork', 'stitches'].forEach(function (grp) {
    var og = document.createElement('optgroup');
    og.label = grp === 'colorwork' ? 'Colorwork' : 'Stitch textures';
    KS.patterns.KINDS.filter(function (k2) { return k2.group === grp; }).forEach(function (k2) {
      var o = document.createElement('option');
      o.value = k2.id; o.textContent = k2.label;
      og.appendChild(o);
    });
    sel.appendChild(og);
  });
  sel.onchange = renderPatParams;
  renderPatParams();
  $('btnPatFill').onclick = function () {
    var p = activePat();
    if (!p || S.tab !== 'edit') { status('Open a chart in the Editor to pattern it.', true); return; }
    var spec;
    try { spec = patSpecFromUI(); } catch (e) { status(e.message, true); return; }
    try {
      var n = KS.patterns.fillChart(p, spec);
      patApply('Patterened chart', spec.kind, n);
      draw();
    } catch (e) { status(e.message, true); }
  };
}

bindCamUI();
bindAmiUI();
bindStampUI();
bindPatUI();

setTab('lib');
draw();
