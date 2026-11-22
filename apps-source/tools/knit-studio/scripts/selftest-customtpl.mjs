/* knit-studio custom templates selftest:
 * node scripts/selftest-customtpl.mjs */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const KS = require('../public/core.js');
KS.shaping = require('../public/shaping.js');
globalThis.KS = KS;
const CT = require('../public/customtpl.js');
const SH = require('../public/shaping.js');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('ok   ' + name); }
  catch (e) { fail++; console.log('FAIL ' + name + ': ' + e.message); }
}
function eq(a, b, msg) {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  if (ja !== jb) throw new Error((msg || '') + ' got ' + ja + ' want ' + jb);
}
const G = { stsPer10cm: 20, rowsPer10cm: 25 };

function fakeStorage() {
  const m = {};
  return {
    getItem: (k) => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); }
  };
}

function shawlSpec() {
  const s = CT.blank();
  s.name = 'Test shawl';
  s.fields = [{ key: 'len', label: 'Length', def: 60, min: 5, max: 200 }];
  s.panels = [{
    name: 'Shawl', role: 'other',
    width: { mode: 'cm', cm: 120 }, length: { mode: 'field', key: 'len' },
    topCm: 100, bottomCm: 0, bandTop: 0, bandBottom: 10, mirror: false
  }];
  return s;
}

t('validate: blanks pass, junk rejected', () => {
  eq(CT.validate(CT.blank()), []);
  eq(CT.validate(shawlSpec()), []);
  if (CT.validate({ name: '', fields: [], panels: [{ name: 'x', role: 'nope', width: { mode: 'cm', cm: 0 } }] }).length < 3) {
    throw new Error('junk accepted too easily');
  }
  const dup = CT.blank();
  dup.fields = [{ key: 'a', label: 'A', def: 10, min: 1, max: 100 }, { key: 'a', label: 'A2', def: 10, min: 1, max: 100 }];
  if (!CT.validate(dup).some((e) => e.includes('duplicate'))) throw new Error('dup key missed');
  const ghost = CT.blank();
  ghost.panels[0].width = { mode: 'field', key: 'nothere' };
  if (!CT.validate(ghost).some((e) => e.includes('unknown field'))) throw new Error('ghost field ref missed');
});

t('build shawl: tapers to target width, fabric never vanishes', () => {
  const built = CT.build(shawlSpec(), { len: 60 }, G);
  const shape = built.panels[0].shape;
  eq(SH.check(shape), []);
  KS.validate(SH.toPattern(shape));
  const p = SH.profile(shape);
  const wAt = (i) => p.hi[i] - p.lo[i];
  if (wAt(p.H - 1) < 30 || wAt(p.H - 1) > 50) throw new Error('top width ' + wAt(p.H - 1) + ' want ~40');
  let minW = 1e9;
  for (let i = 0; i < p.H; i++) minW = Math.min(minW, wAt(i));
  if (minW < 10) throw new Error('fabric collapsed to ' + minW);
  const decs = shape.edges.left.filter((s) => s.kind === 'dec');
  decs.forEach((s) => {
    if (s.every < 2) throw new Error('dec every ' + s.every + ' stinks of chunky');
    if (s.times < 2) throw new Error('taper not spread out');
  });
});

t('build trapezoid: bottom widens, top narrows, field values honored', () => {
  const s = CT.blank();
  s.name = 'Tee front';
  s.fields = [{ key: 'w', label: 'Width', def: 46, min: 5, max: 200 },
    { key: 'l', label: 'Length', def: 60, min: 5, max: 200 }];
  s.panels = [{
    name: 'Front', role: 'front',
    width: { mode: 'field', key: 'w' }, length: { mode: 'field', key: 'l' },
    topCm: 10, bottomCm: 8, bandTop: 0, bandBottom: 8, mirror: false
  }];
  const built = CT.build(s, { w: 46, l: 60 }, G);
  const shape = built.panels[0].shape;
  eq(SH.check(shape), []);
  const kinds = shape.edges.left.map((x) => x.kind);
  eq(kinds, ['straight', 'inc', 'straight', 'dec']);
  const p = SH.profile(shape);
  const wAt = (i) => p.hi[i] - p.lo[i];
  const fullW = Math.round(46 / 10 * 20);
  if (Math.abs(wAt(0) - (fullW - 16)) > 2) throw new Error('caston ' + wAt(0) + ' want ~' + (fullW - 16));
  if (Math.abs(wAt(p.H - 1) - (fullW - 20)) > 2) throw new Error('top ' + wAt(p.H - 1) + ' want ~' + (fullW - 20));
});

