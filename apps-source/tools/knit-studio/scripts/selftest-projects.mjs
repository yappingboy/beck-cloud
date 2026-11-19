/* knit-studio projects + CAM slicer selftest:
 * node scripts/selftest-projects.mjs */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const KS = require('../public/core.js');
KS.shaping = require('../public/shaping.js');
const SL = require('../public/slicer.js');
globalThis.KS = KS; // projectToText picks up KS.shaping through this

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('ok   ' + name); }
  catch (e) { fail++; console.log('FAIL ' + name + ': ' + e.message); }
}
function eq(a, b, msg) {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  if (ja !== jb) throw new Error((msg || '') + ' got ' + ja + ' want ' + jb);
}

/* ---------- slicer: scanline slicing ---------- */

/* ---------- SVG scale detection ---------- */

t('detect: mm viewport == viewBox -> 1 mm/unit', () => {
  const d = SL.detectSvgUnits('<svg width="210mm" height="297mm" viewBox="0 0 210 297"><rect/></svg>');
  if (Math.abs(d.mmPerUnit - 1) > 1e-9) throw new Error(d.mmPerUnit);
});

t('detect: px width with mm viewBox scales down', () => {
  // 794px wide showing 210 viewBox units -> px mm (0.2646) * 794/210
  const d = SL.detectSvgUnits('<svg xmlns:x="y" width="794" height="1123" viewBox="0 0 210 297"/>');
  if (Math.abs(d.mmPerUnit - (794 * SL.MM_PX / 210)) > 1e-6) throw new Error(d.mmPerUnit);
});

t('detect: inch units', () => {
  const d = SL.detectSvgUnits('<svg width="8in" height="10in" viewBox="0 0 80 100">');
  if (Math.abs(d.mmPerUnit - 25.4 / 10) > 1e-9) throw new Error(d.mmPerUnit);
});

t('detect: cm units', () => {
  const d = SL.detectSvgUnits('<svg width="20cm" height="30cm" viewBox="0 0 200 300">');
  if (Math.abs(d.mmPerUnit - 1) > 1e-9) throw new Error(d.mmPerUnit);
});

t('detect: viewBox-only assumes mm', () => {
  const d = SL.detectSvgUnits('<svg viewBox="0 0 100 150"><path d="M0 0"/></svg>');
  if (d.mmPerUnit !== 1) throw new Error(d.mmPerUnit);
  if (!d.source.includes('1 mm')) throw new Error(d.source);
});

t('detect: width without viewBox is CSS px', () => {
  const d = SL.detectSvgUnits('<svg width="800" height="600"><path/></svg>');
  if (Math.abs(d.mmPerUnit - SL.MM_PX) > 1e-9) throw new Error(d.mmPerUnit);
});

t('detect: preserveAspectRatio meet uses smaller ratio', () => {
  // viewBox 100x100 into 200x100mm viewport -> y binds: 1 mm/unit
  const d = SL.detectSvgUnits('<svg width="200mm" height="100mm" viewBox="0 0 100 100">');
  if (Math.abs(d.mmPerUnit - 1) > 1e-9) throw new Error(d.mmPerUnit);
});

t('detect: no svg tag -> mm fallback', () => {
  const d = SL.detectSvgUnits('not an svg at all');
  if (d.mmPerUnit !== 1) throw new Error('fallback should be 1');
});

t('units override map', () => {
  if (SL.unitsToMmPerUnit('px', null) !== SL.MM_PX) throw new Error('px');
  if (SL.unitsToMmPerUnit('in', null) !== 25.4) throw new Error('in');
  if (SL.unitsToMmPerUnit('cm', null) !== 10) throw new Error('cm');
  if (SL.unitsToMmPerUnit('auto', { mmPerUnit: 3.5 }) !== 3.5) throw new Error('auto uses detected');
  if (SL.unitsToMmPerUnit('bogus', { mmPerUnit: 2.5 }) !== 2.5) throw new Error('bogus falls back to detected');
});

t('detect: quoted viewBox and decimal lengths', () => {
  // 10.5in = 266.7 mm across 105 viewBox units -> 2.54 mm per unit
  const d = SL.detectSvgUnits("<svg width='10.5in' height='10in' viewBox='0 0 105 100'>");
  if (Math.abs(d.mmPerUnit - 2.54) > 1e-9) throw new Error(d.mmPerUnit);
});

