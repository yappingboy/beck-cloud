# 8 — Centrifugal pump impeller

> **Prompt**
>
> Design a centrifugal pump impeller: a 90 mm diameter back-plate with a central 12 mm bore and a raised hub, and seven backward-curved blades that sweep from the hub out to the rim, each blade curving smoothly along its path.

Fully parametric OpenSCAD built from the prompt above — adjustable dimensions and colours, exported as `.SCAD` and rendered to the orbiting preview with [`render.sh`](render.sh).

<p align="center"><img src="08-centrifugal-impeller.gif" alt="Centrifugal pump impeller — orbiting render" width="380"></p>

**Parametric controls:** 10 dimensions · 1 colour

**What it demonstrates**

- Seven **backward-curved blades** swept along curved paths (BOSL2) in a clean radial array
- Raised central hub with a 12 mm bore on a circular back-plate
- Smooth turbomachinery surfaces, fused manifold to the plate

**Editable parameters**

| Parameter | Default | Range / options | Description |
| --- | --- | --- | --- |
| `impeller_diameter` | `90` | `[50:1:150]` | Outer diameter of the impeller back-plate |
| `bore_diameter` | `12` | `[4:0.5:30]` | Diameter of the central bore hole |
| `backplate_thickness` | `3` | `[1:0.5:10]` | Thickness of the main back-plate |
| `hub_diameter` | `26` | `[15:1:50]` | Outer diameter of the raised central hub |
| `hub_height` | `20` | `[10:1:60]` | Total height of the hub from the bottom of the back-plate |
| `blade_count` | `7` | `[3:1:15]` | Number of backward-curved blades |
| `blade_height` | `12` | `[2:1:40]` | Height of the blades above the back-plate |
| `blade_thickness` | `3` | `[1:0.5:8]` | Thickness of each blade |
| `sweep_angle` | `75` | `[10:1:180]` | The angle (in degrees) that the blades sweep backwards |
| `part_color` | `"#B0C4DE"` | `LightSteelBlue` |  |
| `steps` | `48` | `Curve resolution` |  |

<details>
<summary>OpenSCAD source — <code>08-centrifugal-impeller.scad</code></summary>

```scad
include <BOSL2/std.scad>

/* [Main Dimensions] */
// Outer diameter of the impeller back-plate
impeller_diameter = 90; // [50:1:150]

// Diameter of the central bore hole
bore_diameter = 12; // [4:0.5:30]

// Thickness of the main back-plate
backplate_thickness = 3; // [1:0.5:10]

/* [Hub Dimensions] */
// Outer diameter of the raised central hub
hub_diameter = 26; // [15:1:50]

// Total height of the hub from the bottom of the back-plate
hub_height = 20; // [10:1:60]

/* [Blade Parameters] */
// Number of backward-curved blades
blade_count = 7; // [3:1:15]

// Height of the blades above the back-plate
blade_height = 12; // [2:1:40]

// Thickness of each blade
blade_thickness = 3; // [1:0.5:8]

// The angle (in degrees) that the blades sweep backwards
sweep_angle = 75; // [10:1:180]

/* [Appearance] */
part_color = "#B0C4DE"; // LightSteelBlue

$fn = 64; 

module centrifugal_impeller() {
    difference() {
        union() {
            // Back-plate
            cyl(d=impeller_diameter, l=backplate_thickness, chamfer1=1, anchor=BOTTOM);

            // Raised Hub
            cyl(d=hub_diameter, l=hub_height, chamfer2=1.5, anchor=BOTTOM);

            // Blades (logarithmic spiral for constant incidence angle)
            // Inner radius overlaps the hub slightly to ensure a solid union
            blade_inner_r = (hub_diameter / 2) - 0.5; 
            // Outer radius stops slightly short of the rim so the round endcaps don't overhang
            blade_outer_r = (impeller_diameter / 2) - (blade_thickness / 2);
            
            steps = 48; // Curve resolution
            
            // Calculate the 2D path of the sweeping blade
            pts = [
                for(i = [0 : steps])
                    let(
                        t = i / steps,
                        r = blade_inner_r * pow(blade_outer_r / blade_inner_r, t),
                        a = -sweep_angle * t
                    )
                    [r * cos(a), r * sin(a)]
            ];

            // Distribute and extrude the 7 blades
            for(i = [0 : blade_count - 1]) {
                zrot(i * 360 / blade_count)
                up(backplate_thickness)
                linear_extrude(height = blade_height)
                stroke(pts, width=blade_thickness, endcaps="round");
            }
        }

        // Central Bore (subtracted at the end to ensure a clean hole through hub and blades)
        down(1)
        cyl(d=bore_diameter, l=hub_height + 2, anchor=BOTTOM);
    }
}

color(part_color)
centrifugal_impeller();
```

</details>
