// [Engine Configuration]
// Show 1/4 cutaway to reveal internal components
cutaway_view = true;
// Number of front fan blades
blade_count = 26; // [16:2:36]

// [Colors]
nacelle_color = "White";
fan_color = "Silver";
spinner_color = "DimGray";
core_cowl_color = "DarkSlateGray";
strut_color = "LightSlateGray";
compressor_color = "LightGray";
combustor_color = "FireBrick";
turbine_color = "Peru";
exhaust_color = "SaddleBrown";
shaft_color = "LightGray";

// Main Execution
// Orient engine horizontally and center it
rotate([-90, 0, 0]) 
translate([0, 0, -155]) {
    engine_casings();
    internals();
}

// === Assemblies ===

module engine_casings() {
    if (cutaway_view) {
        difference() {
            casings();
            // 90-degree wedge cutout to reveal interior
            translate([0, 0, -50])
            cube([200, 200, 500]);
        }
    } else {
        casings();
    }
}

module casings() {
    // Outer Nacelle Cowl
    color(nacelle_color)
    rotate_extrude($fn=128) 
    nacelle_profile();

    // Inner Core Cowl
    color(core_cowl_color)
    rotate_extrude($fn=128) 
    core_cowl_profile();

    // Bypass Struts / Outlet Guide Vanes
    color(strut_color)
    translate([0, 0, 70])
    for(i = [0 : 24]) {
        rotate([0, 0, i * 360 / 25])
        translate([36, 0, 0])
        rotate([0, 90, 0])
        linear_extrude(height=42, twist=5)
        rotate([0, 0, 15])
        scale([1, 0.15])
        circle(r=8, $fn=16);
    }
}

module internals() {
    // Nose Spinner
    color(spinner_color)
    nose_spinner();

    // Front Fan Blades
    color(fan_color)
    translate([0, 0, 40])
    for(i = [0 : blade_count - 1]) {
        rotate([0, 0, i * 360 / blade_count])
        translate([23, 0, 0])
        rotate([-15, 0, 0])
        fan_blade();
    }

    // Central Shaft
    color(shaft_color)
    rotate_extrude($fn=64)
    polygon([
        [0, 40], [24, 40], 
        [16, 55],          
        [16, 135],         
        [16, 240],         
        [0, 240]
    ]);

    // Compressor Stages
    color(compressor_color) {
        blade_row(65,  36, 15, 33, 10);
        blade_row(80,  36, 15, 31, 9);
        blade_row(95,  40, 15, 29, 8);
        blade_row(110, 40, 15, 27, 7);
        blade_row(125, 46, 15, 25, 6);
    }

    // Combustor
    color(combustor_color)
    translate([0, 0, 135])
    rotate_extrude($fn=64)
    polygon([
        [16, 0], [21, 5], [21, 10], 
        [18, 15], 
        [21, 20], [21, 25], [16, 30]
    ]);

    // Turbine Stages
    color(turbine_color) {
        blade_row(180, 30, 15, 28, 12);
        blade_row(195, 30, 15, 27.5, 12);
        blade_row(210, 30, 15, 26.5, 11);
        blade_row(225, 30, 15, 25.5, 10);
    }

    // Exhaust Plug Cone
    color(exhaust_color)
    translate([0, 0, 240])
    cylinder(r1=16, r2=2, h=70, $fn=64);
}

// === Components ===

module nose_spinner() {
    rotate_extrude($fn=64)
    intersection() {
        square([30, 40]);
        translate([-20, 40]) 
        circle(r=45, $fn=128);
    }
}

module fan_blade() {
    rotate([0, 90, 0])
    linear_extrude(height=50, twist=-50, slices=30, scale=0.7)
    scale([1, 0.12])
    circle(r=20, $fn=32);
}

module blade_row(z_pos, count, inner_r, outer_r, chord) {
    translate([0, 0, z_pos])
    for(i = [0 : count - 1]) {
        rotate([0, 0, i * 360 / count])
        translate([inner_r - 1, 0, 0])
        rotate([25, 90, 0]) // Pitch angle
        linear_extrude(height = outer_r - inner_r + 2)
        scale([1, 0.2])
        circle(r=chord/2, $fn=16);
    }
}

module nacelle_profile() {
    offset(r=1.5, $fn=16)
    polygon([
        [76, 15],   // front intake lip
        [82, 50],   // thickest outer curve
        [78, 150],  // rear outer trailing edge
        [76, 150],  // rear inner
        [77, 80],   // inner bypass wall
        [75.5, 40], // fan clearance
        [74.5, 20]  // front inner transition
    ]);
}

module core_cowl_profile() {
    offset(r=1, $fn=16)
    polygon([
        [36, 55],   // front outer (behind fan)
        [38, 90],   // max thickness
        [26, 260],  // rear outer tapering nozzle
        [24, 260],  // rear inner nozzle lip
        [36, 90],   // inner max
        [34, 55]    // front inner (compressor intake)
    ]);
}