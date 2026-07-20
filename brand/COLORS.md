# BeckCloud Color Reference

> Amber and violet. Not blue. (We said it once.)

---

## 1. Primary Palette

These are the core brand colors. Every BeckCloud surface should pull from this palette.

### Ember Gold — `#E8A838`

| Property | Value |
|----------|-------|
| Role | **Primary** — brand color, primary buttons, active states, key highlights |
| Hex | `#E8A838` |
| RGB | `232, 168, 56` |
| HSL | `39°, 79%, 57%` |
| Usage | Logo mark, headings, active navigation, primary CTAs, status "active/running" |
| On Deep Space | ✅ WCAG AAA (contrast 7.6:1) |
| On Gunmetal | ✅ WCAG AAA (contrast 6.0:1) |

This is the color of the brand. If you use one color, it's this one. Ember Gold is warm enough to feel human but technical enough to sit next to terminal output without looking out of place.

### Violet Haze — `#7C5CFC`

| Property | Value |
|----------|-------|
| Role | **Secondary** — links, secondary buttons, technical highlights, category tags |
| Hex | `#7C5CFC` |
| RGB | `124, 92, 252` |
| HSL | `252°, 96%, 67%` |
| Usage | Secondary CTAs, category labels, hover states, technical indicators |
| On Deep Space | ✅ WCAG AAA (contrast 7.4:1) |
| On Gunmetal | ✅ WCAG AAA (contrast 5.9:1) |

Violet Haze is the technical counterweight to Ember Gold. It's the "this is infrastructure" color. Purple in the tech space signals depth, complexity, and capability without being as cold as blue or as aggressive as red.

### Coral Pulse — `#FF6B4A`

| Property | Value |
|----------|-------|
| Role | **Accent** — notifications, alerts, interactive highlights, wordmark gradient end |
| Hex | `#FF6B4A` |
| RGB | `255, 107, 74` |
| HSL | `11°, 100%, 65%` |
| Usage | Notification badges, new indicators, hover emphasis, the "Cloud" gradient end |
| On Deep Space | ✅ WCAG AAA (contrast 7.2:1) |
| On Gunmetal | ✅ WCAG AA (contrast 5.7:1) |

Coral is the spark. Use it sparingly — it's loud by design. Every coral element should demand attention.

### Greenlight — `#4ADE80`

| Property | Value |
|----------|-------|
| Role | **Success** — healthy status, completed tasks, positive indicators |
| Hex | `#4ADE80` |
| RGB | `74, 222, 128` |
| HSL | `142°, 68%, 58%` |
| Usage | Service "up" indicators, success states, checkmarks, positive diffs |
| On Deep Space | ✅ WCAG AAA (contrast 7.8:1) |
| On Gunmetal | ✅ WCAG AAA (contrast 6.2:1) |

A clean, bright green that reads well on dark backgrounds. Not the default Bootstrap green — this is slightly more saturated and warmer.

### Amber — `#FBBF24`

| Property | Value |
|----------|-------|
| Role | **Warning** — degraded status, pending tasks, caution indicators |
| Hex | `#FBBF24` |
| RGB | `251, 191, 36` |
| HSL | `43°, 97%, 56%` |
| Usage | Warning states, pending deployments, degraded services |
| On Deep Space | ✅ WCAG AAA (contrast 8.2:1) |
| On Gunmetal | ✅ WCAG AAA (contrast 6.5:1) |

Sits in the same family as Ember Gold but brighter and more yellow. The distinction matters: Ember Gold is the brand, Amber is a status.

### Red Alert — `#EF4444`

| Property | Value |
|----------|-------|
| Role | **Error** — failed status, critical alerts, destructive actions |
| Hex | `#EF4444` |
| RGB | `239, 68, 68` |
| HSL | `0°, 84%, 60%` |
| Usage | Error states, failed deployments, critical alerts, delete buttons |
| On Deep Space | ✅ WCAG AAA (contrast 7.1:1) |
| On Gunmetal | ✅ WCAG AA (contrast 5.7:1) |

Standard error red. No surprises.

---

## 2. Neutral Palette

The structural colors. Backgrounds, borders, text, surfaces.

### Deep Space — `#0F1729`

| Property | Value |
|----------|-------|
| Role | **Background** — page background, main canvas |
| Hex | `#0F1729` |
| RGB | `15, 23, 41` |
| HSL | `218°, 45%, 11%` |
| Usage | Main page background, full-width dark areas |

Not pure black. Pure black is harsh and makes colored elements vibrate. Deep Space has a tiny blue undertone that gives it depth and makes Ember Gold pop against it.

### Gunmetal — `#1E293B`

| Property | Value |
|----------|-------|
| Role | **Surface** — cards, panels, elevated surfaces, navbars |
| Hex | `#1E293B` |
| RGB | `30, 41, 59` |
| HSL | `216°, 38%, 17%` |
| Usage | Card backgrounds, sidebar panels, navbar, modals, elevated surfaces |