t('build guards: no gauge, zero dims, tiny bands', () => {
  const s = shawlSpec();
  let threw = false;
  try { CT.build(s, { len: 60 }, null); } catch (e) { threw = /gauge/.test(e.message); }
  if (!threw) throw new Error('gauge-less build survived');
  threw = false;
  try { CT.build(s, {}, G); } catch (e) { threw = /resolve to 0/.test(e.message); }
  if (!threw) throw new Error('zero-dims build survived');
  const tiny = CT.blank();
  tiny.name = 'Tiny';
  tiny.panels = [{
    name: 'P', role: 'other', width: { mode: 'cm', cm: 10 }, length: { mode: 'cm', cm: 4 },
    topCm: 6, bottomCm: 4, bandTop: 40, bandBottom: 40, mirror: false
  }];
  const built = CT.build(tiny, {}, G);
  if (!built.notes.some((n) => n.includes('bands trimmed'))) throw new Error('no trim warning');
  eq(SH.check(built.panels[0].shape), []);
});

t('storage: save/list/get/update/remove roundtrip', () => {
  CT._setStorage(fakeStorage());
  eq(CT.list(), []);
  const saved = CT.save(shawlSpec());
  if (!saved.id.startsWith('c-test-shawl-')) throw new Error('id ' + saved.id);
  eq(CT.list().length, 1);
  if (!CT.get(saved.id)) throw new Error('get miss');
  const edited = JSON.parse(JSON.stringify(saved));
  edited.name = 'Test shawl v2';
  CT.save(edited);
  eq(CT.list().length, 1);
  eq(CT.get(saved.id).name, 'Test shawl v2');
  CT.remove(saved.id);
  eq(CT.list(), []);
});

t('fromJson: id dropped, invalid rejected', () => {
  CT._setStorage(fakeStorage());
  const s = shawlSpec();
  s.id = 'victim';
  const imported = CT.fromJson(JSON.stringify(s));
  eq(imported.id, '');
  let threw = false;
  try { CT.fromJson('{"name":"","fields":[],"panels":[]}'); } catch (e) { threw = /invalid template/.test(e.message); }
  if (!threw) throw new Error('invalid import survived');
});

t('storage: real key, legacy dict migration, foreign junk never crashes list', () => {
  const KEY = CT.KEY, LEGACY = CT.LEGACY_KEY;
  if (KEY !== 'ks-custom' + '-templates') throw new Error('KEY drifted: ' + KEY);
  if (LEGACY !== '*'.repeat(3)) throw new Error('legacy key drifted');
  const mem = {};
  CT._setStorage({ getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } });
  // user scenario: another module's id-keyed dict squatting the legacy key
  mem[LEGACY] = JSON.stringify({ st1: { id: 'st1', name: 'migratable' }, st2: 'junk-string' });
  const got = CT.list();
  if (got.length !== 1 || got[0].name !== 'migratable') throw new Error('legacy dict not salvaged: ' + JSON.stringify(got));
  if (!Array.isArray(JSON.parse(mem[KEY]))) throw new Error('migration did not persist an array to the real key');
  // object squatting the CURRENT key: salvaged as values, still an array out
  mem[KEY] = JSON.stringify({ a: { id: 'a', name: 'x' } });
  if (CT.list().length !== 1) throw new Error('object under real key not salvaged');
  // string/number/null junk: empty array, never a throw
  for (const junk of ['"garbage"', '42', 'null', '{oops']) {
    mem[KEY] = junk; delete mem[LEGACY];
    if (!Array.isArray(CT.list()) || CT.list().length) throw new Error('junk leaked: ' + junk);
  }
  // save() recovers the salvaged items and writes a clean array
  mem[KEY] = JSON.stringify({ s: { id: 's', name: 'kept' } });
  const arr = CT.list();
  if (CT.get('s') === null) throw new Error('get lost salvaged item');
  CT.remove('s');
  if (JSON.parse(mem[KEY]).length !== 0) throw new Error('remove did not persist array');
  CT._setStorage(null);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
