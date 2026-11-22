/* knit-studio pixel-art stamps for intarsia (pure): draw a small motif on a
 * grid, stamp it onto any chart. '.' cells are transparent (intarsia: the
 * background color shows through). Stamps carry their own color slot table
 * like charts do; applying maps stamp colors onto the target chart's palette
 * (hex match reuses a slot, new colors append a slot).
 * Storage: localStorage ks-stamps (injectable with _setStorage for tests).
 * UMD like templates.js; needs KS core loaded first (browser: after core.js). */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else { root.KS = root.KS || {}; root.KS.stamps = mod; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function core() {
    var ks = (typeof globalThis !== 'undefined' && globalThis.KS) || (typeof KS !== 'undefined' ? KS : null);
    if (!ks || !ks.COLOR_CODES) throw new Error('stamps: knit-studio core not loaded');
    return ks;
  }
  var KEY = '***';
  var MAXDIM = 64;
  var store = null;
  function ls() { return store || (typeof localStorage !== 'undefined' ? localStorage : null); }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function repeat(ch, n) { var s = ''; for (var i = 0; i < n; i++) s += ch; return s; }
  function validCode(ch) { return core().COLOR_CODES.indexOf(ch) >= 0; }

  /* ---------- model ---------- */

  function create(name, w, h) {
    var s = {
      name: String(name || 'stamp').substring(0, 40) || 'stamp',
      w: clamp(w | 0, 1, MAXDIM), h: clamp(h | 0, 1, MAXDIM),
      colors: [], rows: []
    };
    for (var y = 0; y < s.h; y++) s.rows.push(repeat('.', s.w));
    return s;
  }

  // Coerce anything into a valid stamp; junk cells become transparent.
  function normalize(s) {
    s = s || {};
    var KS = core();
    var out = create(s.name, s.w, s.h);
    if (Array.isArray(s.rows)) {
      for (var y = 0; y < out.h && y < s.rows.length; y++) {
        var r = String(s.rows[y] || '');
        var fixed = '';
        for (var x = 0; x < out.w; x++) {
          var ch = r[x] || '.';
          fixed += (ch === '.' || validCode(ch)) ? ch : '.';
        }
        out.rows[y] = fixed;
      }
    }
    if (Array.isArray(s.colors)) {
      s.colors.slice(0, KS.COLOR_CODES.length).forEach(function (c, i) {
        var hex = c && /^#[0-9a-f]{6}$/i.test(String(c.hex)) ? String(c.hex).toLowerCase()
          : KS.COLOR_RAMP[i];
        out.colors.push({ name: c && c.name ? String(c.name).trim().substring(0, 24) : null, hex: hex });
      });
    }
    return out;
  }

  function check(s) {
    var errs = [];
    var KS = core();
    if (!s || typeof s !== 'object') return ['not a stamp'];
    if (!(s.w >= 1 && s.w <= MAXDIM && s.h >= 1 && s.h <= MAXDIM)) errs.push('size out of range 1..' + MAXDIM);
    if (!Array.isArray(s.rows) || s.rows.length !== s.h) errs.push('row count != height');
    else s.rows.forEach(function (r, y) {
      if (typeof r !== 'string' || r.length !== s.w) { errs.push('row ' + y + ' width != ' + s.w); return; }
      for (var i = 0; i < r.length; i++) {
        var ch = r[i];
        if (ch !== '.' && KS.COLOR_CODES.indexOf(ch) < 0) errs.push('bad cell "' + ch + '" row ' + y);
      }
    });
    if (s.colors !== undefined && !Array.isArray(s.colors)) errs.push('colors must be an array');
    if (s.name !== undefined && typeof s.name !== 'string') errs.push('name must be a string');
    return errs;
  }

  function get(s, y, x) { return s.rows[y] ? s.rows[y][x] : '.'; }
  function set(s, y, x, code) {
    if (!s.rows[y] || x < 0 || x >= s.w || y < 0 || y >= s.h) return false;
    code = code === '.' || validCode(code) ? code : '.';
    s.rows[y] = s.rows[y].substring(0, x) + code + s.rows[y].substring(x + 1);
    return true;
  }
  // ensure the color table has an entry for slot idx; default ramp hex
  function slotColor(s, idx) {
    var KS = core();
    while (s.colors.length <= idx) {
      var i = s.colors.length;
      s.colors.push({ name: null, hex: KS.COLOR_RAMP[i] });
    }
    return s.colors[idx];
  }
  function paint(s, y, x, idx) {
    var KS = core();
    if (idx === null || idx === undefined) return set(s, y, x, '.');
    var code = KS.COLOR_CODES[clamp(idx | 0, 0, KS.COLOR_CODES.length - 1)];
    slotColor(s, clamp(idx | 0, 0, KS.COLOR_CODES.length - 1));
    return set(s, y, x, code);
  }
  function usedSlots(s) {
    var KS = core(), seen = {};
    s.rows.forEach(function (r) {
      for (var i = 0; i < r.length; i++) {
        var ci = KS.COLOR_CODES.indexOf(r[i]);
        if (ci >= 0) seen[ci] = true;
      }
    });
    return Object.keys(seen).map(Number).sort(function (a, b) { return a - b; });
  }

  /* ---------- transforms ---------- */

  function flipH(s) { s.rows = s.rows.map(function (r) { return r.split('').reverse().join(''); }); return s; }
  function flipV(s) { s.rows = s.rows.slice().reverse(); return s; }
  function rotate90(s) { // clockwise; rows[0] stays the top line
    var out = create(s.name, s.h, s.w);
    out.colors = JSON.parse(JSON.stringify(s.colors));
    for (var y = 0; y < s.h; y++) for (var x = 0; x < s.w; x++) {
      set(out, x, s.h - 1 - y, s.rows[y][x]);
    }
    return out;
  }
  function zoom(s, k) {
    k = clamp(k | 0, 1, 8);
    if (k === 1) return s;
    var w = Math.min(MAXDIM, s.w * k), h = Math.min(MAXDIM, s.h * k);
    var out = create(s.name, w, h);
    out.colors = JSON.parse(JSON.stringify(s.colors));
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      set(out, y, x, s.rows[Math.floor(y / k)][Math.floor(x / k)]);
    }
    return out;
  }
  function clear(s) { return create(s.name, s.w, s.h); }

  /* ---------- text (ASCII pixel art) ---------- */

  // Legend lines: `r = #d33682 Heart red` (or ':' / bare space). Body lines are
  // one char per cell ('.' or space = transparent); spaces between chars OK.
  function importText(name, text) {
    var KS = core();
    var lines = String(text || '').split(/\r?\n/);
    var legend = {}, order = [], body = [];
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (!t) continue;
      var m = /^(\S)\s*[:=]?\s*(#[0-9a-fA-F]{6})\s*(.*)$/.exec(t);
      if (m && !body.length && !legend[m[1]] && m[1] !== '.') {
        legend[m[1]] = { hex: m[2].toLowerCase(), name: (m[3] || '').trim() || null };
        order.push(m[1]);
        continue;
      }
      body.push(t);
    }
    if (!order.length) throw new Error('stamps: no color legend lines like "r = #d33682 Heart"');
    var map = {};
    order.forEach(function (ch, i) {
      if (ch === '.' || ch === ' ') throw new Error('stamps: "' + ch + '" is reserved for empty cells');
      map[ch] = KS.COLOR_CODES[i];
    });
    var w = 0, rowsRaw = [];
    body.forEach(function (t) {
      var cells = /\s/.test(t) ? t.trim().split(/\s+/) : t.split('');
      cells.forEach(function (c, ci) {
        if (c.length !== 1) throw new Error('stamps: cell "' + c + '" must be one character');
        if (c === '.' || c === ' ') cells[ci] = '.';
        else {
          if (!map[c]) throw new Error('stamps: body uses "' + c + '" with no legend line');
          cells[ci] = map[c];
        }
      });
      rowsRaw.push(cells);
      if (cells.length > w) w = cells.length;
    });
    if (!rowsRaw.length || !w) throw new Error('stamps: no pixel rows in text');
    var s = create(name, w, rowsRaw.length);
    rowsRaw.forEach(function (cells, y) {
      for (var x = 0; x < cells.length; x++) set(s, y, x, cells[x]);
    });
    order.forEach(function (ch, i) {
      s.colors[i] = { name: legend[ch].name, hex: legend[ch].hex };
    });
    return s;
  }

  function exportText(s) {
    var KS = core();
    var lines = [];
    usedSlots(s).forEach(function (idx) {
      var c = s.colors[idx] || { name: null, hex: KS.COLOR_RAMP[idx] };
      lines.push(KS.COLOR_CODES[idx] + ' = ' + c.hex + (c.name ? ' ' + c.name : ''));
    });
    return lines.concat(s.rows).join('\n');
  }

  /* ---------- composite onto a chart ---------- */

  // Place stamp with its top-left at chart cell (x, y). Transparent cells are
  // skipped, so the intarsia background shows through. Colors map by hex: an
  // identical chart color reuses that slot, new colors append slots.
  // opts: { clip: bool } clip=true crops overflow instead of throwing.
  function apply(p, x, y, stamp, opts) {
    var KS = core();
    opts = opts || {};
    var st = normalize(stamp);
    var errs = check(st);
    if (errs.length) throw new Error('stamps: ' + errs.join('; '));
    x |= 0; y |= 0;
    var fits = x >= 0 && y >= 0 && x + st.w <= p.width && y + st.h <= p.height;
    if (!fits) {
      if (!opts.clip) throw new Error('stamps: does not fit at (' + x + ',' + y + '); move it or use clip');
    }
    var x0 = Math.max(0, x), y0 = Math.max(0, y);
    var x1 = Math.min(p.width, x + st.w), y1 = Math.min(p.height, y + st.h);
    if (x1 <= x0 || y1 <= y0) throw new Error('stamps: entirely outside the chart');
    // map stamp slots -> chart slots
    var pcols = KS.colorsOf(p);
    if (!Array.isArray(p.colors) && p.colors !== undefined) delete p.colors;
    var usedChart = {};
    KS.usedColorCodes(p).forEach(function (c) { usedChart[KS.COLOR_CODES.indexOf(c)] = true; });
    var map = {}, slots = [];
    var taken = {};
    usedSlots(st).forEach(function (idx) {
      var entry = st.colors[idx] || { name: null, hex: KS.COLOR_RAMP[idx] };
      var hex = (entry.hex || KS.COLOR_RAMP[idx]).toLowerCase();
      var found = -1;
      for (var i = 0; i < pcols.length; i++) {
        if (!taken[i] && pcols[i].hex.toLowerCase() === hex) { found = i; break; }
      }
      if (found < 0) for (var j = 0; j < pcols.length; j++) {
        var rampHex = (KS.COLOR_RAMP[j] || '').toLowerCase();
        if (!taken[j] && !usedChart[j] && rampHex === hex) { found = j; break; }
      }
      if (found < 0) {
        found = Math.max(pcols.length, 0);
        while (Object.prototype.hasOwnProperty.call(taken, found)) found++;
        if (found >= KS.COLOR_CODES.length) throw new Error('stamps: chart has no free color slots');
      }
      taken[found] = true;
      map[idx] = found;
      slots.push({ hex: hex, code: KS.COLOR_CODES[found] });
    });
    // write cells (rows are immutable strings; mutate once per row)
    var written = 0;
    for (var yy = y0; yy < y1; yy++) {
      var src = st.rows[yy - y];
      var row = p.rows[yy];
      var changed = false;
      for (var xx = x0; xx < x1; xx++) {
        var ch = src[xx - x];
        if (ch === '.') continue;
        var si = KS.COLOR_CODES.indexOf(ch);
        var target = KS.COLOR_CODES[map[si]];
        if (row[xx] !== target) {
          row = row.substring(0, xx) + target + row.substring(xx + 1);
          changed = true;
        }
        written++;
      }
      if (changed) p.rows[yy] = row;
    }
    // grow the chart color table with mapped slots (preserve earlier entries)
    if (!Array.isArray(p.colors)) p.colors = [];
    Object.keys(map).forEach(function (idx) {
      var from = map[idx];
      if (p.colors.length <= from) {
        while (p.colors.length < from) {
          var fill = p.colors.length;
          p.colors.push({ name: null, hex: KS.COLOR_RAMP[fill] });
        }
        var srcEntry = st.colors[idx | 0];
        p.colors[from] = {
          name: srcEntry && srcEntry.name ? srcEntry.name : null,
          hex: (srcEntry && srcEntry.hex) || KS.COLOR_RAMP[from]
        };
      }
    });
    return { written: written, slots: slots };
  }

  /* ---------- stock library ---------- */

  var LIB_TEXT = {
    'Heart': 'r = #d33682 Heart red\n' + [
      '..rr..rr..',
      '.rrrrrrrr.',
      '.rrrrrrrr.',
      'rrrrrrrrrr',
      'rrrrrrrrrr',
      'rrrrrrrrrr',
      '.rrrrrrrr.',
      '..rrrrrr..',
      '...rrrr...',
      '....rr....'
    ].join('\n'),
    'Star': 'y = #b58900 Gold\n' + [
      '....y....',
      '....y....',
      '.y..y..y.',
      '.yy.y.yy.',
      'yyyyyyyyy',
      '.yyyyyyy.',
      '..yyyyy..',
      '...yyy...',
      '.yy...yy.'
    ].join('\n'),
    'Snowflake': 'c = #268bd2 Ice blue\n' + [
      '....c....',
      'c...c...c',
      '.c..c..c.',
      '..c.c.c..',
      'ccccccccc',
      '..c.c.c..',
      '.c..c..c.',
      'c...c...c',
      '....c....'
    ].join('\n'),
    'Gull': 'w = #268bd2 Sky\n' + [
      '..w......w..',
      '.www....www.',
      'ww.ww..ww.ww',
      'w..www.www..w',
      '....wwww....'
    ].join('\n'),
    'Tree': 'g = #2a9f3c Pine\nt = #8b5a2b Trunk\n' + [
      '...g...',
      '..ggg..',
      '.ggggg.',
      '..ggg..',
      '.ggggg.',
      'ggggggg',
      '...t...'
    ].join('\n'),
    'Diamond': 'd = #d33682 Berry\n' + [
      '...d...',
      '..ddd..',
      '.d...d.',
      'd.....d',
      '.d...d.',
      '..ddd..',
      '...d...'
    ].join('\n')
  };
  function library() {
    return Object.keys(LIB_TEXT).map(function (name) {
      var s = importText(name, LIB_TEXT[name]);
      s.name = name;
      return s;
    });
  }

  /* ---------- storage ---------- */

  var ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
  function readAll() {
    var l = ls();
    if (!l) return {};
    try { return JSON.parse(l.getItem(KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function writeAll(all) {
    var l = ls();
    if (!l) throw new Error('stamps: storage unavailable');
    l.setItem(KEY, JSON.stringify(all));
  }
  function list() {
    var all = readAll();
    return Object.keys(all)
      .map(function (id) { var s = all[id]; return { id: id, name: s.name, w: s.w, h: s.h, colors: usedSlots(s).length }; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });
  }
  function get2(id) {
    var all = readAll();
    return all[id] ? JSON.parse(JSON.stringify(all[id])) : null;
  }
  // exported as getStamp: the cell getter keeps the plain `get` name
  function save(s) {
    var norm = normalize(s);
    var errs = check(norm);
    if (errs.length) throw new Error('stamps: ' + errs.join('; '));
    var all = readAll();
    var id = s && s.id && ID_RE.test(String(s.id)) ? String(s.id) : null;
    if (!id) {
      id = 'st' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }
    norm.id = id;
    all[id] = norm;
    writeAll(all);
    return id;
  }
  function remove(id) {
    var all = readAll();
    if (!all[id]) return false;
    delete all[id];
    writeAll(all);
    return true;
  }

  return {
    MAXDIM: MAXDIM,
    create: create, normalize: normalize, check: check,
    get: get, set: set, paint: paint, slotColor: slotColor, usedSlots: usedSlots,
    flipH: flipH, flipV: flipV, rotate90: rotate90, zoom: zoom, clear: clear,
    importText: importText, exportText: exportText,
    apply: apply,
    library: library,
    save: save, list: list, getStamp: get2, remove: remove,
    _setStorage: function (s) { store = s; }
  };
});
