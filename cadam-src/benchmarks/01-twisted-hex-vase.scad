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
