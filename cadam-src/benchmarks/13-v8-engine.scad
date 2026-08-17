// V8 Engine Model

/* [Visibility] */
// Enable cutaway view to see internal mechanics
cutaway = true;

/* [Animation] */
// Rotate the crankshaft to see the pistons move
crank_angle = 45; // [0:1:360]

/* [Colors] */
block_color = "Silver"; 
head_color = "DarkGray"; 
valve_cover_color = "FireBrick"; 
intake_color = "DimGray"; 
exhaust_color = "Peru"; 
pulley_color = "Black";
oil_pan_color = "DarkSlateGray"; 
internals_color = "LightSteelBlue";

/* [Hidden] */
$fn = 32;
bore = 10;
stroke = 15;
crank_r = stroke / 2;
conrod_len = 35;
cyl_spacing = 28;
deck_height = 50;
bank_angle = 45;
pin_angles = [0, 90, 270, 180];
main_y = [0, 28, 56, 84, 112];
pin_y_start = [8, 36, 64, 92];

// Core kinematics calculation for piston position
function get_D(crank_ang, bank_ang) = 
    let(Px = crank_r * sin(crank_ang),
        Pz = crank_r * cos(crank_ang),
        K = Px * sin(bank_ang) + Pz * cos(bank_ang))
    K + sqrt(K*K - crank_r*crank_r + conrod_len*conrod_len);

module assemble_engine() {
    engine_stand();
    engine_block();
    heads();
    valve_covers();
    spark_plugs();
    oil_pan();
    intake_manifold();
    exhaust_headers();
    front_accessories();
    alternator();
    belt();
    front_pulley();
    fan();
    flywheel();
    internals(crank_angle);
}

module cutaway_cutter() {
    if(cutaway) {
        intersection() {
             // Diagonal cut plane along right cylinder axis
             rotate([0, bank_angle, 0])
             // Massive bounding box starting at main journal 3 to cleanly slice front-right
             translate([0.1, 56, -150])
             cube([300, 200, 400]);
             
             // Limit strictly to right side of the engine to preserve left bank
             translate([0.1, 56, -150]) cube([300, 200, 400]);
        }
    }
}

module engine_block() {
    color(block_color)
    difference() {
        union() {
            // Main block body
            translate([-25, 0, -10]) cube([50, 120, 20]);
            
            // Banks
            intersect_bank(bank_angle);
            intersect_bank(-bank_angle);
            
            // Side reinforcement ribs
            for(y = main_y) {
                translate([-26, y-2, -10]) cube([52, 4, 15]);
            }
            // Rear bell housing flange
            translate([-26, -4, -10]) cube([52, 4, 30]);
            
            // Main bearing supports (bulkheads) connecting block to crank
            for(y = main_y) {
                translate([-15, y, -15]) cube([30, 8, 15]);
            }
        }
        
        // Hollow out valley
        translate([-10, -1, 20]) cube([20, 122, 40]);
        
        // Hollow out crankcase bays between the bulkheads
        for(i = [0:3]) {
            y_start_hollow = main_y[i] + 8;
            hollow_len = main_y[i+1] - y_start_hollow;
            if (hollow_len > 0) {
                translate([0, y_start_hollow, 0]) rotate([-90,0,0]) cylinder(r=18, h=hollow_len);
                translate([-18, y_start_hollow, -20]) cube([36, hollow_len, 20]);
            }
        }
        // Front and rear crank clearance
        translate([0, -5, 0]) rotate([-90,0,0]) cylinder(r=18, h=5);
        translate([-18, -5, -20]) cube([36, 5, 20]);
        translate([0, 120, 0]) rotate([-90,0,0]) cylinder(r=18, h=5);
        translate([-18, 120, -20]) cube([36, 5, 20]);
        
        // Cut the shaft hole for the crank through the solid bulkheads perfectly matching radius
        translate([0, -10, 0]) rotate([-90,0,0]) cylinder(r=5, h=140);
        
        // Cylinder bores
        for(i=[0:3]) {
            y_s = pin_y_start[i];
            // Right bank
            translate([0, y_s + 7.5, 0])
            rotate([0, bank_angle, 0])
            translate([0, 0, 10]) cylinder(r=bore, h=deck_height+10);
            
            // Left bank
            translate([0, y_s + 12.5, 0])
            rotate([0, -bank_angle, 0])
            translate([0, 0, 10]) cylinder(r=bore, h=deck_height+10);
        }
        
        cutaway_cutter();
    }
}

module intersect_bank(ang) {
    rotate([0, ang, 0])
    translate([-14, 0, -20]) cube([28, 120, deck_height + 20]);
}

module heads() {
    color(head_color)
    difference() {
        union() {
            head_shape(bank_angle);
            head_shape(-bank_angle);
        }
        cutaway_cutter();
    }
}

module head_shape(ang) {
    rotate([0, ang, 0])
    translate([-14, 0, deck_height]) 
    difference() {
        cube([28, 120, 18]);
        // Spark plug recesses
        for(i=[0:3]) {
            y_s = pin_y_start[i] + 10;
            translate([14, y_s, 9]) rotate([0, 90, 0]) cylinder(r=4, h=10, center=true);
        }
    }
}

