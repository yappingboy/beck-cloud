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
  if (KS.rle('kkkxx..') !== 'k3 x2') throw new Error('rle got ' + KS.rle('kkkxx..'));
if (KS.rle('..kk..p.') !== 'k2 p1') throw new Error('rle must skip unworked cells, got ' + KS.rle('..kk..p.'));
if (KS.rle('....') !== '') throw new Error('blank row must encode empty, got ' + KS.rle('....'));
  const p = KS.blank('band', 4, 2);
  p.rows = ['kxkx', 'xxxx'];
  const txt = KS.toText(p);
  if (!txt.includes('Row 1 (RS): x4')) throw new Error('bottom row should be Row 1: ' + txt);
});

t('toText lists only worked stitches; blank rows explained', () => {
  const p = KS.blank('shortrow', 6, 3);
  p.rows = ['......', '.kk...', 'kkkkkk']; // bottom-up rows[0] = top
  const txt = KS.toText(p);
  if (txt.includes('no-work')) throw new Error('instructions still say no-work: ' + txt);
  if (!txt.includes('Row 1 (RS): k6')) throw new Error('full row wrong: ' + txt);
  if (!txt.includes('Row 2 (WS): k2')) throw new Error('partial row must list worked sts only: ' + txt);
  if (!/Row 3 \(RS\): not worked/.test(txt)) throw new Error('blank row needs a plain-language note: ' + txt);
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

t('k2tog code t validates, palette, text export', () => {
  if (!KS.PALETTE.includes('t')) throw new Error('palette missing t');
  if (!KS.CODES.t || !/knit 2 together/i.test(KS.CODES.t.hint)) throw new Error('CODES.t');
  const p = KS.blank('t2', 4, 2);
  KS.setCell(p, 0, 2, 't');
  KS.validate(p);
  if (KS.getCell(p, 0, 2) !== 't') throw new Error('cell lost');
  const txt = KS.toText(p);
  if (!txt.includes('t1')) throw new Error('rle should emit t1: ' + txt.split('\n').pop());
});

/* ---------- intarsia colors ---------- */
t('color slots: 38 codes, a/b kept, capitals + digits valid cells', () => {
  if (KS.COLOR_CODES.length !== 38) throw new Error('slots ' + KS.COLOR_CODES.length);
  if (KS.colorIndex('a') !== 0 || KS.colorIndex('b') !== 1) throw new Error('legacy slots moved');
  if (KS.colorIndex('C') !== 14 || KS.colorIndex('3') !== 5) throw new Error('index math');
  if (KS.colorIndex('k') !== -1 || KS.colorIndex('t') !== -1) throw new Error('symbols are not colors');
  const p = KS.blank('t', 4, 2);
  p.rows = ['aB3C', '.09z'.replace('z', 'Z')];
  KS.validate(p);
  let threw = false;
  try { KS.validate(KS.blank('t', 1, 1) && Object.assign(KS.blank('x', 1, 1), { rows: ['#'] })); }
  catch (e) { threw = true; }
  if (!threw) throw new Error('"#" accepted as a cell code');
});

t('colors table sanitizing: hex regex, name cap, junk dropped', () => {
  const p = KS.blank('t', 2, 1);
  p.colors = [
    { name: '  Fern  ', hex: '#0F8000' },
    { name: 'x'.repeat(40), hex: 'red' },
    'junk',
    { hex: '#0000ff' }
  ];
  KS.validate(p);
  const t2 = KS.colorsOf(p);
  if (t2[0].name !== 'Fern' || t2[0].hex !== '#0f8000') throw new Error('entry 0: ' + JSON.stringify(t2[0]));
  if (t2[1].name.length !== 24) throw new Error('name cap');
  if (t2[1].hex !== KS.COLOR_RAMP[1]) throw new Error('bad hex should fall back to ramp');
  if (t2[3].hex !== '#0000ff') throw new Error('entry 3');
});

t('colorAt defaults: A magenta, B blue, then ramp; names auto', () => {
  const p = KS.blank('t', 2, 1);
  const a = KS.colorAt(p, 0), b = KS.colorAt(p, 1), c = KS.colorAt(p, 4);
  if (a.hex !== '#d33682' || a.name !== 'Color A') throw new Error('A');
  if (b.hex !== '#268bd2' || b.name !== 'Color B') throw new Error('B');
  if (c.name !== 'Color 5' || !/^#[0-9a-f]{6}$/.test(c.hex)) throw new Error('slot 5');
  if (KS.colorAt(p, 99).hex !== '#888888') throw new Error('out of range fallback');
});

t('setCell paints color codes; usedColorCodes scans rows', () => {
  const p = KS.blank('t', 3, 1);
  KS.setCell(p, 0, 0, 'a');
  KS.setCell(p, 0, 1, '3');
  KS.setCell(p, 0, 2, 'Q');
  eq(p.rows, ['a3Q']);
  eq(KS.usedColorCodes(p), ['a', '3', 'Q']);
});

t('toText and toSvg carry the color legend', () => {
  const p = KS.blank('tint', 4, 2);
  p.rows = ['ab3a', 'b3ab']; // a=slot0, b=slot1, 3=slot5
  p.colors = [{ name: 'Heather', hex: '#7b5ea7' }, { name: 'Slate', hex: '#556677' }];
  KS.validate(p);
  const txt = KS.toText(p);
  if (!txt.includes('Heather = #7b5ea7') || !txt.includes('[code "a"]')) throw new Error('txt legend: ' + txt);
  const svg = KS.toSvg(p);
  if (!svg.includes('fill="#7b5ea7"')) throw new Error('cell fill');
  if (!svg.includes('>Heather #7b5ea7</text>')) throw new Error('legend text');
  if (!svg.includes('>Color 6 ')) throw new Error('unnamed slot 3 is Color 6');
  if (!svg.includes('>Slate #556677</text>')) throw new Error('named B slot');
});

t('legacy two-color charts: no table injected, defaults named; plain charts no legend', () => {
  const p = KS.blank('old', 2, 2);
  p.rows = ['ab', 'ba'];
  KS.validate(p);
  if (p.colors !== undefined) throw new Error('colors must stay absent when unset');
  const txt = KS.toText(p); // a/b ARE color cells, so a defaults legend is correct
  if (!txt.includes('Color A = #d33682') || !txt.includes('Color B = #268bd2')) throw new Error('defaults legend: ' + txt);
  const plain = KS.blank('plain', 2, 1);
  plain.rows = ['.k'];
  if (KS.toText(plain).includes('colors:')) throw new Error('no colors, no legend');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
