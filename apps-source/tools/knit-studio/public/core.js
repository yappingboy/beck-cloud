/* knit-studio core: pattern model, transforms, exports, chart rendering.
 * UMD: window.KS in browsers, module.exports in node. DOM-free except the
 * canvas helpers (renderChart/drawCell), which only run when called. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Japanese machine-chart palette. One char per cell.
  var CODES = {
    '.': { label: 'Empty', hint: 'no instruction' },
    'k': { label: 'Knit', hint: 'needle in working position, forms a stitch' },
    'x': { label: 'Off', hint: 'needle out of action, float / no loop' },
    'h': { label: 'Hold', hint: 'holding position, short rows' },
    '<': { label: 'Transfer L', hint: 'loop moves one needle left' },
    '>': { label: 'Transfer R', hint: 'loop moves one needle right' },
    'a': { label: 'Color A', hint: 'color A feed' },
    'b': { label: 'Color B', hint: 'color B feed' },
    'i': { label: 'Increase', hint: 'shaping increase' },
    'd': { label: 'Decrease', hint: 'shaping decrease' },
    't': { label: 'K2tog', hint: 'knit 2 together, right-leaning decrease' }
  };
  // Intarsia color slots: 'a','b' are slots 0/1; digits and capitals extend
  // to 38 colors. The chart's optional `colors` table overrides name+hex per
  // slot; anything unset falls back to COLOR_RAMP.
  var COLOR_CODES = 'ab0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  function hslHex(h, sat, lig) {
    var c = (1 - Math.abs(2 * lig / 100 - 1)) * sat / 100;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var mm = 1 - c - 2 * (1 - lig / 100) + c; // normalize helper
    var l = lig / 100;
    var m2 = l - c / 2;
    var rgb = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] :
      h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return '#' + rgb.map(function (v) {
      var q = Math.round((v + m2) * 255).toString(16);
      return q.length === 1 ? '0' + q : q;
    }).join('');
  }
  var COLOR_RAMP = COLOR_CODES.map(function (code, i) {
    if (i === 0) return '#d33682'; // Color A, historic magenta
    if (i === 1) return '#268bd2'; // Color B, historic blue
    return hslHex((i * 47 + 8) % 360, 58, 46);
  });
  COLOR_CODES.forEach(function (code, i) {
    CODES[code] = {
      label: i === 0 ? 'Color A' : i === 1 ? 'Color B' : 'Color ' + (i + 1),
      hint: 'intarsia color slot ' + (i + 1), color: true
    };
  });
  // Symbol palette: non-color tools; color slots render dynamically per chart.
  var PALETTE = ['.', 'k', 'x', 'h', '<', '>', 'i', 'd', 't'];

  function colorIndex(code) { return COLOR_CODES.indexOf(code); }
  function colorsOf(p) {
    var out = [];
    if (p && Array.isArray(p.colors)) {
      p.colors.forEach(function (c) {
        if (out.length >= COLOR_CODES.length) return;
        var hex = c && /^#[0-9a-f]{6}$/i.test(String(c.hex)) ? String(c.hex).toLowerCase() : (COLOR_RAMP[out.length] || '#888888');
        var name = c ? String(c.name || '').trim().substring(0, 24) : '';
        out.push({ name: name || null, hex: hex });
      });
    }
    return out;
  }
  function colorAt(p, idx) {
    var t = colorsOf(p);
    var e = t[idx] || {};
    return {
      name: e.name || (idx < 2 ? 'Color ' + 'AB'.charAt(idx) : 'Color ' + (idx + 1)),
      hex: e.hex || COLOR_RAMP[idx] || '#888888'
    };
  }
  function colorHex(p, idx) { return colorAt(p, idx).hex; }
  function escapeXml(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function usedColorCodes(p) {
    var seen = [], out = [];
    (p.rows || []).forEach(function (r) {
      for (var i = 0; i < r.length; i++) {
        var ci = colorIndex(r[i]);
        if (ci >= 0 && !seen[ci]) { seen[ci] = true; out.push(COLOR_CODES[ci]); }
      }
    });
    return out;
  }

  var INK = '#e8e8e8';
  var CELL_FG = '#101010';

  /* ---------- model ---------- */

  function blank(name, width, height) {
    width = Math.max(1, width | 0);
    height = Math.max(1, height | 0);
    var row = repeat('.', width);
    var rows = [];
    for (var y = 0; y < height; y++) rows.push(row);
    return {
      format: 'knit-studio/1',
      name: name || 'untitled',
      width: width, height: height,
      gauge: null,
      rows: rows,
      meta: { tags: [], notes: '' }
    };
  }

  function repeat(ch, n) {
    var s = '';
    for (var i = 0; i < n; i++) s += ch;
    return s;
  }

  function validate(p) {
    if (!p || typeof p !== 'object') throw new Error('not a pattern object');
    if (p.format !== 'knit-studio/1') throw new Error('unsupported format: ' + p.format);
    var w = p.width | 0, h = p.height | 0;
    if (!(w > 0 && h > 0) || w > 4000 || h > 4000) throw new Error('bad dimensions');
    if (!Array.isArray(p.rows) || p.rows.length !== h) throw new Error('row count != height');
    for (var y = 0; y < h; y++) {
      var r = p.rows[y];
      if (typeof r !== 'string' || r.length !== w) throw new Error('row ' + y + ' width != ' + w);
      for (var i = 0; i < r.length; i++) {
        if (!(r[i] in CODES)) throw new Error('unknown cell code "' + r[i] + '" in row ' + y);
      }
    }
    if (p.colors !== undefined && !Array.isArray(p.colors)) delete p.colors;
    if (p.colors) p.colors = colorsOf(p);
    if (!p.meta || typeof p.meta !== 'object') p.meta = { tags: [], notes: '' };
    if (!Array.isArray(p.meta.tags)) p.meta.tags = [];
    return p;
  }

  function clone(p) { return JSON.parse(JSON.stringify(p)); }

  function getCell(p, y, x) {
    if (y < 0 || y >= p.height || x < 0 || x >= p.width) return null;
    return p.rows[y][x];
  }

  // Mutates rows immutably-by-copy (rows is array of strings).
  function setCell(p, y, x, code) {
    if (y < 0 || y >= p.height || x < 0 || x >= p.width) return p;
    if (!(code in CODES)) return p;
    var r = p.rows[y];
    if (r[x] === code) return p;
    p.rows[y] = r.substring(0, x) + code + r.substring(x + 1);
    return p;
  }

  /* ---------- transforms ---------- */

  // Nearest-neighbour resample. Used for pattern resize.
  function resample(p, nw, nh) {
    nw = Math.max(1, Math.round(nw));
    nh = Math.max(1, Math.round(nh));
    var rows = [];
    for (var y = 0; y < nh; y++) {
      var sy = Math.min(p.height - 1, Math.floor((y + 0.5) * p.height / nh));
      var src = p.rows[sy];
      var out = '';
      for (var x = 0; x < nw; x++) {
        var sx = Math.min(p.width - 1, Math.floor((x + 0.5) * p.width / nw));
        out += src[sx];
      }
      rows.push(out);
    }
    var q = clone(p);
    q.width = nw; q.height = nh; q.rows = rows;
    return q;
  }

  function resizedGauge(p, factor) {
    if (!p.gauge) return p;
    var q = clone(p);
    q.gauge = {
      stsPer10cm: Math.max(1, Math.round(p.gauge.stsPer10cm * factor)),
      rowsPer10cm: Math.max(1, Math.round(p.gauge.rowsPer10cm * factor))
    };
    return q;
  }

  function crop(p, x0, y0, w, h) {
    x0 = Math.max(0, x0 | 0); y0 = Math.max(0, y0 | 0);
    w = Math.min(p.width - x0, Math.max(1, w | 0));
    h = Math.min(p.height - y0, Math.max(1, h | 0));
    var rows = [];
    for (var y = 0; y < h; y++) rows.push(p.rows[y0 + y].substring(x0, x0 + w));
    var q = clone(p);
    q.width = w; q.height = h; q.rows = rows;
    return q;
  }

  function floodFill(p, y, x, code) {
    var target = getCell(p, y, x);
    if (target === null || target === code) return p;
    var rows = p.rows.slice();
    var stack = [[y, x]];
    while (stack.length) {
      var top = stack.pop(), yy = top[0], xx = top[1];
      if (yy < 0 || yy >= p.height || xx < 0 || xx >= p.width) continue;
      if (rows[yy][xx] !== target) continue;
      rows[yy] = rows[yy].substring(0, xx) + code + rows[yy].substring(xx + 1);
      stack.push([yy + 1, xx], [yy - 1, xx], [yy, xx + 1], [yy, xx - 1]);
    }
    p.rows = rows;
    return p;
  }

  /* ---------- raster import ----------
   * Input: luminance grid, length w*h, values 0 (black)..1 (white),
   * or null/NaN for transparent. Output: chart rows (two-color mode).
   * opts: { threshold=0.5, invert=false, dither=false }
   * Dark cells -> 'x' (needle off), light cells -> 'k' (knit): classic
   * two-color punchcard mapping. Invert swaps. */
  function imageToChart(lum, w, h, opts) {
    opts = opts || {};
    var thr = opts.threshold == null ? 0.5 : opts.threshold;
    var invert = !!opts.invert;
    var n = w * h;
    var g = new Float64Array(n);
    var empty = new Uint8Array(n);
    for (var i = 0; i < n; i++) {
      var v = lum[i];
      if (v === null || v === undefined || v !== v) { empty[i] = 1; g[i] = thr; }
      else g[i] = invert ? 1 - v : v;
    }
    if (opts.dither) {
      var wts = [[1, 0, 7 / 16], [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16]];
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var idx = y * w + x;
          if (empty[idx]) continue;
          var old = g[idx];
          var nv = old < thr ? 0 : 1;
          var err = old - nv;
          g[idx] = nv;
          for (var k = 0; k < wts.length; k++) {
            var dx = wts[k][0], dy = wts[k][1], f = wts[k][2];
            var nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= w || ny >= h) continue;
            var ni = ny * w + nx;
            if (empty[ni]) continue;
            g[ni] += err * f;
          }
        }
      }
    }
    var rows = [];
    for (var ry = 0; ry < h; ry++) {
      var row = '';
      for (var rx = 0; rx < w; rx++) {
        var ri = ry * w + rx;
        if (empty[ri]) row += '.';
        else row += g[ri] < 0.5 ? 'x' : 'k';
      }
      rows.push(row);
    }
    return { width: w, height: h, rows: rows };
  }

  // Rasterize an <img> (already loaded) into a luminance grid of wCells x hCells.
  // DOM-only. Returns { lum, w, h }.
  function sampleImage(img, wCells, hCells) {
    var cv = document.createElement('canvas');
    cv.width = wCells; cv.height = hCells;
    var ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, wCells, hCells);
    var d = ctx.getImageData(0, 0, wCells, hCells).data;
    var lum = new Array(wCells * hCells);
    for (var i = 0; i < lum.length; i++) {
      var a = d[i * 4 + 3];
      if (a < 16) { lum[i] = null; continue; }
      var r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2];
      // composite over white for partial alpha
      var aa = a / 255;
      r = r * aa + 255 * (1 - aa); gg = gg * aa + 255 * (1 - aa); b = b * aa + 255 * (1 - aa);
      lum[i] = (0.2126 * r + 0.7152 * gg + 0.0722 * b) / 255;
    }
    return { lum: lum, w: wCells, h: hCells };
  }

  // Load an image file (svg/png/jpeg/...) into an <img>. SVGs get
  // width/height patched from viewBox when absent so canvas scaling works.
  function loadImageFile(file) {
    return new Promise(function (resolve, reject) {
      var done = function (url) {
        var img = new Image();
        img.onload = function () { resolve(img); };
        img.onerror = function () { reject(new Error('could not decode image: ' + file.name)); };
        img.src = url;
      };
      if (/\.svg$/i.test(file.name) || file.type === 'image/svg+xml') {
        var fr = new FileReader();
        fr.onload = function () {
          var txt = String(fr.result);
          if (!/\swidth\s*=/.test(txt.match(/<svg[^>]*>/i) ? txt.match(/<svg[^>]*>/i)[0] : '')) {
            var vb = txt.match(/viewBox\s*=\s*["']\s*([\d.+-]+)[,\s]+([\d.+-]+)[,\s]+([\d.+-]+)[,\s]+([\d.+-]+)/i);
            if (vb) txt = txt.replace(/<svg/i, '<svg width="' + vb[3] + '" height="' + vb[4] + '"');
          }
          done(URL.createObjectURL(new Blob([txt], { type: 'image/svg+xml' })));
        };
        fr.onerror = function () { reject(new Error('could not read ' + file.name)); };
        fr.readAsText(file);
      } else {
        done(URL.createObjectURL(file));
      }
    });
  }

  /* ---------- legacy import: knitting-slicer output ----------
   * { bounds:[..], panels:[{ id, segments:{ "rowIdx": [start,end] } }] }
   * rows counted bottom-up, segments are stitch ranges [start,end).
   * Returns one pattern per panel. */
  function fromSlicer(data, baseName) {
    if (!data || !Array.isArray(data.panels) || !data.panels.length) {
      throw new Error('not a knitting-slicer project (no panels)');
    }
    var base = (baseName || 'sliced').replace(/\.svg$/i, '');
    return data.panels.map(function (panel, i) {
      var rowsIdx = Object.keys(panel.segments).map(Number).sort(function (a, b) { return a - b; });
      var maxRow = rowsIdx.length ? rowsIdx[rowsIdx.length - 1] : 0;
      var maxSt = 0;
      rowsIdx.forEach(function (r) {
        var seg = panel.segments[String(r)];
        if (seg[1] > maxSt) maxSt = seg[1];
      });
      var w = Math.max(1, maxSt), h = Math.max(1, maxRow + 1);
      var p = blank(base + '-p' + (i + 1), w, h);
      rowsIdx.forEach(function (r) {
        var seg = panel.segments[String(r)];
        var y = h - 1 - r; // slicer row 0 = bottom; rows[0] = top
        if (y < 0) return;
        var row = p.rows[y];
        for (var s = seg[0]; s < seg[1] && s < w; s++) {
          row = row.substring(0, s) + 'k' + row.substring(s + 1);
        }
        p.rows[y] = row;
      });
      p.meta.notes = 'imported from knitting-slicer panel ' + (panel.id != null ? panel.id : i + 1);
      return p;
    });
  }

  /* ---------- exports ---------- */

  // Run-length encoding of one row: "k10 x4 k6". Unworked cells ('.')
  // are skipped: instructions list only stitches you actually work;
  // wrap/hold marks show the chart's real turns.
  function rle(row) {
    var out = [], prev = null, n = 0;
    for (var i = 0; i <= row.length; i++) {
      var c = i < row.length ? row[i] : null;
      if (c === prev) { n++; continue; }
      if (prev !== null && prev !== '.') out.push(prev + n);
      prev = c; n = 1;
    }
    return out.join(' ');
  }

  // Per-row knitting instructions, bottom row = 1. Face rows odd.
  function toText(p) {
    var lines = [p.name + ' — ' + p.width + ' st x ' + p.height + ' rows'];
    if (p.gauge) lines.push('gauge: ' + p.gauge.stsPer10cm + ' sts x ' + p.gauge.rowsPer10cm + ' rows / 10cm');
    lines.push('');
    for (var r = 0; r < p.height; r++) {
      var y = p.height - 1 - r; // bottom-up
      var side = (r % 2 === 0) ? 'RS' : 'WS';
      var body = rle(p.rows[y]);
      lines.push('Row ' + (r + 1) + ' (' + side + '): ' +
        (body || 'not worked (short rows / held edge - see chart turns)'));
    }
    var uc = usedColorCodes(p);
    if (uc.length) {
      lines.push('', 'colors:');
      uc.forEach(function (code) {
        var col = colorAt(p, colorIndex(code));
        lines.push('  ' + col.name + ' = ' + col.hex + '   [code "' + code + '"]');
      });
    }
    return lines.join('\n');
  }

  // Printable SVG chart, rows top-down with edge row numbers.
  function toSvg(p, cell) {
    cell = cell || 20;
    var W = p.width * cell, H = p.height * cell, pad = 24;
    var uc = usedColorCodes(p);
    var legendH = uc.length ? 12 + Math.ceil(uc.length / 8) * 16 : 0;
    var s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + (W + pad * 2) +
      '" height="' + (H + pad * 2 + legendH) + '" viewBox="0 0 ' + (W + pad * 2) + ' ' + (H + pad * 2 + legendH) + '">\n';
    s += '<rect width="100%" height="100%" fill="white"/>\n';
    var g = ' transform="translate(' + pad + ',' + pad + ')"';
    s += '<g' + g + '>\n';
    for (var y = 0; y < p.height; y++) {
      for (var x = 0; x < p.width; x++) {
        s += cellSvg(p.rows[y][x], x * cell, y * cell, cell, p);
      }
    }
    for (var x2 = 0; x2 <= p.width; x2++) s += '<line x1="' + x2 * cell + '" y1="0" x2="' + x2 * cell + '" y2="' + H + '" stroke="#999" stroke-width="0.5"/>';
    for (var y2 = 0; y2 <= p.height; y2++) s += '<line x1="0" y1="' + y2 * cell + '" x2="' + W + '" y2="' + y2 * cell + '" stroke="#999" stroke-width="0.5"/>';
    for (var r = 1; r <= p.height; r++) {
      if (r % 5 && p.height > 10) continue; // small charts label every row
      var ty = (p.height - r) * cell + cell / 2;
      s += '<text x="-4" y="' + (ty + 4) + '" font-size="10" text-anchor="end" font-family="sans-serif">' + r + '</text>';
    }
    s += '</g>\n';
    if (uc.length) {
      s += '<g transform="translate(' + pad + ',' + (pad + H + 6) + ')" font-family="sans-serif" font-size="11">\n';
      var cx = 0, cy = 0;
      uc.forEach(function (code, i) {
        if (i && i % 8 === 0) { cx = 0; cy += 16; }
        var col = colorAt(p, colorIndex(code));
        s += '<rect x="' + cx + '" y="' + (cy + 2) + '" width="11" height="11" fill="' + col.hex + '" stroke="#333"/>' +
          '<text x="' + (cx + 15) + '" y="' + (cy + 11) + '">' + escapeXml(col.name) + ' ' + col.hex + '</text>';
        cx += 20 + 7 * col.name.length;
      });
      s += '</g>\n';
    }
    s += '</svg>\n';
    return s;
  }

  function cellSvg(code, px, py, c, p) {
    var m = c * 0.15, s = '';
    var ci = colorIndex(code);
    if (ci >= 0) {
      return '<rect x="' + (px + m) + '" y="' + (py + m) + '" width="' + (c - 2 * m) + '" height="' + (c - 2 * m) +
        '" fill="' + colorHex(p, ci) + '" stroke="#101010" stroke-width="0.5"/>';
    }
    switch (code) {
      case 'x': s += '<rect x="' + px + '" y="' + py + '" width="' + c + '" height="' + c + '" fill="#111"/>'; break;
      case 'h': s += '<rect x="' + (px + c * 0.3) + '" y="' + (py + c * 0.3) + '" width="' + (c * 0.4) + '" height="' + (c * 0.4) + '" fill="#111"/>'; break;
      case '<': s += '<line x1="' + (px + c) + '" y1="' + (py + c) + '" x2="' + (px + c * 0.15) + '" y2="' + (py + c * 0.15) + '" stroke="#111" stroke-width="2"/>'; break;
      case '>': s += '<line x1="' + px + '" y1="' + (py + c) + '" x2="' + (px + c * 0.85) + '" y2="' + (py + c * 0.15) + '" stroke="#111" stroke-width="2"/>'; break;
      case 'i': s += '<polygon points="' + (px + c / 2) + ',' + (py + m) + ' ' + (px + c - m) + ',' + (py + c - m) + ' ' + (px + m) + ',' + (py + c - m) + '" fill="#2aa198"/>'; break;
      case 'd': s += '<polygon points="' + (px + m) + ',' + (py + m) + ' ' + (px + c - m) + ',' + (py + m) + ' ' + (px + c / 2) + ',' + (py + c - m) + '" fill="#dc322f"/>'; break;
      case 't':
        s += '<line x1="' + (px + c * 0.18) + '" y1="' + (py + c - m) + '" x2="' + (px + c * 0.78) + '" y2="' + (py + m) + '" stroke="#8959a8" stroke-width="' + Math.max(1, c * 0.13) + '"/>';
        s += '<line x1="' + (px + c * 0.55) + '" y1="' + (py + c - m) + '" x2="' + (px + c * 0.72) + '" y2="' + (py + c * 0.55) + '" stroke="#8959a8" stroke-width="' + Math.max(1, c * 0.1) + '"/>';
        break;
    }
    return s;
  }

  function slug(name) {
    var s = String(name || 'pattern').toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 48);
    return s || 'pattern';
  }

  /* ---------- multi-panel projects ----------
   * knit-studio-project/1: a garment = named panels, each holding a full
   * knit-studio/1 chart (+ optional shaping model). Panel ids stay unique
   * and stable (p1, p2, ...) until removed. */
  var PANEL_ROLES = ['front', 'back', 'sleeve-left', 'sleeve-right', 'collar',
    'cuff', 'band', 'hood', 'pocket', 'placket', 'other'];

  function blankProject(name) {
    return {
      format: 'knit-studio-project/1',
      name: name || 'untitled project',
      gauge: null,
      panels: [],
      meta: { tags: [], notes: '' }
    };
  }

  function validatePanel(pn, where) {
    if (!pn || typeof pn !== 'object') throw new Error(where + ': not a panel');
    if (!pn.id || typeof pn.id !== 'string') throw new Error(where + ': missing id');
    pn.name = String(pn.name || pn.id);
    pn.role = PANEL_ROLES.indexOf(pn.role) >= 0 ? pn.role : 'other';
    if (pn.chart) validate(pn.chart);
    if (pn.shape != null && typeof pn.shape !== 'object') throw new Error(where + ': bad shape');
    if (pn.notes == null) pn.notes = '';
    return pn;
  }

  function validateProject(p) {
    if (!p || typeof p !== 'object') throw new Error('not a project object');
    if (p.format !== 'knit-studio-project/1') throw new Error('unsupported project format: ' + p.format);
    if (!Array.isArray(p.panels) || p.panels.length > 64) throw new Error('panels must be an array (max 64)');
    var seen = {};
    p.panels.forEach(function (pn, i) {
      validatePanel(pn, 'panel ' + i);
      if (seen[pn.id]) throw new Error('duplicate panel id: ' + pn.id);
      seen[pn.id] = 1;
    });
    if (!p.meta || typeof p.meta !== 'object') p.meta = { tags: [], notes: '' };
    if (!Array.isArray(p.meta.tags)) p.meta.tags = [];
    return p;
  }

  function nextPanelId(p) {
    var n = 1;
    while (p.panels.some(function (x) { return x.id === 'p' + n; })) n++;
    return 'p' + n;
  }

  // Add a panel from a validated chart (+ optional shaping model). Returns it.
  function addPanel(p, chart, name, role, shape) {
    validate(chart);
    var pn = {
      id: nextPanelId(p),
      name: name || (chart && chart.name) || ('Panel ' + (p.panels.length + 1)),
      role: PANEL_ROLES.indexOf(role) >= 0 ? role : 'other',
      chart: chart,
      shape: shape || null,
      notes: ''
    };
    p.panels.push(pn);
    return pn;
  }

  function getPanel(p, id) {
    for (var i = 0; i < p.panels.length; i++) if (p.panels[i].id === id) return p.panels[i];
    return null;
  }

  function removePanel(p, id) {
    var before = p.panels.length;
    p.panels = p.panels.filter(function (x) { return x.id !== id; });
    return p.panels.length < before;
  }

  // Write an edited chart back into its bound panel.
  function setPanelChart(p, id, chart) {
    var pn = getPanel(p, id);
    if (!pn) return null;
    validate(chart);
    pn.chart = chart;
    return pn;
  }

  // Stitch/row extents actually used, per panel and total width fit hint.
  function panelDims(pn) {
    if (!pn.chart) return { width: 0, height: 0 };
    return { width: pn.chart.width, height: pn.chart.height };
  }

  // Yarn length estimation. One knit stitch wraps roughly
  // BASE x (stitch width + row height) of yarn; BASE 1.45 calibrated so a
  // 10x10 cm stockinette swatch at 20 sts/26 rows lands near 6-7 m, which
  // matches a worsted gauge swatch weighed against its label's m/g.
  // Fabric multipliers are stockinette-relative and commonly quoted.
  var YARN_BASE = 1.45;
  var FABRICS = {
    stockinette: 1, garter: 1.55, rib: 1.25, seed: 1.2, lace: 0.95, cables: 1.3
  };
  function workedStitches(chart) {
    if (!chart || !Array.isArray(chart.rows)) return 0;
    var sts = 0;
    chart.rows.forEach(function (r) {
      var row;
      if (typeof r === 'string') row = r;
      else if (Array.isArray(r)) {
        row = r.map(function (c) {
          if (!c) return ' ';
          if (typeof c === 'string') return c;
          var sym = c.symbol || c.char || '';
          return sym ? sym.charAt(0) : ' ';
        }).join('');
      } else row = ' ';
      for (var i = 0; i < row.length; i++) {
        var ch = row.charAt(i);
        if (ch !== '.' && ch !== ' ' && ch !== '\u00b7' && ch !== '\u00a0') sts++;
      }
    });
    return sts;
  }
  // -> estimated meters | null when gauge or chart is missing
  function yarnMeters(chart, gauge, fabric) {
    if (!gauge || !(gauge.stsPer10cm > 0) || !(gauge.rowsPer10cm > 0) ||
      !chart || !Array.isArray(chart.rows) || !chart.rows.length) return null;
    var sts = workedStitches(chart);
    if (!sts) return null;
    var f = FABRICS[fabric] !== undefined ? FABRICS[fabric] : 1;
    var cmPerSt = YARN_BASE * (10 / gauge.stsPer10cm + 10 / gauge.rowsPer10cm) * f;
    return Math.round(sts * cmPerSt / 100);
  }
  // -> { panels: [{id, name, meters}], total: number|null, missingGauge: n }
  function projectYarn(p, fabric) {
    var res = { panels: [], total: 0, missingGauge: 0 };
    if (!p || !p.panels) return res;
    p.panels.forEach(function (pn) {
      var g = (pn.shape && pn.shape.gauge) || p.gauge || null;
      var m = yarnMeters(pn.chart, g, fabric);
      if (m === null) res.missingGauge++;
      else res.total += m;
      res.panels.push({ id: pn.id, name: pn.name, meters: m });
    });
    if (!res.total) res.total = null;
    return res;
  }

  // All-panel instruction text (chart rows + shaping notes).
  // shapingText defaults to KS.shaping.toText when loaded (browser global or test global).
  function projectToText(p, shapingText) {
    var st = shapingText;
    if (!st && typeof globalThis !== 'undefined' && globalThis.KS && globalThis.KS.shaping) st = globalThis.KS.shaping.toText;
    var lines = [p.name + ' \u2014 ' + p.panels.length + ' panel' + (p.panels.length === 1 ? '' : 's')];
    if (p.gauge) lines.push('gauge: ' + p.gauge.stsPer10cm + ' sts x ' + p.gauge.rowsPer10cm + ' rows / 10cm');
    if (p.meta && p.meta.notes) lines.push(p.meta.notes);
    p.panels.forEach(function (pn, i) {
      lines.push('', '===== PANEL ' + String.fromCharCode(65 + i) + ': ' + pn.name +
        (pn.role !== 'other' ? ' [' + pn.role + ']' : '') + ' =====');
      if (pn.notes) lines.push(pn.notes);
      if (pn.chart) {
        lines.push(toText(pn.chart));
        if (pn.shape && st) { lines.push(''); lines.push(st(pn.shape)); }
      } else lines.push('(no chart yet)');
    });
    var y = projectYarn(p, (p.meta && p.meta.fabric) || 'stockinette');
    if (y.total !== null) {
      lines.push('', 'yarn estimate: ~' + y.total + ' m (' +
        ((p.meta && p.meta.fabric) || 'stockinette') + '; rough, swatch and weigh to be sure)' +
        (y.missingGauge ? ' \u2014 ' + y.missingGauge + ' panel(s) without gauge skipped' : ''));
    }
    return lines.join('\n');
  }

  // Build a project straight from slicer output { bounds, panels:[{id,segments}] }.
  function projectFromSlicer(data, name) {
    var pats = fromSlicer(data, name || 'project');
    var proj = blankProject(name || 'sliced project');
    pats.forEach(function (pt, i) {
      proj.panels.push({
        id: nextPanelId(proj),
        name: 'Panel ' + String.fromCharCode(65 + i),
        role: 'other',
        chart: pt,
        shape: null,
        notes: 'sliced from SVG'
      });
    });
    return proj;
  }

  /* ---------- canvas rendering (browsers only) ---------- */

  function drawCell(ctx, code, px, py, size, p) {
    if (code === '.') return;
    var c = size, m = c * 0.15;
    var ci = colorIndex(code);
    if (ci >= 0) {
      ctx.save();
      ctx.fillStyle = colorHex(p, ci);
      ctx.fillRect(px + m, py + m, c - 2 * m, c - 2 * m);
      ctx.strokeStyle = '#101010';
      ctx.lineWidth = Math.max(0.5, c * 0.05);
      ctx.strokeRect(px + m, py + m, c - 2 * m, c - 2 * m);
      ctx.restore();
      return;
    }
    ctx.save();
    if (code === 'x') {
      ctx.fillStyle = '#101010';
      ctx.fillRect(px + 0.5, py + 0.5, c - 1, c - 1);
    } else if (code === 'h') {
      ctx.fillStyle = '#101010';
      ctx.fillRect(px + c * 0.3, py + c * 0.3, c * 0.4, c * 0.4);
    } else if (code === '<' || code === '>') {
      ctx.strokeStyle = code === '<' ? '#b58900' : '#cb4b16';
      ctx.lineWidth = Math.max(1, c * 0.12);
      ctx.beginPath();
      if (code === '<') { ctx.moveTo(px + c, py + c); ctx.lineTo(px + c * 0.1, py + c * 0.1); }
      else { ctx.moveTo(px, py + c); ctx.lineTo(px + c * 0.9, py + c * 0.1); }
      ctx.stroke();
    } else if (code === 'i') {
      ctx.fillStyle = '#2aa198';
      ctx.beginPath();
      ctx.moveTo(px + c / 2, py + m); ctx.lineTo(px + c - m, py + c - m); ctx.lineTo(px + m, py + c - m);
      ctx.closePath(); ctx.fill();
    } else if (code === 'd') {
      ctx.fillStyle = '#dc322f';
      ctx.beginPath();
      ctx.moveTo(px + m, py + m); ctx.lineTo(px + c - m, py + m); ctx.lineTo(px + c / 2, py + c - m);
      ctx.closePath(); ctx.fill();
    } else if (code === 't') {
      // k2tog: right-leaning decrease, two legs merging into one
      ctx.strokeStyle = '#8959a8';
      ctx.lineWidth = Math.max(1.5, c * 0.13);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px + c * 0.18, py + c - m); ctx.lineTo(px + c * 0.78, py + m);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, c * 0.1);
      ctx.beginPath();
      ctx.moveTo(px + c * 0.55, py + c - m); ctx.lineTo(px + c * 0.72, py + c * 0.55);
      ctx.stroke();
    } else { // 'k' knit: white cell, needle in working position
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px + 0.5, py + 0.5, c - 1, c - 1);
    }
    ctx.restore();
  }

  // view: { zoom, ox, oy, showGrid, showNumbers, w, h } -> draws pattern
  function renderChart(ctx, p, view) {
    var z = view.zoom, ox = view.ox, oy = view.oy;
    ctx.fillStyle = '#262626';
    ctx.fillRect(0, 0, view.w, view.h);
    var x0 = Math.max(0, Math.floor(-ox / z));
    var y0 = Math.max(0, Math.floor(-oy / z));
    var x1 = Math.min(p.width, Math.ceil((view.w - ox) / z));
    var y1 = Math.min(p.height, Math.ceil((view.h - oy) / z));
    if (x1 <= x0 || y1 <= y0) return;
    // background: empty area slightly lighter
    ctx.fillStyle = '#2e2e2e';
    ctx.fillRect(ox + x0 * z, oy + y0 * z, (x1 - x0) * z, (y1 - y0) * z);
    for (var y = y0; y < y1; y++) {
      var row = p.rows[y];
      for (var x = x0; x < x1; x++) {
        drawCell(ctx, row[x], Math.round(ox + x * z), Math.round(oy + y * z), Math.ceil(z), p);
      }
    }
    if (view.showGrid && z >= 6) {
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var gx = x0; gx <= x1; gx++) {
        if (gx % 10 === 0) continue;
        ctx.moveTo(ox + gx * z + 0.5, oy + y0 * z); ctx.lineTo(ox + gx * z + 0.5, oy + y1 * z);
      }
      for (var gy = y0; gy <= y1; gy++) {
        if (gy % 10 === 0) continue;
        ctx.moveTo(ox + x0 * z, oy + gy * z + 0.5); ctx.lineTo(ox + x1 * z, oy + gy * z + 0.5);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      for (var gx2 = x0; gx2 <= x1; gx2++) {
        if (gx2 % 10) continue;
        ctx.moveTo(ox + gx2 * z + 0.5, oy + y0 * z); ctx.lineTo(ox + gx2 * z + 0.5, oy + y1 * z);
      }
      for (var gy2 = y0; gy2 <= y1; gy2++) {
        if (gy2 % 10) continue;
        ctx.moveTo(ox + x0 * z, oy + gy2 * z + 0.5); ctx.lineTo(ox + x1 * z, oy + gy2 * z + 0.5);
      }
      ctx.stroke();
    }
    if (view.showNumbers && z >= 6) {
      ctx.font = '11px monospace';
      ctx.fillStyle = '#ccc';
      ctx.textBaseline = 'middle';
      for (var r = 1; r <= p.height; r++) {
        var py = oy + (p.height - r) * z;
        if (py + z / 2 < oy || py > oy + p.height * z) continue;
        if (py > view.h || py + z < 0) continue;
        if (r % 5 === 0) {
          ctx.fillStyle = r % 10 === 0 ? '#e0a040' : '#aaa';
          ctx.fillText(String(r), Math.min(view.w - 24, ox + p.width * z + 4), py + z / 2);
          if (ox > 14) { ctx.textAlign = 'right'; ctx.fillText(String(r), ox - 4, py + z / 2); ctx.textAlign = 'left'; }
        }
      }
      ctx.fillStyle = '#aaa';
      for (var c = 0; c < p.width; c += 10) {
        var px = ox + c * z + z * 5;
        if (px < 0 || px > view.w) continue;
        ctx.textAlign = 'center';
        ctx.fillText(String(c), px, Math.max(8, oy - 6));
        ctx.textAlign = 'left';
      }
    }
    // border
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.strokeRect(ox + 0.5, oy + 0.5, p.width * z, p.height * z);
  }

  function fitView(p, vw, vh, pad) {
    pad = pad == null ? 40 : pad;
    var z = Math.max(1, Math.floor(Math.min((vw - pad * 2) / p.width, (vh - pad * 2) / p.height)));
    return {
      zoom: z,
      ox: Math.round((vw - p.width * z) / 2),
      oy: Math.round((vh - p.height * z) / 2)
    };
  }

  return {
    CODES: CODES, PALETTE: PALETTE, FORMAT: 'knit-studio/1',
    blank: blank, validate: validate, clone: clone,
    getCell: getCell, setCell: setCell,
    resample: resample, resizedGauge: resizedGauge, crop: crop, floodFill: floodFill,
    imageToChart: imageToChart, sampleImage: sampleImage, loadImageFile: loadImageFile,
    fromSlicer: fromSlicer,
    PANEL_ROLES: PANEL_ROLES,
    blankProject: blankProject, validateProject: validateProject,
    addPanel: addPanel, getPanel: getPanel, removePanel: removePanel,
    setPanelChart: setPanelChart, panelDims: panelDims,
    projectToText: projectToText, projectFromSlicer: projectFromSlicer,
    yarnMeters: yarnMeters, projectYarn: projectYarn, workedStitches: workedStitches,
    YARN_BASE: YARN_BASE, FABRICS: FABRICS,
    colorIndex: colorIndex, colorsOf: colorsOf, colorAt: colorAt,
    colorHex: colorHex, usedColorCodes: usedColorCodes,
    COLOR_CODES: COLOR_CODES, COLOR_RAMP: COLOR_RAMP,
    rle: rle, toText: toText, toSvg: toSvg, slug: slug,
    drawCell: drawCell, renderChart: renderChart, fitView: fitView
  };
});