t('mm-outline slice at gauge lands in sane stitch range', () => {
  // 100mm x 100mm square, 1 mm/unit -> 3.937in -> ~8.7 sts at 22/100mm
  // 100 mm square at 22 sts / 30 rows per 100 mm -> 22 sts x 30 rows
  const d = SL.detectSvgUnits('<svg width="100mm" height="100mm" viewBox="0 0 100 100">');
  const mm = d.mmPerUnit;
  const inch = (u) => [u[0] * mm / 25.4, u[1] * mm / 25.4];
  const g = SL.gaugePerInch(22, 30, '100mm');
  const r = SL.slicePolygon([[0, 0], [100, 0], [100, 100], [0, 100]].map(inch), g.sts, g.rows);
  const rows = Object.keys(r.panels[0].segments).length;
  if (rows < 29 || rows > 31) throw new Error('rows ' + rows + ' want ~30');
  const w = r.panels[0].segments['15'];
  if (w[1] - w[0] < 21 || w[1] - w[0] > 22) throw new Error('width ' + (w[1] - w[0]) + ' want 22 sts');
});
t('slice rectangle -> one full-width panel', () => {
  // 10 x 4 units, y-up, origin 0
  const r = SL.slicePolygon([[0, 0], [10, 0], [10, 4], [0, 4]], 1, 1);
  if (r.panels.length !== 1) throw new Error('want 1 panel, got ' + r.panels.length);
  const rows = Object.keys(r.panels[0].segments).map(Number).sort((a, b) => a - b);
  eq(rows.length, 4, 'rows');
  for (const y of rows) eq(r.panels[0].segments[y], [0, 10], 'row ' + y);
});

t('slice at gauge scales stitches x rows', () => {
  // 4in wide x 2in tall at 5 sts/in, 10 rows/in => 20 sts x 20 rows
  const r = SL.slicePolygon([[0, 0], [4, 0], [4, 2], [0, 2]], 5, 10);
  const rows = Object.keys(r.panels[0].segments).map(Number);
  eq(rows.length, 20, 'row count');
  eq(r.panels[0].segments['0'], [0, 20], 'bottom row width');
});

t('triangle narrows one row at a time', () => {
  const r = SL.slicePolygon([[0, 0], [10, 0], [0, 10]], 1, 1);
  if (r.panels.length !== 1) throw new Error('want 1 panel');
  const seg = r.panels[0].segments;
  if (seg['0'][1] - seg['0'][0] < 9) throw new Error('bottom row too narrow');
  if (seg['9'][1] - seg['9'][0] > 2) throw new Error('top row too wide');
});

t('hourglass splits into two panels at the pinch', () => {
  // 0.2-unit pinch between y=4.5..5.5 rounds away -> rows 4 and 5 have no
  // segments -> bottom panel finishes, top panel starts fresh
  const pts = [[0, 0], [6, 0], [6, 4], [3.1, 4.5], [3.1, 5.5], [6, 6],
    [6, 10], [0, 10], [0, 6], [2.9, 5.5], [2.9, 4.5], [0, 4]];
  const r = SL.slicePolygon(pts, 1, 1);
  if (r.panels.length !== 2) throw new Error('want 2 panels, got ' + r.panels.length);
  const rowSets = r.panels.map((p) => Object.keys(p.segments).map(Number).sort((a, b) => a - b));
  const bottoms = rowSets.find((rows) => rows[0] === 0);
  const tops = rowSets.find((rows) => rows[0] === 6);
  if (!bottoms || !tops) throw new Error('expected panels at rows 0..3 and 6..9, got ' + JSON.stringify(rowSets));
  eq(bottoms, [0, 1, 2, 3]);
  eq(tops, [6, 7, 8, 9]);
});

t('maxStitches chunks wide rows', () => {
  const r = SL.slicePolygon([[0, 0], [25, 0], [25, 3], [0, 3]], 1, 1, 10);
  const rows = Object.keys(r.panels[0].segments).map(Number).sort((a, b) => a - b);
  // row 0 may have one or two segments depending on overlap continuity; check widths
  for (const y of rows) {
    for (const key of Object.keys(r.panels[0].segments)) {
      const s = r.panels[0].segments[key];
      if (s[1] - s[0] > 10) throw new Error('segment wider than maxStitches');
    }
  }
});

t('rejects degenerate outlines', () => {
  let threw = false;
  try { SL.slicePolygon([[0, 0], [1, 1]], 1, 1); } catch (e) { threw = true; }
  if (!threw) throw new Error('should reject <3 points');
});

/* ---------- slicer: instructions ---------- */

t('instruction map: cast on / work even / bind off', () => {
  const r = SL.slicePolygon([[0, 0], [4, 0], [4, 3], [0, 3]], 1, 1);
  const map = SL.instructionMap(r.panels[0]);
  const rows = Object.keys(map).map(Number).sort((a, b) => a - b);
  if (!map[rows[0]].startsWith('Cast on 4')) throw new Error('cast on: ' + map[rows[0]]);
  if (!map[rows[1]].startsWith('Work even')) throw new Error('even: ' + map[rows[1]]);
  if (!map[rows[rows.length - 1]].includes('Bind off remaining 4')) throw new Error('bind off');
});

