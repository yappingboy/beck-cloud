/* knit-studio shaping selftest: node scripts/selftest-shaping.mjs */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SH = require(path.join(__dirname, '../public/shaping.js'));

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('ok   ' + name); }
  catch (e) { fail++; console.log('FAIL ' + name + ': ' + e.message); }
}
function eq(a, b, msg) {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  if (ja !== jb) throw new Error((msg || '') + ' got ' + ja + ' want ' + jb);
}
function shape(o) {
  return SH.normalize(Object.assign({ name: 't', width: 10, edges: { left: [], right: [] } }, o));
}

t('straight edge profile is all-zero', () => {
  const s = shape({ width: 10, edges: { left: [{ kind: 'straight', rows: 5 }], right: [{ kind: 'straight', rows: 5 }] } });
  const p = SH.profile(s);
  if (p.H !== 5) throw new Error('H=' + p.H);
  eq(p.leftOff, [0, 0, 0, 0, 0]);
});

t('H is the taller edge; shorter edge pads straight', () => {
  const s = shape({ edges: { left: [{ kind: 'straight', rows: 3 }], right: [{ kind: 'dec', every: 2, each: 1, times: 4 }] } });
  const p = SH.profile(s);
  if (p.H !== 8) throw new Error('H=' + p.H);
  eq(p.leftOff, [0, 0, 0, 0, 0, 0, 0, 0]);
});

t('dec events land on rows every,2*every within segment', () => {
  const s = shape({ edges: { left: [{ kind: 'straight', rows: 5 }, { kind: 'dec', every: 3, each: 1, times: 2 }], right: [] } });
  const p = SH.profile(s);
  eq(p.leftOff, [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 2]);
  const evs = SH.events(p.edges.left);
  eq(evs.map(e => e.row), [8, 11]);
  eq(evs.map(e => e.dir), [1, 1]);
});

t('inc produces negative offsets; extents widen grid', () => {
  const s = shape({ width: 4, edges: { left: [{ kind: 'inc', every: 2, each: 1, times: 1 }], right: [] } });
  const p = SH.profile(s);
  eq(p.leftOff, [0, -1]);
  const e = SH.extents(s);
  if (e.minX !== -1 || e.gridW !== 5) throw new Error('extents ' + JSON.stringify(e.minX) + ' ' + e.gridW);
});

t('check() flags impossible width', () => {
  const s = shape({ width: 3, edges: { left: [{ kind: 'dec', every: 1, each: 2, times: 2 }], right: [] } });
  if (!SH.check(s).length) throw new Error('should flag');
});

t('toPattern: dims, fabric, decrease marker', () => {
  const s = shape({ width: 10, edges: { left: [{ kind: 'straight', rows: 5 }, { kind: 'dec', every: 3, each: 1, times: 2 }], right: [{ kind: 'straight', rows: 11 }] } });
  const p = SH.toPattern(s);
  if (p.format !== 'knit-studio/1' || p.height !== 11 || p.width !== 10) throw new Error('dims ' + p.width + 'x' + p.height);
  // rows[0] is top (row 11): left decreased twice -> lo=2; the vanished needle
  // of the event at row 11 sits just outside at x=1
  if (p.rows[0][2] !== 'k') throw new Error('top fabric');
  if (p.rows[0][1] !== 'd') throw new Error('decrease marker, row0: ' + p.rows[0]);
  if (p.rows[10][0] !== 'k') throw new Error('bottom fabric at x0');
});

t('toPattern: transfer flag emits arrow glyph', () => {
  const s = shape({ width: 10, edges: { left: [{ kind: 'dec', every: 2, each: 1, times: 1, transfer: true }], right: [] } });
  const p = SH.toPattern(s);
  const top = p.rows[0];
  if (top.indexOf('>') !== 0) throw new Error('expected transfer glyph at x0, row: ' + top);
});

t('toPattern: increase marks new needle', () => {
  const s = shape({ width: 4, edges: { left: [{ kind: 'inc', every: 2, each: 1, times: 1 }], right: [{ kind: 'straight', rows: 2 }] } });
  const p = SH.toPattern(s);
  if (p.rows[0][0] !== 'i') throw new Error('row: ' + p.rows[0]);
});

t('roundtrip: derive(segs) -> profile matches drawn offsets', () => {
  const drawn = [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 2];
  const segs = SH.segmentsFromOffsets(drawn);
  const s = shape({ width: 10, edges: { left: segs, right: [] } });
  eq(SH.profile(s).leftOff, drawn);
});

t('derive: grouped decreases become one 3-1-2 triplet', () => {
  const segs = SH.segmentsFromOffsets([0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 2]);
  eq(segs, [{ kind: 'straight', rows: 5 }, { kind: 'dec', every: 3, each: 1, times: 2, transfer: false }]);
});

t('derive: single mid-event keeps its placement', () => {
  const drawn = [0, 0, 0, 1, 1];
  const segs = SH.segmentsFromOffsets(drawn);
  const s = shape({ width: 10, edges: { left: segs, right: [{ kind: 'straight', rows: 5 }] } });
  eq(SH.profile(s).leftOff, drawn);
});

t('derive: increases round-trip too', () => {
  const drawn = [0, 0, -1, -1, -2, -2, -3];
  const segs = SH.segmentsFromOffsets(drawn);
  const s = shape({ width: 10, edges: { left: segs, right: [{ kind: 'straight', rows: 7 }] } });
  eq(SH.profile(s).leftOff, drawn);
});

