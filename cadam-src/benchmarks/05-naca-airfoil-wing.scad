// Tapered Wing Section Parameters
/* [Wing Geometry] */
root_chord = 120;       // [50:10:300]
tip_chord = 80;         // [30:10:200]
span = 200;             // [50:10:500]

/* [NACA 4-Digit Profile] */
// First digit (max camber in hundredths)
naca_m = 0.02;          // [0.00:0.01:0.09]
// Second digit (position of max camber in tenths)
naca_p = 0.40;          // [0.10:0.10:0.90]
// Last two digits (max thickness in hundredths)
naca_t = 0.12;          // [0.05:0.01:0.30]

/* [Structural Features] */
spar_radius = 4;        // [1:0.5:10]
lightening_holes = 5;   // [0:1:10]

/* [Appearance] */
wing_color = "SteelBlue"; // [SteelBlue, Silver, Orange, White, DimGray]

$fn = 64;

// --- Mathematical Functions for NACA 4-Digit Airfoil ---

function naca_camber(x, m, p) =
    (m == 0 || p == 0) ? 0 :
    (x < p) ? (m / pow(p,2)) * (2 * p * x - pow(x,2))
            : (m / pow(1-p,2)) * ((1 - 2*p) + 2 * p * x - pow(x,2));

function naca_camber_deriv(x, m, p) =
    (m == 0 || p == 0) ? 0 :
    (x < p) ? (2 * m / pow(p,2)) * (p - x)
            : (2 * m / pow(1-p,2)) * (p - x);

function naca_points(m, p, t, N=80) =
    let (
        upper = [for (i=[0:N])
            let (
                x = 0.5 * (1 - cos(i * 180 / N)),
                yt = 5 * t * (0.2969 * sqrt(max(0, x)) - 0.1260 * x - 0.3516 * pow(x,2) + 0.2843 * pow(x,3) - 0.1015 * pow(x,4)),
                yc = naca_camber(x, m, p),
                dyc = naca_camber_deriv(x, m, p),
                theta = atan(dyc)
            )
            [x - yt * sin(theta), yc + yt * cos(theta)]
        ],
        lower = [for (i=[N-1:-1:1]) // Skip duplicate endpoints to form a closed loop
            let (
                x = 0.5 * (1 - cos(i * 180 / N)),
                yt = 5 * t * (0.2969 * sqrt(max(0, x)) - 0.1260 * x - 0.3516 * pow(x,2) + 0.2843 * pow(x,3) - 0.1015 * pow(x,4)),
                yc = naca_camber(x, m, p),
                dyc = naca_camber_deriv(x, m, p),
                theta = atan(dyc)
            )
            [x + yt * sin(theta), yc - yt * cos(theta)]
        ]
    )
    concat(upper, lower);


// --- Modules ---

// Generates a rounded-end cylinder between two points, safely extended to cut cleanly
module strut(p1, p2, r) {
    v = p2 - p1;
    ext = 5;
    dir = v / norm(v);
    p1_ext = p1 - dir * ext;
    p2_ext = p2 + dir * ext;
    hull() {
        translate(p1_ext) sphere(r=r);
        translate(p2_ext) sphere(r=r);
    }
}


// --- Main Geometry Assembly ---

// Calculate standard spar locations (25% and 70% of chord length)
x_spar1 = 0.25;
x_spar2 = 0.70;

// Calculate 3D coordinates for the spar tubes to correctly follow the camber and taper
p1_root = [x_spar1 * root_chord, naca_camber(x_spar1, naca_m, naca_p) * root_chord, 0];
p1_tip  = [x_spar1 * tip_chord,  naca_camber(x_spar1, naca_m, naca_p) * tip_chord, span];

p2_root = [x_spar2 * root_chord, naca_camber(x_spar2, naca_m, naca_p) * root_chord, 0];
p2_tip  = [x_spar2 * tip_chord,  naca_camber(x_spar2, naca_m, naca_p) * tip_chord, span];


// Rotate wing to lay "flat" for standard viewing 
// (Span extends along +Y, chord along +X, thickness aligns with Z)
color(wing_color)
rotate([-90, 0, 0])
difference() {
    
    // Solid Wing Shape
    linear_extrude(height = span, scale = tip_chord / root_chord)
    scale([root_chord, root_chord])
    polygon(naca_points(naca_m, naca_p, naca_t));

    // Spanwise Spar Tube Cuts
    strut(p1_root, p1_tip, spar_radius);
    strut(p2_root, p2_tip, spar_radius);

    // Lightening Hole Cuts (spaced evenly along span)
    if (lightening_holes > 0) {
        for (i = [1 : lightening_holes]) {
            let (
                // Space holes along the span
                z_pos = i * span / (lightening_holes + 1),
                
                // Determine the chord length at this spanwise position
                local_chord = root_chord + (tip_chord - root_chord) * (z_pos / span),
                
                // Position halfway between the two spars
                x_pos = 0.475 * local_chord,
                
                // Make the hole size proportional to the local chord length
                hole_r = local_chord * 0.12
            )
            // Cut through the airfoil thickness (Y axis in the unrotated frame)
            translate([x_pos, 0, z_pos])
            rotate([90, 0, 0])
            cylinder(h=root_chord * 2, r=hole_r, center=true);
        }
    }
}
