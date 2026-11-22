# knit-studio

Knitting diagram/pattern suite: viewer, editor, shaping designer, library,
image→chart conversion (SVG/PNG/JPEG), and pattern resize. Japanese machine-chart
notation. Zero dependencies: Node built-ins only, vanilla JS frontend, no
build step.

Related: `beck-cloud/apps-source/tools/knitting-slicer` ("S2S Knitting CAM")
does vector silhouette slicing (SVG outline → per-row segments). knit-studio
complements it: full chart grid editing plus raster import. knit-studio can
also import the slicer's JSON output (`KS.fromSlicer`).

## Run

```sh
node server.js            # http://host:8732
PORT=9000 node server.js  # custom port
```

## File structure (conventions)

```
tools/knit-studio/
├── server.js        # zero-dep http server: static files + library API
├── public/
│   ├── index.html   # single-page UI shell (Library/Editor/Shaping/Projects/
│   │                #   Templates/CAM/Ami/Stamps/Viewer/Convert tabs)
│   ├── style.css
│   ├── core.js      # pattern model + transforms + chart renderer (UMD: window.KS / require)
│   ├── shaping.js   # shaping engine: parametric garment edges (UMD: KS.shaping)
│   ├── templates.js # garment templates (UMD: KS.templates)
│   ├── customtpl.js # user-defined templates + storage (UMD: KS.customTpl)
│   ├── stamps.js    # pixel-art stamps: grid model, transforms, composite (UMD: KS.stamps)
│   ├── patterns.js  # repeat generators: colorwork + stitch fills (UMD: KS.patterns)
│   ├── slicer.js    # S2S/CAM slicer
│   ├── ami.js       # amigurumi round parser
│   └── app.js       # UI wiring
├── library/         # pattern storage: one JSON file per pattern, <id>.json
│   └── index.json is NOT used — listing scans the dir
└── scripts/
    ├── selftest.mjs           # core model/transforms/exports
    ├── selftest-shaping.mjs   # shaping engine
    ├── selftest-projects.mjs  # projects + CAM
    ├── selftest-ami.mjs       # amigurumi importer
    ├── selftest-templates.mjs # garment templates
    ├── selftest-customtpl.mjs # custom templates
    ├── selftest-stamps.mjs    # pixel-art stamps
    └── selftest-patterns.mjs  # patterning tools
```

Conventions:
- Core logic lives in `core.js` only; `app.js` is UI. Keep `core.js` DOM-free
  except the `renderChart`/`drawCell` canvas helpers guarded to browsers.
- Any new API route: register in `server.js` route table, JSON in/out,
  id-validated (`/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/`).
- Pattern files are canonical JSON (see format below), pretty-printed.

## Pattern format `knit-studio/1`

```json
{
  "format": "knit-studio/1",
  "name": "fairisle-band",
  "id": "fairisle-band",
  "width": 40,
  "height": 60,
  "gauge": { "stsPer10cm": 22, "rowsPer10cm": 30 },
  "rows": ["kkkk....", "..."],
  "meta": { "tags": ["yc"], "notes": "" }
}
```

`rows[0]` is the TOP row as displayed; knitting row numbers count from the
bottom. Each character is one cell:

| code | symbol | meaning |
|------|--------|---------|
| `.`  | (blank) | no instruction |
| `k`  | □ | needle in working position — forms a stitch |
| `x`  | ■ | needle out of action — no loop / float |
| `h`  | ▣ | holding position — short rows |
| `<`  | ↙ | transfer left |
| `>`  | ↘ | transfer right |
| `a`  | ▪ A | color A feed |
| `b`  | ▫ B | color B feed |
| `i`  | ▲ | increase (shaping) |
| `d`  | ▼ | decrease (shaping) |
| `t`  | ⾆ | k2tog — knit 2 together, right-leaning decrease |

## Shaping format `knit-studio-shape/1`

Parametric garment-panel shaping. Embedded in generated chart patterns at
`meta.shape` so library round-trips reopen in the Shaping tab.

```json
{
  "format": "knit-studio-shape/1",
  "name": "panel-1",
  "width": 80,
  "edges": {
    "left":  [{ "kind": "straight", "rows": 6 },
              { "kind": "dec", "every": 4, "each": 1, "times": 6, "transfer": false },
              { "kind": "straight", "rows": 14 }],
    "right": []
  }
}
```

