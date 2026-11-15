/* knit-studio logic selftest: node scripts/selftest.mjs */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const KS = require('../public/core.js');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('ok   ' + name); }
  catch (e) { fail++; console.log('FAIL ' + name + ': ' + e.message); }
}
function eq(a, b, msg) {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  if (ja !== jb) throw new Error((msg || '') + ' got ' + ja + ' want ' + jb);
}

t('blank + validate', () => {
  const p = KS.validate(KS.blank('t', 8, 4));
  if (p.rows.length !== 4 || p.rows[0] !== '........') throw new Error('bad blank');
});

t('validate rejects garbage', () => {
  let threw = false;
  try { KS.validate({ format: 'nope' }); } catch (e) { threw = true; }
  if (!threw) throw new Error('should reject');
  threw = false;
  try { KS.validate({ format: 'knit-studio/1', width: 2, height: 1, rows: ['z.'] }); } catch (e) { threw = true; }
  if (!threw) throw new Error('should reject unknown code');
});

t('setCell/getCell', () => {
  const p = KS.blank('t', 4, 2);
  KS.setCell(p, 0, 1, 'x');
  if (KS.getCell(p, 0, 1) !== 'x' || p.rows[0] !== '.x..') throw new Error('set failed');
  if (KS.getCell(p, 9, 9) !== null) throw new Error('oob should be null');
});

t('resample doubles and halves', () => {
  const p = KS.blank('t', 2, 2);
  p.rows = ['k.', 'xx'];
  const big = KS.resample(p, 4, 4);
  eq(big.rows, ['kk..', 'kk..', 'xxxx', 'xxxx'], 'double');
  const small = KS.resample(KS.resample(p, 4, 4), 2, 2);
  eq(small.rows, ['k.', 'xx'], 'double->half roundtrip');
});

t('resample non-integer ratio', () => {
  const p = KS.blank('s', 10, 1);
  p.rows = ['kxkxkxkxkx'];
  const q = KS.resample(p, 5, 1);
  if (q.rows[0].length !== 5) throw new Error('width');
});

t('crop', () => {
  const p = KS.blank('c', 6, 6);
  p.rows = p.rows.map((r, y) => (y === 2 ? '..kxx.' : r));
  const c = KS.crop(p, 2, 2, 3, 1);
  eq(c.rows, ['kxx']);
});

t('floodFill', () => {
  const p = KS.blank('f', 4, 2);
  p.rows = ['kk.x', 'kk.x'];
  KS.floodFill(p, 0, 0, 'x');
  // fills the connected 'k' region only; '.' islands are not crossed
  eq(p.rows, ['xx.x', 'xx.x']);
});

t('imageToChart threshold', () => {
  // 2x2: black, white, dark gray, light gray (0.5 exactly ties toward 'k')
  const r = KS.imageToChart([0, 1, 0.1, 0.9], 2, 2, { threshold: 0.5 });
  eq(r.rows, ['xk', 'xk']);
  const inv = KS.imageToChart([0, 1, 0.1, 0.9], 2, 2, { threshold: 0.5, invert: true });
  eq(inv.rows, ['kx', 'kx']);
  eq(KS.imageToChart([0.5], 1, 1, {}).rows, ['k'], 'threshold tie -> knit');
});

t('imageToChart transparency', () => {
  const r = KS.imageToChart([null, 0, 0, null], 2, 2, {});
  eq(r.rows, ['.x', 'x.']);
});

t('imageToChart dither stays binary', () => {
  const lum = new Array(8 * 8).fill(0.5);
  const r = KS.imageToChart(lum, 8, 8, { dither: true, threshold: 0.5 });
  const codes = new Set(r.rows.join('').split(''));
  if ([...codes].some((c) => c !== 'x' && c !== 'k')) throw new Error('dither produced non-binary: ' + [...codes]);
  const xs = r.rows.join('').split('').filter((c) => c === 'x').length;
  if (xs === 0 || xs === 64) throw new Error('dither collapsed to solid');
});

t('rle + toText', () => {
  if (KS.rle('kkkxx..') !== 'k3 x2 no-work 2') throw new Error('rle got ' + KS.rle('kkkxx..'));
  const p = KS.blank('band', 4, 2);
  p.rows = ['kxkx', 'xxxx'];
  const txt = KS.toText(p);
  if (!txt.includes('Row 1 (RS): x4')) throw new Error('bottom row should be Row 1: ' + txt);
});

t('fromSlicer maps bottom-up rows', () => {
  const pats = KS.fromSlicer({
    bounds: [0, 0, 4, 2],
    panels: [{ id: 0, segments: { '0': [0, 4], '1': [1, 3] } }]
  }, 'sleeve.svg');
  if (pats.length !== 1) throw new Error('panel count');
  const p = pats[0];
  if (p.width !== 4 || p.height !== 2) throw new Error('dims ' + p.width + 'x' + p.height);
  // segment end is exclusive: [1,3) = stitches 1-2; row 0 = bottom
  eq(p.rows, ['.kk.', 'kkkk']);
});

t('toSvg emits cells and numbers', () => {
  const p = KS.blank('svg', 2, 2);
  p.rows = ['kx', 'ha'];
  const s = KS.toSvg(p, 10);
  if (!s.startsWith('<svg') || !s.includes('</svg>')) throw new Error('not svg');
  if (!s.includes('>2</text>')) throw new Error('missing row number');
});

t('slug', () => {
  if (KS.slug('Fair Isle Band!') !== 'fair-isle-band') throw new Error('slug');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
