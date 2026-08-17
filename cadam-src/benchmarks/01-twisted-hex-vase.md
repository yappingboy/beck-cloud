# 1 — Twisted hexagonal vase

> **Prompt**
>
> Design a twisted hexagonal vase: a hollow shell about 150 mm tall that tapers from a 70 mm base to a 50 mm mouth, with the hexagonal cross-section twisting 120 degrees from bottom to top, a 2 mm wall, and a closed bottom.

Fully parametric OpenSCAD built from the prompt above — adjustable dimensions and colours, exported as `.SCAD` and rendered to the orbiting preview with [`render.sh`](render.sh).

<p align="center"><img src="01-twisted-hex-vase.gif" alt="Twisted hexagonal vase — orbiting render" width="380"></p>

**Parametric controls:** 6 dimensions · 1 colour

**What it demonstrates**

- Generative twist-loft via `linear_extrude(twist=, scale=)` over a hexagon
- Hollowed with a solid printable floor (inner cutter intersected with a lifted cylinder)
- Compensates the hexagon flat-angle so the wall thickness stays true on every face

**Editable parameters**

| Parameter | Default | Range / options | Description |
| --- | --- | --- | --- |
| `height` | `150` | `[50:5:300]` | Total height of the vase |
| `base_radius` | `35` | `[20:1:100]` | Base radius (circumradius, so diameter is 2x this) |
| `mouth_radius` | `25` | `[10:1:80]` | Mouth radius (circumradius, so diameter is 2x this) |
| `twist_angle` | `120` | `[-720:5:720]` | Total twist angle from bottom to top (degrees) |
| `wall_thickness` | `2.0` | `[0.5:0.5:5.0]` | Thickness of the walls and base |

<details>
<summary>OpenSCAD source — <code>01-twisted-hex-vase.scad</code></summary>

```scad
// Twisted Hexagonal Vase

/* [Dimensions] */
// Total height of the vase
height = 150;           // [50:5:300]
// Base radius (circumradius, so diameter is 2x this)
base_radius = 35;       // [20:1:100]
// Mouth radius (circumradius, so diameter is 2x this)
mouth_radius = 25;      // [10:1:80]
// Total twist angle from bottom to top (degrees)
twist_angle = 120;      // [-720:5:720]
// Thickness of the walls and base
wall_thickness = 2.0;   // [0.5:0.5:5.0]

/* [Style] */
// Color of the vase
vase_color = "Turquoise";

/* [Hidden] */
// Compensation for the hexagon's angle to maintain true wall thickness on the flats
wall_adj = wall_thickness / cos(30);

// Number of vertical slices for a smooth twist
slices = height * 2; 

// Outer geometry variables
r_bot_out = base_radius;
r_top_out = mouth_radius;
scale_out = r_top_out / r_bot_out;

// Inner geometry variables
r_bot_in = base_radius - wall_adj;
r_top_in_at_H = mouth_radius - wall_adj;

// Extend the inner cutter slightly to ensure a clean opening at the top
cut_extra = 2; 
H_in = height + cut_extra;

// Calculate slope of inner radius change to maintain perfect alignment
slope = (r_top_in_at_H - r_bot_in) / height;
r_top_in = r_bot_in + slope * H_in;

scale_in = r_top_in / r_bot_in;
twist_in = twist_angle * (H_in / height);

color(vase_color)
difference() {
    // Outer Solid Shell
    linear_extrude(height = height, twist = twist_angle, scale = scale_out, slices = slices)
        circle(r = r_bot_out, $fn = 6);
    
    // Inner Cut (Hollow)
    // We intersect the twisted inner solid with a lifted cylinder 
    // to leave a solid floor of exactly `wall_thickness`.
    intersection() {
        linear_extrude(height = H_in, twist = twist_in, scale = scale_in, slices = slices)
            circle(r = r_bot_in, $fn = 6);
            
        translate([0, 0, wall_thickness])
            cylinder(h = H_in, r = max(base_radius, mouth_radius) * 2, $fn = 32);
    }
}
```

</details>
