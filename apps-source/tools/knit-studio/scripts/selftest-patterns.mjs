/* patterns selftest: generators, fill regions, params, errors. */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KS = require(path.join(__dirname, '../public/core.js'));
globalThis.KS = KS; // patterns.js resolves core lazily
const PT = require(path.join(__dirname, '../public/patterns.js'));

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('ok   ' + name); }
  catch (e) { fail++; console.log('FAIL ' + name + ': ' + e.message); }
}
function eq(a, b, msg) { if (a !== b) throw new Error((msg || '') + ' got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b)); }
function chart(w, h) { const p = KS.blank('t', w, h); return p; }

t('stripes: cycle list wraps, band height respected', () => {
  const p = chart(8, 6);
  const n = PT.fillChart(p, { kind: 'stripes', cycle: 'a,b', rowH: 2 });
  eq(n, 48);
  eq(p.rows[0], 'aaaaaaaa');
  eq(p.rows[1], 'aaaaaaaa');
  eq(p.rows[2], 'bbbbbbbb');
  eq(p.rows[3], 'bbbbbbbb');
  eq(p.rows[4], 'aaaaaaaa'); // cycle wraps
  const q = chart(8, 4);
  PT.fillChart(q, { kind: 'stripes', cycle: 'a,b,7', rowH: 1 });
  eq(q.rows.map((r) => r[0]).join(''), 'ab7a');
});

t('checker + twill geometry', () => {
  const p = chart(6, 6);
  PT.fillChart(p, { kind: 'checker', a: 'a', b: 'b', block: 2 });
  eq(p.rows[0].substring(0, 4), 'aabb');
  eq(p.rows[2].substring(0, 4), 'bbaa');
  const q = chart(6, 6);
  PT.fillChart(q, { kind: 'twill', a: 'a', b: 'b', block: 2 });
  eq(q.rows[0].substring(0, 4), 'aabb');
  // one diagonal band: (2,0), (1,1), (0,2) share color
  eq(q.rows[0][2] + q.rows[1][1] + q.rows[2][0], 'bbb');
});

t('stitch textures: rib, seed, basket, garter, stockinette', () => {
  const p = chart(6, 4);
  PT.fillChart(p, { kind: 'rib', group: 1 });
  eq(p.rows[0], 'kxkxkx');
  const q = chart(4, 4);
  PT.fillChart(q, { kind: 'seed' });
  eq(q.rows[0], 'kxkx'); eq(q.rows[1], 'xkxk');
  const b = chart(4, 4);
  PT.fillChart(b, { kind: 'basket', block: 2 });
  eq(b.rows[0], 'kkxx'); eq(b.rows[2], 'xxkk');
  const g = chart(4, 4);
  PT.fillChart(g, { kind: 'garter', rowH: 1 });
  eq(g.rows[0], 'kkkk'); eq(g.rows[1], 'xxxx');
  const s = chart(3, 3);
  PT.fillChart(s, { kind: 'stockinette' });
  eq(s.rows.join(''), 'kkkkkkkkk');
});

t('fillRect: region clamped, pattern origin at region corner, half-open', () => {
  const p = chart(10, 10);
  const n = PT.fillRect(p, 8, 8, 20, 20, { kind: 'stripes', cycle: 'a,b', rowH: 2 });
  eq(n, 4); // 2x2 clamp at bottom-right
  eq(p.rows[8], '........aa'); // region row 0 = first cycle color...
  eq(p.rows[9], '........aa'); // ...band height 2 covers both rows
  eq(p.rows[7], '..........'); // above region untouched
  const q = chart(6, 6);
  PT.fillRect(q, 1, 0, 3, 2, { kind: 'checker', a: 'a', b: 'b', block: 1 });
  eq(q.rows[0], '.ab...');
  eq(q.rows[1], '.ba...');
  eq(q.rows[2], '......'); // y=2 exclusive
});

t('params: defaults, int coercion, unknown kind and bad colors rejected', () => {
  const p = chart(4, 4);
  PT.fillChart(p, { kind: 'checker' }); // defaults a/b/block4
  eq(p.rows[0], 'aaaaaaaa'.substring(0, 4));
  PT.fillChart(p, { kind: 'rib', group: '2.6' }); // coerced to 3? rounds to 3 -> kkkx
  eq(p.rows[0], 'kkkx');
  let errs = 0;
  try { PT.fillChart(p, { kind: 'argyle' }); } catch (e) { errs += /unknown pattern/.test(e.message) ? 1 : 0; }
  try { PT.fillChart(p, { kind: 'stripes', cycle: 'a,zz' }); } catch (e) { errs += /not a color/.test(e.message) ? 1 : 0; }
  try { PT.fillChart(p, { kind: 'stripes', cycle: '  ' }); } catch (e) { errs += /empty/.test(e.message) ? 1 : 0; }
  try { PT.fillChart(p, { kind: 'checker', a: 'k' }); } catch (e) { errs += /not a color/.test(e.message) ? 1 : 0; }
  eq(errs, 4);
});

t('filled charts stay valid and instructable', () => {
  const p = chart(12, 8);
  PT.fillChart(p, { kind: 'checker', a: 'a', b: '7', block: 3 });
  KS.validate(p);
  const txt = KS.toText(p);
  if (!/a3/.test(txt) || !/73/.test(txt)) throw new Error('instructions miss pattern colors: ' + txt.split('\n')[3]);
  if (/no-work/.test(txt)) throw new Error('no-work crept back');
  const g = PT.previewGrid('rib', 4, 2, { group: 2 });
  eq(g.join('|'), 'kkxx|kkxx');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