module spark_plugs() {
    color("White")
    difference() {
        union() {
            for(i=[0:3]) {
                y_s = pin_y_start[i] + 10;
                // Right
                rotate([0, bank_angle, 0]) translate([14, y_s, deck_height + 9]) rotate([0, 90, 0]) cylinder(r=2, h=8);
                // Left
                rotate([0, -bank_angle, 0]) translate([-14, y_s, deck_height + 9]) rotate([0, -90, 0]) cylinder(r=2, h=8);
            }
        }
        cutaway_cutter();
    }
}

module valve_covers() {
    color(valve_cover_color)
    difference() {
        union() {
            valve_cover_shape(bank_angle);
            valve_cover_shape(-bank_angle);
        }
        cutaway_cutter();
    }
}

module valve_cover_shape(ang) {
    rotate([0, ang, 0])
    translate([-12, 0, deck_height + 18]) {
        // Base
        hull() {
            cube([24, 120, 2]);
            translate([2, 2, 8]) cube([20, 116, 2]);
        }
        // Ribs
        for(y=[5 : 10 : 115]) {
            translate([4, y, 10]) cube([16, 4, 2]);
        }
        // Oil cap
        if(ang > 0) { 
            translate([12, 20, 10]) cylinder(r=5, h=4);
        }
    }
}

module oil_pan() {
    color(oil_pan_color)
    difference() {
        union() {
            hull() {
                translate([-25, 0, -10]) cube([50, 120, 1]);
                translate([-15, 10, -30]) cube([30, 100, 1]);
            }
            for(y=[15:5:105]) {
                translate([-15, y, -32]) cube([30, 2, 4]);
            }
        }
        // Hollow inside
        hull() {
            translate([-23, 2, -10]) cube([46, 116, 1]);
            translate([-13, 12, -28]) cube([26, 96, 1]);
        }
        cutaway_cutter();
    }
}

module intake_manifold() {
    color(intake_color)
    difference() {
        union() {
            // Central plenum
            translate([-10, 10, 35]) cube([20, 100, 15]);
            
            // Runners to Right head
            for(i=[0:3]) {
                y_s = pin_y_start[i] + 10;
                hull() {
                    translate([10, y_s-4, 40]) cube([2, 8, 8]);
                    rotate([0, bank_angle, 0]) translate([-14, y_s-4, deck_height-2]) cube([5, 8, 12]);
                }
            }
            
            // Runners to Left head
            for(i=[0:3]) {
                y_s = pin_y_start[i] + 10;
                hull() {
                    translate([-12, y_s-4, 40]) cube([2, 8, 8]);
                    rotate([0, -bank_angle, 0]) translate([9, y_s-4, deck_height-2]) cube([5, 8, 12]);
                }
            }
            
            // Throttle body
            translate([0, 110, 42.5]) rotate([-90,0,0]) cylinder(r=8, h=15);
        }
        cutaway_cutter();
    }
}

module exhaust_headers() {
    color(exhaust_color)
    difference() {
        union() {
            // Right bank
            for(i=[0:3]) {
                y_s = pin_y_start[i] + 10;
                header_pipe(bank_angle, 1, y_s);
            }
            // Right Collector
            translate([50, 10, -25]) rotate([-90,0,0]) cylinder(r=6, h=100);
            
            // Left bank
            for(i=[0:3]) {
                y_s = pin_y_start[i] + 10;
                header_pipe(-bank_angle, -1, y_s);
            }
            // Left Collector
            translate([-50, 10, -25]) rotate([-90,0,0]) cylinder(r=6, h=100);
        }
        cutaway_cutter();
    }
}

module header_pipe(ang, dir, y) {
    gx = dir * (14*cos(45) + (deck_height+7.5)*sin(45));
    gz = (deck_height+7.5)*cos(45) - 14*sin(45);
    
    hull() {
        translate([gx, y, gz]) rotate([0, 90, 0]) cylinder(r=4, h=2, center=true);
        translate([gx + dir*5, y, gz - 5]) sphere(r=4);
    }
    hull() {
        translate([gx + dir*5, y, gz - 5]) sphere(r=4);
        translate([dir*50, y, -25]) sphere(r=5);
    }
}

module front_accessories() {
    color(block_color)
    union() {
        // Timing cover
        hull() {
            translate([-25, 120, -10]) cube([50, 4, 20]);
            translate([-15, 120, 40]) cube([30, 4, 10]);
        }
        // Water pump
        translate([0, 124, 30]) rotate([-90,0,0]) cylinder(r=12, h=8);
        // Water pump pulley
        color(pulley_color) translate([0, 132, 30]) rotate([-90,0,0]) {
            cylinder(r=10, h=8);
            translate([0,0,8]) cylinder(r=8, h=2);
        }
    }
}

module alternator() {
    color("LightGray")
    union() {
        translate([20, 125, 40]) rotate([-90,0,0]) cylinder(r=8, h=10);
        color(pulley_color) translate([20, 135, 40]) rotate([-90,0,0]) cylinder(r=6, h=5);
    }
}

