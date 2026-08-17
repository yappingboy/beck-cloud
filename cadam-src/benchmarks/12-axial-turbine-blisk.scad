// Axial-Flow Turbine Blisk
// A parametric model of a jet engine compressor stage

/* [Blisk Dimensions] */
// Number of blades around the hub
num_blades = 28;           // [10:1:60]
// Outer radius of the central hub
hub_radius = 45;           // [20:1:100]
// Radius of the central shaft hole
bore_radius = 12;          // [5:1:30]
// Radial height of each blade
blade_height = 45;         // [20:1:100]

/* [Hub Profile] */
// Thickness of the hub at the center
hub_center_thickness = 30; // [10:1:60]
// Thickness of the hub at the rim
hub_rim_thickness = 22;    // [10:1:50]
// Width of the collar around the bore
flange_width = 8;          // [0:1:20]
// Height of the collar around the bore
flange_height = 5;         // [0:1:20]

/* [Blade Aerodynamics] */
// Length of the blade profile (chord)
blade_chord = 22;          // [10:1:50]
// Angle of the blade at the root
root_stagger = 30;         // [0:1:90]
// Total twist from root to tip
blade_twist = 35;          // [-60:1:60]
// Aerodynamic camber (curvature)
camber_pct = 10;           // [0:1:20]
// Maximum thickness of the blade profile
thickness_pct = 6;         // [2:1:15]

/* [Settings] */
blisk_color = "#A8AEB3";
$fn = 72;

// --- Main Model ---

color(blisk_color)
difference() {
    union() {
        hub();
        blade_array();
    }
    // Central bore keyway to lock the blisk to a shaft
    translate([bore_radius + 1.5, 0, 0])
    cube([4, 6, hub_center_thickness * 3], center=true);
}

// --- Modules ---

module hub() {
    // Generates the profiled central disk
    rotate_extrude(convexity = 4)
    polygon([
        [bore_radius, hub_center_thickness/2 + flange_height],
        [bore_radius + flange_width, hub_center_thickness/2 + flange_height],
        [bore_radius + flange_width, hub_center_thickness/2],
        [hub_radius, hub_rim_thickness/2],
        [hub_radius, -hub_rim_thickness/2],
        [bore_radius + flange_width, -hub_center_thickness/2],
        [bore_radius + flange_width, -hub_center_thickness/2 - flange_height],
        [bore_radius, -hub_center_thickness/2 - flange_height]
    ]);
}

module blade_array() {
    // Radial array of aerofoil blades
    for (i = [0 : num_blades - 1]) {
        rotate([0, 0, i * 360 / num_blades])
        // Embed the blade root slightly into the hub rim
        translate([hub_radius - 2, 0, 0])
        // Lay the blade down so it points outward radially
        rotate([0, 90, 0]) 
        // Extrude with aerodynamic twist
        linear_extrude(height = blade_height + 2, twist = blade_twist, slices = 45, convexity = 2)
        // Set the root angle (stagger)
        rotate([0, 0, root_stagger])
        // Center the aerofoil on the extrusion axis
        translate([-blade_chord/2, 0])
        naca_airfoil(blade_chord, thickness_pct, camber_pct, 40);
    }
}

module naca_airfoil(c, t_pct, m_pct, p_pct) {
    // Generates a robust NACA-style highly cambered profile
    t_val = t_pct / 100;
    m = m_pct / 100;
    p = p_pct / 100;

    // Thickness distribution function
    function y_t(x) = 5 * t_val * c * (0.2969*sqrt(abs(x/c)) - 0.1260*(x/c) - 0.3516*pow(x/c,2) + 0.2843*pow(x/c,3) - 0.1015*pow(x/c,4));

    // Camber line function
    function y_c(x) = (m == 0) ? 0 :
        ( (x/c) <= p ) ? m * c / pow(p,2) * (2*p*(x/c) - pow(x/c,2))
                       : m * c / pow(1-p,2) * ((1-2*p) + 2*p*(x/c) - pow(x/c,2));

    // Camber gradient for normal vector
    function dy_c(x) = (m == 0) ? 0 :
        ( (x/c) <= p ) ? 2 * m / pow(p,2) * (p - (x/c))
                       : 2 * m / pow(1-p,2) * (p - (x/c));

    function theta(x) = atan(dy_c(x));

    steps = 30; // Resolution per side
    
    // Generate upper surface points
    pts_upper = [ for (i=[0:steps])
        let (
            x = c * (1 - cos(i * 180 / steps))/2,
            yt = y_t(x),
            yc = y_c(x),
            th = theta(x)
        )
        [ x - yt * sin(th), yc + yt * cos(th) ]
    ];

    // Generate lower surface points
    pts_lower = [ for (i=[steps:-1:0])
        let (
            x = c * (1 - cos(i * 180 / steps))/2,
            yt = y_t(x),
            yc = y_c(x),
            th = theta(x)
        )
        [ x + yt * sin(th), yc - yt * cos(th) ]
    ];

    // Combine and apply offset to guarantee manifold trailing edges and robust printability
    offset(r=0.6)
    polygon(concat(pts_upper, pts_lower));
}