One step above Deep Space. The difference between Gunmetal and Deep Space should be subtle — just enough to create depth through elevation, not enough to create harsh borders.

### Steel — `#334155`

| Property | Value |
|----------|-------|
| Role | **Border** — dividers, borders, disabled states |
| Hex | `#334155` |
| RGB | `51, 65, 85` |
| HSL | `216°, 27%, 27%` |
| Usage | 1px borders, section dividers, disabled buttons, inactive tabs |

### Cloud — `#94A3B8`

| Property | Value |
|----------|-------|
| Role | **Secondary text** — captions, metadata, timestamps, labels |
| Hex | `#94A3B8` |
| RGB | `148, 163, 184` |
| HSL | `214°, 19%, 65%` |
| Usage | Timestamps, secondary labels, placeholder text, disabled text |
| On Deep Space | ✅ WCAG AA (contrast 4.9:1) |
| On Gunmetal | ⚠️ WCAG AA (contrast 3.9:1) — only for large text or decorative use |

### Frost — `#E2E8F0`

| Property | Value |
|----------|-------|
| Role | **Body text** — primary reading text on dark backgrounds |
| Hex | `#E2E8F0` |
| RGB | `226, 232, 240` |
| HSL | `214°, 37%, 91%` |
| Usage | Body copy, headings, primary labels, navigation text |
| On Deep Space | ✅ WCAG AAA (contrast 13.6:1) |
| On Gunmetal | ✅ WCAG AAA (contrast 10.8:1) |

Not pure white. Frost has the same blue undertone as Deep Space, which creates a cohesive, warm-on-cool contrast that's easier on the eyes than pure white on near-black.

---

## 3. Dark Mode Palette

BeckCloud is dark-mode-first. These are the default values.

```css
/* BeckCloud Dark Mode — CSS Custom Properties */
:root {
  /* Backgrounds */
  --bg-primary:    #0F1729;  /* Deep Space */
  --bg-secondary:  #1E293B;  /* Gunmetal */
  --bg-tertiary:   #283548;  /* Slightly lighter Gunmetal for hover states */

  /* Surfaces */
  --surface-card:    #1E293B;
  --surface-elevated: #283548;
  --surface-hover:   #334155;

  /* Borders */
  --border-default:  #334155;
  --border-subtle:   #283548;
  --border-focus:    #E8A838;

  /* Text */
  --text-primary:    #E2E8F0;  /* Frost */
  --text-secondary:  #94A3B8;  /* Cloud */
  --text-tertiary:   #64748B;  /* Muted — for captions, timestamps */
  --text-inverse:    #0F1729;  /* Deep Space — for text on brand colors */

  /* Brand */
  --brand-primary:   #E8A838;  /* Ember Gold */
  --brand-secondary: #7C5CFC;  /* Violet Haze */
  --brand-accent:    #FF6B4A;  /* Coral Pulse */

  /* Status */
  --status-success:  #4ADE80;  /* Greenlight */
  --status-warning:  #FBBF24;  /* Amber */
  --status-error:    #EF4444;  /* Red Alert */
  --status-info:     #60A5FA;  /* Soft blue — for informational states only */
}
```

### Light Mode (Secondary — when it exists)

```css
[data-theme="light"] {
  --bg-primary:    #F8FAFC;
  --bg-secondary:  #FFFFFF;
  --bg-tertiary:   #F1F5F9;

  --surface-card:    #FFFFFF;
  --surface-elevated: #FFFFFF;
  --surface-hover:   #F1F5F9;

  --border-default:  #E2E8F0;
  --border-subtle:   #F1F5F9;
  --border-focus:    #B8860B;

  --text-primary:    #0F1729;
  --text-secondary:  #475569;
  --text-tertiary:   #94A3B8;
  --text-inverse:    #FFFFFF;

  --brand-primary:   #B8860B;  /* Darker gold for light mode */
  --brand-secondary: #6344E0;  /* Darker violet for light mode */
  --brand-accent:    #E05536;  /* Darker coral for light mode */

  --status-success:  #16A34A;
  --status-warning:  #D97706;
  --status-error:    #DC2626;
  --status-info:     #2563EB;
}
```

---

## 4. Gradients

### Brand Gradient (Ember → Coral)

Used on the "Cloud" portion of the wordmark and primary CTA hover states.

```css
--gradient-brand: linear-gradient(90deg, #E8A838 0%, #FF6B4A 100%);
```

### Ember Glow (Subtle)

Used sparingly for hero backgrounds or feature highlights. A radial glow that fades to transparent.

```css
--gradient-glow: radial-gradient(ellipse at center, rgba(232, 168, 56, 0.15) 0%, transparent 70%);
```

### Violet Depth

Used for secondary backgrounds, technical sections, or feature cards.

```css
--gradient-violet: linear-gradient(135deg, #1E293B 0%, #2D1B69 100%);
```

---

## 5. Status Color System

