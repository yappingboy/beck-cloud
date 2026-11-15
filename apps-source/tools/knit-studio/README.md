# knit-studio

Knitting diagram/pattern suite: viewer, editor, library, image→chart
conversion (SVG/PNG/JPEG), and pattern resize. Japanese machine-chart
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
│   ├── index.html   # single-page UI shell (tabs: Library/Editor/Viewer/Convert)
│   ├── style.css
│   ├── core.js      # pattern model + transforms + chart renderer (UMD: window.KS / require)
│   └── app.js       # UI wiring
├── library/         # pattern storage: one JSON file per pattern, <id>.json
│   └── index.json is NOT used — listing scans the dir
└── scripts/
    └── selftest.mjs # node-based logic tests (no browser needed)
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

## API

- `GET  /api/health`
- `GET  /api/patterns`          → list summaries `{id,name,width,height,tags,updatedAt}`
- `GET  /api/patterns/:id`      → full pattern JSON
- `PUT  /api/patterns/:id`      → create/update (body = full pattern, optional `thumb` data-URL)
- `DELETE /api/patterns/:id`

## Tests

```sh
node scripts/selftest.mjs
```