t('condensed groups collapse identical rows', () => {
  const r = SL.slicePolygon([[0, 0], [4, 0], [4, 8], [0, 8]], 1, 1);
  const g = SL.condensedGroups(r.panels[0]);
  const even = g.filter((x) => x.action === 'Work even. (Total: 4 sts)');
  if (even.length !== 1) throw new Error('want exactly one work-even group, got ' + even.length);
  if (even[0].endNum - even[0].startNum < 4) throw new Error('group too short: ' + JSON.stringify(even[0]));
});

t('instructions text covers all panels', () => {
  const pts1 = [[0, 0], [3, 0], [3, 3], [0, 3]];
  const pts2 = [[10, 0], [13, 0], [13, 3], [10, 3]];
  const a = SL.slicePolygon(pts1, 1, 1), b = SL.slicePolygon(pts2, 1, 1);
  const data = { bounds: [0, 0, 13, 3], panels: [a.panels[0], b.panels[0]] };
  const text = SL.instructionsText(data, 'TEST');
  if (!text.includes('Panel A') || !text.includes('Panel B')) throw new Error('missing panel headers');
  if ((text.match(/Cast on/g) || []).length !== 2) throw new Error('want 2 cast-ons');
});

t('gauge unit conversions', () => {
  const g1 = SL.gaugePerInch(20, 30, '100mm');
  if (Math.abs(g1.sts - 20 * 0.254) > 1e-9) throw new Error('sts per inch wrong');
  const g2 = SL.gaugePerInch(5, 7, 'inch');
  eq([g2.sts, g2.rows], [5, 7]);
});

/* ---------- slicer -> charts (core.fromSlicer) ---------- */

t('fromSlicer builds charts from slice output', () => {
  const r = SL.slicePolygon([[0, 0], [6, 0], [6, 3], [0, 3]], 1, 1);
  const pats = KS.fromSlicer(r, 'tee');
  if (pats.length !== 1) throw new Error('want 1 chart');
  const p = KS.validate(pats[0]);
  if (p.height !== 3 || p.width !== 6) throw new Error('dims ' + p.width + 'x' + p.height);
  if (p.rows.some((row) => row !== 'kkkkkk')) throw new Error('rows not fully knit');
});

/* ---------- project model ---------- */

t('blank project + add panels + ids', () => {
  const p = KS.validateProject(KS.blankProject('sweater'));
  const a = KS.addPanel(p, KS.blank('front', 10, 10), 'Front', 'front');
  const b = KS.addPanel(p, KS.blank('back', 10, 10), 'Back', 'back');
  eq([a.id, b.id], ['p1', 'p2']);
  eq(p.panels.length, 2);
  KS.removePanel(p, 'p1');
  const c = KS.addPanel(p, KS.blank('x', 5, 5), 'Sleeve', 'other');
  if (c.id !== 'p1') throw new Error('freed id should be reused, got ' + c.id);
  if (KS.getPanel(p, 'p2').name !== 'Back') throw new Error('other panels disturbed');
});

t('validateProject rejects bad input', () => {
  let threw = false;
  try { KS.validateProject({ format: 'nope' }); } catch (e) { threw = true; }
  if (!threw) throw new Error('bad format');
  threw = false;
  try {
    KS.validateProject({
      format: 'knit-studio-project/1',
      panels: [{ id: 'p1' }, { id: 'p1' }]
    });
  } catch (e) { threw = true; }
  if (!threw) throw new Error('duplicate panel ids');
  threw = false;
  try {
    KS.validateProject({
      format: 'knit-studio-project/1',
      panels: [{ id: 'p1', chart: { format: 'knit-studio/1', width: 1, height: 1, rows: ['z'] } }]
    });
  } catch (e) { threw = true; }
  if (!threw) throw new Error('bad chart inside panel');
});

t('panel roles normalize to known set', () => {
  const p = KS.validateProject({ format: 'knit-studio-project/1', panels: [{ id: 'p1', role: 'wobble' }] });
  if (p.panels[0].role !== 'other') throw new Error('unknown role should become other');
});

t('setPanelChart writes edited chart back', () => {
  const p = KS.blankProject('cardigan');
  const pn = KS.addPanel(p, KS.blank('pocket', 4, 4), 'Pocket', 'pocket');
  const edited = KS.blank('pocket v2', 6, 6);
  KS.setPanelChart(p, pn.id, edited);
  if (KS.getPanel(p, pn.id).chart.width !== 6) throw new Error('chart not updated');
  if (KS.setPanelChart(p, 'nope', edited) !== null) throw new Error('missing panel should return null');
});

