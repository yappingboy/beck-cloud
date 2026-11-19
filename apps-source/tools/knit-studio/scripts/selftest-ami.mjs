/* knit-studio amigurumi importer selftest:
 * node scripts/selftest-ami.mjs */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const KS = require('../public/core.js');
KS.shaping = require('../public/shaping.js');
globalThis.KS = KS;
const AMI = require('../public/ami.js');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('ok   ' + name); }
  catch (e) { fail++; console.log('FAIL ' + name + ': ' + e.message); }
}
function eq(a, b, msg) {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  if (ja !== jb) throw new Error((msg || '') + ' got ' + ja + ' want ' + jb);
}

const BEAR = `Amigurumi bear head
R1: MR 6sc
R2: inc x6 (12)
R3: *sc, inc* x6 (18)
Rnd 4: *2sc, inc* x6 (24)
R5-8: sc (24)
R9: *2sc, dec* x6 (18)
Round 10: *sc, dec* x6 (12)
R11: dec x6 (6)`;

t('parse canonical bear head', () => {
  const p = AMI.parseRoundText(BEAR);
  eq(p.errors, []);
  eq(p.rounds.map(r => r.sts), [6, 12, 18, 24, 24, 24, 24, 24, 18, 12, 6]);
  eq(p.rounds.map(r => r.label)[0], 'R1');
  eq(p.rounds.map(r => r.label).slice(-1)[0], 'R11');
});

t('parse header variants: Round N / Rnd N / Row N', () => {
  const p = AMI.parseRoundText('Round 1: MR 6sc\nRnd 2: inc (12)\nRow 3: sc (12)');
  eq(p.rounds.map(r => r.sts), [6, 12, 12]);
});

t('delta fallback without totals: inc x6 / dec x6', () => {
  const p = AMI.parseRoundText('R1: MR 6sc\nR2: inc x6 around\nR3: sc even\nR4: dec x6');
  eq(p.errors, []);
  eq(p.rounds.map(r => r.sts), [6, 12, 12, 6]);
});

t('"N inc" and "dec N" multiplier forms', () => {
  const p = AMI.parseRoundText('R1: MR 6sc\nR2: 6 inc\nR3: 3 dec');
  eq(p.errors, []);
  eq(p.rounds.map(r => r.sts), [6, 12, 9]);
});

t('range expands per round with even body', () => {
  const p = AMI.parseRoundText('R1: MR 6sc (6)\nR2: inc (12)\nR3-7: sc (12)\nR8: dec (6)');
  eq(p.rounds.length, 8);
  eq(p.rounds.map(r => r.sts), [6, 12, 12, 12, 12, 12, 12, 6]);
});

t('non-pattern lines ignored; unresolvable rounds reported not guessed', () => {
  const p = AMI.parseRoundText('Leave long tail.\nR1: MR 6sc\nseam and stuff');
  eq(p.rounds.map(r => r.sts), [6]);
  eq(p.errors, []);
  const q = AMI.parseRoundText('R1: work some nonsense here');
  eq(q.rounds.length, 0);
  if (q.errors.length !== 1) throw new Error('expected one error');
});

t('amiToShape split=2 -> mirrored widths, symmetric segments', () => {
  const counts = AMI.parseRoundText(BEAR).rounds.map(r => r.sts);
  const res = AMI.amiToShape(counts, { split: 2 });
  eq(res.widths, [3, 6, 9, 12, 12, 12, 12, 12, 9, 6, 3]);
  eq(res.shape.edges.left, res.shape.edges.right);
  if (res.shape.width !== 12) throw new Error('base width ' + res.shape.width);
  if (!res.shape.mirror) throw new Error('mirror flag');
});

t('amiToShape -> valid shaping model -> valid chart', () => {
  const counts = [6, 12, 18, 24, 24, 18, 12, 6];
  const res = AMI.amiToShape(counts, { split: 2 });
  const shape = KS.shaping.normalize(res.shape);
  const errs = KS.shaping.check(shape);
  if (errs.length) throw new Error('shaping check: ' + errs.join('; '));
  const pat = KS.validate(KS.shaping.toPattern(shape));
  if (pat.height < 6) throw new Error('chart too short: ' + pat.height);
  if (pat.width < 12) throw new Error('chart too narrow: ' + pat.width);
});

t('gauge conversion rescales widths', () => {
  // crochet 20 sts/10cm -> knit 10 sts/10cm halves everything
  const res = AMI.amiToShape([20, 40, 40, 20], { split: 2, amiSts10: 20, knitSts10: 10 });
  eq(res.widths, [5, 10, 10, 5]);
  if (!res.warnings.some(w => /gauge converted/.test(w))) throw new Error('missing gauge note');
});

t('split=1 keeps full circumference width', () => {
  const res = AMI.amiToShape([24, 24], { split: 1 });
  eq(res.widths, [24, 24]);
});

