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
