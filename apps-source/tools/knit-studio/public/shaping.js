/* knit-studio shaping engine: parametric garment-edge shaping.
 * Model: base width + left/right edge segment lists (bottom-up):
 *   {kind:'straight', rows}
 *   {kind:'dec'|'inc', every, each, times, transfer}   (Japanese 段-目-回数 notation)
 * Events land on rows every, 2*every, ... times*every inside the segment.
 * DOM-free; UMD. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.KS) root.KS.shaping = api;
  else root.KSshaping = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function normSeg(s) {
    if (!s || typeof s !== 'object') throw new Error('bad segment');
    if (s.kind === 'straight') return { kind: 'straight', rows: Math.max(1, s.rows | 0) };
    if (s.kind === 'dec' || s.kind === 'inc') {
      return {
        kind: s.kind,
        every: clamp(s.every | 0, 1, 500),
        each: clamp(s.each | 0, 1, 100),
        times: clamp(s.times | 0, 1, 2000),
        transfer: !!s.transfer
      };
    }
    if (s.kind === 'sr') { // short rows: w&t this far before the edge, wedge closes by `turn` per event
      return {
        kind: 'sr',
        every: clamp(s.every | 0, 1, 500),
        turn: clamp(s.turn | 0, 1, 200),
        times: clamp(s.times | 0, 1, 2000)
      };
    }
    if (s.kind === 'hold') { // holding stitches: `each` sts off the edge stay unworked for `rows` rows
      return {
        kind: 'hold',
        each: clamp(s.each | 0, 1, 4000),
        rows: clamp(s.rows | 0, 1, 4000),
        release: !!s.release
      };
    }
    throw new Error('unknown segment kind: ' + s.kind);
  }

  function normalize(shape) {
    var le = (shape.edges && shape.edges.left || []).map(normSeg);
    var re = (shape.edges && shape.edges.right || []).map(normSeg);
    if (!le.length && !re.length) {
      le = [{ kind: 'straight', rows: 60 }];
      re = [{ kind: 'straight', rows: 60 }];
    } else if (!le.length) {
      le = [{ kind: 'straight', rows: Math.max(1, edgeRows(re)) }];
    } else if (!re.length) {
      re = [{ kind: 'straight', rows: Math.max(1, edgeRows(le)) }];
    }
    var out = {
      format: 'knit-studio-shape/1',
      name: shape.name || 'panel',
      width: clamp(shape.width | 0, 1, 4000),
      gauge: shape.gauge || null,
      mirror: !!shape.mirror,
      edges: { left: le, right: re }
    };
    return out;
  }

  function edgeRows(segs) {
    return segs.reduce(function (n, s) {
      if (s.kind === 'straight') return n + s.rows;
      if (s.kind === 'hold') return n + s.rows;
      return n + s.every * s.times;
    }, 0);
  }

  // Padding segments so both edges span the same row count (straight to top).
  function edgesPadded(shape) {
    var H = Math.max(edgeRows(shape.edges.left), edgeRows(shape.edges.right));
    return {
      H: H,
      left: padTo(shape.edges.left, H),
      right: padTo(shape.edges.right, H)
    };
  }

  function padTo(segs, H) {
    var out = segs.map(function (s) { return Object.assign({}, s); });
    var miss = H - edgeRows(out);
    if (miss > 0) out.push({ kind: 'straight', rows: miss });
    return out;
  }

  // Per-edge cumulative offsets, bottom-up rows 0..H-1.
  // Positive offset = edge pulled inward (fabric narrower on that side).
  function edgeProfile(segs, H) {
    var off = new Array(H);
    var acc = 0, row = 0; // 0-based cursor
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i];
      if (s.kind === 'straight') {
        for (var r = 0; r < s.rows && row < H; r++) off[row++] = acc;
      } else if (s.kind === 'hold') {
        var hs = s.each;
        acc += hs; // sts go on hold starting this row
        for (var hr = 0; hr < s.rows && row < H; hr++) off[row++] = acc;
        if (!s.release) acc -= hs; // released: following rows knit them again
      } else if (s.kind === 'sr') {
        // geometry of a wedge: the turn point recedes `turn` sts per event,
        // exactly like a decrease; only glyphs and text differ
        for (var sk = 0; sk < s.times; sk++) {
          for (var sq = 0; sq < s.every && row < H; sq++) {
            if (sq === s.every - 1) acc += s.turn;
            off[row++] = acc;
          }
        }
      } else {
        var d = (s.kind === 'dec' ? 1 : -1) * s.each;
        for (var k = 0; k < s.times; k++) {
          var run = s.every;
          for (var q = 0; q < run && row < H; q++) {
            if (q === run - 1) acc += d; // event lands on the last row of each repeat
            off[row++] = acc;
          }
        }
      }
    }
    while (row < H) off[row++] = acc;
    return off;
  }

  // {H, leftOff[], rightOff[], lo[row], hi[row]} relative to base width (may go negative).
  function profile(shape) {
    var p = edgesPadded(shape);
    var leftOff = edgeProfile(p.left, p.H);
    var rightOff = edgeProfile(p.right, p.H);
    var lo = [], hi = [];
    for (var r = 0; r < p.H; r++) { lo.push(leftOff[r]); hi.push(shape.width - rightOff[r]); }
    return { H: p.H, leftOff: leftOff, rightOff: rightOff, lo: lo, hi: hi, edges: p };
  }

  function check(shape) {
    var p = profile(shape);
    var errs = [];
    for (var r = 0; r < p.H; r++) {
      if (p.hi[r] - p.lo[r] < 1) { errs.push('fabric narrower than 1 stitch at row ' + (r + 1)); break; }
    }
    return errs;
  }

  // Grid extents so every row fits: minX = leftmost edge ever reached.
  function extents(shape) {
    var p = profile(shape);
    var minX = 0, maxW = 0;
    for (var r = 0; r < p.H; r++) {
      minX = Math.min(minX, p.lo[r]);
      maxW = Math.max(maxW, p.hi[r] - p.lo[r]);
    }
    return { H: p.H, minX: minX, gridW: maxW, prof: p };
  }

  // Shaping events per edge: {row (1-based), dir:1 dec/-1 inc, each, transfer}
  function events(segs) {
    var out = [], row = 0;
    segs.forEach(function (s) {
      if (s.kind === 'straight' || s.kind === 'hold') { row += s.rows; return; }
      if (s.kind === 'sr') { row += s.every * s.times; return; } // wedge marks drawn separately
      for (var k = 0; k < s.times; k++) {
        row += s.every - 1;
        out.push({ row: row + 1, dir: s.kind === 'dec' ? 1 : -1, each: s.each, transfer: !!s.transfer });
        row += 1;
      }
    });
    return out;
  }

  /* ---- chart generation ----
   * fabric = 'k'; decrease rows mark the vanished needle just outside the
   * fabric with 'd' (or transfer glyph); increase rows mark the new needle
   * at the outermost fabric cell with 'i'. Editable afterwards. */
  function toPattern(shape, name) {
    var e = extents(shape);
    var p = e.prof;
    var evL = events(p.edges.left), evR = events(p.edges.right);
    var rows = [];
    for (var r = p.H - 1; r >= 0; r--) { // rows[0] is top
      var row = '';
      for (var x = 0; x < e.gridW; x++) {
        var gx = x + e.minX;
        row += (gx >= p.lo[r] && gx < p.hi[r]) ? 'k' : '.';
      }
      rows.push(row);
    }
    function mark(rowIdx, x, code) { // rowIdx 0-based from bottom
      var y = p.H - 1 - rowIdx;
      if (y < 0 || y >= p.H) return;
      if (x < 0 || x >= e.gridW) return;
      var rr = rows[y];
      rows[y] = rr.substring(0, x) + code + rr.substring(x + 1);
    }
    function apply(ev, side) {
      ev.forEach(function (ev) {
        var r = ev.row - 1;
        var prev = r > 0 ? (side === 'left' ? p.lo[r - 1] : p.hi[r - 1]) : (side === 'left' ? 0 : p.hi[0]);
        var cur = side === 'left' ? p.lo[r] : p.hi[r];
        if (ev.dir === 1) { // decrease: mark vanished needle(s) just outside new edge
          for (var m = 0; m < ev.each; m++) {
            var gx = side === 'left' ? (prev + m) : (prev - 1 - m);
            mark(r, gx - e.minX, ev.transfer ? (side === 'left' ? '>' : '<') : 'd');
          }
        } else { // increase: mark new needle(s) at outermost fabric cell
          for (var n = 0; n < ev.each; n++) {
            var gx2 = side === 'left' ? (cur + n) : (cur - 1 - n);
            mark(r, gx2 - e.minX, 'i');
          }
        }
      });
    }
    apply(evL, 'left');
    apply(evR, 'right');
    // short-row and holding marks: 'h' on live-but-unworked needles
    function marksFor(segs, side) {
      var row = 0;
      segs.forEach(function (s) {
        if (s.kind === 'sr') {
          for (var k = 0; k < s.times; k++) {
            var er = row + s.every * k + (s.every - 1);
            if (er >= p.H) break;
            mark(er, (side === 'left' ? p.lo[er] - 1 : p.hi[er]) - e.minX, 'h'); // the wrap
            for (var t = 1; t < s.turn; t++) { // held loops just past the turn
              var gx = side === 'left' ? (p.lo[er] - 1 - t) : (p.hi[er] + t);
              mark(er, gx - e.minX, 'h');
            }
          }
          row += s.every * s.times;
        } else if (s.kind === 'hold') {
          for (var r = row; r < row + s.rows && r < p.H; r++) {
            for (var q = 0; q < s.each; q++) {
              var gx2 = side === 'left' ? (p.lo[r] - 1 - q) : (p.hi[r] + q);
              mark(r, gx2 - e.minX, 'h');
            }
          }
          row += s.rows;
        } else if (s.kind === 'straight') { row += s.rows; }
        else { row += s.every * s.times; }
      });
    }
    marksFor(p.edges.left, 'left');
    marksFor(p.edges.right, 'right');
    var pat = {
      format: 'knit-studio/1',
      name: name || (shape.name || 'panel'),
      width: e.gridW, height: p.H,
      gauge: shape.gauge || null,
      rows: rows,
      meta: { tags: ['shaping'], notes: 'generated from shaping designer', shape: JSON.parse(JSON.stringify(shape)) }
    };
    return pat;
  }

  /* ---- derivation: drawn edge -> segments ----
   * Input: per-row cumulative offsets (bottom-up). Output: straight +
   * every/each/times triplets. Convention: a shaped segment's events land
   * on rows every, 2*every, ... so derivation pulls every-1 plain rows from
   * the preceding straight run to align the grid. Single events become
   * every=(plain rows before)+1, times=1. */
  function segmentsFromOffsets(off, deltaCap) {
    var H = off.length, cap = deltaCap || 8;
    var deltas = [];
    for (var r = 0; r < H; r++) deltas.push((off[r] || 0) - (r > 0 ? (off[r - 1] || 0) : 0));
    var segs = [], i = 0;
    function pushStraight(n) {
      if (n <= 0) return;
      var last = segs[segs.length - 1];
      if (last && last.kind === 'straight') last.rows += n;
      else segs.push({ kind: 'straight', rows: n });
    }
    function popStraight(n) { // pull n rows off the tail straight run
      while (n > 0) {
        var last = segs[segs.length - 1];
        if (!last || last.kind !== 'straight') return false;
        var take = Math.min(n, last.rows);
        last.rows -= take; n -= take;
        if (last.rows === 0) segs.pop();
      }
      return true;
    }
    function zerosBefore(idx) {
      var n = 0;
      while (idx - 1 - n >= 0 && deltas[idx - 1 - n] === 0) n++;
      return n;
    }
    function single(e0, d) {
      var every = Math.min(999, zerosBefore(e0) + 1);
      popStraight(every - 1);
      segs.push({ kind: d > 0 ? 'dec' : 'inc', every: every, each: Math.abs(d), times: 1, transfer: false });
    }
    while (i < H) {
      var d = deltas[i];
      if (d === 0 || Math.abs(d) > cap) { pushStraight(1); i++; continue; }
      // group equal-delta events at equal spacing (spacing 2..12)
      var evs = [i], p = 0, j = i + 1;
      while (j < H) {
        if (deltas[j] === 0) { j++; continue; }
        var sp = j - evs[evs.length - 1];
        if (deltas[j] !== d || sp < 2 || sp > 12 || (p && sp !== p)) break;
        p = sp; evs.push(j); j++;
      }
      if (evs.length >= 2 && p >= 2) {
        var need = p - 1, have = zerosBefore(evs[0]);
        if (have >= need && popStraight(need)) {
          segs.push({ kind: d > 0 ? 'dec' : 'inc', every: p, each: Math.abs(d), times: evs.length, transfer: false });
          i = evs[evs.length - 1] + 1;
          continue;
        }
      }
      single(evs[0], d);
      i = evs[0] + 1;
    }
    return segs;
  }

  function toText(shape) {
    var p = profile(shape);
    var lines = [(shape.name || 'panel') + ' — ' + shape.width + ' st base, ' + p.H + ' rows'];
    if (shape.gauge) lines.push('gauge: ' + shape.gauge.stsPer10cm + ' sts x ' + shape.gauge.rowsPer10cm + ' rows / 10cm');
    ['left', 'right'].forEach(function (side) {
      lines.push('', side.toUpperCase() + ' edge:');
      var found = false;
      p.edges[side].forEach(function (s) {
        if (s.kind === 'straight') lines.push('  work ' + s.rows + ' rows even');
        else if (s.kind === 'sr') {
          found = true;
          lines.push('  every ' + s.every + 'th row w&t ' + s.turn + ' st before this edge x ' + s.times +
            '   [short rows]');
        } else if (s.kind === 'hold') {
          found = true;
          lines.push('  place ' + s.each + ' st on holder at this edge, hold ' + s.rows + ' rows, then ' +
            (s.release ? 'bind off' : 'take back') + '   [holding]');
        }
        else {
          found = true;
          lines.push('  every ' + s.every + 'th row ' + (s.kind === 'dec' ? 'dec' : 'inc') +
            ' ' + s.each + ' st' + (s.transfer ? ' (transfer)' : '') + ' x ' + s.times +
            '   [' + s.every + '-' + s.each + '-' + s.times + ']');
        }
      });
      if (!found) lines.push('  (even all rows)');
    });
    lines.push('', 'top width: ' + (p.hi[p.H - 1] - p.lo[p.H - 1]) + ' st');
    return lines.join('\n');
  }

  function outlinePoints(shape) {
    // outline polygon in cell units, (x,row) points bottom-up then top across
    var e = extents(shape), p = e.prof;
    var left = [], right = [];
    for (var r = 0; r < p.H; r++) {
      left.push([p.lo[r] - e.minX, r]);
      right.push([p.hi[r] - e.minX, r]);
    }
    return { left: left, right: right, gridW: e.gridW, H: p.H, minX: e.minX, width: shape.width };
  }

  /* ---- presets: sock/3D pieces built from short rows + holding ---- */
  // Dutch heel over half the leg stitches: straight flap, wedge turn at both
  // edges (w&t 1 st earlier every 2 rows), 2 rows left live for gusset pickup.
  function sockHeel(W) {
    var w = Math.max(8, W | 0), t = Math.max(1, Math.floor(w / 4));
    function edge() {
      return [
        { kind: 'straight', rows: w },
        { kind: 'sr', every: 2, turn: 1, times: t },
        { kind: 'straight', rows: 2 }
      ];
    }
    return { name: 'sock heel', width: w, mirror: false, gauge: null, edges: { left: edge(), right: edge() } };
  }
  // Short-row toe: wedge both edges to a ~half-width grafting point.
  function sockToe(W) {
    var w = Math.max(12, W | 0), t = Math.max(1, Math.floor(w / 4));
    var edge = [{ kind: 'sr', every: 2, turn: 1, times: t }];
    return { name: 'sock toe', width: w, mirror: false, gauge: null, edges: { left: edge, right: edge } };
  }
  // Short-row shoulder slope at the neck edge (mirror for both shoulders).
  function shoulderSlope(W) {
    var w = Math.max(16, W | 0);
    var turn = Math.max(2, Math.floor(w / 12)), times = Math.max(1, Math.floor(w / 8));
    return {
      name: 'shoulder slope', width: w, mirror: false, gauge: null,
      edges: {
        left: [{ kind: 'straight', rows: 2 }],
        right: [
          { kind: 'straight', rows: 2 },
          { kind: 'sr', every: 2, turn: turn, times: times }
        ]
      }
    };
  }
  // Ear flap / mug style wedge: one edge short-rows into a rounded point.
  function earFlap(W) {
    var w = Math.max(10, W | 0), t = Math.max(1, Math.floor(w / 2));
    return {
      name: 'ear flap', width: w, mirror: false, gauge: null,
      edges: {
        left: [{ kind: 'straight', rows: 2 + 2 * t }],
        right: [
          { kind: 'straight', rows: 2 },
          { kind: 'sr', every: 2, turn: 1, times: t }
        ]
      }
    };
  }

  return {
    normalize: normalize, normSeg: normSeg, edgeRows: edgeRows,
    profile: profile, check: check, extents: extents, events: events,
    toPattern: toPattern, segmentsFromOffsets: segmentsFromOffsets,
    toText: toText, outlinePoints: outlinePoints,
    sockHeel: sockHeel, sockToe: sockToe, shoulderSlope: shoulderSlope, earFlap: earFlap
  };
});