t('odd round counts warn but still convert', () => {
  const res = AMI.amiToShape([7, 7], { split: 2 });
  if (!res.warnings.some(w => /odd/.test(w))) throw new Error('missing odd warning');
  eq(res.widths, [4, 4]);
});

t('roundsToChart builds bottom-up strip chart', () => {
  const pat = KS.validate(AMI.roundsToChart([6, 12, 6], { name: 'ball' }));
  eq([pat.width, pat.height], [12, 3]);
  if (!pat.rows.every(r => r.length === 12)) throw new Error('row width');
  if (pat.rows[0].indexOf('k') < 0) throw new Error('top row empty');
  // bottom row (last in rows[]) is round 1 -> 6 sts
  if (pat.rows[pat.height - 1].indexOf('k') !== 0) throw new Error('bottom row should start knit');
});

t('amiToText lists deltas and notes', () => {
  const p = AMI.parseRoundText('R1: MR 6sc\nR2: inc x6 (12)\nR3: dec x6 (6)');
  const res = AMI.amiToShape(p.rounds.map(r => r.sts), { split: 2 });
  const txt = AMI.amiToText(p, res.widths, res.warnings, 'bear head');
  if (!txt.includes('R2: 12 sts')) throw new Error('round line');
  if (!txt.includes('(+6)') || !txt.includes('(-6)')) throw new Error('deltas');
  if (!txt.includes('cast on')) throw new Error('cast on marker');
});

t('full pipeline: pattern text -> project-shaped chart', () => {
  const p = AMI.parseRoundText(BEAR);
  const res = AMI.amiToShape(p.rounds.map(r => r.sts), { split: 2, amiSts10: 22, knitSts10: 24 });
  const proj = KS.blankProject('bear head knit');
  const pat = KS.shaping.toPattern(res.shape);
  KS.addPanel(proj, pat, 'Head', 'other', JSON.parse(JSON.stringify(res.shape)));
  const round = KS.validateProject(JSON.parse(JSON.stringify(proj)));
  const pn = round.panels[0];
  KS.validate(pn.chart);
  if (!pn.shape || pn.shape.format !== 'knit-studio-shape/1') throw new Error('shape not carried');
  const txt = KS.projectToText(round);
  if (!txt.includes('PANEL A: Head')) throw new Error('export text');
});

t('parse Rnds plural + en-dash range + (4 rounds) noise (bug repro)', () => {
  const BALL = `Rnd 1: MR, 6 sc into ring. (6)
Rnd 2: inc around. (12)
Rnd 3: (sc, inc) x 6 (18)
Rnd 4: (2 sc, inc) x 6  (24)
Rnd 5: (3 sc, inc) x6  (30)
Rnd 6: (4 sc, inc)6x (36)
Rnds 7\u201310:(4 rounds) sc in each st around  (36)
Rnd 11: (4 sc, dec) x 6  (30)
Rnd 12: (3 sc, dec) x 6 (24)
Rnd 13:  (2 sc, dec) x 6 (18)
Rnd 14:  (sc, dec) x 6 (12)
Rnd 15: dec around. (6)`;
  const p = AMI.parseRoundText(BALL);
  eq(p.errors, []);
  eq(p.rounds.map((r) => r.sts),
    [6, 12, 18, 24, 30, 36, 36, 36, 36, 36, 30, 24, 18, 12, 6]);
  eq(p.rounds.length, 15);
  const res = AMI.amiToShape(p.rounds.map((r) => r.sts), { split: 2, name: 'ball' });
  eq(KS.shaping.check(res.shape), []);
  KS.validate(KS.shaping.toPattern(res.shape));
});

t('delta fallback without totals: group multipliers + inc/dec around', () => {
  const noTot = `Rnd 1: MR 6 sc into ring
Rnd 2: inc around
Rnd 3: (sc, inc) x 6
Rnd 4: (2 sc, inc) x 6
Rnd 5: (3 sc, inc) x6
Rnd 6: (4 sc, inc)6x
Rnds 7-10: (4 rounds) sc in each st around
Rnd 11: (4 sc, dec) x 6
Rnd 12: (3 sc, dec) x 6
Rnd 13: (2 sc, dec) x 6
Rnd 14: (sc, dec) x 6
Rnd 15: dec around`;
  const p = AMI.parseRoundText(noTot);
  eq(p.errors, []);
  eq(p.rounds.map((r) => r.sts),
    [6, 12, 18, 24, 30, 36, 36, 36, 36, 36, 30, 24, 18, 12, 6]);
});

t('star-group multipliers: *sc, inc* rep 6', () => {
  const p = AMI.parseRoundText('R1: MR 6sc\nR2: *sc, inc* rep 6 (18)');
  eq(p.errors, []);
  eq(p.rounds.map((r) => r.sts), [6, 18]);
});

t('malformed round header reports an error instead of vanishing', () => {
  const p = AMI.parseRoundText('R1: MR 6sc\nRounds 7, 8, 9: work sparkle puffs\nR10: sc (6)');
  if (p.errors.length === 0) throw new Error('expected an error for comma header');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
