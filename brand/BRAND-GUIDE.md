# BeckCloud Brand Guide

> "It's not a startup. It's a homelab with opinions."

## 1. Brand Name

**Primary:** BeckCloud  
**Secondary:** BeckLab (reference to the domain `becklab.cloud`)

Use "BeckCloud" in all-facing surfaces — dashboards, service names, documentation. "BeckLab" works as a shorthand in internal contexts, URLs, and domain references. Think of it like "the lab" — casual, familiar.

**What it's NOT:** Not "Beck Cloud" (two words). Not "BeckCLoud" or any other capitalization experiment. It's BeckCloud. One word. CamelCase. Done.

---

## 2. Taglines

Five options, ranked. The first is the primary.

| # | Tagline | Vibe |
|---|---------|------|
| 1 | **"Built by one. Running for all."** | Primary. Confident without being cocky. Honest about the solo-operator reality but proud of what it delivers. |
| 2 | "Where homelabs graduate." | Aspirational. Implies growth, maturity, and the transition from toy to tool. |
| 3 | "Your data, our overkill." | Playful. Leans into the homelab spirit of deploying enterprise-grade tools for personal use. |
| 4 | "Uptime you can brag about." | Casual, competitive. Speaks to the pride-of-ownership angle. |
| 5 | "Not AWS. Better." | Bold, borderline irreverent. Use sparingly — good for a dev portal or internal joke. |

**Primary tagline:** *"Built by one. Running for all."*

---

## 3. Color Palette

See [COLORS.md](./COLORS.md) for the full technical reference (hex, RGB, contrast ratios, dark mode variants).

### Palette at a Glance

| Role | Name | Hex | Feel |
|------|------|-----|------|
| Primary | Ember Gold | `#E8A838` | Warm, confident, human — the one color that says "someone built this" |
| Secondary | Violet Haze | `#7C5CFC` | Technical depth, modern, unexpected (not blue) |
| Accent | Coral Pulse | `#FF6B4A` | Energy, action, the spark in the machine |
| Success | Greenlight | `#4ADE80` | Clean, readable green — goes well on dark |
| Warning | Amber | `#FBBF24` | Cautious, noticeable without being alarming |
| Error | Red Alert | `#EF4444` | Standard error red, nothing fancy |
| Neutral Dark | Deep Space | `#0F1729` | Background — not quite black, has character |
| Neutral Mid | Gunmetal | `#1E293B` | Cards, panels, elevated surfaces |
| Neutral Light | Frost | `#E2E8F0` | Body text on dark backgrounds |

**Why amber-gold?** Generic tech blue is everywhere. Cloud providers own blue. Blue says "enterprise." Amber-gold says "hardware." It's the color of terminal prompts, solder iron glow, LED indicators on a rack. It's warm without being orange. It works on dark backgrounds without vibrating. It makes people think of things that are lit up in a dark room — which is exactly what a homelab is.

---

## 4. Typography

### Headings: JetBrains Mono

- **Weight:** 700 (bold) for display, 600 (semi-bold) for section headings
- **Why:** JetBrains Mono was designed for code. It looks at home next to terminals, config files, and deployment logs. It signals "this was built by someone who types" without being a programming font costume.
- **Google Fonts:** `https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@600;700`
- **System fallback:** `Consolas, "Courier New", monospace`

### Body: Inter

- **Weight:** 400 (regular) for body, 500 (medium) for labels and buttons
- **Why:** Inter is the best free body font on the internet. Period. It was designed for screens. It has excellent x-height, generous proportions, and reads perfectly at small sizes (which matters for dashboard labels and service names). It doesn't fight for attention — which is good, because the amber accent will be doing enough talking.
- **Google Fonts:** `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600`
- **System fallback:** `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`

### Type Scale

| Level | Font | Size | Weight | Line Height |
|-------|------|------|--------|-------------|
| H1 (Hero) | JetBrains Mono | 48px / 3rem | 700 | 1.1 |
| H2 (Page) | JetBrains Mono | 32px / 2rem | 700 | 1.2 |
| H3 (Section) | JetBrains Mono | 24px / 1.5rem | 600 | 1.3 |
| H4 (Card) | JetBrains Mono | 18px / 1.125rem | 600 | 1.4 |
| Body | Inter | 16px / 1rem | 400 | 1.6 |
| Small | Inter | 14px / 0.875rem | 400 | 1.5 |
| Caption | Inter | 12px / 0.75rem | 500 | 1.4 |

