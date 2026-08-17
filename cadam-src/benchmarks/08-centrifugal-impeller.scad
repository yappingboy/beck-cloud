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