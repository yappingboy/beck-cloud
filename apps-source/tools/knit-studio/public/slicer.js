/* knit-studio slicer: SVG garment outline -> stitch-row panels + karaoke
 * instructions. Pure port of the knitting-slicer service (shapely scanline
 * slicing) with no dependencies. UMD: window.KS.slicer in browsers,
 * module.exports in node. Only svgToShapes() touches the DOM. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.KS) root.KS.slicer = api;
  else root.KSslicer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var COLORS = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
    '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];

  /* ---------- gauge ---------- */

  // sts/rows given per 100mm or per inch -> per inch
  function gaugePerInch(stsPerUnit, rowsPerUnit, unit) {
    if (unit === 'inch') return { sts: stsPerUnit, rows: rowsPerUnit };
    return { sts: stsPerUnit * 25.4 / 100, rows: rowsPerUnit * 25.4 / 100 };
  }

  /* ---------- scanline slicing (port of main.py slice_to_panels) ----------
   * points: [[x,y], ...] outline in user units, y already UP, min at 0.
   * Returns { bounds:[minX,minY,maxX,maxY], panels:[{id, segments:{row:[s,e]}}] }
   * rows bottom-up; segments are stitch ranges [start,end). */
  function slicePolygon(points, stsPerInch, rowsPerInch, maxStitches) {
    if (!Array.isArray(points) || points.length < 3) throw new Error('need >= 3 outline points');
    var P = [], i;
    for (i = 0; i < points.length; i++) P.push([points[i][0] * stsPerInch, points[i][1] * rowsPerInch]);
    // close the ring
    var first = P[0], last = P[P.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) P.push([first[0], first[1]]);

    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (i = 0; i < P.length; i++) {
      if (P[i][0] < minX) minX = P[i][0];
      if (P[i][0] > maxX) maxX = P[i][0];
      if (P[i][1] < minY) minY = P[i][1];
      if (P[i][1] > maxY) maxY = P[i][1];
    }
    var startRow = Math.floor(minY), endRow = Math.ceil(maxY);

    function rowSegments(row) {
      var scanY = row + 0.5, xs = [], n = P.length;
      for (var e = 0; e < n; e++) {
        var a = P[e], b = P[(e + 1) % n];
        if ((a[1] <= scanY && b[1] > scanY) || (b[1] <= scanY && a[1] > scanY)) {
          var t = (scanY - a[1]) / (b[1] - a[1]);
          xs.push(a[0] + t * (b[0] - a[0]));
        }
      }
      xs.sort(function (p, q) { return p - q; });
      var segs = [];
      for (var k = 0; k + 1 < xs.length; k += 2) {
        var s0 = Math.round(xs[k]), s1 = Math.round(xs[k + 1]);
        if (s1 <= s0) continue;
        if (maxStitches) {
          for (var c = s0; c < s1; c += maxStitches) segs.push([c, Math.min(c + maxStitches, s1)]);
        } else segs.push([s0, s1]);
      }
      return segs;
    }

    var active = [], finished = [], counter = 0;
    for (var row = startRow; row < endRow; row++) {
      var segs2 = rowSegments(row);
      if (!segs2.length) {
        finished = finished.concat(active);
        active = [];
        continue;
      }
      var overlaps = [];
      for (var pi = 0; pi < active.length; pi++) {
        var p = active[pi];
        if (p.lastRow !== row - 1) continue;
        var ls = p.segments[p.lastRow];
        for (var si = 0; si < segs2.length; si++) {
          var ov = Math.max(0, Math.min(ls[1], segs2[si][1]) - Math.max(ls[0], segs2[si][0]));
          if (ov > 0) overlaps.push([ov, pi, si]);
        }
      }
      // python sorted tuple desc, reverse=True
      overlaps.sort(function (a, b) { return b[0] - a[0] || b[1] - a[1] || b[2] - a[2]; });
      var usedP = {}, usedS = {}, nextActive = [];
      for (var o = 0; o < overlaps.length; o++) {
        var opi = overlaps[o][1], osi = overlaps[o][2];
        if (!usedP[opi] && !usedS[osi]) {
          active[opi].segments[row] = [segs2[osi][0], segs2[osi][1]];
          active[opi].lastRow = row;
          nextActive.push(active[opi]);
          usedP[opi] = 1; usedS[osi] = 1;
        }
      }
      for (var s2 = 0; s2 < segs2.length; s2++) {
        if (!usedS[s2]) {
          var np = { id: counter++, segments: {}, lastRow: row };
          np.segments[row] = [segs2[s2][0], segs2[s2][1]];
          nextActive.push(np);
        }
      }
      for (var pa = 0; pa < active.length; pa++) {
        if (!usedP[pa]) finished.push(active[pa]);
      }
      active = nextActive;
    }
    finished = finished.concat(active);
    return {
      bounds: [minX, minY, maxX, maxY],
      panels: finished.filter(function (p) { return Object.keys(p.segments).length > 0; })
        .map(function (p) { return { id: p.id, segments: p.segments }; })
    };
  }

  /* ---------- instructions (port of S2S CAM tracker logic) ---------- */

  function instructionMap(panel) {
    var map = {};
    var rows = Object.keys(panel.segments).map(Number).sort(function (a, b) { return a - b; });
    if (!rows.length) return map;
    var prevStart = null, prevEnd = null;
    rows.forEach(function (r) {
      var seg = panel.segments[r], start = seg[0], end = seg[1];
      var total = end - start;
      if (prevStart === null) {
        map[r] = 'Cast on ' + total + ' sts.';
      } else {
        var sd = prevStart - start, ed = end - prevEnd, acts = [];
        if (sd > 0) acts.push('Inc ' + sd + ' at start');
        else if (sd < 0) acts.push('Dec ' + Math.abs(sd) + ' at start');
        if (ed > 0) acts.push('Inc ' + ed + ' at end');
        else if (ed < 0) acts.push('Dec ' + Math.abs(ed) + ' at end');
        if (!acts.length) acts.push('Work even');
        map[r] = acts.join(', ') + '. (Total: ' + total + ' sts)';
      }
      prevStart = start; prevEnd = end;
    });
    if (rows.length) {
      var last = rows[rows.length - 1];
      map[last] += ' -- Then Bind off remaining ' + (prevEnd - prevStart) + ' sts.';
    }
    return map;
  }

  function condensedGroups(panel) {
    var map = instructionMap(panel);
    var rows = Object.keys(panel.segments).map(Number).sort(function (a, b) { return a - b; });
    var groups = [], cur = null;
    rows.forEach(function (r, idx) {
      var action = map[r], rowNum = idx + 1;
      if (!cur) cur = { startNum: rowNum, endNum: rowNum, action: action, rowIndices: [idx] };
      else if (cur.action === action) { cur.endNum = rowNum; cur.rowIndices.push(idx); }
      else { groups.push(cur); cur = { startNum: rowNum, endNum: rowNum, action: action, rowIndices: [idx] }; }
    });
    if (cur) groups.push(cur);
    return groups;
  }

  function groupLine(g) {
    return (g.startNum === g.endNum ? 'Row ' + g.startNum + ': ' : 'Rows ' + g.startNum + '-' + g.endNum + ': ') + g.action;
  }

  // Full multi-panel instruction text, like the CAM tool's export.
  function instructionsText(data, title) {
    if (!data || !data.panels || !data.panels.length) throw new Error('no panels to export');
    var out = (title || 'KNIT-STUDIO') + ' INSTRUCTIONS\n============================\n\n';
    data.panels.forEach(function (p, i) {
      out += '--- Panel ' + String.fromCharCode(65 + i) + ' ---\n';
      condensedGroups(p).forEach(function (g) { out += groupLine(g) + '\n'; });
      out += '\n';
    });
    return out;
  }

  /* ---------- SVG -> outline points (browsers only) ----------
   * Samples every drawable geometry element to a point list in SVG user
   * units (mm for garment drafts), y flipped UP, origin normalized to the
   * shape's own min. defs/symbol/marker/pattern/clipPath/mask subtrees are
   * skipped so template art never becomes fabric. */
  function svgToShapes(svgText, resolution) {
    if (typeof document === 'undefined') throw new Error('svgToShapes needs a browser DOM');
    resolution = resolution || 200;
    var host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:-10000px;top:0;width:1000px;height:1000px;opacity:0;pointer-events:none;z-index:-1';
    host.innerHTML = svgText;
    document.body.appendChild(host);
    try {
      var svg = host.querySelector('svg');
      if (!svg) throw new Error('no <svg> element found');
      var SEL = 'defs,symbol,marker,pattern,clipPath,mask';
      var els = svg.querySelectorAll('path,rect,circle,ellipse,polygon,polyline,line');
      var shapes = [];
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.closest && el.closest(SEL)) continue;
        if (el.tagName === 'svg') continue;
        if (typeof el.getTotalLength !== 'function') continue;
        var total = 0;
        try { total = el.getTotalLength(); } catch (e) { continue; }
        if (!isFinite(total) || total <= 0) continue;
        var m = el.getCTM && el.getCTM();
        var pts = [], lastPt = null;
        for (var k = 0; k <= resolution; k++) {
          var pt;
          try { pt = el.getPointAtLength(total * k / resolution); } catch (e) { break; }
          var x = pt.x, y = pt.y;
          if (m && typeof DOMMatrix === 'function') {
            var q = new DOMPoint(x, y).matrixTransform(m);
            x = q.x; y = q.y;
          }
          if (lastPt && Math.abs(lastPt[0] - x) < 1e-9 && Math.abs(lastPt[1] - y) < 1e-9) continue;
          lastPt = [x, y];
          pts.push([x, -y]); // flip: SVG y-down -> math y-up
        }
        if (pts.length < 3) continue;
        var minX = Infinity, minY = Infinity;
        pts.forEach(function (p) { if (p[0] < minX) minX = p[0]; if (p[1] < minY) minY = p[1]; });
        pts = pts.map(function (p) { return [p[0] - minX, p[1] - minY]; });
        shapes.push({
          index: shapes.length,
          id: el.id || '',
          tag: el.tagName,
          points: pts
        });
      }
      if (!shapes.length) throw new Error('no drawable shapes found in SVG');
      return shapes;
    } finally {
      document.body.removeChild(host);
    }
  }

  return {
    COLORS: COLORS,
    gaugePerInch: gaugePerInch,
    slicePolygon: slicePolygon,
    instructionMap: instructionMap,
    condensedGroups: condensedGroups,
    groupLine: groupLine,
    instructionsText: instructionsText,
    svgToShapes: svgToShapes
  };
});