t('projectToText includes every panel and gauge', () => {
  const p = KS.blankProject('pullover');
  p.gauge = { stsPer10cm: 22, rowsPer10cm: 30 };
  KS.addPanel(p, KS.blank('front', 3, 2), 'Front', 'front');
  KS.addPanel(p, KS.blank('back', 3, 2), 'Back', 'back');
  const txt = KS.projectToText(p);
  if (!txt.includes('2 panels')) throw new Error('header');
  if (!txt.includes('gauge: 22')) throw new Error('gauge line');
  if (!txt.includes('PANEL A: Front [front]') || !txt.includes('PANEL B: Back [back]')) throw new Error('headers');
  if ((txt.match(/Row 1/g) || []).length !== 2) throw new Error('both panel rows missing');
});

t('projectFromSlicer wraps CAM output', () => {
  const pts1 = [[0, 0], [3, 0], [3, 2], [0, 2]];
  const pts2 = [[10, 0], [13, 0], [13, 2], [10, 2]];
  const a = SL.slicePolygon(pts1, 1, 1), b = SL.slicePolygon(pts2, 1, 1);
  const data = { bounds: [0, 0, 13, 2], panels: [a.panels[0], b.panels[0]] };
  const proj = KS.projectFromSlicer(data, 'raglan');
  KS.validateProject(proj);
  eq(proj.name, 'raglan');
  eq(proj.panels.length, 2);
  if (!proj.panels[0].chart || proj.panels[0].chart.height !== 2) throw new Error('panel chart wrong');
  const txt = KS.projectToText(proj);
  if (!txt.includes('Panel A')) throw new Error('text export missing panels');
});

t('shaping model survives project round-trip', () => {
  const shape = KS.shaping.normalize({
    name: 'sleeve', width: 60,
    edges: { left: [{ kind: 'inc', every: 6, each: 1, times: 4 }], right: [] }
  });
  const chart = KS.shaping.toPattern(shape);
  const p = KS.blankProject('cardie');
  const pn = KS.addPanel(p, chart, 'Sleeve', 'sleeve-left', JSON.parse(JSON.stringify(shape)));
  const round = KS.validateProject(JSON.parse(JSON.stringify(p)));
  const got = KS.getPanel(round, pn.id);
  if (got.role !== 'sleeve-left') throw new Error('role lost');
  if (!got.shape || got.shape.edges.left[0].every !== 6) throw new Error('shape lost');
  const txt = KS.projectToText(round);
  if (!txt.includes('every 6th row inc 1 st x 4')) throw new Error('shaping text missing from export: ' + txt);
});


/* ---------- yarn estimation ---------- */
t('yarnMeters: calibrated stockinette + fabric multipliers', () => {
  const full = KS.blank('f', 100, 100);
  full.rows = full.rows.map(() => 'k'.repeat(100));
  const g = { stsPer10cm: 20, rowsPer10cm: 26 };
  eq(KS.yarnMeters(full, g, 'stockinette'), 128);
  eq(KS.yarnMeters(full, g, 'rib'), 160);
  eq(KS.yarnMeters(full, g, 'nonsense-fabric'), 128);
  eq(KS.yarnMeters(full, null, 'stockinette'), null);
  eq(KS.yarnMeters(null, g, 'stockinette'), null);
});

t('workedStitches ignores dots, spaces and middots', () => {
  const c = KS.blank('m', 6, 2);
  c.rows = ['..k..k', '.\u00b7 k .'];
  eq(KS.workedStitches(c), 3);
});

t('projectYarn sums panels, honors shape gauge, counts missing', () => {
  const p = KS.blankProject('yarn ball test');
  p.gauge = { stsPer10cm: 20, rowsPer10cm: 26 };
  const big = KS.blank('b', 100, 100);
  big.rows = big.rows.map(() => 'k'.repeat(100));
  const shaped = KS.blank('s', 50, 50);
  shaped.rows = shaped.rows.map(() => 'k'.repeat(50));
  const shapeGauge = {
    format: 'knit-studio-shape/1', width: 50,
    gauge: { stsPer10cm: 10, rowsPer10cm: 13 }, edges: { left: [], right: [] }
  };
  KS.addPanel(p, big, 'front', 'front');
  KS.addPanel(p, shaped, 'loose', 'other', JSON.parse(JSON.stringify(shapeGauge)));
  p.panels.push({ id: 'px', name: 'empty', role: 'other', chart: null, shape: null, notes: '' });
  const y = KS.projectYarn(p, 'stockinette');
  eq(y.panels.map((x) => x.meters), [128, 64, null]);
  eq(y.total, 192);
  eq(y.missingGauge, 1);
  const txt = KS.projectToText(p);
  if (!txt.includes('yarn estimate: ~192 m')) throw new Error('export line missing');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
