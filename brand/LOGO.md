# BeckCloud Logo Specification

> The mark is a hexagon with a heartbeat inside.

---

## 1. Primary Mark

### Shape: The Hexagon

The BeckCloud mark is built around a **regular hexagon** — six equal sides, six equal angles. This references:

- **K3s/Kubernetes cluster nodes** — hexagonal topology is the canonical visual language for distributed systems
- **Structure and containment** — a hexagon is the strongest shape in nature (honeycomb). It implies resilience.
- **The "B" and "C"** — the hexagon's angles naturally suggest the letters B and C when split vertically, subtly encoding "BeckCloud" into the geometry.

### The Ember Core

Inside the hexagon sits the **ember** — an organic, flame-like shape rendered in solid Ember Gold (`#E8A838`). It's not a literal fire. It's more like the warm glow of an LED indicator, or the reflection of a monitor in a dark room.

The ember is:
- **Slightly asymmetric** — it tilts gently right, giving it energy and forward motion
- **Rounded** — no sharp corners inside the hexagon. The contrast between the rigid hexagon and the soft ember is the entire point
- **Centered vertically** but slightly offset to the right, creating a sense of forward momentum
- **Proportional** — roughly 45% of the hexagon's internal area, leaving enough negative space to read it at small sizes

### Construction

```
Hexagon outline: stroke width = 1/8 of hexagon height
Fill: transparent (or Gunmetal #1E293B on light backgrounds)
Stroke color: Ember Gold #E8A838
Inner ember: filled shape, Ember Gold #E8A838
Corner radius: 0 (sharp hexagon edges — this is infrastructure, not a mobile app)
```

---

## 2. Wordmark

### Typography

The wordmark uses **JetBrains Mono Bold (700)**.

**"Beck"** — solid Ember Gold (`#E8A838`)  
**"Cloud"** — gradient from Ember Gold (`#E8A838`) to Coral Pulse (`#FF6B4A`), left to right

This gradient on "Cloud" does two things:
1. Creates visual interest on an otherwise static name
2. Subtly reinforces the brand color palette without introducing a new color

### Layout

The wordmark sits to the right of the primary mark. The lockup is:

```
[hexagon mark]  [24px gap]  BeckCloud
```

The wordmark baseline aligns with the **center** of the hexagon mark (not the bottom). This creates a balanced horizontal composition.

### Letter Spacing

- Tracking: `-0.5px` (slight tightening — JetBrains Mono is naturally spacious, so a small tighten brings it into harmony with the compact hexagon mark)

---

## 3. Logo Variants

### Primary Lockup (Horizontal)

```
  ┌───┐       BeckCloud
  │ 🔥 │       (Ember Gold + Gold→Coral gradient)
  └───┘
```

**Usage:** Navbar, headers, documentation titles, slide decks.

### Stacked Lockup

```
  ┌───┐
  │ 🔥 │
  └───┘
  BeckCloud
```

**Usage:** Square contexts, mobile nav, social media profiles, situations where horizontal space is limited.

### Mark Only (Favicon / App Icon)

Just the hexagon with ember. No text.

**Usage:** Browser favicons, PWA icons, service icons, terminal prompts.

**Favicon spec:**
- `favicon.ico`: 32×32px, 16×16px
- `favicon-32.png`: 32×32px
- `favicon-16.png`: 16×16px
- `apple-touch-icon.png`: 180×180px
- `android-chrome-192.png`: 192×192px
- `android-chrome-512.png`: 512×512px

### Monochrome

A single-color version for print, stamps, or single-color contexts. Uses only Ember Gold or white/black depending on background.

---

## 4. Color Variants

### On Dark Backgrounds (Primary — default)

- Hexagon stroke: `#E8A838` (Ember Gold)
- Ember fill: `#E8A838` (Ember Gold)
- "Beck": `#E8A838` (Ember Gold)
- "Cloud": gradient `#E8A838` → `#FF6B4A` (Coral Pulse)
- Background: `#0F1729` (Deep Space) or `#1E293B` (Gunmetal)

### On Light Backgrounds

