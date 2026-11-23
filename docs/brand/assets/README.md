# BeckCloud Logo Assets

Generated from the spec in [../LOGO.md](../LOGO.md). SVG files are the masters; PNG icons are exports of `favicon.svg` (mark only, per spec — no text below 120px).

## Files

| File | Variant | Use |
|------|---------|-----|
| `beckcloud-mark-dark.svg` | Primary mark, Ember Gold | Default mark on dark backgrounds |
| `beckcloud-mark-light.svg` | Darker gold (#B8860B stroke) | Mark on light backgrounds |
| `beckcloud-mark-inverted.svg` | White | Mark on any dark color/photo |
| `beckcloud-mark-mono-gold.svg` | Monochrome gold | Single-color print on dark |
| `beckcloud-mark-mono-gunmetal.svg` | Monochrome gunmetal | Single-color print on light |
| `beckcloud-lockup-horizontal-dark.svg` | Mark + wordmark, gradient | Navbars, headers, docs (min width 240px) |
| `beckcloud-lockup-horizontal-light.svg` | Horizontal, light-bg palette | Light pages |
| `beckcloud-lockup-horizontal-inverted.svg` | Horizontal, white | Dark/photographic |
| `beckcloud-lockup-horizontal-mono-gold.svg` | Horizontal, single color | Faxes, stamps, one-color print |
| `beckcloud-lockup-stacked-dark.svg` | Stacked lockup | Square contexts, mobile nav (min width 120px) |
| `beckcloud-lockup-stacked-light.svg` / `-inverted.svg` | Stacked variants | As above, per background |
| `favicon.svg` | Mark (dark) | Vector favicon source |
| `favicon-16.png`, `favicon-32.png` | Raster favicon | Browser tabs |
| `apple-touch-icon.png` | 180×180 | iOS home screen |
| `android-chrome-192.png`, `android-chrome-512.png` | PWA icons | Manifest install |

## Rules (short form — full rules in LOGO.md §5)

- Clear space = half the hexagon height. Don't stretch, skew, rotate, or glow. (Yes, even though it wants to.)
- Wordmark sets in JetBrains Mono 700, tracking −0.5px. If the font can't load (e.g. plain rasterization), the SVG degrades to monospace fallback — acceptable, don't fake it with a substitute face.
- Horizontal lockup below 240px wide → switch to mark only.

## Regenerating

Marks and lockups are deterministic geometry (regular pointy-top hexagon, stroke = 1/8 hexagon height, ember offset right). PNG exports:

```bash
magick -background none favicon.svg -resize 512x512 android-chrome-512.png  # repeat per size
```