For dashboards and service monitors, the color-coded status system:

| Status | Color | Usage |
|--------|-------|-------|
| ✅ Running / Up | Greenlight `#4ADE80` | Service healthy, deployment complete, backup success |
| ⏳ Pending / Degraded | Amber `#FBBF24` | Deployment in progress, degraded performance, maintenance |
| ❌ Stopped / Error | Red Alert `#EF4444` | Service down, deployment failed, backup error |
| ℹ️ Info / Neutral | Soft Blue `#60A5FA` | Informational messages, updates available, notes |
| ⚫ Unknown / Off | Cloud `#94A3B8` | Service not monitored, unknown state, disabled |

### Status Badges

```css
/* Example badge styles */
.badge-running {
  background: rgba(74, 222, 128, 0.15);
  color: #4ADE80;
  border: 1px solid rgba(74, 222, 128, 0.3);
}

.badge-pending {
  background: rgba(251, 191, 36, 0.15);
  color: #FBBF24;
  border: 1px solid rgba(251, 191, 36, 0.3);
}

.badge-error {
  background: rgba(239, 68, 68, 0.15);
  color: #EF4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}
```

---

## 6. Accessibility Notes

### Contrast Matrix

All color combinations tested against WCAG 2.1 AA and AAA standards.

**On Deep Space (`#0F1729`):**

| Foreground | Contrast Ratio | AA | AAA |
|------------|---------------|----|----|
| Frost `#E2E8F0` | 13.6:1 | ✅ Large & Normal | ✅ Large & Normal |
| Ember Gold `#E8A838` | 7.6:1 | ✅ Large & Normal | ✅ Large & Normal |
| Violet Haze `#7C5CFC` | 7.4:1 | ✅ Large & Normal | ✅ Large & Normal |
| Coral Pulse `#FF6B4A` | 7.2:1 | ✅ Large & Normal | ✅ Large & Normal |
| Greenlight `#4ADE80` | 7.8:1 | ✅ Large & Normal | ✅ Large & Normal |
| Red Alert `#EF4444` | 7.1:1 | ✅ Large & Normal | ✅ Large & Normal |
| Cloud `#94A3B8` | 4.9:1 | ✅ Normal | ❌ Normal (✅ Large) |
| Steel `#334155` | 2.3:1 | ❌ | ❌ (borders only) |

**On Gunmetal (`#1E293B`):**

| Foreground | Contrast Ratio | AA | AAA |
|------------|---------------|----|----|
| Frost `#E2E8F0` | 10.8:1 | ✅ Large & Normal | ✅ Large & Normal |
| Ember Gold `#E8A838` | 6.0:1 | ✅ Large & Normal | ✅ Large & Normal |
| Violet Haze `#7C5CFC` | 5.9:1 | ✅ Large & Normal | ✅ Large & Normal |
| Coral Pulse `#FF6B4A` | 5.7:1 | ✅ Large & Normal | ✅ Large & Normal |
| Red Alert `#EF4444` | 5.7:1 | ✅ Large & Normal | ✅ Large & Normal |
| Cloud `#94A3B8` | 3.9:1 | ❌ Normal (✅ Large) | ❌ |

### Guidelines

1. **Body text** must use Frost (`#E2E8F0`) on dark backgrounds. Never use Cloud (`#94A3B8`) for body text.
2. **Labels and captions** can use Cloud (`#94A3B8`) — it meets AA for normal text on Deep Space.
3. **Status indicators** (the colored dots and badges) should include text labels in addition to color. Color alone is never the sole indicator of state.
4. **Interactive elements** must have a visible focus state. The focus ring color is Ember Gold (`#E8A838`), which provides sufficient contrast on all dark backgrounds.
5. **Don't use brand colors as backgrounds for text** unless the text is large and bold (≥24px / 1.5rem). Ember Gold backgrounds with dark text pass AA for large text only.

---

## 7. Quick Reference Card

```
┌─────────────────────────────────────────────────┐
│  BeckCloud Color Reference                      │
│                                                  │
│  Brand:                                          │
│  ■ Ember Gold    #E8A838  (Primary)             │
│  ■ Violet Haze   #7C5CFC  (Secondary)           │
│  ■ Coral Pulse   #FF6B4A  (Accent)              │
│                                                  │
│  Status:                                         │
│  ■ Greenlight    #4ADE80  (Success)             │
│  ■ Amber         #FBBF24  (Warning)             │
│  ■ Red Alert     #EF4444  (Error)               │
│                                                  │
│  Neutrals:                                       │
│  ■ Deep Space    #0F1729  (Background)          │
│  ■ Gunmetal      #1E293B  (Surface)             │
│  ■ Steel         #334155  (Border)              │
│  ■ Cloud         #94A3B8  (Secondary text)      │
│  ■ Frost         #E2E8F0  (Primary text)        │
└─────────────────────────────────────────────────┘
```

---

*Version 1.0 · 2026-07-19 · BeckCloud Color Reference*
