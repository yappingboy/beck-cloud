# 3 — Hex bolt & nut — real threads

> **Prompt**
>
> Create an M12 hex bolt 45 mm long with a real threaded shaft and a standard hex head, plus its matching hex nut, placed side by side.

Fully parametric OpenSCAD built from the prompt above — adjustable dimensions and colours, exported as `.SCAD` and rendered to the orbiting preview with [`render.sh`](render.sh).

<p align="center"><img src="03-hex-bolt-and-nut.gif" alt="Hex bolt & nut — real threads — orbiting render" width="380"></p>

**Parametric controls:** 3 dimensions · 2 colours

**What it demonstrates**

- **Real ISO metric threads** via BOSL2 `screw()` / `nut()` (spec `"M12x1.75"`) — not faked with stacked cylinders
- A complete fastener set: hex bolt + matching hex nut
- Standard spec string drives pitch, head, and thread profile

**Editable parameters**

| Parameter | Default | Range / options | Description |
| --- | --- | --- | --- |
| `screw_length` | `45` | `[10:1:100]` | Length of the screw shaft |

<details>
<summary>OpenSCAD source — <code>03-hex-bolt-and-nut.scad</code></summary>

```scad
include <BOSL2/std.scad>
include <BOSL2/screws.scad>

/* [Screw Parameters] */
// The screw size and pitch specification
screw_spec = "M12x1.75"; 

// Length of the screw shaft
screw_length = 45;      // [10:1:100]

/* [Colors] */
bolt_color = "LightSlateGray";
nut_color = "LightSlateGray";

$fn = 64;

// Place bolt on the left
translate([-15, 0, 0])
color(bolt_color)
screw(spec=screw_spec, l=screw_length, head="hex");

// Place nut on the right
translate([15, 0, 0])
color(nut_color)
nut(spec=screw_spec);
```

</details>