Edge segments stack bottom-up; a shaped segment works its event on rows
every, 2*every, … times*every — the Japanese `every-each-times` triplet
(`6-1-4` = every 6th row, 1 st, 4 times). `kind: dec` narrows, `inc` widens,
`transfer` marks fully-fashioned decreases with transfer glyphs. Dragging
outline handles in the UI edits the triplets (and vice versa); generation
to a chart pattern is one click (`KS.shaping.toPattern`).

## Project format `knit-studio-project/1`

A garment is a **project**: one JSON document holding several named panels,
each with its own chart (and the shaping model it came from, when generated).

```json
{
  "format": "knit-studio-project/1",
  "name": "weekend-cardigan",
  "gauge": { "stsPer10cm": 22, "rowsPer10cm": 30 },
  "panels": [
    { "id": "p1", "name": "Back",  "role": "back",
      "chart": { "format": "knit-studio/1", "...": "full chart" },
      "shape": null, "notes": "" },
    { "id": "p2", "name": "Sleeve", "role": "sleeve-left",
      "chart": { "...": "..." }, "shape": { "format": "knit-studio-shape/1", "...": "..." } }
  ],
  "meta": { "tags": ["gift"], "notes": "size M" }
}
```

Panel ids (`p1`, `p2`, …) stay unique while the panel lives and are reused
after removal. Roles: `front, back, sleeve-left, sleeve-right, collar, cuff,
band, hood, pocket, placket, other`. The Projects tab edits panels in place;
**Edit** opens a panel chart in the editor, **Update panel chart** pushes the
edit back. Export produces one instruction sheet covering every panel,
plus a rough **yarn estimate**: worked stitches across all panels converted
to meters from the project gauge (a panel's own shaping gauge wins when set),
scaled by fabric type (stockinette, rib, cables, ...). Ballpark only, on
purpose — weigh a swatch before buying yarn.

## CAM slicer (S2S)

The **CAM** tab is a dependency-free port of the knitting-slicer service:
an SVG garment outline (mm) is sliced at your gauge into stitch-row panels
by scanline, splitting wherever the outline pinches apart. It keeps the
original tracker: row-by-row karaoke instructions, per-row segment editing
on the canvas, condensed `Rows 4-15: Dec 1 at each end` groups, `.txt`
export — plus one-click **Save as project**, so sliced panels land straight
in a multi-panel project. Engine: `public/slicer.js` (`KS.slicer`).

**Scale detection:** on import the root `<svg>` tag is inspected and a
millimetres-per-user-unit scale is derived (width/height units vs viewBox,
`preserveAspectRatio=meet` math, CSS-px fallback at 96 dpi). Points are
converted to inches before slicing, so px exports and mm drafts land at the
same gauge. The status line reports the resolved scale and its reason; a
**SVG scale** dropdown forces mm / px / cm / inch when the file lies about
itself. After slicing, the status shows the physical size (`42 x 58 cm at
this gauge`) so bad scales can't sneak by.

## 3D shaping: short rows & holding stitches

Edges in the Shaping tab accept two segment kinds beyond dec/inc:

- **Short rows (`sr`)** — `every N rows, w&t M sts before this edge, x T`.
  The turn point recedes by M each event, so the edge wedges like a Dutch
  heel or short-row toe. The chart marks the wrap and the live-but-unworked
  needles with `h` (holding position, same idiom as machine diagrams).
- **Holders (`hold`)** — `place E sts at this edge on hold for R rows`,
  then take back (default) or bind off (`release`). Held spans render as `h`
  for exactly their rows and the edge reopens after release.

Presets build from these: **Heel flap + turn** (half-leg width, straight
flap, wedge to live gusset sts), **Toe wedge**, **Shoulder slope** (mirror
for both), **Ear flap**. Exported `.txt` spells them out: `every 2th row
w&t 1 st before this edge x 15`, `place 12 st on holder ... then take back`.

## Angles and twists

With gauge filled in, every shaped segment shows its physical slope:
`** 27°` badges next to dec/inc/short-row/spiral segments (degrees from
vertical, tooltip has mm rise/run and edge length). The
`target angle ° -> w&t seg` box does the inverse: pick the angle you want,
it computes the turn distance at your cadence (`KS.shaping.segAngle` /
`segFromAngle` in the engine).

**Spiral twist (`twist` segment)** — `every N rows w&t at M sts from this edge,
for R rows`. Width stays constant; wrap marks march up a fixed column, and on
a seamed tube that spiral becomes a 3D twist. `tentacle` preset: spiral +
taper to the tip, spiral still turning at the point. Twist pitch angle shows
in the same badges — that angle ** the angle your tentacle corkscrews at.

## Intarsia colors

The chart carries its own color table: `colors: [{name, hex}]`, one entry
per color slot, up to **38 colors** (chart codes `a` `b` `0`-`9` `A`-`Z`).
The ✎ button under the palette edits it: native color pickers, names,
add/remove (removal blocked while a color is in the chart). Slots without an
entry fall back to a built-in ramp; `a`/`b` keep their historic magenta/blue
so old charts look unchanged. Everything follows the table: editor canvas,
library thumbnails, PNG/SVG export (SVG gets a name + hex legend), and the
`.txt` instructions list every used color.

## Patterning tools

The Editor's **Patterning** box fills the whole chart or a dragged region
with a repeating generator. Two groups:

- **Colorwork** writes intarsia color slots: stripes (color cycle list like
  `a,b,7` + rows per band), checkerboard (two colors + block size), diagonal
  twill (same, sheared 45°).
- **Stitch textures** alternate knit (`k`) and off (`x`) cells: stockinette,
  garter rows, rib (column groups), seed, basket weave (block checker).

The ▨ **Pattern tool** (key `g`) turns any drag into a patterned region fill;
the pattern's origin sits at the region's top-left corner, so bands and
repeats line up where you drop them. Color dropdowns list the chart's own
palette names. Everything is one ctrl+Z away, and patterned charts export
normally — `.txt` instructions get the same run-length rows as painted ones.
Engine: `public/patterns.js` (`KS.patterns`), DOM-free and selftested;
`cellAt(kind, x, y, params)` is the pure generator.

## Pixel-art stamps (intarsia motifs)

The **Stamps** tab draws small pixel-art motifs on a grid (up to 64×64) and
stamps them onto any chart. Empty cells are transparent, so the chart's own
colorwork shows through — the point of an intarsia patch. A stamp carries
its own color table like a chart does; stamping maps stamp colors onto the
target palette: identical hexes reuse an existing slot, new colors append
one, and a chart with all 38 slots full fails with a clean error instead of
clobbering a color.

- Draw: click/drag to paint, right-drag or ⌫ to erase; ↔ ↕ ⟳ ⤢ transform;
  + color adds a slot (up to 38), the color picker and name edit it.
- Stock motifs: heart, star, snowflake, gull, tree, diamond — edit or save
  any of them.
- Text format: legend lines (`r = #d33682 Heart`), then rows, one character
  per cell, `.` = empty. Paste pixel art in, export `.txt` out.
- Placing: **Stamp onto open chart** drops the motif centered on the chart
  open in the Editor or Viewer (refuses when it would not fit). In the
  Editor, the 📮 Stamp tool (key `s`) drops the current stamp under each
  click, clipping at chart edges. Panel charts work too: open a project
  panel in the editor, stamp, save the project.
- Saved stamps live in browser localStorage (`ks-stamps`), separate from
  the pattern library. Engine: `public/stamps.js` (`KS.stamps`), DOM-free,
  selftested.

## Annotating the shaping diagram

Click anywhere on the shaping preview to pin a text note: it anchors to that
row and stitch offset, draws as an amber dot + leader + label, and lands in
the **Notes** list where you can retype or delete it. Notes live in the shape
model (`annotations: [{row, off, text}]`), so they survive save/load,
presets, project panels, and appear in `.txt` exports (`row 24: start heel
turn`). Charts generated from the shape carry the notes on
`meta.annotations` and `meta.shape`.

## Project templates

The **Templates** tab turns measurements into a multi-panel project: pick a
garment (socks, sweater, cardigan, T-shirt with five collar styles, shawl,
scarf, beanie), enter the wearer's
dimensions (cm or inches) and your gauge, and every panel arrives as a chart
plus an editable shaping model — cuffs, tapers, held heel flaps, w&t toes,
crown decreases — with how-to annotations pinned on the diagrams. Sweater,
cardigan and T-shirt each take a **shoulder shaping** choice (straight, short-row
slope, decrease wedge) plus **neck width and depth**; neckbands are cut to the
elliptical opening you pick. The sweater adds a **sleeve/shoulder style** —
set-in cap, drop shoulder, saddle shoulder (with tabs) or raglan — and a
**collar**: turtleneck tube, crew band, V-neck bias strips or shirt collar
(band + leaf). On the T-shirt, polo and henley split the center
front into two panels — the plackets sew behind that opening. Panel sizes come
from your numbers: change chest or ease and rebuild. Saved per template in the browser, so the wearer's measurements
survive refreshes. Engine: `public/templates.js` (`KS.templates`), pure and
selftested; generated panels always pass `shaping.check` and chart validation.
Templates are starting points — and they stay editable: every generated
panel carries its full **shaping model**. The ∿ button on any panel row in
Projects opens that model in the Shaping tab (a panel without one starts
flat at the chart's size); **Save shaping to panel** writes the edited model
back and regenerates the chart from it, so parametric tweaks never leave you
repainting cells.


**Your own templates:** the gallery's ✚ card builds custom templates from a
name, measurement fields (label/key/default/min/max) and flat trapezoid
panels — width and length from a field or fixed cm, a bottom taper (narrower
cast-on that widens out), a top taper, and plain bands in rows. Panels are
generated with the same gauge-driven, evenly-spread increase math as the
built-ins, so tapers land smooth. Templates live in browser storage and
export/import as JSON for sharing or backup. Engine: `public/customtpl.js`
(`KS.customTpl`), DOM-free and selftested.

## Amigurumi importer

The **Ami** tab converts crochet amigurumi patterns into knitting. Paste
round-notation text (`R2: inc x6 (12)`, `R4-6: sc (18)`, `MR 6sc`) and the
parser resolves every round's stitch count (trailing `(N)` totals win;
otherwise `inc`/`dec` deltas with `inc x6` / `6 inc` multipliers, `work
even`, magic-ring seeds). Conversion to knitting:

- each round becomes one knit row whose width is that round's stitch count
- **Flat half** mode divides the tube by two and mirrors it, so distributed
  increases/decreases land as every-N-rows shaping at each edge — knit the
  piece flat, seam it; **Full circumference** keeps the tube width
- optional gauge rescale from crochet sts/10 cm to knit sts/10 cm keeps the
  physical size instead of the stitch count
- handoff: shaping designer (editable), flat chart (editor), project panel,
  or a round-list `.txt` with derived edge instructions

Engine: `public/ami.js` (`KS.ami`: `parseRoundText`, `amiToShape`,
`roundsToChart`, `amiToText`), DOM-free and fully selftested
(`scripts/selftest-ami.mjs`).

## API

- `GET  /api/health`
- `GET  /api/patterns`          → list summaries `{id,name,width,height,tags,updatedAt}`
- `GET  /api/patterns/:id`      → full pattern JSON
- `PUT  /api/patterns/:id`      → create/update (body = full pattern, optional `thumb` data-URL)
- `DELETE /api/patterns/:id`
- `GET  /api/projects`          → list summaries `{id,name,panels,tags,updatedAt}`
- `GET  /api/projects/:id`      → full project JSON
- `PUT  /api/projects/:id`      → create/update (body = full project; panel charts validated)
- `DELETE /api/projects/:id`

Projects store under `PROJECTS_DIR` (default: `library/projects/` inside the
library volume, so existing PVCs keep them without manifest changes).

## Tests

```sh
npm test                              # all eight suites
node scripts/selftest.mjs             # core model/transforms/exports
node scripts/selftest-shaping.mjs     # shaping engine
node scripts/selftest-projects.mjs    # projects + CAM slicer
node scripts/selftest-ami.mjs         # amigurumi importer
node scripts/selftest-templates.mjs   # garment templates
node scripts/selftest-customtpl.mjs   # custom template editor
node scripts/selftest-stamps.mjs      # pixel-art stamps
node scripts/selftest-patterns.mjs    # patterning tools
```
