include <BOSL2/std.scad>

/* [Dimensions] */
// Outer diameter of the knob
knob_diameter = 40;       // [20:1:80]
// Total height of the knob
knob_height = 22;         // [10:1:50]
// Number of knurl ridges
knurl_density = 36;       // [16:2:100]
// Depth of the diamond knurl pattern
knurl_depth = 1.2;        // [0.5:0.1:3.0]

/* [Shaft Interface] */
// Diameter of the D-shaft
shaft_diameter = 6.0;     // [3:0.1:12]
// Extra clearance for easy fit
shaft_clearance = 0.2;    // [0:0.05:0.5]
// Depth of the flat portion on the D-shaft
shaft_flat_depth = 1.5;   // [0:0.1:4.0]
// How deep the shaft hole goes into the knob
shaft_bore_depth = 18;    // [5:1:40]

/* [Set Screw] */
// Thread diameter for the set screw (M3 = 3.0)
set_screw_diameter = 3.0; // [2:0.1:6.0]
// Height of the set screw hole from the bottom
set_screw_height = 8;     // [2:1:30]
// Diameter of the counterbore for the set screw head
set_screw_cb_diameter = 6.0; // [3:0.1:10.0]
// Depth of the counterbore
set_screw_cb_depth = 12;  // [0:1:30]

/* [Pointer] */
// Rotational angle of the pointer (180 points opposite to flat)
pointer_angle = 180;      // [0:15:345]
// Width of the pointer base
pointer_width = 4;        // [2:0.5:10]
// Raised height of the pointer
pointer_height = 1.5;     // [0.5:0.1:5]

/* [Colors] */
knob_color = "DarkSlateGray";
pointer_color = "Silver";

// 2D gear profile for sweeping into knurls
module gear_2d(r, depth, teeth) {
    w = ((r - depth) * 2 * 3.14159) / teeth * 1.1;
    union() {
        circle(r = r - depth, $fn=120);
        for(i=[0:teeth-1]) {
            rotate([0, 0, i * 360 / teeth])
            polygon([
                [r - depth + 0.05, -w/2],
                [r - depth + 0.05, w/2],
                [r, 0]
            ]);
        }
    }
}

// Cylindrical base with top and bottom chamfers
module chamfered_cylinder(d, h, chamfer) {
    rotate_extrude($fn=120) {
        polygon([
            [0, 0],
            [d/2 - chamfer, 0],
            [d/2, chamfer],
            [d/2, h - chamfer],
            [d/2 - chamfer, h],
            [0, h]
        ]);
    }
}

// D-shaft boolean cutter
module d_shaft_cutter(d, depth, flat_dist) {
    intersection() {
        cylinder(d=d, h=depth, $fn=64);
        translate([-d, -d, 0])
            cube([d*2, d + flat_dist, depth]);
    }
}

// Variables derived from parameters
actual_shaft_d = shaft_diameter + shaft_clearance;
flat_dist = (shaft_diameter/2) - shaft_flat_depth + (shaft_clearance/2);

// Main Assembly
difference() {
    // Solid body with diamond knurling
    color(knob_color)
    intersection() {
        twist_angle = 360 * knob_height / (3.14159 * knob_diameter);
        intersection() {
            linear_extrude(height=knob_height, twist=twist_angle, slices=60, convexity=5)
                gear_2d(knob_diameter/2, knurl_depth, knurl_density);
            linear_extrude(height=knob_height, twist=-twist_angle, slices=60, convexity=5)
                gear_2d(knob_diameter/2, knurl_depth, knurl_density);
        }
        chamfered_cylinder(knob_diameter, knob_height, 1.5);
    }

    // D-Shaft Cut
    translate([0, 0, -0.05])
    d_shaft_cutter(actual_shaft_d, shaft_bore_depth + 0.05, flat_dist);

    // Set Screw Cut
    translate([0, knob_diameter/2 + 1, set_screw_height])
    rotate([90, 0, 0]) {
        cylinder(d=set_screw_diameter, h=knob_diameter/2 + 2, $fn=32);
        translate([0, 0, -1])
        cylinder(d=set_screw_cb_diameter, h=set_screw_cb_depth + 1, $fn=32);
    }
}

// Top Pointer Indicator
color(pointer_color)
rotate([0, 0, pointer_angle])
translate([0, 0, knob_height - 0.05])
hull() {
    // Outer tip
    translate([0, knob_diameter/2 - 4, 0]) 
        cylinder(d=pointer_width/2, h=pointer_height, $fn=32);
    // Inner base
    translate([0, 4, 0]) 
        cylinder(d=pointer_width, h=pointer_height, $fn=32);
}