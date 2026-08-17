// Title: Herringbone Planetary Gear Stage
// Description: A robust, manifold module 1.5 planetary gear stage with herringbone teeth, carrier plate, and custom colors.
// Version: v4

use <MCAD/involute_gears.scad>

PI_VAL = 3.141592653589793;

/* [Gear Parameters] */
gear_module = 1.5;         // [1:0.1:3]
gear_thickness = 10;       // [5:1:20]
sun_twist = 10;            // [0:1:30]
sun_bore = 6;              // [3:0.5:10]
planet_bore = 6;           // [3:0.5:10]

/* [Colors] */
sun_color = "Gold";
planet_color = "Tomato";
ring_color = "SteelBlue";
carrier_color = "Silver";

/* [Calculated Constants] */
sun_teeth = 18;
planet_teeth = 18;
ring_teeth = 54;
pitch_sun = gear_module * sun_teeth / 2;
pitch_planet = gear_module * planet_teeth / 2;
pitch_ring = gear_module * ring_teeth / 2;
center_distance = pitch_sun + pitch_planet;

$fn = 64;

// ==============================
// Modules
// ==============================

module single_gear(teeth, mod, half_t, t_angle) {
    gear(
        number_of_teeth = teeth,
        circular_pitch = PI_VAL * mod,
        pressure_angle = 20,
        clearance = 0.25,
        gear_thickness = half_t,
        rim_thickness = half_t,
        hub_thickness = half_t,
        bore_diameter = 0,
        twist = t_angle
    );
}

module herringbone_gear_base(mod, teeth, thickness, base_twist, is_planet) {
    half_t = thickness / 2;
    // Maintain constant helix angle across different gear sizes
    t_angle = (base_twist * 18 / teeth) * (is_planet ? -1 : 1);
    
    union() {
        single_gear(teeth, mod, half_t, t_angle);
        
        translate([0, 0, thickness])
        mirror([0, 0, 1])
        single_gear(teeth, mod, half_t, t_angle);
    }
}

module hb_gear(teeth, is_planet=false, bore=0) {
    difference() {
        herringbone_gear_base(gear_module, teeth, gear_thickness, sun_twist, is_planet);
        if (bore > 0) {
            translate([0, 0, -1]) 
            cylinder(r=bore/2, h=gear_thickness+2, $fn=32);
        }
    }
}

module ring_gear() {
    outer_radius = pitch_ring + 4 * gear_module; 
    
    // Shift slightly to prevent Z-fighting at top and bottom
    translate([0, 0, 0.01])
    difference() {
        union() {
            cylinder(r=outer_radius, h=gear_thickness - 0.02, $fn=128);
            // Outer grip ridges
            for(i=[0:10:359]) {
                rotate([0, 0, i])
                translate([outer_radius, 0, 0])
                cylinder(r=gear_module, h=gear_thickness - 0.02, $fn=16);
            }
        }
        
        // Subtract a slightly scaled herringbone gear to form the internal teeth with clearance
        translate([0, 0, -0.01])
        scale([1.015, 1.015, 1])
        rotate([0, 0, 360 / ring_teeth / 2]) // half tooth phase shift
        herringbone_gear_base(gear_module, ring_teeth, gear_thickness, sun_twist, is_planet=true);
    }
}

module carrier() {
    // Carrier plate positioned slightly above the gears
    translate([0, 0, gear_thickness + 0.5])
    difference() {
        union() {
            // Main carrier disc
            cylinder(r=center_distance + 8, h=3, $fn=64);
            
            // Pins connecting the planet gears
            for(i=[0:120:359]) {
                rotate([0, 0, i])
                translate([center_distance, 0, -gear_thickness - 0.1])
                cylinder(r=planet_bore/2 - 0.2, h=gear_thickness + 1.1, $fn=32);
            }
            
            // Central pin acting as sun bearing
            translate([0, 0, -gear_thickness - 0.1])
            cylinder(r=sun_bore/2 - 0.2, h=gear_thickness + 1.1, $fn=32);
        }
        
        // Aesthetic weight-saving cutouts
        for(i=[0:60:359]) {
            rotate([0, 0, i + 30])
            translate([center_distance * 0.55, 0, -1])
            cylinder(r=6, h=5, $fn=32);
        }
        
        // Central hole through the carrier shaft
        translate([0, 0, -gear_thickness - 0.2]) 
        cylinder(r=sun_bore/2 - 1.5, h=gear_thickness + 5, $fn=16);
    }
}

// ==============================
// Assembly
// ==============================

// Central Sun Gear
color(sun_color)
hb_gear(sun_teeth, is_planet=false, bore=sun_bore);

// Planet Gears (x3)
color(planet_color)
for(i=[0:120:359]) {
    rotate([0, 0, i])
    translate([center_distance, 0, 0])
    rotate([0, 0, 360 / planet_teeth / 2]) // Phase shift by half tooth for perfect meshing
    hb_gear(planet_teeth, is_planet=true, bore=planet_bore);
}

// Internal Ring Gear
color(ring_color)
ring_gear();

// Carrier Plate
color(carrier_color)
carrier();