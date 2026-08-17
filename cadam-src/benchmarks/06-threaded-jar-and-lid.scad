include <BOSL2/std.scad>
include <BOSL2/threading.scad>

/* [Jar Dimensions] */
jar_diameter = 60;       // [20:1:100]
jar_height = 70;         // [20:1:200]
wall_thickness = 2.5;    // [1:0.1:5]

/* [Neck and Threading] */
neck_diameter = 55;      // [20:1:100]
neck_height = 15;        // [5:1:30]
thread_pitch = 3;        // [1:0.5:5]
lid_clearance = 0.5;     // [0:0.1:2]

/* [Colors] */
jar_color = "LightSkyBlue";
lid_color = "SteelBlue";

$fn = 64;

shoulder_height = 5;
body_height = jar_height - neck_height - shoulder_height;

// Position jar
translate([-35, 0, 0])
color(jar_color)
difference() {
    // Solid exterior
    union() {
        // Body
        cylinder(d=jar_diameter, h=body_height);
        // Shoulder
        translate([0, 0, body_height])
        cylinder(d1=jar_diameter, d2=neck_diameter, h=shoulder_height);
        // Neck
        translate([0, 0, body_height + shoulder_height])
        threaded_rod(d=neck_diameter, l=neck_height, pitch=thread_pitch, anchor=BOTTOM);
    }
    
    // Hollow interior
    union() {
        // Body interior
        translate([0, 0, wall_thickness])
        cylinder(d=jar_diameter - 2 * wall_thickness, h=body_height - wall_thickness + 0.01);
        
        // Shoulder interior
        translate([0, 0, body_height])
        cylinder(d1=jar_diameter - 2 * wall_thickness, d2=neck_diameter - 2 * wall_thickness, h=shoulder_height + 0.01);
        
        // Neck interior
        translate([0, 0, body_height + shoulder_height])
        cylinder(d=neck_diameter - 2 * wall_thickness, h=neck_height + 1);
    }
}

// Position lid beside the jar, upside down to show internal threads
translate([35, 0, neck_height + wall_thickness])
rotate([180, 0, 0])
color(lid_color)
difference() {
    lid_outer_d = neck_diameter + 2 * wall_thickness + 2 * lid_clearance + 2;
    
    // Lid exterior with grips
    difference() {
        cylinder(d=lid_outer_d, h=neck_height + wall_thickness);
        
        // Grips
        for (i = [0 : 15 : 359]) {
            rotate([0, 0, i])
            translate([lid_outer_d/2, 0, -1])
            cylinder(r=1.5, h=neck_height + wall_thickness + 2, $fn=16);
        }
    }
    
    // Internal threads cutout
    translate([0, 0, -0.1])
    threaded_rod(d=neck_diameter + lid_clearance, l=neck_height + 0.2, pitch=thread_pitch, anchor=BOTTOM, internal=true);
}