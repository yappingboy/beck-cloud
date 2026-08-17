// 90-Degree Mounting Bracket with Honeycomb

/* [Dimensions] */
// Length of each flange from the outer corner
flange_length = 80;        // [40:1:150]
// Width of the bracket
bracket_width = 80;        // [40:1:150]
// Thickness of the flanges
thickness = 5;             // [2:1:15]
// Radius of the inner corner fillet
corner_fillet = 5;         // [1:1:15]

/* [Mounting Holes] */
// Diameter of the mounting holes (M5 clearance)
hole_dia = 5.2;            // [2:0.1:10]
// Solid boundary diameter around each hole
hole_boss_dia = 16;        // [8:1:30]

// Hole X position (distance from outer corner)
hole_offset_x = 45;        // [10:1:100]
// Hole Y1 position (distance from side edge)
hole_offset_y1 = 20;       // [10:1:100]
// Hole Y2 position (distance from side edge)
hole_offset_y2 = 60;       // [10:1:100]

/* [Honeycomb Pattern] */
// Flat-to-flat inner diameter of each hexagon
hex_flat_to_flat = 12;     // [5:1:30]
// Wall thickness between hexagons
hex_wall = 3;              // [1:0.5:10]
// Solid border thickness around the edges
border_thickness = 6;      // [2:1:20]

/* [Rendering] */
bracket_color = "#4682B4"; // color

$fn = 64;

// Combine hole positions into an array (4 holes total, 2 per flange)
hole_positions = [
    [hole_offset_x, hole_offset_y1],
    [hole_offset_x, hole_offset_y2]
];

// Helper module to generate a 2D grid of hexagons
module hex_grid(w, h, d, wall) {
    S = d + wall;
    dx = S;
    dy = S * sin(60);
    cols = ceil(w / dx) + 1;
    rows = ceil(h / dy) + 1;
    for (i = [-1 : cols]) {
        for (j = [-1 : rows]) {
            x = i * dx + (j % 2) * (dx / 2);
            y = j * dy;
            translate([x, y]) rotate(30) circle(d = d / cos(30), $fn=6);
        }
    }
}

// Generates the 2D masking area to keep borders and bosses solid
module honeycomb_mask() {
    difference() {
        // Safe inner zone
        translate([thickness + corner_fillet + border_thickness, border_thickness])
        square([flange_length - (thickness + corner_fillet + border_thickness * 2),
                bracket_width - border_thickness * 2]);

        // Subtract bosses around the mounting holes
        for (pos = hole_positions) {
            translate(pos) circle(d = hole_boss_dia);
        }
    }
}

// The final 2D honeycomb cutout pattern
module honeycomb_cut_2d() {
    intersection() {
        // Generate full grid slightly larger than needed to ensure coverage
        translate([-10, -10]) hex_grid(flange_length + 20, bracket_width + 20, hex_flat_to_flat, hex_wall);
        honeycomb_mask();
    }
}

// 2D L-profile of the bracket
module bracket_profile() {
    R_in = corner_fillet;
    R_out = thickness + corner_fillet;
    C = [thickness + corner_fillet, thickness + corner_fillet];

    union() {
        // Flange 1 right of corner
        translate([C.x, 0]) square([flange_length - C.x, thickness]);
        // Flange 2 above corner
        translate([0, C.y]) square([thickness, flange_length - C.y]);
        // Filleted Corner section
        intersection() {
            square([C.x, C.y]);
            translate(C) difference() {
                circle(r = R_out);
                circle(r = R_in);
            }
        }
    }
}

// Build the final 3D part
color(bracket_color)
difference() {
    // 1. Base solid bracket (L-extrusion)
    translate([0, bracket_width, 0])
    rotate([90, 0, 0])
    linear_extrude(bracket_width)
    bracket_profile();

    // 2. Flange 1 holes (Z-axis)
    for (pos = hole_positions) {
        translate([pos.x, pos.y, -1])
        cylinder(d = hole_dia, h = thickness + 2);
    }

    // 3. Flange 2 holes (X-axis)
    for (pos = hole_positions) {
        translate([-1, pos.y, pos.x])
        rotate([0, 90, 0])
        cylinder(d = hole_dia, h = thickness + 2);
    }

    // 4. Flange 1 honeycomb cutout
    translate([0, 0, -1])
    linear_extrude(height = thickness + 2)
    honeycomb_cut_2d();

    // 5. Flange 2 honeycomb cutout
    translate([thickness + 1, 0, 0])
    rotate([0, -90, 0])
    linear_extrude(height = thickness + 2)
    honeycomb_cut_2d();
}
