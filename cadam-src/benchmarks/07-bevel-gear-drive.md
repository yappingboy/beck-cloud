# 7 — Right-angle bevel gear drive

> **Prompt**
>
> Build a right-angle bevel gear drive: a 24-tooth bevel gear on a vertical shaft meshing at 90 degrees with a 16-tooth bevel pinion on a horizontal shaft, each on a short stub shaft.

Fully parametric OpenSCAD built from the prompt above — adjustable dimensions and colours, exported as `.SCAD` and rendered to the orbiting preview with [`render.sh`](render.sh).

<p align="center"><img src="07-bevel-gear-drive.gif" alt="Right-angle bevel gear drive — orbiting render" width="380"></p>

**Parametric controls:** 9 dimensions · 3 colours

**What it demonstrates**

- A meshing **bevel gear pair** at 90° via BOSL2 `bevel_gear()` with matched pitch cones
- 24-tooth gear + 16-tooth pinion, each on a stub shaft
- Three colours for gear / pinion / shafts

**Editable parameters**

| Parameter | Default | Range / options | Description |
| --- | --- | --- | --- |
| `gear1_teeth` | `24` | `[10:1:60]` |  |
| `gear2_teeth` | `16` | `[10:1:60]` |  |
| `circular_pitch` | `5` | `[2:0.5:10]` |  |
| `face_width` | `8` | `[4:1:20]` |  |
| `bore_diameter` | `5` | `[2:0.5:20]` |  |
| `shaft_length` | `30` | `[10:1:50]` |  |
| `shaft_diameter` | `5` | `[2:0.5:20]` |  |
| `gear2_spin` | `11.25` | `[0:0.1:45]` |  |

<details>
<summary>OpenSCAD source — <code>07-bevel-gear-drive.scad</code></summary>

```scad
include <BOSL2/std.scad>
include <BOSL2/gears.scad>

/* [Gear Specifications] */
gear1_teeth = 24;      // [10:1:60]
gear2_teeth = 16;      // [10:1:60]
circular_pitch = 5;    // [2:0.5:10]
face_width = 8;        // [4:1:20]
bore_diameter = 5;     // [2:0.5:20]
shaft_length = 30;     // [10:1:50]
shaft_diameter = 5;    // [2:0.5:20]
gear2_spin = 11.25;    // [0:0.1:45]

/* [Colors] */
gear1_color = "SteelBlue";
gear2_color = "DarkOrange";
shaft_color = "Silver";

$fn = 64;

module gear_system() {
    // Gear 1: Vertical (Z-axis)
    color(gear1_color)
    bevel_gear(
        circ_pitch = circular_pitch,
        teeth = gear1_teeth,
        mate_teeth = gear2_teeth,
        face_width = face_width,
        bore = bore_diameter,
        spiral = 0,
        anchor = "apex"
    );
    
    // Vertical Shaft
    color(shaft_color)
    translate([0, 0, -shaft_length/2])
    cylinder(h=shaft_length, d=shaft_diameter, center=true);

    // Gear 2: Horizontal (X-axis)
    color(gear2_color)
    rotate([0, 90, 0])
    rotate([0, 0, gear2_spin]) // Fine-tune tooth meshing
    bevel_gear(
        circ_pitch = circular_pitch,
        teeth = gear2_teeth,
        mate_teeth = gear1_teeth,
        face_width = face_width,
        bore = bore_diameter,
        spiral = 0,
        anchor = "apex"
    );
    
    // Horizontal Shaft
    color(shaft_color)
    rotate([0, 90, 0])
    translate([0, 0, -shaft_length/2])
    cylinder(h=shaft_length, d=shaft_diameter, center=true);
}

gear_system();
```

</details>
