/* knit-studio garment templates (pure): dims in cm -> project panel shapes.
 * UMD: window.KS.templates (browser) or require() (node selftests).
 * Each template: id, name, icon, blurb, fields[], build(dims, gauge).
 * build() returns { panels: [{name, role, shape, notes[]}], notes: [] }.
 * Shapes use only verified segment kinds (straight/dec/inc/sr/hold);
 * results are starting points to tune in the Projects/Shaping tabs. */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else { root.KS = root.KS || {}; root.KS.templates = mod; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function maker(gauge) {
    var sts10 = clamp(gauge.stsPer10cm, 1, 200);
    var rows10 = clamp(gauge.rowsPer10cm, 1, 200);
    return {
      sts: function (cm) { return Math.max(8, Math.min(3900, Math.round(cm / 10 * sts10))); },
      rows: function (cm) { return Math.max(4, Math.min(3900, Math.round(cm / 10 * rows10))); }
    };
  }
  function st(rows) { return { kind: 'straight', rows: rows }; }
  function dec(every, each, times) { return { kind: 'dec', every: Math.max(1, every | 0), each: Math.max(1, each | 0), times: Math.max(1, times | 0) }; }
  function inc(every, each, times) { return { kind: 'inc', every: Math.max(1, every | 0), each: Math.max(1, each | 0), times: Math.max(1, times | 0) }; }
  function hold(each, rows, release) { return { kind: 'hold', each: Math.max(1, each | 0), rows: Math.max(1, rows | 0), release: !!release }; }
  function sr(every, turn, times) { return { kind: 'sr', every: Math.max(1, every | 0), turn: Math.max(1, turn | 0), times: Math.max(1, times | 0) }; }
  function edge() { return Array.prototype.slice.call(arguments); }

  var TEMPLATES = [
    {
      id: 'socks', name: 'Socks (cuff-down)', icon: '🧦',
      blurb: 'Top-down side-seam socks: instep + sole panels per sock. Heel tapers in, works a flap, tapers back out; rounded toe. Seams stay on the sides.',
      fields: [
        { key: 'footCirc', label: 'Foot circumference', def: 22, min: 12, max: 40 },
        { key: 'footLen', label: 'Foot length (heel to toe)', def: 24, min: 12, max: 35 },
        { key: 'legLen', label: 'Leg length (ankle to top)', def: 18, min: 5, max: 45 }
      ],
      build: function (d, g) {
        var m = maker(g);
        var halfW = Math.max(14, Math.round(m.sts(d.footCirc) / 2));
        var legRows = m.rows(d.legLen);
        var footRows = m.rows(d.footLen);
        var legStraight = Math.max(2, legRows - 4);
        var cupEach = Math.max(1, Math.floor(halfW / 8));
        var cupTimes = 2;
        var cupEvery = 2;
        var flapRows = Math.max(6, m.rows(5));
        var gusEvery = 3;
        var toeEv = Math.max(2, Math.min(Math.floor((halfW - 8) / 2), Math.round(footRows * 0.18)));
        var footStraight = Math.max(2, footRows - flapRows - gusEvery * cupTimes - toeEv * 2 - 2);
        var totalRows = 4 + legStraight + cupEvery * cupTimes + flapRows +
          gusEvery * cupTimes + footStraight + toeEv * 2 + 2;
        var soleEdge = function () {
          return edge(
            st(4 + legStraight),
            dec(cupEvery, cupEach, cupTimes),
            st(flapRows),
            inc(gusEvery, cupEach, cupTimes),
            st(footStraight),
            dec(2, 1, toeEv),
            st(2)
          );
        };
        var instepEdge = function () {
          return edge(
            st(totalRows - 2 - toeEv * 2),
            dec(2, 1, toeEv),
            st(2)
          );
        };
        var sole = {
          name: 'sole', width: halfW, gauge: g, mirror: true,
          edges: { left: soleEdge(), right: soleEdge() },
          annotations: [
            { row: 5, off: 0, text: 'cuff: rib; work instep panel alongside to matching row count' },
            { row: 5 + legStraight, off: cupEach, text: 'heel cup: decrease at both edges to half width' },
            { row: 5 + legStraight + cupEvery * cupTimes + flapRows, off: 0, text: 'gusset: even increases back to foot width' },
            { row: totalRows - toeEv * 2, off: 0, text: 'round toe: dec every other row, leave live sts' }
          ]
        };
        var instep = {
          name: 'instep', width: halfW, gauge: g, mirror: true,
          edges: { left: instepEdge(), right: instepEdge() },
          annotations: [
            { row: 5, off: 0, text: 'straight panel, no heel shaping here' },
            { row: totalRows - toeEv * 2, off: 0, text: 'round toe in sync with sole panel' }
          ]
        };
        return {
          panels: [
            { name: 'Sock L instep', role: 'other', shape: instep },
            { name: 'Sock L sole', role: 'other', shape: sole },
            { name: 'Sock R instep', role: 'other', shape: JSON.parse(JSON.stringify(instep)) },
            { name: 'Sock R sole', role: 'other', shape: JSON.parse(JSON.stringify(sole)) }
          ],
          notes: [
            'Side-seam construction: sew instep to sole along BOTH long edges, then graft or seam the live toe sts. Seams run up the sides, never over the foot.',
            'Heel lives in the sole panel only: taper in, straight flap, taper back out.'
          ]
        };
      }
    },
    {
      id: 'sweater', name: 'Sweater (drop shoulder)', icon: '🧥',
      blurb: 'Pullover in pieces: straight back and front to bust line, short-row shoulders, straight sleeves with cap, collar band. Body shapes at the waistline stay straight in v1 — widen tapers in Shaping.',
      fields: [
        { key: 'chest', label: 'Bust / chest circumference', def: 96, min: 60, max: 180 },
        { key: 'bodyLen', label: 'Body length (underarm to shoulder)', def: 42, min: 20, max: 70 },
        { key: 'sleeveLen', label: 'Sleeve length (underarm to cuff)', def: 45, min: 15, max: 75 },
        { key: 'armCirc', label: 'Upper arm circumference', def: 32, min: 18, max: 60 },
        { key: 'wristCirc', label: 'Wrist circumference', def: 18, min: 12, max: 35 },
        { key: 'ease', label: 'Positive ease (+cm)', def: 6, min: -5, max: 30 }
      ],
      build: function (d, g) {
        var m = maker(g);
        var bodySts = m.sts(d.chest + d.ease);
        var half = Math.max(12, Math.round(bodySts / 2));
        var bodyRows = m.rows(d.bodyLen);
        var slopeTurn = Math.max(2, Math.floor(half / 24));
        var slope = function () { return sr(2, slopeTurn, 2); };
        var backShape = {
          name: 'back', width: half, gauge: g, mirror: false,
          edges: {
            left: edge(st(4), st(bodyRows - 6), slope()),
            right: edge(st(4), st(bodyRows - 6), slope())
          },
          annotations: [
            { row: 5, off: 0, text: 'rib band: work 2x2 rib (edit cells)' },
            { row: bodyRows - 5, off: 0, text: 'shoulder: short-row slope, hold live or BO' }
          ]
        };
        var frontShape = {
          name: 'front', width: half, gauge: g, mirror: false,
          edges: {
            left: edge(st(4), st(bodyRows - 6), slope()),
            right: edge(st(4), st(bodyRows - 6), slope())
          },
          annotations: [
            { row: bodyRows - Math.max(6, Math.round(bodyRows * 0.18)), off: Math.round(half / 2), text: 'neck: shape or pick up here' }
          ]
        };
        var armSts = m.sts(d.armCirc + 4);
        var wristSts = m.sts(d.wristCirc + 2);
        var sleeveRows = m.rows(d.sleeveLen);
        var taper = armSts - wristSts;
        var taperEach = taper > 12 ? 2 : 1;
        var taperTimes = Math.max(1, Math.ceil(Math.round(taper / 2) / taperEach));
        var taperEvery = Math.max(2, Math.round(sleeveRows * 0.6 / taperTimes));
        var widthAtCap = Math.max(wristSts, wristSts + 2 * taperEach * taperTimes);
        var capEach = Math.max(1, Math.floor((widthAtCap - 10) / 6)); // 6 events total -> leave >=10 sts
        var cap = function () { return dec(2, capEach, 3); };
        var sleeveEdge = function () {
          return edge(
            st(Math.max(4, Math.round(sleeveRows * 0.12))),       // cuff rib
            inc(taperEvery, taperEach, taperTimes),
            st(Math.max(2, sleeveRows - Math.round(sleeveRows * 0.12) - taperEvery * taperTimes - 10)),
            cap()
          );
        };
        var sleeveL = { name: 'sleeve L', width: Math.max(10, wristSts), gauge: g, mirror: false, edges: { left: sleeveEdge(), right: sleeveEdge() }, annotations: [{ row: 3, off: 0, text: 'base = wrist sts; taper widens to upper arm' }] };
        var collarSts = Math.max(16, m.sts((d.chest + d.ease) * 0.21));
        var collar = { name: 'collar band', width: collarSts, gauge: g, mirror: false, edges: { left: edge(st(m.rows(3))), right: edge(st(m.rows(3))) }, annotations: [{ row: 2, off: 0, text: 'work in rib, 3 cm deep' }] };
        var sl = JSON.parse(JSON.stringify(sleeveL)); sl.name = 'sleeve L';
        var srr = JSON.parse(JSON.stringify(sleeveL)); srr.name = 'sleeve R';
        return {
          panels: [
            { name: 'Back', role: 'back', shape: backShape },
            { name: 'Front', role: 'front', shape: frontShape },
            { name: 'Sleeve L', role: 'sleeve-left', shape: sl },
            { name: 'Sleeve R', role: 'sleeve-right', shape: srr },
            { name: 'Collar', role: 'collar', shape: collar }
          ],
          notes: ['Seamed pullover; swatch gauge before cutting yarn.']
        };
      }
    },
    {
      id: 'cardigan', name: 'Cardigan', icon: '🧶',
      blurb: 'Open front: two fronts, back, straight sleeves with cap, button bands. V1 fronts are straight; add waist shaping in Shaping.',
      fields: [
        { key: 'chest', label: 'Bust / chest circumference', def: 96, min: 60, max: 180 },
        { key: 'bodyLen', label: 'Body length', def: 52, min: 25, max: 90 },
        { key: 'sleeveLen', label: 'Sleeve length', def: 45, min: 15, max: 75 },
        { key: 'armCirc', label: 'Upper arm circumference', def: 32, min: 18, max: 60 },
        { key: 'wristCirc', label: 'Wrist circumference', def: 18, min: 12, max: 35 },
        { key: 'ease', label: 'Positive ease (+cm)', def: 8, min: -5, max: 30 }
      ],
      build: function (d, g) {
        var m = maker(g);
        var bodySts = m.sts(d.chest + d.ease);
        var frontW = Math.max(10, Math.round(bodySts / 4));
        var bodyRows = m.rows(d.bodyLen);
        var slopeTurn = Math.max(2, Math.floor(frontW / 20));
        var front = function (side) {
          var left = edge(st(6), st(bodyRows - 8));                        // button band edge: straight
          var right = edge(st(6), st(bodyRows - 8), sr(2, slopeTurn, 2));  // shoulder slope
          return side === 'R' ? { left: right, right: left } : { left: left, right: right };
        };
        var f1 = { name: 'front L', width: frontW, gauge: g, mirror: false, edges: front('L'), annotations: [{ row: 3, off: 0, text: 'inner edge = button band' }] };
        var f2 = { name: 'front R', width: frontW, gauge: g, mirror: false, edges: front('R') };
        var backShape = { name: 'back', width: Math.max(12, Math.round(bodySts / 2)), gauge: g, mirror: false, edges: { left: edge(st(6), st(bodyRows - 6)), right: edge(st(6), st(bodyRows - 6)) } };
        var armSts = m.sts(d.armCirc + 4);
        var wristSts = m.sts(d.wristCirc + 2);
        var sleeveRows = m.rows(d.sleeveLen);
        var taper = armSts - wristSts;
        var taperEach = taper > 12 ? 2 : 1;
        var taperTimes = Math.max(1, Math.ceil(Math.round(taper / 2) / taperEach));
        var taperEvery = Math.max(2, Math.round(sleeveRows * 0.6 / taperTimes));
        var widthAtCap = Math.max(wristSts, wristSts + 2 * taperEach * taperTimes);
        var capEach = Math.max(1, Math.floor((widthAtCap - 10) / 6)); // 6 events total -> leave >=10 sts
        var sEdge = function () {
          return edge(
            st(Math.max(4, Math.round(sleeveRows * 0.12))),
            inc(taperEvery, taperEach, taperTimes),
            st(Math.max(2, sleeveRows - Math.round(sleeveRows * 0.12) - taperEvery * taperTimes - 12)),
            dec(2, capEach, 3)
          );
        };
        var sl = { name: 'sleeve L', width: Math.max(10, wristSts), gauge: g, mirror: false, edges: { left: sEdge(), right: sEdge() } };
        var bandW = Math.max(6, m.sts(2.5));
        var band = { name: 'button band', width: bandW, gauge: g, mirror: false, edges: { left: edge(st(bodyRows)), right: edge(st(bodyRows)) }, annotations: [{ row: 2, off: 0, text: 'two bands, one per front edge' }] };
        var sl2 = JSON.parse(JSON.stringify(sl)); sl2.name = 'sleeve R';
        return {
          panels: [
            { name: 'Front L', role: 'front', shape: f1 },
            { name: 'Front R', role: 'front', shape: f2 },
            { name: 'Back', role: 'back', shape: backShape },
            { name: 'Sleeve L', role: 'sleeve-left', shape: sl },
            { name: 'Sleeve R', role: 'sleeve-right', shape: sl2 },
            { name: 'Bands', role: 'band', shape: band }
          ],
          notes: ['Mark buttonholes on the chart while you tune.']
        };
      }
    },
    {
      id: 'tshirt', name: 'T-Shirt', icon: '👕',
      blurb: 'Classic Tee: straight body, short sleeves with caps, shoulder seams. Pick a collar - crew, scoop, V-neck, polo, or henley - panel set, neckbands and plackets adapt.',
      fields: [
        { key: 'chest', label: 'Bust / chest circumference', def: 96, min: 60, max: 180 },
        { key: 'bodyLen', label: 'Body length (shoulder to hem)', def: 64, min: 35, max: 95 },
        { key: 'sleeveLen', label: 'Sleeve length', def: 20, min: 8, max: 45 },
        { key: 'armCirc', label: 'Upper arm circumference', def: 32, min: 18, max: 60 },
        { key: 'cuffCirc', label: 'Sleeve cuff circumference', def: 28, min: 14, max: 45 },
        { key: 'ease', label: 'Positive ease (+cm)', def: 4, min: -4, max: 20 },
        { key: 'collar', label: 'Collar', type: 'select', def: 'crew', options: ['crew', 'scoop', 'v-neck', 'polo', 'henley'] }
      ],
      build: function (d, g) {
        var m = maker(g);
        var bodySts = m.sts(d.chest + d.ease);
        var half = Math.max(12, Math.round(bodySts / 2));
        var bodyRows = m.rows(d.bodyLen);
        var slopeTurn = Math.max(2, Math.floor(half / 24));
        var slope = function () { return sr(2, slopeTurn, 2); };
        var neckCm = { crew: 9, scoop: 15, 'v-neck': 0, polo: 16, henley: 14 }[d.collar] || 9;
        var neckRow = Math.max(2, bodyRows - Math.max(2, m.rows(neckCm)));
        var hemAnn = { row: 2, off: 0, text: 'hem band: 2x2 rib, 2-3 cm' };
        var backShape = {
          name: 'back', width: half, gauge: g, mirror: false,
          edges: {
            left: edge(st(8), st(bodyRows - 10), slope()),
            right: edge(st(8), st(bodyRows - 10), slope())
          },
          annotations: [hemAnn, { row: neckRow, off: Math.round(half / 2), text: 'back neck: ' + (d.collar === 'v-neck' ? 'shallow curve, bind off or hold' : d.collar + ' depth ~' + neckCm + ' cm from shoulder') }]
        };
        var panels = [];
        if (d.collar === 'v-neck') {
          var fHalf = Math.max(10, Math.round(bodySts / 4));
          var fEdge = function (outerRight) {
            var straight = edge(st(8), st(bodyRows - 10));
            var sloped = edge(st(8), st(bodyRows - 10), slope());
            return outerRight ? { left: straight, right: sloped } : { left: sloped, right: straight };
          };
          panels.push({ name: 'Front L', role: 'front', shape: { name: 'front L', width: fHalf, gauge: g, mirror: false, edges: fEdge(false), annotations: [hemAnn, { row: neckRow, off: 0, text: 'V from center front: inner edge stays straight, V forms at seam; band cut on bias' }] } });
          panels.push({ name: 'Front R', role: 'front', shape: { name: 'front R', width: fHalf, gauge: g, mirror: false, edges: fEdge(true), annotations: [hemAnn] } });
        } else {
          panels.push({
            name: 'Front', role: 'front',
            shape: {
              name: 'front', width: half, gauge: g, mirror: false,
              edges: {
                left: edge(st(8), st(bodyRows - 10), slope()),
                right: edge(st(8), st(bodyRows - 10), slope())
              },
              annotations: [hemAnn, { row: neckRow, off: Math.round(half / 2), text: (d.collar === 'crew' || d.collar === 'scoop' ? d.collar + ' neck ' + neckCm + ' cm deep: shape round or pick up live sts here' : d.collar + ': flat neck, placket at center') }]
            }
          });
        }
        panels.unshift({ name: 'Back', role: 'back', shape: backShape });
        var armSts = m.sts(d.armCirc + 2);
        var cuffSts = m.sts(d.cuffCirc);
        var sleeveRows = m.rows(d.sleeveLen);
        var taper = armSts - cuffSts;
        var taperEach = taper > 12 ? 2 : 1;
        var taperTimes = Math.max(1, Math.ceil(Math.round(taper / 2) / taperEach));
        var taperEvery = Math.max(2, Math.round(sleeveRows * 0.6 / taperTimes));
        var widthAtCap = cuffSts + 2 * taperEach * taperTimes;
        var capEach = Math.max(1, Math.floor((widthAtCap - 10) / 4)); // tee caps stay low
        var sEdge = function () {
          return edge(
            st(Math.max(4, Math.round(sleeveRows * 0.15))),
            inc(taperEvery, taperEach, taperTimes),
            st(Math.max(2, sleeveRows - Math.round(sleeveRows * 0.15) - taperEvery * taperTimes - 6)),
            dec(2, capEach, 2)
          );
        };
        var sl = { name: 'sleeve L', width: Math.max(10, cuffSts), gauge: g, mirror: false, edges: { left: sEdge(), right: sEdge() }, annotations: [{ row: 2, off: 0, text: 'cuff band in the round style rib' }] };
        var sr2 = JSON.parse(JSON.stringify(sl));
        sr2.name = 'sleeve R';
        panels.push({ name: 'Sleeve L', role: 'sleeve-left', shape: sl });
        panels.push({ name: 'Sleeve R', role: 'sleeve-right', shape: sr2 });
        var bandRows = { crew: 8, scoop: 10, 'v-neck': 10, polo: 10, henley: 7 }[d.collar] || 8;
        var bandName = d.collar === 'v-neck' ? 'Bias neck strips (x2)' : 'Neckband';
        panels.push({
          name: bandName, role: 'collar',
          shape: {
            name: 'collar', width: Math.max(10, m.sts(d.collar === 'v-neck' ? 3.5 : 42 * 0.9)), gauge: g, mirror: false,
            edges: { left: edge(st(bandRows)), right: edge(st(bandRows)) },
            annotations: [{ row: 2, off: 0, text: d.collar === 'v-neck' ? 'two bias strips for the V, join to band then neck' : '1x1 rib band, sew to neck' }]
          }
        });
        if (d.collar === 'polo' || d.collar === 'henley') {
          var plRows = m.rows(d.collar === 'polo' ? 14 : 20);
          var pl = function (i, buttons) {
            return {
              name: 'Placket ' + (i + 1), role: 'placket',
              shape: {
                name: 'placket', width: Math.max(6, m.sts(3.5)), gauge: g, mirror: false,
                edges: { left: edge(st(plRows)), right: edge(st(plRows)) },
                annotations: [{ row: Math.max(2, plRows - 3), off: 1, text: buttons + ' buttonhole' + (buttons > 1 ? 's' : '') + ' at top' }]
              }
            };
          };
          panels.push(pl(0, d.collar === 'polo' ? 1 : 3));
          panels.push(pl(1, d.collar === 'polo' ? 0 : 0));
        }
        return {
          panels: panels,
          notes: ['Tee knits faster than a sweater; that is not a flaw in the gauge.', 'Seam shoulders first, then set sleeves, side seams last.']
        };
      }
    },
    {
      id: 'shawl', name: 'Shawl (triangle)', icon: '🔺',
      blurb: 'Top-down triangle: a few live sts at the neck, inc at both edges every other row to the wingspan.',
      fields: [
        { key: 'neckW', label: 'Neck edge width', def: 16, min: 6, max: 40 },
        { key: 'depth', label: 'Depth (neck to point)', def: 60, min: 25, max: 90 },
        { key: 'wingspan', label: 'Wingspan (top edge)', def: 170, min: 60, max: 260 }
      ],
      build: function (d, g) {
        var m = maker(g);
        var neckSts = Math.max(6, m.sts(d.neckW));
        var topSts = m.sts(d.wingspan);
        var ev = Math.max(2, Math.round((topSts - neckSts) / 2));
        var rowsNeeded = 2 * ev + 4;
        var rowsAvail = m.rows(d.depth);
        var every = Math.max(2, Math.min(12, Math.ceil(rowsAvail / ev / 2) * 2));
        var e = function () { return edge(st(2), inc(every, Math.max(1, Math.ceil((topSts - neckSts) / 2 / ev)), ev), st(2)); };
        var shape = {
          name: 'shawl', width: neckSts, gauge: g, mirror: true,
          edges: { left: e(), right: e() },
          annotations: [{ row: 2, off: 0, text: 'cast on at neck; inc every ' + every + ' rows at each edge' }]
        };
        return { panels: [{ name: 'Shawl', role: 'other', shape: shape }], notes: [] };
      }
    },
    {
      id: 'scarf', name: 'Scarf', icon: '🧣',
      blurb: 'Straight rectangle. Any stitch pattern fits the chart once generated.',
      fields: [
        { key: 'width', label: 'Width', def: 30, min: 10, max: 60 },
        { key: 'length', label: 'Length', def: 150, min: 50, max: 250 }
      ],
      build: function (d, g) {
        var m = maker(g);
        var shape = {
          name: 'scarf', width: m.sts(d.width), gauge: g, mirror: false,
          edges: { left: edge(st(m.rows(d.length))), right: edge(st(m.rows(d.length))) },
          annotations: [{ row: 2, off: 0, text: 'edges: slip 1 for a chained selvedge' }]
        };
        return { panels: [{ name: 'Scarf', role: 'other', shape: shape }], notes: [] };
      }
    },
    {
      id: 'beanie', name: 'Beanie', icon: '🎿',
      blurb: 'Ribbed brim, straight body, short crown: repeated decreases to a small opening.',
      fields: [
        { key: 'headCirc', label: 'Head circumference', def: 56, min: 30, max: 70 },
        { key: 'depth', label: 'Depth (brim edge to crown)', def: 19, min: 12, max: 30 },
        { key: 'ease', label: 'Ease (negative ok)', def: -2, min: -6, max: 4 }
      ],
      build: function (d, g) {
        var m = maker(g);
        var headSts = m.sts(d.headCirc + d.ease);
        var rowsAll = m.rows(d.depth);
        var brim = Math.max(8, Math.round(rowsAll * 0.3));
        var decEach = Math.max(1, Math.floor(headSts / 12));
        var decTimes = Math.max(2, Math.round((headSts * 0.8) / (2 * decEach)));
        var e = function () { return edge(st(brim), st(4), dec(2, decEach, decTimes), st(2)); };
        var shape = {
          name: 'beanie', width: headSts, gauge: g, mirror: true,
          edges: { left: e(), right: e() },
          annotations: [
            { row: 2, off: 0, text: 'brim: 2x2 rib' },
            { row: brim + 5, off: 0, text: 'crown: dec pattern to ~10 sts, cinch' }
          ]
        };
        return { panels: [{ name: 'Beanie', role: 'other', shape: shape }], notes: ['Worked flat, seamed; or halve for in-the-round.'] };
      }
    }
  ];

  function get(id) {
    for (var i = 0; i < TEMPLATES.length; i++) if (TEMPLATES[i].id === id) return TEMPLATES[i];
    return null;
  }
  function defaults(id) {
    var t = get(id);
    var d = {};
    if (t) t.fields.forEach(function (f) { d[f.key] = f.def; });
    return d;
  }
  function validate(id, dims, gauge) {
    var errs = [];
    var t = get(id);
    if (!t) return ['unknown template: ' + id];
    if (!gauge || !(gauge.stsPer10cm > 0) || !(gauge.rowsPer10cm > 0)) {
      errs.push('gauge required (sts + rows per 10 cm)');
    }
    t.fields.forEach(function (f) {
      if (f.type === 'select') {
        if (f.options.indexOf(String(dims[f.key])) < 0) {
          errs.push(f.label + ': choose ' + f.options.join(' / '));
        }
        return;
      }
      var v = Number(dims[f.key]);
      if (!(v >= f.min && v <= f.max)) {
        errs.push(f.label + ' must be ' + f.min + '-' + f.max + ' cm');
      }
    });
    return errs;
  }
  function build(id, dims, gauge, opts) {
    var errs = validate(id, dims, gauge);
    if (errs.length) { var e = new Error(errs.join('; ')); e.code = 'dims'; throw e; }
    var t = get(id);
    var out = t.build(dims, gauge);
    out.name = (opts && opts.name) || (t.name.toLowerCase().replace(/[^a-z]+/g, '-'));
    return out;
  }
  // Unit helpers for the form
  function inToCm(inch) { return Math.round(inch * 25.4 * 10) / 10; }
  function cmToIn(cm) { return Math.round(cm / 25.4 * 10) / 10; }

  return { TEMPLATES: TEMPLATES, get: get, defaults: defaults, validate: validate, build: build, inToCm: inToCm, cmToIn: cmToIn };
});