---

## 5. Voice & Tone

### The Personality

BeckCloud sounds like Stephen talking to someone he actually respects. That's the baseline.

The voice is **dry**. Not dead — dry. There's wit in there, but it doesn't announce itself. It doesn't need to. The humor is in the observation, not the punchline. Think: understated competence with a smirk that you notice in retrospect.

### The Rules

**Be precise, not verbose.** If you can say it in twelve words, don't write thirty. Homelab operators are engineers. Engineers don't want a novel. They want the status, the fix, and the truth. Give them that.

**Be honest about complexity.** This isn't a product that pretends to be simple. BeckCloud is a homelab with twenty services, a Kubernetes cluster, and a backup strategy that involves more moving parts than most small businesses. Say it out loud: "This is complicated, and it works, and here's why that's impressive." Don't hide behind "just works." It doesn't. You made it work. That's the point.

**Be slightly sarcastic, never condescending.** There's a line between "this server survived three power cycles and a firmware update" and "you wouldn't know how this works if you tried." Stay on the right side. Snark is seasoning, not the meal.

**Be proud without being loud.** The homelab culture is built on quiet competence. People who run K3s clusters at home don't need to be told they're doing something impressive. They already know. The tone should acknowledge that shared understanding — like two people in a room who both know what `kubectl get pods --all-namespaces` does and find that both funny and tragic.

### Examples

| Situation | BeckCloud Voice | Not This |
|-----------|----------------|----------|
| Service down | "Velero's offline. We're looking at it." | "We're experiencing a brief interruption to our backup services and our team is working diligently to resolve the issue." |
| New service deployed | "Jellyfin's upgraded. The transcoding should be faster. Try not to stress it." | "We're excited to announce the latest update to our media streaming platform!" |
| Dashboard welcome | "Everything's running. For now." | "Welcome to your unified operations dashboard!" |
| Error page | "Something broke. Probably something I did. Check the logs." | "An unexpected error has occurred. Please contact support." |

### The Anti-Voice

BeckCloud is not:
- A startup landing page ("Empowering your digital journey!")
- A corporate IT department ("Per our service level agreement...")
- A meme account ("bro really thought he could...")
- A tutorial blog ("In this guide, we'll walk you through...")

It's a person's homelab. Act like it.

---

## 6. Logo Concept

See [LOGO.md](./LOGO.md) for the full technical specification.

### Quick Summary

The BeckCloud mark is a **geometric hexagon** (referencing K3s/cluster architecture) with an **ember-like core** inside — a warm, organic shape that contrasts with the rigid geometry. The wordmark uses JetBrains Mono with a subtle gradient from Ember Gold to Coral Pulse on the "Cloud" portion.

The hexagon says "infrastructure." The ember says "human." Together they say "infrastructure with a heartbeat."

**Favicon:** Hexagon only, solid Ember Gold on transparent.  
**Navbar:** Hexagon mark + "Beck" in wordmark.  
**Hero/Full:** Hexagon mark + "BeckCloud" wordmark with gradient accent.

---

## 7. Design Principles

1. **Dark mode is not a theme — it's the default.** Light mode exists as an afterthought, like a reading lamp. Design for dark first, always.

2. **Information density is a feature.** Homelab dashboards live on second monitors. Every pixel should carry weight. Dense, scannable, no whitespace-for-whitespace's-sake layouts.

3. **Monospace has meaning.** Code, status, identifiers — anything that looks like data should use JetBrains Mono. It creates visual hierarchy: monospace = technical, sans-serif = human.

4. **Color is signal, not decoration.** Every colored element should communicate something: status, severity, category. If a color doesn't carry information, it's probably noise.

5. **Personal > polished.** A hand-drawn icon is better than a generic icon from a paid library if it carries character. Imperfection is allowed. Sterility is not.

---

*Version 1.0 · 2026-07-19 · BeckCloud Brand Foundation*
