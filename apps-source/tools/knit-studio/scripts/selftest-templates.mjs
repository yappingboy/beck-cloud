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

t('socks: instep+sole panels per sock, top width = half foot circumference', () => {
  const built = TP.build('socks', TP.defaults('socks'), G, {});
  if (built.panels.length !== 4) throw new Error('panels');
  const shape = SH.normalize(built.panels[0].shape);
  const p = SH.profile(shape);
  const footSts = Math.round(22 / 10 * 22);
  const w0 = p.hi[0] - p.lo[0];
  const wEnd = p.hi[p.H - 1] - p.lo[p.H - 1];
  if (Math.abs(w0 - footSts / 2) > 4) throw new Error('cast-on ' + w0 + ' want ~' + footSts / 2);
  if (!(wEnd < w0 / 2 + 2)) throw new Error('toe must round down, got ' + wEnd + ' from ' + w0);
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
    if (['socks', 'sweater', 'cardigan', 'beanie', 'tshirt'].includes(tpl.id) && !withAnn.length) {
      throw new Error(tpl.id + ': expected guidance annotations');
    }
    withAnn.forEach((pn) => {
      const n = SH.normalize(pn.shape);
      if (!n.annotations.length) throw new Error(tpl.id + '/' + pn.name + ': annotations lost');
    });
  });
});

t('tshirt: every collar variant builds valid panels', () => {
  ['crew', 'scoop', 'v-neck', 'polo', 'henley'].forEach((c) => {
    const built = TP.build('tshirt', Object.assign(TP.defaults('tshirt'), { collar: c }), G, {});
    built.panels.forEach((pn) => {
      const shape = SH.normalize(pn.shape);
      const errs = SH.check(shape);
      if (errs.length) throw new Error(c + '/' + pn.name + ': ' + errs.join('; '));
      KS.validate(SH.toPattern(shape, pn.name));
    });
  });
});

t('tshirt: collar changes the panel set', () => {
  const d = TP.defaults('tshirt');
  const crew = TP.build('tshirt', Object.assign({}, d, { collar: 'crew' }), G, {});
  if (!crew.panels.some((p) => p.role === 'collar')) throw new Error('crew needs neckband');
  if (crew.panels.some((p) => p.role === 'placket')) throw new Error('crew has plackets');
  const polo = TP.build('tshirt', Object.assign({}, d, { collar: 'polo' }), G, {});
  if (!polo.panels.some((p) => p.role === 'placket')) throw new Error('polo placket missing');
  const hen = TP.build('tshirt', Object.assign({}, d, { collar: 'henley' }), G, {});
  if (hen.panels.filter((p) => p.role === 'placket').length < 2) throw new Error('henley needs two plackets');
  const v = TP.build('tshirt', Object.assign({}, d, { collar: 'v-neck' }), G, {});
  if (v.panels.filter((p) => p.role === 'front').length !== 2) throw new Error('v-neck must split front');
  if (v.panels.filter((p) => p.role === 'collar').length !== 1) throw new Error('v-neck bias strips missing');
});

t('templates: select field rejects unknown option, accepts valid', () => {
  const d = TP.defaults('tshirt');
  if (TP.validate('tshirt', Object.assign({}, d, { collar: 'turtleneck' }), G).length === 0) {
    throw new Error('turtleneck accepted');
  }
  if (TP.validate('tshirt', Object.assign({}, d, { collar: 'scoop' }), G).length) throw new Error('scoop rejected');
});

t('sleeve tapers are smooth: <=2 sts per event, spread over many rows', () => {
  ['sweater', 'cardigan', 'tshirt'].forEach((id) => {
    const built = TP.build(id, TP.defaults(id), G, {});
    const sl = built.panels.find((p) => /sleeve l/i.test(p.name));
    if (!sl) throw new Error(id + ': no sleeve panel');
    const incs = sl.shape.edges.left.filter((x) => x.kind === 'inc');
    if (!incs.length) throw new Error(id + ': no taper increases');
    incs.forEach((x) => {
      if (x.each > 2) throw new Error(id + ': chunky +' + x.each + ' sts in one event');
      if (x.times < 2) throw new Error(id + ': taper not spread over multiple events');
      if (x.every < 2) throw new Error(id + ': increases more often than every 2nd row');
    });
  });
});

t('socks: side-seam instep+sole panels, heel tapers in and out', () => {
  const built = TP.build('socks', TP.defaults('socks'), G, {});
  if (built.panels.length !== 4) throw new Error('expected instep+sole per sock, got ' + built.panels.length);
  const sole = built.panels.find((p) => /sole/.test(p.name));
  const segs = sole.shape.edges.left;
  if (segs.some((x) => x.kind === 'hold' || x.kind === 'sr')) throw new Error('heel must shape width, not short-rows');
  const d = segs.map((x) => x.kind);
  if (d.indexOf('dec') < 0 || d.indexOf('inc') < 0 || d.indexOf('inc') <= d.indexOf('dec')) {
    throw new Error('heel must taper in then out: ' + d.join(','));
  }
  const instep = built.panels.find((p) => /instep/.test(p.name));
  if (instep.shape.edges.left.some((x) => x.kind !== 'straight' && x.kind !== 'st' && x.kind !== 'dec')) {
    throw new Error('instep must stay straight except toe');
  }
  built.panels.forEach((pn) => {
    const errs = SH.check(pn.shape);
    if (errs.length) throw new Error(pn.name + ': ' + errs.join('; '));
  });
});