module belt() {
    color("#222222")
    difference() {
        hull() {
            translate([0, 134, 30]) rotate([-90,0,0]) cylinder(r=10, h=4);
            translate([0, 134, 0]) rotate([-90,0,0]) cylinder(r=16, h=4);
            translate([20, 135, 40]) rotate([-90,0,0]) cylinder(r=6, h=4);
        }
        hull() {
            translate([0, 133, 30]) rotate([-90,0,0]) cylinder(r=8, h=6);
            translate([0, 133, 0]) rotate([-90,0,0]) cylinder(r=14, h=6);
            translate([20, 134, 40]) rotate([-90,0,0]) cylinder(r=4, h=6);
        }
    }
}

module fan() {
    color("Silver")
    union() {
        translate([0, 142, 30]) rotate([-90,0,0]) cylinder(r=5, h=2);
        // Fan blades removed per user request
    }
}

module front_pulley() {
    color(pulley_color)
    translate([0, 124, 0]) rotate([-90,0,0]) {
        cylinder(r=12, h=8);
        translate([0,0,8]) cylinder(r=16, h=8);
    }
}

module flywheel() {
    color(pulley_color)
    translate([0, -5, 0]) rotate([-90,0,0]) cylinder(r=25, h=5);
}

module engine_stand() {
    color("Orange")
    union() {
        // Floor base
        translate([-40, -40, -60]) cube([80, 160, 5]);
        // Upright
        translate([-15, -30, -55]) cube([30, 15, 75]);
        // Stand head
        translate([-10, -15, -10]) cube([20, 10, 20]);
        // Standoff mounts to bell housing
        for(x=[-15, 15]) {
            for(z=[-5, 15]) {
                translate([x, -15, z]) rotate([-90,0,0]) cylinder(r=2, h=15);
            }
        }
    }
}

module internals(crank_angle_offset=0) {
    color(internals_color) {
        
        // Front extension connecting to front pulley
        translate([0, 120, 0]) rotate([-90,0,0]) cylinder(r=5, h=20);
        
        // Rear extension connecting to flywheel
        translate([0, -10, 0]) rotate([-90,0,0]) cylinder(r=5, h=10);
        
        // Main journals nested in bulkheads
        for(y = main_y) {
            translate([0, y, 0]) {
                translate([0, 4, 0]) rotate([-90,0,0]) cylinder(r=5, h=8, center=true);
            }
        }
        
        for(i = [0:3]) {
            ang = crank_angle_offset + pin_angles[i];
            y_s = pin_y_start[i];
            
            // Web 1
            web(ang, y_s);
            
            // Crank Pin
            translate([0, y_s + 5, 0]) 
            rotate([0, ang, 0]) 
            translate([0, 0, crank_r]) 
            translate([0, 5, 0]) rotate([-90,0,0]) cylinder(r=4, h=10, center=true);
            
            // Web 2
            web(ang, y_s + 15);
            
            // Piston 1 (Right Bank)
            piston_and_rod(ang, bank_angle, y_s + 7.5);
            
            // Piston 2 (Left Bank)
            piston_and_rod(ang, -bank_angle, y_s + 12.5);
        }
    }
}

module web(angle, y_pos) {
    translate([0, y_pos, 0])
    rotate([0, angle, 0]) {
        hull() {
            translate([0, 2.5, 0]) rotate([-90,0,0]) cylinder(r=6, h=5, center=true);
            translate([0, 2.5, crank_r]) rotate([-90,0,0]) cylinder(r=6, h=5, center=true);
        }
        // Counterweight
        translate([0, 2.5, -crank_r/2 + 1])
        cube([16, 5, crank_r + 10], center=true);
    }
}

module piston_and_rod(crank_ang, bank_ang, y_pos) {
    D = get_D(crank_ang, bank_ang);
    Px = crank_r * sin(crank_ang);
    Pz = crank_r * cos(crank_ang);
    Wx = D * sin(bank_ang);
    Wz = D * cos(bank_ang);
    
    rod_ang = atan2(Wx - Px, Wz - Pz);
    
    translate([0, y_pos, 0]) {
        // Conrod
        translate([Px, 0, Pz])
        rotate([0, rod_ang, 0])
        translate([0, -2.5, 0]) {
            hull() {
                rotate([-90,0,0]) cylinder(r=4, h=5);
                translate([0, 0, conrod_len]) rotate([-90,0,0]) cylinder(r=3, h=5);
            }
        }
        
        // Piston pin
        translate([Wx, 0, Wz])
        rotate([0, bank_ang, 0])
        rotate([-90,0,0]) cylinder(r=2.5, h=10, center=true);
        
        // Piston body
        translate([Wx, 0, Wz])
        rotate([0, bank_ang, 0]) {
            translate([0, 0, -6]) rotate([-90,0,0]) cylinder(r=bore-0.5, h=12, center=true);
            translate([0, 0, 6]) rotate([-90,0,0]) cylinder(r=bore-0.5, h=4, center=true);
        }
    }
}

assemble_engine();