t('toText shows japanese triplet notation', () => {
  const s = shape({ width: 20, edges: { left: [{ kind: 'dec', every: 6, each: 1, times: 4 }], right: [] } });
  const txt = SH.toText(s);
  if (!txt.includes('[6-1-4]')) throw new Error(txt);
});

/* ---- short rows + holding stitches ---- */
t('normSeg clamps sr and hold fields', () => {
  const sr = SH.normSeg({ kind: 'sr', every: 0, turn: 999, times: 7 });
  eq(sr, { kind: 'sr', every: 1, turn: 200, times: 7 });
  const hd = SH.normSeg({ kind: 'hold', each: 0, rows: 5, release: true });
  eq(hd, { kind: 'hold', each: 1, rows: 5, release: true });
});

t('sr wedge geometry matches an equivalent decrease', () => {
  const a = shape({ width: 20, edges: { left: [{ kind: 'sr', every: 2, turn: 1, times: 3 }], right: [{ kind: 'straight', rows: 6 }] } });
  const b = shape({ width: 20, edges: { left: [{ kind: 'dec', every: 2, each: 1, times: 3 }], right: [{ kind: 'straight', rows: 6 }] } });
  eq(SH.profile(a).leftOff, SH.profile(b).leftOff);
  if (SH.profile(a).H !== 6) throw new Error('H');
});

t('hold narrows for its rows then releases; release binds off', () => {
  const s = shape({ width: 20, edges: { left: [{ kind: 'hold', each: 4, rows: 3 }], right: [{ kind: 'straight', rows: 5 }] } });
  eq(SH.profile(s).leftOff, [4, 4, 4, 0, 0]);
  const r = shape({ width: 20, edges: { left: [{ kind: 'hold', each: 4, rows: 3, release: true }], right: [{ kind: 'straight', rows: 5 }] } });
  eq(SH.profile(r).leftOff, [4, 4, 4, 4, 4]);
});

t('edgeRows counts sr and hold spans', () => {
  if (SH.edgeRows([{ kind: 'sr', every: 2, turn: 1, times: 5 }]) !== 10) throw new Error('sr');
  if (SH.edgeRows([{ kind: 'hold', each: 3, rows: 7 }]) !== 7) throw new Error('hold');
});

t('events() ignores sr and hold (marks are drawn per segment)', () => {
  const s = shape({ width: 20, edges: { left: [{ kind: 'sr', every: 2, turn: 1, times: 3 }, { kind: 'hold', each: 2, rows: 4 }], right: [] } });
  const p = SH.profile(s);
  eq(SH.events(p.edges.left), []);
});

t('chart from sr wedge carries h wrap marks', () => {
  const s = shape({ width: 12, edges: { left: [{ kind: 'sr', every: 2, turn: 1, times: 3 }], right: [{ kind: 'straight', rows: 6 }] } });
  const pat = SH.toPattern(s);
  const rows = pat.rows;
  if (rows.length !== 6 || rows.some((r) => r.length !== pat.width)) throw new Error('grid size');
  const hCount = rows.join('').split('').filter((c) => c === 'h').length;
  if (hCount < 3) throw new Error('expected a wrap mark per short row, got ' + hCount);
});

t('chart from hold span shows held sts for exactly its rows', () => {
  const s = shape({ width: 12, edges: { left: [{ kind: 'hold', each: 3, rows: 4 }], right: [{ kind: 'straight', rows: 8 }] } });
  const pat = SH.toPattern(s);
  const withH = pat.rows.filter((r) => r.includes('h')).length;
  if (withH !== 4) throw new Error('held rows ' + withH);
  pat.rows.forEach((r) => { if ((r.split('h').length - 1) > 0 && (r.split('h').length - 1) !== 3) throw new Error('held width drift'); });
});

t('toText prints w&t and holder instructions', () => {
  const s = shape({ width: 20, edges: { left: [{ kind: 'sr', every: 2, turn: 1, times: 6 }], right: [{ kind: 'hold', each: 5, rows: 8 }] } });
  const txt = SH.toText(s);
  if (!txt.includes('w&t 1 st')) throw new Error('missing w&t line: ' + txt);
  if (!txt.includes('holder') || !txt.includes('take back')) throw new Error('missing holder line: ' + txt);
});

t('sock presets build valid, checkable shapes with charts', () => {
  [SH.sockHeel(32), SH.sockToe(64), SH.shoulderSlope(48), SH.earFlap(24)].forEach((p) => {
    const errs = SH.check(p);
    if (errs.length) throw new Error(p.name + ': ' + errs.join('; '));
    const pat = SH.toPattern(p);
    if (pat.rows.length !== pat.height) throw new Error(p.name + ' rows');
    if (pat.rows.some((r) => r.length !== pat.width)) throw new Error(p.name + ' width');
  });
});

t('heel preset: flap straight, wedge turns, live sts remain', () => {
  const h = SH.sockHeel(32);
  const p = SH.profile(h);
  const topW = p.hi[p.H - 1] - p.lo[p.H - 1];
  if (topW < 8) throw new Error('heel should leave live gusset sts, top=' + topW);
  const txt = SH.toText(h);
  if (!txt.includes('w&t')) throw new Error('no short rows in heel text');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
