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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
