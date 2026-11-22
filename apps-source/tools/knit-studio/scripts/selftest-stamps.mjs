/* stamps selftest: model, transforms, ASCII text, composite, storage. */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KS = require(path.join(__dirname, '../public/core.js'));
globalThis.KS = KS; // stamps.js resolves core lazily
const ST = require(path.join(__dirname, '../public/stamps.js'));

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('ok   ' + name); pass++; }
  catch (e) { console.log('FAIL ' + name + ': ' + e.message); fail++; }
}
function eq(a, b, msg) { if (a !== b) throw new Error((msg || '') + ' got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b)); }

t('create + model basics', () => {
  const s = ST.create('heart', 4, 3);
  eq(s.w, 4); eq(s.h, 3); eq(s.rows.join('|'), '....|....|....');
  ST.paint(s, 1, 1, 0);
  eq(s.rows[1], '.a..');
  eq(s.colors.length, 1); eq(s.colors[0].hex, KS.COLOR_RAMP[0]);
  if (ST.check(s).length) throw new Error('valid stamp failed check');
  if (!ST.set(s, 1, 1, '.')) throw new Error('erase failed');
  eq(s.rows[1], '....');
});

t('normalize drops junk cells and bad colors', () => {
  const s = ST.normalize({ name: 'x', w: 3, h: 2, rows: ['aZ?', 'kk.'], colors: [{ hex: '#zzzzzz' }, { name: 'ok', hex: '#010203' }] });
  eq(s.rows[0], 'aZ.');
  eq(s.colors[0].hex, KS.COLOR_RAMP[0]);
  eq(s.colors[1].name, 'ok');
});

t('flip / rotate / zoom geometry', () => {
  const s = ST.create('t', 2, 2);
  ST.paint(s, 0, 0, 0); // top-left a
  ST.flipH(s); eq(s.rows[0], '.a');
  ST.flipV(s); eq(s.rows[1], '.a');
  const r = ST.rotate90(ST.normalize({ w: 2, h: 1, rows: ['a.'] }));
  eq(r.w + 'x' + r.h, '1x2');
  eq(r.rows[0] + '|' + r.rows[1], 'a|.'); // clockwise: left cell rises to top
  const z = ST.zoom(ST.normalize({ w: 2, h: 1, rows: ['a.'] }), 3);
  eq(z.w, 6); eq(z.rows[0], 'aaa...');
});

t('importText legend + body, transparent dots and spaces', () => {
  const s = ST.importText('x', 'r = #d33682 Red\nb:#268bd2 Blue\nr r . b\nrb.b');
  eq(s.w, 4); eq(s.h, 2);
  eq(s.colors.length, 2); eq(s.colors[1].hex, '#268bd2');
  // dense and spaced parses agree; '.' stays transparent
  eq(s.rows[0], 'aa.b'); // spaced body: r r . b
  eq(s.rows[1], 'ab.b'); // dense body: rb.b
  let threw = false;
  try { ST.importText('x', 'r = #d33682 Red\nq.r'); } catch (e) { threw = /legend/.test(e.message); }
  if (!threw) throw new Error('unknown body char must throw with legend hint');
});

t('exportText round-trips through importText', () => {
  const s = ST.importText('rt', 'r = #d33682 Red\nr.r\nrrr');
  const txt = ST.exportText(s);
  const back = ST.importText('rt2', txt);
  eq(back.rows.join('|'), s.rows.join('|'));
  eq(back.colors.length, s.colors.length);
  eq(back.colors[0].hex, '#d33682');
});

t('library motifs normalize and apply', () => {
  const lib = ST.library();
  if (lib.length < 4) throw new Error('stock library too small');
  lib.forEach((motif) => {
    if (ST.check(motif).length) throw new Error(motif.name + ' invalid');
    if (!motif.rows.join('').replace(/\./g, '').length) throw new Error(motif.name + ' empty');
    const p = KS.blank(motif.name + ' chart', motif.w + 4, motif.h + 4);
    const r = ST.apply(p, 2, 2, motif);
    if (r.written <= 0) throw new Error(motif.name + ' wrote nothing');
    KS.validate(p);
  });
});

t('apply: transparent skip, hex reuse, new slot append, bounds', () => {
  const p = KS.blank('chart', 10, 6);
  p.colors = [{ name: 'Berry', hex: '#d33682' }, { name: 'Blue', hex: '#268bd2' }];
  const s = ST.importText('dot', 'r = #d33682 Berry\nb = #00ff00 Neon\nrb\nb.');
  const res = ST.apply(p, 1, 2, s);
  eq(res.written, 3); // '.' skipped
  eq(res.slots[0].code, 'a', 'berry hex matched existing slot a');
  eq(res.slots[1].code, '0', 'neon appended new slot "0" (third of ab01...)');
  eq(p.rows[2].substring(1, 3), 'a0');
  eq(p.colors.length, 3); eq(p.colors[2].hex, '#00ff00');
  eq(p.rows[3].substring(1, 3), '0.', 'transparent cell untouched');
  let threw = false;
  try { ST.apply(p, 9, 5, s); } catch (e) { threw = /fit/.test(e.message); }
  if (!threw) throw new Error('out of bounds must throw without clip');
  const r2 = ST.apply(p, 9, 5, s, { clip: true });
  if (r2.written <= 0) throw new Error('clip apply wrote nothing');
  KS.validate(p);
});

t('apply: new color on a full chart fails clean', () => {
  const p = KS.blank('full', 12, 12);
  p.colors = KS.COLOR_CODES.map((c, i) => ({ name: 'c' + i, hex: '#0000' + (i < 10 ? '0' : '') + i.toString(16).padStart(2, '0') }));
  const s = ST.importText('new', 'n = #123456 Nope\nn.n');
  let threw = false;
  try { ST.apply(p, 0, 0, s); } catch (e) { threw = /free color slots/.test(e.message); }
  if (!threw) throw new Error('expected no-free-slots error');
  eq(p.rows[0], '............'); // chart untouched on failure
});

t('storage: save/list/getStamp/remove roundtrip', () => {
  const mem = {};
  ST._setStorage({ getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } });
  const s = ST.importText('saved', 'r = #d33682 Red\nrr');
  const id = ST.save(s);
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) throw new Error('bad id ' + id);
  const rows = ST.list();
  eq(rows.length, 1); eq(rows[0].name, 'saved'); eq(rows[0].colors, 1);
  const got = ST.getStamp(id);
  eq(got.rows.join('|'), s.rows.join('|'));
  const again = ST.save(Object.assign({}, got, { name: 'saved2' }));
  if (again !== id) throw new Error('explicit id must update in place');
  eq(ST.list().length, 1);
  if (!ST.remove(id)) throw new Error('remove failed');
  eq(ST.list().length, 0);
  eq(ST.getStamp(id), null);
  eq(ST.remove('nope'), false);
  ST._setStorage(null);
});

t('apply keeps pattern valid for toText', () => {
  const p = KS.blank('toText', 16, 16);
  const motif = ST.library()[0];
  ST.apply(p, 1, 1, motif);
  KS.validate(p);
  const txt = KS.toText(p);
  if (/no-work/.test(txt)) throw new Error('stamped chart regressed no-work fix');
  if (!/a\d/.test(txt)) throw new Error('stamp color missing from instructions: ' + txt.split('\n').slice(3, 6).join(' / '));
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
