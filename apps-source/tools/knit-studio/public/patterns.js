/* knit-studio patterning tools (pure): repeat generators that fill a chart
 * or a rectangular region with colorwork patterns (stripes, checker, twill)
 * or stitch textures (stockinette, garter rows, rib, seed, basket).
 * Color patterns write intarsia color-slot codes; texture patterns write
 * knit ('k') vs off ('x') cells. UMD like stamps.js; needs KS core loaded
 * first (browser: after core.js). */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else { root.KS = root.KS || {}; root.KS.patterns = mod; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function core() {
    var ks = (typeof globalThis !== 'undefined' && globalThis.KS) || (typeof KS !== 'undefined' ? KS : null);
    if (!ks || !ks.COLOR_CODES) throw new Error('patterns: knit-studio core not loaded');
    return ks;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // UI metadata: params are rendered generically by app.js.
  var KINDS = [
    { id: 'stripes', label: 'Stripes', group: 'colorwork',
      params: [{ key: 'cycle', label: 'Color cycle (comma list)', def: 'a,b', type: 'cycle' },
               { key: 'rowH', label: 'Rows per band', def: 2, min: 1, max: 40, type: 'int' }] },
    { id: 'checker', label: 'Checkerboard', group: 'colorwork',
      params: [{ key: 'a', label: 'Color 1', def: 'a', type: 'color' },
               { key: 'b', label: 'Color 2', def: 'b', type: 'color' },
               { key: 'block', label: 'Block size', def: 4, min: 1, max: 100, type: 'int' }] },
    { id: 'twill', label: 'Diagonal twill', group: 'colorwork',
      params: [{ key: 'a', label: 'Color 1', def: 'a', type: 'color' },
               { key: 'b', label: 'Color 2', def: 'b', type: 'color' },
               { key: 'block', label: 'Diagonal width', def: 4, min: 1, max: 100, type: 'int' }] },
    { id: 'stockinette', label: 'Stockinette (all knit)', group: 'stitches', params: [] },
    { id: 'garter', label: 'Garter rows (knit / off)', group: 'stitches',
      params: [{ key: 'rowH', label: 'Rows per band', def: 1, min: 1, max: 40, type: 'int' }] },
    { id: 'rib', label: 'Rib (columns)', group: 'stitches',
      params: [{ key: 'group', label: 'Width of each side', def: 1, min: 1, max: 50, type: 'int' }] },
    { id: 'seed', label: 'Seed texture', group: 'stitches', params: [] },
    { id: 'basket', label: 'Basket weave', group: 'stitches',
      params: [{ key: 'block', label: 'Block size', def: 3, min: 1, max: 50, type: 'int' }] }
  ];
  function kind(id) {
    for (var i = 0; i < KINDS.length; i++) if (KINDS[i].id === id) return KINDS[i];
    return null;
  }
  function validColor(code) { return core().COLOR_CODES.indexOf(code) >= 0; }

  // 'a,b,7' -> ['a','b','7']; junk entries throw with the bad token.
  function parseCycle(text) {
    var parts = String(text || '').split(/[,\s]+/).filter(Boolean);
    if (!parts.length) throw new Error('patterns: color cycle is empty (e.g. "a,b")');
    parts.forEach(function (c) {
      if (!validColor(c)) throw new Error('patterns: "' + c + '" is not a color code (a b 0-9 A-Z)');
    });
    return parts;
  }

  function needColor(v, fallback) {
    if (v === undefined || v === null || v === '') v = fallback;
    if (!validColor(v)) throw new Error('patterns: "' + v + '" is not a color code');
    return v;
  }
  function intOpt(o, key, def) {
    var v = o && o[key];
    if (v === undefined || v === null || v === '' || isNaN(+v)) v = def;
    return Math.max(1, Math.round(+v));
  }
  function colorParams(o, kindDef) {
    var res = {};
    (kindDef.params || []).forEach(function (p) {
      if (p.type === 'color') res[p.key] = needColor(o && o[p.key], p.def);
      else if (p.type === 'cycle') res[p.key] = parseCycle(o && o[p.key] ? o[p.key] : p.def);
      else if (p.type === 'int') res[p.key] = intOpt(o, p.key, p.def);
    });
    return res;
  }

  // One generator per kind; returns the cell code at (x, y), y counts from
  // the top of the FILLED REGION (pattern starts fresh wherever you drop it).
  function cellAt(kindId, x, y, o) {
    var kd = kind(kindId);
    if (!kd) throw new Error('patterns: unknown pattern "' + kindId + '"');
    var p = colorParams(o || {}, kd);
    switch (kindId) {
      case 'stripes': return p.cycle[Math.floor(y / p.rowH) % p.cycle.length];
      case 'checker': return ((Math.floor(x / p.block) + Math.floor(y / p.block)) % 2 === 0) ? p.a : p.b;
      case 'twill': return (Math.floor((x + y) / p.block) % 2 === 0) ? p.a : p.b;
      case 'stockinette': return 'k';
      case 'garter': return (Math.floor(y / p.rowH) % 2 === 0) ? 'k' : 'x';
      case 'rib': return (Math.floor(x / p.group) % 2 === 0) ? 'k' : 'x';
      case 'seed': return ((x + y) % 2 === 0) ? 'k' : 'x';
      case 'basket': return ((Math.floor(x / p.block) + Math.floor(y / p.block)) % 2 === 0) ? 'k' : 'x';
    }
    throw new Error('patterns: no generator for "' + kindId + '"');
  }

  // Fill half-open rect [x0,x1) x [y0,y1) of pattern rows (row 0 = top),
  // clamped to the chart. Returns cells written (overwrites included).
  function fillRect(p, x0, y0, x1, y1, spec) {
    if (!p || !Array.isArray(p.rows)) throw new Error('patterns: not a chart');
    var kindId = spec && spec.kind;
    var kd = kind(kindId);
    if (!kd) throw new Error('patterns: unknown pattern "' + kindId + '"');
    // validate params once up front
    var probe = { x: 0, y: 0 };
    cellAt(kindId, 0, 0, spec);
    var a = clamp(Math.min(x0, x1) | 0, 0, p.width), b = clamp(Math.max(x0, x1) | 0, 0, p.width);
    var c = clamp(Math.min(y0, y1) | 0, 0, p.height), d = clamp(Math.max(y0, y1) | 0, 0, p.height);
    if (a === b || c === d) return 0;
    var written = 0;
    for (var y = c; y < d; y++) {
      var row = p.rows[y];
      var changed = false;
      for (var x = a; x < b; x++) {
        var code = cellAt(kindId, x - a, y - c, spec);
        if (row[x] !== code) {
          row = row.substring(0, x) + code + row.substring(x + 1);
          changed = true;
        }
        written++;
      }
      if (changed) p.rows[y] = row;
    }
    return written;
  }
  function fillChart(p, spec) { return fillRect(p, 0, 0, p.width, p.height, spec); }

  // Preview grid for UI tiles: rows of codes for w x h.
  function previewGrid(kindId, w, h, o) {
    var out = [];
    for (var y = 0; y < h; y++) {
      var r = '';
      for (var x = 0; x < w; x++) r += cellAt(kindId, x, y, o);
      out.push(r);
    }
    return out;
  }

  return {
    KINDS: KINDS, kind: kind,
    parseCycle: parseCycle,
    cellAt: cellAt, fillRect: fillRect, fillChart: fillChart,
    previewGrid: previewGrid
  };
});
