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
