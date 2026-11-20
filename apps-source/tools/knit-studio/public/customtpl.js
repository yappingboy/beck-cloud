/* knit-studio custom templates (pure): user-defined garment templates.
 * spec = { id, name, icon, blurb,
 *   fields: [{ key, label, def, min, max }],               // cm measurements
 *   panels: [{ name, role,
 *     width:  { mode:'cm'|'field', cm, key },              // flat piece width
 *     length: { mode:'cm'|'field', cm, key },
 *     bottomCm,   // cast-on narrower by this; increases widen back to full
 *     topCm,      // decreases taper in by this toward the top
 *     bandBottom, bandTop,   // plain rows (rib bands etc.), in ROWS
 *     mirror }] }
 * Panel = trapezoid: bands, even increase spread, straight middle, even
 * decrease spread, bands. Storage: localStorage ks-custom-templates
 * (injectable with _setStorage for tests). UMD like templates.js. */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else { root.KS = root.KS || {}; root.KS.customTpl = mod; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var KEY = '***';
  var ROLES = ['front', 'back', 'sleeve-left', 'sleeve-right', 'collar',
    'cuff', 'band', 'hood', 'pocket', 'placket', 'other'];
  var store = null;
  function ls() { return store || (typeof localStorage !== 'undefined' ? localStorage : null); }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function maker(gauge) {
    var sts10 = clamp(gauge.stsPer10cm, 1, 200);
    var rows10 = clamp(gauge.rowsPer10cm, 1, 200);
    return {
      sts: function (cm) { return Math.max(10, Math.min(3900, Math.round(cm / 10 * sts10))); },
      rows: function (cm) { return Math.max(6, Math.min(3900, Math.round(cm / 10 * rows10))); }
    };
  }
  function st(rows) { return { kind: 'straight', rows: rows }; }
  function dec(every, each, times) { return { kind: 'dec', every: Math.max(1, every | 0), each: Math.max(1, each | 0), times: Math.max(1, times | 0) }; }
  function inc(every, each, times) { return { kind: 'inc', every: Math.max(1, every | 0), each: Math.max(1, each | 0), times: Math.max(1, times | 0) }; }
  function cp(a) { return JSON.parse(JSON.stringify(a)); }

  function slug(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '').slice(0, 28) || 'tpl';
  }

  function blank() {
    return {
      id: '', name: 'My template', icon: '\u2702\ufe0f', blurb: '',
      fields: [
        { key: 'width', label: 'Width', def: 40, min: 5, max: 150 },
        { key: 'length', label: 'Length', def: 50, min: 5, max: 200 }
      ],
      panels: [{
        name: 'Panel A', role: 'other',
        width: { mode: 'field', key: 'width', cm: 40 },
        length: { mode: 'field', key: 'length', cm: 50 },
        topCm: 0, bottomCm: 0, bandTop: 0, bandBottom: 0, mirror: false
      }]
    };
  }

  function validate(t) {
    var errs = [];
    if (!t || typeof t !== 'object') return ['template must be an object'];
    if (!String(t.name || '').trim()) errs.push('name required');
    if (String(t.icon || '').length > 8) errs.push('icon: max 8 characters');
    if (String(t.blurb || '').length > 300) errs.push('blurb: max 300 characters');
    var keys = {};
    if (!Array.isArray(t.fields)) errs.push('fields must be an array');
    else {
      if (t.fields.length > 12) errs.push('max 12 fields');
      t.fields.forEach(function (f, i) {
        var n = 'field ' + (i + 1);
        if (!/^[a-z][a-z0-9_]{0,19}$/.test(f.key || '')) errs.push(n + ': key must start lowercase a-z, then a-z0-9_ (max 20)');
        else if (keys[f.key]) errs.push(n + ': duplicate key "' + f.key + '"');
        else keys[f.key] = true;
        var mn = Number(f.min), mx = Number(f.max), d = Number(f.def);
        if (!(mn >= 1 && mx >= mn && mx <= 500)) errs.push(n + ': min/max must be 1-500 cm');
        else if (!(d >= mn && d <= mx)) errs.push(n + ': default outside min-max');
      });
    }
    if (!Array.isArray(t.panels) || !t.panels.length) errs.push('at least one panel required');
    else {
      if (t.panels.length > 16) errs.push('max 16 panels');
      t.panels.forEach(function (p, i) {
        var n = 'panel ' + (i + 1);
        if (!String(p.name || '').trim()) errs.push(n + ': name required');
        if (ROLES.indexOf(p.role) < 0) errs.push(n + ': unknown role "' + p.role + '"');
        [['width', p.width], ['length', p.length]].forEach(function (pair) {
          var v = pair[1], m = n + ' ' + pair[0];
          if (!v || (v.mode !== 'cm' && v.mode !== 'field')) errs.push(m + ': mode must be cm or field');
          else if (v.mode === 'field' && !keys[v.key]) errs.push(m + ': unknown field key "' + v.key + '"');
          else if (v.mode === 'cm' && !(Number(v.cm) >= 1 && Number(v.cm) <= 500)) errs.push(m + ': cm must be 1-500');
        });
        [['topCm', 150], ['bottomCm', 150], ['bandTop', 80], ['bandBottom', 80]].forEach(function (x) {
          var v = Number(p[x[0]]);
          if (!(v >= 0 && v <= x[1])) errs.push(n + ': ' + x[0] + ' must be 0-' + x[1]);
        });
      });
    }
    return errs;
  }

  function valueCm(v, dims) {
    if (!v) return 0;
    if (v.mode === 'cm') return Number(v.cm) || 0;
    var d = dims ? dims[v.key] : null;
    return d !== null && d !== undefined && !isNaN(d) ? Number(d) : 0;
  }

  // distribute n sts (per side) over ~1/3 of available rows. Events stay
  // dense (every >= 2); if the even-1/2 spread does not fit, coarsen the
  // event size and DERIVE the count from it, so each * times never
  // over-removes past n by more than one stitch-per-side.
  function spread(n, availRows) {
    if (!(n > 0) || availRows < 6) return null;
    var each = n > 6 ? 2 : 1;
    var times = Math.max(2, Math.ceil(n / each));
    var every = Math.max(2, Math.floor(availRows * 0.34 / times) || 2);
    if (every * times > availRows * 0.45) {
      every = 2;
      times = Math.max(2, Math.min(times, Math.floor(availRows * 0.45 / every)));
      each = Math.max(1, Math.ceil(n / times));
      times = Math.max(2, Math.ceil(n / each)); // exact coverage, <= n + each - 1
    }
    return { every: every, each: each, times: times };
  }

  function buildPanel(p, dims, gauge, warn) {
    var m = maker(gauge);
    var wCm = valueCm(p.width, dims);
    var lCm = valueCm(p.length, dims);
    if (!(wCm > 0) || !(lCm > 0)) {
      throw new Error('"' + p.name + '": width/length resolve to 0 - fill in the measurements');
    }
    var W = m.sts(wCm);
    var R = m.rows(lCm);
    var bandB = clamp(p.bandBottom | 0, 0, 80);
    var bandT = clamp(p.bandTop | 0, 0, 80);
    if (bandB + bandT + 8 > R) {
      var keep = Math.floor(R / 6);
      if (bandB || bandT) warn('"' + p.name + '": bands trimmed, piece too short');
      bandB = Math.min(bandB, keep);
      bandT = Math.min(bandT, keep);
    }
    var bDelta = Math.min(m.sts(Number(p.bottomCm) || 0), Math.max(0, W - 10));
    var tDelta = Math.min(m.sts(Number(p.topCm) || 0), Math.max(0, W - 10));
    var baseW = Math.max(10, W - bDelta);
    var avail = Math.max(6, R - bandB - bandT - 2);
    var eB = spread(Math.floor(bDelta / 2), avail);
    var eT = spread(Math.floor(tDelta / 2), avail);
    if (Math.floor(bDelta / 2) > 0 && !eB) warn('"' + p.name + '": bottom taper skipped, too short');
    if (Math.floor(tDelta / 2) > 0 && !eT) warn('"' + p.name + '": top taper skipped, too short');
    var spanB = eB ? eB.every * eB.times : 0;
    var spanT = eT ? eT.every * eT.times : 0;
    var mid = Math.max(2, R - bandB - bandT - spanB - spanT);
    var segs = [];
    if (bandB) segs.push(st(bandB));
    if (eB) segs.push(inc(eB.every, eB.each, eB.times));
    segs.push(st(mid));
    if (eT) segs.push(dec(eT.every, eT.each, eT.times));
    if (bandT) segs.push(st(bandT));
    var shape = {
      format: 'knit-studio-shape/1',
      name: p.name,
      width: baseW,
      gauge: gauge,
      mirror: !!p.mirror,
      edges: { left: cp(segs), right: cp(segs) }
    };
    var ann = [];
    if (bandB) ann.push({ row: 2, off: 0, text: 'band: ' + bandB + ' rows (edit cells for rib)' });
    if (eB) ann.push({ row: bandB + 2, off: 0, text: 'widen +' + eB.each * eB.times + ' per side over ' + spanB + ' rows' });
    if (eT) ann.push({ row: bandB + spanB + mid + 1, off: 0, text: 'taper -' + eT.each * eT.times + ' per side over ' + spanT + ' rows' });
    if (bandT) ann.push({ row: R - bandT + 1, off: 0, text: 'band: last ' + bandT + ' rows, bind off' });
    if (ann.length) shape.annotations = ann;
    return shape;
  }

  // -> { name, panels: [{name, role, shape}], notes: [] }
  function build(t, dims, gauge, opts) {
    var errs = validate(t);
    if (errs.length) throw new Error(errs.join('; '));
    if (!gauge || !(gauge.stsPer10cm > 0) || !(gauge.rowsPer10cm > 0)) {
      throw new Error('a gauge (sts + rows per 10cm) is required');
    }
    var warns = [];
    var panels = t.panels.map(function (p) {
      return { name: p.name, role: p.role, shape: buildPanel(p, dims || {}, gauge, function (msg) { warns.push(msg); }) };
    });
    var notes = (t.blurb ? [t.blurb] : []).concat(warns);
    notes.push('Custom template "' + t.name + '"; regenerate after editing the template.');
    return { name: (opts && opts.name) || t.name, panels: panels, notes: notes };
  }

  function list() {
    var s = ls();
    if (!s) return [];
    try { return JSON.parse(s.getItem(KEY)) || []; } catch (e) { return []; }
  }
  function get(id) {
    var items = list();
    for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
    return null;
  }
  function save(t) {
    var errs = validate(t);
    if (errs.length) throw new Error(errs.join('; '));
    var items = list();
    var copy = cp(t);
    if (!copy.id) copy.id = 'c-' + slug(copy.name) + '-' + Date.now().toString(36);
    var found = false;
    items = items.map(function (x) {
      if (x.id === copy.id) { found = true; return copy; }
      return x;
    });
    if (!found) items.push(copy);
    var s = ls();
    if (!s) throw new Error('no storage available');
    s.setItem(KEY, JSON.stringify(items));
    return copy;
  }
  function remove(id) {
    var s = ls();
    if (!s) return;
    s.setItem(KEY, JSON.stringify(list().filter(function (x) { return x.id !== id; })));
  }
  // import: id is dropped so it never overwrites an existing template
  function fromJson(txt) {
    var t = JSON.parse(txt);
    t.id = '';
    var errs = validate(t);
    if (errs.length) throw new Error('invalid template: ' + errs.join('; '));
    return t;
  }

  return {
    KEY: KEY, ROLES: ROLES, blank: blank, validate: validate, build: build,
    list: list, get: get, save: save, remove: remove, fromJson: fromJson,
    _setStorage: function (s) { store = s; }
  };
});
