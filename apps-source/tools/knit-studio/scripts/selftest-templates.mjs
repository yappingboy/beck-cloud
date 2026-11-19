/* knit-studio templates selftest: node scripts/selftest-templates.mjs */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KS = require(path.join(__dirname, '../public/core.js'));
const SH = require(path.join(__dirname, '../public/shaping.js'));
globalThis.KS = { shaping: SH }; // project/chart helpers hook
const TP = require(path.join(__dirname, '../public/templates.js'));

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('ok   ' + name); }
  catch (e) { fail++; console.log('FAIL ' + name + ': ' + e.message); }
}

const G = { stsPer10cm: 22, rowsPer10cm: 30 };

function everyPanelOk(id) {
  const built = TP.build(id, TP.defaults(id), G, {});
  if (!built.panels.length) throw new Error(id + ': no panels');
  built.panels.forEach((pn) => {
    const shape = SH.normalize(pn.shape);
    const errs = SH.check(shape);
    if (errs.length) throw new Error(id + '/' + pn.name + ': ' + errs.join('; '));
    const pat = SH.toPattern(shape, pn.name);
    KS.validate(pat);
    if (pat.height < 4 || pat.width < 8) throw new Error(id + '/' + pn.name + ' degenerate');
    const p = SH.profile(shape);
    if (p.lo.some((v, i) => p.hi[i] - v < 1)) throw new Error(id + '/' + pn.name + ' pinched');
  });
  return built;
}

for (const tpl of TP.TEMPLATES) {
  t(tpl.id + ': every panel passes shaping check + chart validate', () => { everyPanelOk(tpl.id); });
}

t('socks: 2 panels, toe closes to half the foot width', () => {
  const built = TP.build('socks', TP.defaults('socks'), G, {});
  if (built.panels.length !== 2) throw new Error('panels');
  const shape = SH.normalize(built.panels[0].shape);
  const p = SH.profile(shape);
  const footSts = Math.round(22 / 10 * 22);
  const topW = p.hi[p.H - 1] - p.lo[p.H - 1];
  if (Math.abs(topW - footSts / 2) > 4) throw new Error('top ' + topW + ' want ~' + footSts / 2);
});

t('scaling: +10 cm bust widens back panel, taller gauge widens more', () => {
  const d = TP.defaults('sweater');
  const small = TP.build('sweater', Object.assign({}, d, { chest: 86 }), G, {});
  const big = TP.build('sweater', Object.assign({}, d, { chest: 106 }), G, {});
  const w = (b) => { const p = SH.profile(SH.normalize(b.panels.find((x) => x.role === 'back').shape)); return p.hi[p.H - 1] - p.lo[p.H - 1]; };
  if (!(w(big) > w(small) + 8)) throw new Error(w(small) + ' -> ' + w(big)); // +10cm bust = +11st on half-back
  const tightG = { stsPer10cm: 28, rowsPer10cm: 30 };
  const tight = TP.build('sweater', d, tightG, {});
  if (w(tight) <= w(big)) throw new Error('finer gauge must widen stitchwise');
});

t('shawl top width reaches wingspan in stitches', () => {
  const built = TP.build('shawl', TP.defaults('shawl'), G, {});
  const shape = SH.normalize(built.panels[0].shape);
  const p = SH.profile(shape);
  const topW = p.hi[p.H - 1] - p.lo[p.H - 1];
  const want = Math.round(170 / 10 * 22);
  if (Math.abs(topW - want) / want > 0.12) throw new Error('top ' + topW + ' want ~' + want);
});

t('validate: missing gauge and out-of-range dims rejected', () => {
  const d = TP.defaults('beanie');
  const e1 = TP.validate('beanie', d, null);
  if (!e1.some((x) => x.includes('gauge'))) throw new Error('gauge error missing');
  const e2 = TP.validate('beanie', Object.assign({}, d, { headCirc: 200 }), G);
  if (!e2.length) throw new Error('range error missing');
  let threw = false;
  try { TP.build('beanie', Object.assign({}, d, { headCirc: 200 }), G, {}); }
  catch (err) { threw = err.code === 'dims'; }
  if (!threw) throw new Error('build must throw code=dims');
});

t('unknown template id rejected', () => {
  if (!TP.validate('toga', {}, G).length) throw new Error('validate');
});

t('unit helpers round-trip within rounding', () => {
  const cm = 56;
  if (Math.abs(TP.inToCm(TP.cmToIn(cm)) - cm) > 0.3) throw new Error('roundtrip');
});

t('annotations survive normalize on every template panel', () => {
  TP.TEMPLATES.forEach((tpl) => {
    const built = TP.build(tpl.id, TP.defaults(tpl.id), G, {});
    const withAnn = built.panels.filter((pn) => (pn.shape.annotations || []).length);
    if (['socks', 'sweater', 'cardigan', 'beanie'].includes(tpl.id) && !withAnn.length) {
      throw new Error(tpl.id + ': expected guidance annotations');
    }
    withAnn.forEach((pn) => {
      const n = SH.normalize(pn.shape);
      if (!n.annotations.length) throw new Error(tpl.id + '/' + pn.name + ': annotations lost');
    });
  });
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
