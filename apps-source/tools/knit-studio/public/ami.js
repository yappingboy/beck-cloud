/* knit-studio amigurumi importer: parse crochet round patterns into stitch
 * counts, convert to knitting widths and symmetric shaping segments.
 * DOM-free; UMD. Grammar (common amigurumi notation):
 *   R1: MR 6sc
 *   Rnd 2: inc x6 (12)
 *   Round 3: *sc, inc* rep 6 (18)
 *   R4-6: sc (18)
 *   R7: *sc 2, dec* x6 (12)
 * Trailing (N) totals win; otherwise +1/inc and -1/dec deltas apply against
 * the previous round, honoring "inc x6" / "6 inc" style multipliers and
 * "work even" bodies. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.KS) root.KS.ami = api;
  else root.KSam = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function shaping() {
    var s = (typeof KS !== 'undefined' && KS.shaping) ||
      (typeof globalThis !== 'undefined' && globalThis.KS && globalThis.KS.shaping);
    if (!s) throw new Error('KS.shaping not loaded');
    return s;
  }

  var HEADER = /^\s*[>\-|*)\]]*\s*(?:r(?:ounds?|nds?|nd|d)?|rows?)\s*#?\s*(\d+)\s*(?:\s*[-\u2013\u2014]\s*(\d+))?\s*[:.\-)\]]?\s*(.*)$/i;
  var HEADERISH = /^\s*[>\-|*)\]]*\s*(?:r(?:ounds?|nds?|nd|d)?|rows?)\s*#?\s*\d/i;

  // net stitch change from inc/dec wording; null when the keyword is absent
  // Honors group multipliers: "(sc, inc) x 6", "(4 sc, dec)6x", "*sc, inc* rep 6"
  var GRP_PAREN = /\(([^)]*)\)\s*(?:(?:[x\u00d7]|rep(?:lets)?\.?|repeats?|times)\s*(\d+)|(\d+)\s*(?:[x\u00d7]|times?))/i;
  var GRP_STAR = /\*([^*]*)\*\s*(?:(?:[x\u00d7]|rep(?:lets)?\.?|repeats?|times)\s*(\d+)|(\d+)\s*(?:[x\u00d7]|times?))/i;
  function keywordDelta(body, kind) {
    var innerRe = kind === 'inc'
      ? /\b(?:inc|increase)s?\b/gi
      : /\b(?:dec|decrease|reduce|sc2tog|tog)\b/gi;
    var re = kind === 'inc'
      ? /\b(?:inc|increase)s?\b(?:\s*(?:x|\u00d7|by)?\s*(\d+))?|\b(\d+)\s*incs?\b/gi
      : /\b(?:dec|decrease|reduce)s?\b(?:\s*(?:x|\u00d7|by)?\s*(\d+))?|\b(\d+)\s*(?:sc\s+)?decs?\b/gi;
    var m, n = 0, saw = false, from = 0;
    var g = GRP_PAREN.exec(body), gs = GRP_STAR.exec(body);
    if (gs && (!g || gs.index < g.index)) g = gs;
    if (g) {
      var gm = g[2] || g[3];
      var inner = (g[1] || '').match(innerRe);
      if (gm && inner) {
        n += inner.length * parseInt(gm, 10);
        saw = true;
        from = g.index + g[0].length;
      }
    }
    re.lastIndex = from;
    while ((m = re.exec(body))) {
      saw = true;
      var mult = m[1] || m[2] || m[3];
      n += mult ? parseInt(mult, 10) : 1;
    }
    return saw ? n : null;
  }

  // body + previous round count -> { sts, src } | { sts: null }
  function parseOne(raw, prev) {
    var body = String(raw || '').replace(/\(\s*\d+\s*(?:rounds?|rnds?|rows?)\s*\)/gi, ' ').trim();
    var tot = /\((\d+)\s*(?:sts?|stitches|sc|dc)?\)\s*[.,;]?\s*$/.exec(body);
    if (tot) return { sts: parseInt(tot[1], 10), src: 'total' };
    // "inc around" = one increase worked in every stitch; "dec around" pairs stitches up
    if (prev !== null && /\binc\w*\s+(?:around|in (?:each|every)|to each)\b/i.test(body)) {
      return { sts: prev * 2, src: 'delta' };
    }
    if (prev !== null && (/\bdec\w*\s+(?:around|in each|in every)\b/i.test(body) || /\bdec\w*\s+each\s+st/i.test(body))) {
      return { sts: Math.floor(prev / 2), src: 'delta' };
    }
    var inc = keywordDelta(body, 'inc') || 0;
    var dec = keywordDelta(body, 'dec') || 0;
    if ((inc || dec) && prev !== null) return { sts: prev + inc - dec, src: 'delta' };
    if (/^(?:work\s+)?even|sc\s*even|work\s+even|even\s+around|in (?:each|every)\s+st\b|\baround\b/i.test(body) && prev !== null) {
      return { sts: prev, src: 'even' };
    }
    
var mr = /\b(?:mr|magic ring|magic circle)\b/i.test(body);
    var seed = mr && /(\d+)\s*(?:sc|dc|tr|st)/i.exec(body);
    if (seed) return { sts: parseInt(seed[1], 10), src: 'ring' };
    var any = /\((\d+)\s*(?:sts?|stitches)\)/i.exec(body);
    if (any) return { sts: parseInt(any[1], 10), src: 'total' };
    return { sts: null };
  }

  // -> { rounds: [{label, round, sts, src}], errors: [string] }
  function parseRoundText(text) {
    var rounds = [], errors = [], prev = null;
    var lines = String(text || '').split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var m = HEADER.exec(line);
      if (!m) {
        if (HEADERISH.test(line)) {
          errors.push('line ' + (i + 1) + ': unrecognized round header "' +
            line.trim().substring(0, 44) + '"');
        }
        continue;
      }
      var a = parseInt(m[1], 10);
      var b = m[2] ? parseInt(m[2], 10) : null;
      var body = m[3] || '';
      if (b !== null && b > a && b - a > 63) {
        errors.push('line ' + (i + 1) + ': round range ' + a + '-' + b + ' too wide, treated as single round');
      }
      var span = (b !== null && b > a && b - a <= 63) ? b - a + 1 : 1;
      var ok = true;
      for (var k = 0; k < span; k++) {
        var res = parseOne(body, prev);
        if (res.sts == null) {
          errors.push('line ' + (i + 1) + ': could not resolve stitch count for "' +
            line.trim().substring(0, 44) + '"');
          ok = false;
          break;
        }
        rounds.push({ label: 'R' + (a + k), round: a + k, sts: res.sts, src: res.src });
        prev = res.sts;
      }
      void ok;
    }
    return { rounds: rounds, errors: errors };
  }

  // counts -> symmetric flat-panel shaping model for knitting
  // opts: { split: 1|2 (round -> two mirrored sides),
  //         amiSts10, knitSts10 (gauge conversion factors per 10 cm),
  //         name, gauge }
  function amiToShape(counts, opts) {
    opts = opts || {};
    var split = opts.split === 1 ? 1 : 2;
    var factor = (opts.amiSts10 > 0 && opts.knitSts10 > 0) ? opts.knitSts10 / opts.amiSts10 : 1;
    var warnings = [];
    if (!Array.isArray(counts) || !counts.length) throw new Error('no rounds to convert');
    if (split === 2 && counts.some(function (c) { return c % 2 !== 0; })) {
      warnings.push('odd round counts split \u00b11 st per side');
    }
    var widths = counts.map(function (c) {
      return Math.max(1, Math.round(c / split * factor));
    });
    var maxW = 0;
    widths.forEach(function (w) { if (w > maxW) maxW = w; });
    // symmetric halves: each edge takes half the missing stitches
    var off = widths.map(function (w) { return Math.floor((maxW - w) / 2); });
    var segs = shaping().segmentsFromOffsets(off, 12).map(function (s) { return Object.assign({}, s); });
    var shape = {
      format: 'knit-studio-shape/1',
      name: opts.name || 'amigurumi piece',
      width: maxW,
      gauge: opts.gauge || null,
      mirror: true,
      edges: { left: segs, right: JSON.parse(JSON.stringify(segs)) }
    };
    if (factor !== 1) {
      warnings.push('gauge converted ' + opts.amiSts10 + ' crochet sts/10cm \u2192 ' +
        opts.knitSts10 + ' knit sts/10cm (\u00d7' + factor.toFixed(2) + ')');
    }
    if (widths.some(function (w, i) { return i > 0 && Math.abs(w - widths[i - 1]) > 12; })) {
      warnings.push('some rows change more than 12 st \u2014 consider splitting those rounds; abrupt edges will be kept straight');
    }
    return { shape: shape, widths: widths, warnings: warnings };
  }

  // plain per-round strip chart (row width = round count), no edge glyphs
  function roundsToChart(counts, opts) {
    opts = opts || {};
    if (!Array.isArray(counts) || !counts.length) throw new Error('no rounds');
    var widths = counts.map(function (c) { return Math.max(1, Math.round(c)); });
    var maxW = Math.max.apply(null, widths);
    var rows = [];
    for (var r = counts.length - 1; r >= 0; r--) {
      var row = '';
      for (var x = 0; x < maxW; x++) row += x < widths[r] ? 'k' : '.';
      rows.push(row);
    }
    return {
      format: 'knit-studio/1', name: opts.name || 'amigurumi rounds',
      width: maxW, height: counts.length, gauge: opts.gauge || null,
      rows: rows,
      meta: { tags: ['amigurumi'], notes: 'one row per crochet round, width = stitch count' }
    };
  }

  function amiToText(parsed, widths, warnings, title) {
    var lines = [(title || 'amigurumi') + ' \u2014 ' + parsed.rounds.length + ' rounds'];
    parsed.rounds.forEach(function (r, i) {
      var d = i > 0 ? r.sts - parsed.rounds[i - 1].sts : r.sts;
      lines.push(r.label + ': ' + r.sts + ' sts' +
        (widths ? ' \u2192 ' + widths[i] + ' st panel' : '') +
        (i === 0 ? ' (cast on)' : (d === 0 ? ' (even)' : (d > 0 ? ' (+' + d + ')' : ' (' + d + ')'))));
    });
    if (warnings && warnings.length) {
      lines.push('');
      warnings.forEach(function (w) { lines.push('note: ' + w); });
    }
    return lines.join('\n');
  }

  return {
    parseRoundText: parseRoundText,
    amiToShape: amiToShape,
    roundsToChart: roundsToChart,
    amiToText: amiToText
  };
});