t('shoulder options: sweater/cardigan/tshirt build valid for all modes', () => {
  ['sweater', 'cardigan', 'tshirt'].forEach((id) => {
    ['straight', 'shortrow', 'wedge'].forEach((mode) => {
      const built = TP.build(id, Object.assign(TP.defaults(id), { shoulder: mode }), G, {});
      built.panels.forEach((pn) => {
        const errs = SH.check(pn.shape);
        if (errs.length) throw new Error(id + '/' + mode + '/' + pn.name + ': ' + errs.join('; '));
        KS.validate(SH.toPattern(pn.shape, pn.name));
      });
      if (mode === 'straight') {
        const body = built.panels.find((p) => p.role === 'back' || p.role === 'front');
        const tops = body.shape.edges.left.filter((x) => x.kind === 'sr' || x.kind === 'dec');
        if (tops.length) throw new Error(id + ': straight shoulders still slope');
      }
    });
  });
});

t('shoulder modes differ: wedge consumes more rows than straight', () => {
  const d = TP.defaults('tshirt');
  const flat = TP.build('tshirt', Object.assign({}, d, { shoulder: 'straight' }), G, {});
  const wedge = TP.build('tshirt', Object.assign({}, d, { shoulder: 'wedge' }), G, {});
  const kinds = (b) => b.panels.find((p) => p.role === 'back').shape.edges.left.map((x) => x.kind).join(',');
  if (!kinds(wedge).includes('dec')) throw new Error('wedge mode produced no wedge: ' + kinds(wedge));
  if (kinds(flat).includes('dec') || kinds(flat).includes('sr')) throw new Error('straight mode shaped: ' + kinds(flat));
});

t('neck size: bigger neckW grows the neckband; deeper neckRow moves annotation', () => {
  const d = TP.defaults('sweater');
  const narrow = TP.build('sweater', Object.assign({}, d, { neckW: 14, neckD: 7 }), G, {});
  const wide = TP.build('sweater', Object.assign({}, d, { neckW: 26, neckD: 14 }), G, {});
  const band = (b) => b.panels.find((p) => p.role === 'collar').shape.width;
  if (!(band(wide) > band(narrow))) throw new Error('neckband did not grow: ' + band(narrow) + ' -> ' + band(wide));
  const annRow = (b) => Math.min(...(b.panels.find((p) => p.role === 'front').shape.annotations || [])
    .filter((a) => /front neck/.test(a.text)).map((a) => a.row));
  if (!(annRow(wide) < annRow(narrow))) throw new Error('deeper neck annotation not higher up');
});

t('tshirt neck size drives tee neckband too', () => {
  const d = TP.defaults('tshirt');
  const a = TP.build('tshirt', Object.assign({}, d, { collar: 'crew', neckW: 15, neckD: 8 }), G, {});
  const b = TP.build('tshirt', Object.assign({}, d, { collar: 'crew', neckW: 28, neckD: 16 }), G, {});
  const w = (p) => p.panels.find((x) => x.role === 'collar').shape.width;
  if (!(w(b) > w(a))) throw new Error('tee neckband static: ' + w(a) + ' -> ' + w(b));
});

t('polo/henley split the center front with opening annotation', () => {
  const d = TP.defaults('tshirt');
  ['polo', 'henley'].forEach((c) => {
    const b = TP.build('tshirt', Object.assign({}, d, { collar: c }), G, {});
    const fronts = b.panels.filter((p) => p.role === 'front');
    if (fronts.length !== 2) throw new Error(c + ' must split front into two panels, got ' + fronts.length);
    const anns = fronts.flatMap((p) => (p.shape.annotations || []).map((a) => a.text)).join(' | ');
    if (!/center front opening/.test(anns)) throw new Error(c + ' missing opening annotation: ' + anns);
    const pl = b.panels.filter((p) => p.role === 'placket');
    if (!pl.length) throw new Error(c + ' needs placket');
    if (!pl.some((p) => (p.shape.annotations || []).some((a) => /sew behind/.test(a.text)))) {
      throw new Error(c + ' placket missing sew-behind annotation');
    }
  });
  const crew = TP.build('tshirt', Object.assign({}, d, { collar: 'crew' }), G, {});
  if (crew.panels.filter((p) => p.role === 'front').length !== 1) throw new Error('crew front must stay whole');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