- Hexagon stroke: `#B8860B` (darker gold for contrast on light)
- Ember fill: `#D4940A` (slightly deeper gold)
- "Beck": `#1E293B` (Gunmetal)
- "Cloud": gradient `#1E293B` → `#4A3580` (Gunmetal → dark violet)
- Background: `#F8FAFC` or white

### Inverted (White)

- Hexagon stroke: `#FFFFFF`
- Ember fill: `#FFFFFF`
- "Beck": `#FFFFFF`
- "Cloud": gradient `#FFFFFF` → `#E2E8F0` (Frost)
- Background: any dark color

### Monochrome

- Single color: Ember Gold `#E8A838` on dark, or `#1E293B` on light
- All elements same color, no gradient

---

## 5. Usage Rules

### Minimum Size

| Variant | Minimum Width | Context |
|---------|--------------|---------|
| Full lockup | 240px | Print, web headers |
| Mark only | 32px | Web, favicons |
| Mark only | 16px | Browser favicon |
| Stacked | 120px width | Mobile, social |

### Clear Space

Maintain a clear space around the logo equal to **half the height of the hexagon mark**. No other elements (text, borders, other icons) should enter this zone.

```
    ← clear space = ½ hex height →

          ┌──────────────┐
          │              │
          │    ┌───┐     │
    ──────┼────│ 🔥 │────┼─────  BeckCloud
          │    └───┘     │
          │              │
          └──────────────┘
          ← clear space →
```

### Don'ts

- **Don't** stretch, skew, or rotate the logo. Ever.
- **Don't** add drop shadows, outlines, or effects to the logo.
- **Don't** place the logo on a background that doesn't meet contrast requirements (minimum 3:1 for logos).
- **Don't** change the color of individual elements (e.g., making the hexagon blue while keeping the ember gold).
- **Don't** use the logo as a background pattern or texture.
- **Don't** add text underneath the logo (no taglines in the lockup).
- **Don't** use the primary lockup in spaces narrower than 240px — switch to mark-only.
- **Don't** make it glow. I know you want to. Don't.

### Do's

- **Do** use the dark variant on dark backgrounds and the light variant on light backgrounds.
- **Do** scale proportionally — maintain the aspect ratio at all times.
- **Do** use the monochrome variant for single-color print.
- **Do** use the mark-only version for small UI elements (favicons, service badges).

---

## 6. ASCII Mockups

### Primary Mark

```
       /\
      /  \
     | 🔥 |
      \  /
       \/

   Hexagon outline: Ember Gold stroke
   Inner ember: Ember Gold fill
   Background: transparent or Gunmetal
```

### Full Lockup

```
       /\            BeckCloud
      /  \           ═══════════
     | 🔥 |          Beck = Ember Gold
      \  /           Cloud = Gold → Coral gradient
       \/
```

### Stacked Variant

```
       /\
      /  \
     | 🔥 |
      \  /
       \/
    BeckCloud
```

### Favicon (simplified)

```
  ┌──┐
  │🔥│
  └──┘
```

---

## 7. SVG Construction Notes

When the logo is actually built (by a designer or with Figma), these are the technical specs:

### Hexagon Path

```svg
<!-- Regular hexagon, pointy-top orientation -->
<!-- Center at (100, 100), radius 60 -->
<path d="M100,40 L152,70 L152,130 L100,160 L48,130 L48,70 Z" />
```

### Ember Shape

The ember should be a custom bezier curve — something like a stylized flame droplet, slightly asymmetrical, tilted right. A rough starting point:

```svg
<!-- Organic ember shape, centered in hexagon -->
<path d="M100,65 
         C108,75 118,90 115,105 
         C112,120 105,130 100,130 
         C95,130 88,120 85,105 
         C82,90 92,75 100,65 Z" />
```

The ember should feel like it's **rising** — the right side should be slightly taller than the left, giving forward momentum.

### Export Formats

| Format | Use Case |
|--------|----------|
| SVG | Web, print, scalable use |
| PNG (transparent) | Embeds, emails, presentations |
| ICO | Browser favicon |
| PDF | Print materials |
| WebP | Optimized web use |

---

*Version 1.0 · 2026-07-19 · BeckCloud Logo Specification*
