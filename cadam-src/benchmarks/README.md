# CADAM Benchmarks

A showcase of what [CADAM](https://adam.new/cadam) builds from a single plain-language
description. Each benchmark starts from the prompt shown and comes out as fully parametric
OpenSCAD — adjustable dimensions and colours, ready to export as `.STL`, `.SCAD`, or `.DXF`.
The `.scad` source for each model is included here, so they double as a record of how well
CADAM turns plain language into real, printable, fully parametric CAD.

### Complex machines & assemblies

| Model | What it shows | Controls |
| --- | --- | --- |
| [V8 engine](13-v8-engine.md) | complete V8 — banks, heads, valve covers, manifold, headers, crank, pistons, oil pan | 22 dims · 8 colors |
| [9-cylinder radial aircraft engine](10-radial-aircraft-engine.md) | nine finned cylinders in a radial star + prop hub | 15 dims · 6 colors |
| [Turbofan jet engine](11-turbofan-jet-engine.md) | full engine — fan, bypass cowl, core stages, exhaust plug | 2 dims · 10 colors |
| [Axial turbine blisk](12-axial-turbine-blisk.md) | ring of twisted aerofoil blades on a keyed hub | 14 dims · 1 color |

### Parametric fundamentals

| Model | What it shows | Controls |
| --- | --- | --- |
| [Twisted hexagonal vase](01-twisted-hex-vase.md) | generative twist-loft, hollow shell with solid floor | 6 dims · 1 color |
| [Knurled control knob](02-knurled-control-knob.md) | diamond knurling, D-bore + set screw, pointer | 15 dims · 2 colors |
| [Hex bolt & nut](03-hex-bolt-and-nut.md) | **real ISO threads** (BOSL2 `screw`/`nut`) | 3 dims · 2 colors |
| [Honeycomb bracket](04-honeycomb-bracket.md) | generative hex lattice, filleted L-bracket | 13 dims · 1 color |
| [NACA 2412 wing](05-naca-airfoil-wing.md) | true airfoil from the NACA equations, tapered loft | 9 dims · 1 color |
| [Threaded jar & lid](06-threaded-jar-and-lid.md) | two **mating** threaded parts | 9 dims · 2 colors |
| [Bevel gear drive](07-bevel-gear-drive.md) | meshing bevel gear pair at 90° | 9 dims · 3 colors |
| [Centrifugal impeller](08-centrifugal-impeller.md) | 7 swept backward-curved blades | 10 dims · 1 color |
| [Planetary gear stage](09-herringbone-planetary-gearbox.md) | full epicyclic assembly, herringbone teeth | 10 dims · 4 colors |

## Regenerating the GIFs

`render.sh` turns any `.scad` into a clean orbiting GIF (and, with `--sheet`, a
4-view contact sheet). It mirrors CADAM's own preview: BOSL2 on the library path,
`color()` parts preserved, a clean orbit around the vertical axis.

Prerequisites (macOS shown; any OpenSCAD ≥ 2021.01 with BOSL2 support works):

```bash
# OpenSCAD CLI + ImageMagick
brew install --cask openscad@snapshot
brew install imagemagick

# BOSL2 (and BOSL) on the OpenSCAD library path — these are bundled in the repo
mkdir -p /tmp/oscad-libs/BOSL2 /tmp/oscad-libs/BOSL
unzip -o ../public/libraries/BOSL2.zip -d /tmp/oscad-libs/BOSL2
unzip -o ../public/libraries/BOSL.zip  -d /tmp/oscad-libs/BOSL
```

Then:

```bash
./render.sh 03-hex-bolt-and-nut.scad            # -> 03-hex-bolt-and-nut.gif
./render.sh --sheet 09-herringbone-planetary-gearbox.scad   # -> *.sheet.png (inspection)
```

Knobs (env vars): `FRAMES` (default 36), `SIZE` (520), `ELEV` (62°), `FPS` (24),
`COLORSCHEME` (Tomorrow), `OPENSCADPATH` (`/tmp/oscad-libs`), `OPENSCAD_BIN`.
