/* [Engine Core] */
num_cylinders = 9;           // [3:1:18]
crankcase_diameter = 100;    // [50:5:150]
crankcase_thickness = 40;    // [20:5:80]
hub_diameter = 30;           // [10:2:60]
hub_length = 35;             // [10:5:80]
shaft_diameter = 12;         // [5:1:30]
shaft_length = 40;           // [10:5:100]

/* [Cylinders] */
cylinder_diameter = 22;      // [10:2:50]
cylinder_length = 60;        // [30:5:120]
fin_thickness = 1.2;         // [0.5:0.1:3]
fin_spacing = 3.5;           // [1.5:0.5:10]
fin_overhang = 3;            // [1:0.5:10]

/* [Details] */
pushrod_diameter = 3;        // [1:0.5:6]
intake_diameter = 4;         // [1:0.5:8]

/* [Colors] */
crankcase_color = "SlateGray";
barrel_color = "Silver";
head_color = "DimGray";
pushrod_color = "LightGray";
intake_color = "Gray";
shaft_color = "Silver";

$fn = 64;

module engine() {
    // Crankcase
    color(crankcase_color) {
        // Main body
        cylinder(d=crankcase_diameter, h=crankcase_thickness, center=true);
        
        // Chamfer rings to soften the drum edges
        translate([0, 0, crankcase_thickness/2])
            rotate_extrude() translate([crankcase_diameter/2, 0, 0]) circle(d=4);
        translate([0, 0, -crankcase_thickness/2])
            rotate_extrude() translate([crankcase_diameter/2, 0, 0]) circle(d=4);
        
        // Front reduction gear housing
        translate([0, 0, crankcase_thickness/2])
            cylinder(d1=crankcase_diameter * 0.85, d2=hub_diameter * 1.5, h=12);
            
        translate([0, 0, crankcase_thickness/2 + 12])
            cylinder(d1=hub_diameter * 1.5, d2=hub_diameter * 1.2, h=hub_length - 12);
            
        // Bearing housing cap
        translate([0, 0, crankcase_thickness/2 + hub_length])
            cylinder(d=hub_diameter * 1.25, h=5);
            
        // Rear accessory section
        translate([0, 0, -crankcase_thickness/2]) rotate([180, 0, 0])
            cylinder(d1=crankcase_diameter * 0.85, d2=crankcase_diameter * 0.6, h=25);
            
        // Crankcase ribs/bolts details
        for(i=[0:num_cylinders-1]) {
            rotate([0, 0, i * 360/num_cylinders + 180/num_cylinders])
                translate([crankcase_diameter/2, 0, 0])
                    cylinder(d=8, h=crankcase_thickness, center=true);
        }
    }
    
    // Prop Shaft
    color(shaft_color) {
        translate([0, 0, crankcase_thickness/2 + hub_length]) {
            cylinder(d=shaft_diameter, h=shaft_length);
            
            // Propeller mounting flange
            translate([0, 0, shaft_length * 0.3]) {
                difference() {
                    cylinder(d=shaft_diameter * 2.5, h=4);
                    // Bolt holes
                    for(b=[0:5]) {
                        rotate([0, 0, b * 360/6])
                            translate([shaft_diameter * 0.9, 0, -1])
                                cylinder(d=2, h=6);
                    }
                }
            }
            translate([0, 0, shaft_length * 0.3 + 4])
                cylinder(d=shaft_diameter * 1.5, h=shaft_length * 0.1);
        }
    }
    
    // Cylinders and Rods
    for(i=[0:num_cylinders-1]) {
        angle = i * 360 / num_cylinders;
        rotate([0, 0, angle]) {
            // Cylinder
            translate([crankcase_diameter/2 - 5, 0, 0])
                rotate([0, 90, 0])
                    radial_cylinder();
                    
            // Pushrods (Front)
            pushrod_base_x = crankcase_diameter * 0.31;
            pushrod_base_z = crankcase_thickness/2 + 6;
            pushrod_top_x = crankcase_diameter/2 - 5 + cylinder_length * 0.9;
            pushrod_top_y = cylinder_diameter * 0.25;
            pushrod_top_z = 0;
            
            draw_rod([pushrod_base_x, -pushrod_top_y, pushrod_base_z], 
                     [pushrod_top_x, -pushrod_top_y, pushrod_top_z], 
                     pushrod_diameter, pushrod_color);
                     
            draw_rod([pushrod_base_x, pushrod_top_y, pushrod_base_z], 
                     [pushrod_top_x, pushrod_top_y, pushrod_top_z], 
                     pushrod_diameter, pushrod_color);
                     
            // Intake pipe (Back)
            intake_base_x = crankcase_diameter * 0.37;
            intake_base_z = -crankcase_thickness/2 - 8;
            intake_top_x = crankcase_diameter/2 - 5 + cylinder_length * 0.85;
            intake_top_y = 0;
            intake_top_z = -cylinder_diameter * 0.4;
            
            draw_rod([intake_base_x, 0, intake_base_z], 
                     [intake_top_x, 0, intake_top_z], 
                     intake_diameter, intake_color);
        }
    }
}

module radial_cylinder() {
    // Barrel
    color(barrel_color) {
        // Core
        cylinder(d=cylinder_diameter, h=cylinder_length * 0.7);
        
        // Fins
        num_fins = floor((cylinder_length * 0.65) / fin_spacing);
        for(f=[1:num_fins]) {
            translate([0, 0, f * fin_spacing + 2])
                cylinder(d=cylinder_diameter + 2 * fin_overhang, h=fin_thickness, center=true);
        }
    }
    
    // Head
    color(head_color) {
        translate([0, 0, cylinder_length * 0.7]) {
            // Lower head block
            cylinder(d=cylinder_diameter + 2, h=cylinder_length * 0.2);
            
            // Domed top
            translate([0, 0, cylinder_length * 0.2])
                scale([1, 1, 0.7]) sphere(d=cylinder_diameter + 2);
                
            // Rocker boxes
            translate([0, cylinder_diameter * 0.25, cylinder_length * 0.2])
                rotate([90, 0, 0])
                    cylinder(d=cylinder_diameter * 0.5, h=cylinder_diameter * 0.5, center=true);
            translate([0, -cylinder_diameter * 0.25, cylinder_length * 0.2])
                rotate([90, 0, 0])
                    cylinder(d=cylinder_diameter * 0.5, h=cylinder_diameter * 0.5, center=true);
                    
            // Head fins
            head_fins = 3;
            for(f=[1:head_fins]) {
                translate([0, 0, f * fin_spacing - 1])
                    cylinder(d=cylinder_diameter + 4, h=fin_thickness, center=true);
            }
        }
    }
}

module draw_rod(p1, p2, dia, rod_color) {
    color(rod_color) {
        dist = norm(p2 - p1);
        dir = (p2 - p1) / dist;
        axis = cross([0,0,1], dir);
        angle = acos(max(-1, min(1, dir[2])));
        
        translate(p1)
        if (norm(axis) > 0.001) {
            rotate(a=angle, v=axis)
                cylinder(d=dia, h=dist);
        } else {
            cylinder(d=dia, h=dist);
        }
    }
}

engine();