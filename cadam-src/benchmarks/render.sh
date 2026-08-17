#!/usr/bin/env bash
#
# render.sh — turn a CADAM benchmark .scad into an orbiting GIF (and an optional
# multi-view contact sheet for inspection). Mirrors how CADAM previews models in
# the browser: BOSL2/MCAD on the library path, color() parts preserved, a clean
# orbit around the vertical axis.
#
# Usage:
#   ./render.sh model.scad                 -> model.gif  (orbit)
#   ./render.sh model.scad out.gif         -> out.gif
#   ./render.sh --sheet model.scad         -> model.sheet.png (iso/front/right/top)
#
# Env knobs (sane defaults):
#   FRAMES=36 SIZE=520 ELEV=62 FPS=24 COLORSCHEME=Tomorrow BG=#0d1117
#
set -euo pipefail

# --- locate the OpenSCAD CLI (snapshot/nightly first, then stable) ------------
find_openscad() {
  if [[ -n "${OPENSCAD_BIN:-}" && -x "${OPENSCAD_BIN}" ]]; then echo "${OPENSCAD_BIN}"; return; fi
  for c in \
    "/Applications/OpenSCAD (Nightly).app/Contents/MacOS/OpenSCAD" \
    "/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD" \
    "$(command -v openscad 2>/dev/null || true)"; do
    [[ -n "$c" && -x "$c" ]] && { echo "$c"; return; }
  done
  echo "ERROR: OpenSCAD CLI not found. Set OPENSCAD_BIN." >&2; exit 1
}
OSCAD="$(find_openscad)"

# BOSL2 / BOSL / MCAD live here (unzipped from public/libraries/*.zip).
export OPENSCADPATH="${OPENSCADPATH:-/tmp/oscad-libs}"

FRAMES="${FRAMES:-36}"
SIZE="${SIZE:-520}"
ELEV="${ELEV:-62}"
FPS="${FPS:-24}"
COLORSCHEME="${COLORSCHEME:-Tomorrow}"   # clean near-white backdrop
RENDER_FLAG="${RENDER_FLAG:---render}"   # full (manifold) render; --preview is faster but CSG-fuzzy

SHEET=0
if [[ "${1:-}" == "--sheet" ]]; then SHEET=1; shift; fi

SRC="${1:?usage: render.sh [--sheet] model.scad [out.(gif|png)]}"
BASE="$(basename "${SRC%.scad}")"
DIR="$(cd "$(dirname "$SRC")" && pwd)"
OUT="${2:-}"

delay=$(awk "BEGIN{printf \"%.0f\", 100/${FPS}}")
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

render_frame() { # rotx roty rotz file
  "$OSCAD" -o "$4" --imgsize="${SIZE},${SIZE}" --projection=perspective \
    --colorscheme="$COLORSCHEME" $RENDER_FLAG --viewall --autocenter \
    --camera="0,0,0,$1,$2,$3,0" "$SRC" 2>"$tmp/err.log" || {
      echo "OpenSCAD failed on $SRC:" >&2; cat "$tmp/err.log" >&2; exit 1; }
}

if [[ "$SHEET" == "1" ]]; then
  OUT="${OUT:-$DIR/$BASE.sheet.png}"
  render_frame 62 0 25  "$tmp/iso.png"
  render_frame 90 0 0   "$tmp/front.png"
  render_frame 90 0 90  "$tmp/right.png"
  render_frame 0  0 0   "$tmp/top.png"
  magick montage "$tmp/iso.png" "$tmp/front.png" "$tmp/right.png" "$tmp/top.png" \
    -label '' -tile 2x2 -geometry +6+6 -background white "$OUT"
  echo "wrote $OUT"
  exit 0
fi

OUT="${OUT:-$DIR/$BASE.gif}"
echo "rendering $FRAMES frames of $BASE ..."
i=0
while [[ $i -lt $FRAMES ]]; do
  az=$(awk "BEGIN{printf \"%.2f\", $i*360/$FRAMES}")
  printf -v n "%03d" "$i"
  render_frame "$ELEV" 0 "$az" "$tmp/f_$n.png"
  i=$((i+1))
done

echo "assembling $OUT ..."
magick -delay "$delay" -loop 0 "$tmp"/f_*.png \
  -layers OptimizePlus -fuzz 3% -colors 200 "$OUT"
# second pass: strip + max compression
magick "$OUT" -strip -layers Optimize "$OUT"
echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"
