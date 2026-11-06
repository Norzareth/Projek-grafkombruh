// ============================================================
//  Gundog/Character.js : karakter kedua (Gundog, tank berkaki empat)
//  Memakai MyObject, shader, dan gaya arsiran yang sama dengan karakter pertama & environment
//  (cahaya + arsiran abu-abu). Hierarki tetap lewat induk.childs.push(anak).
//
//  Character (akar kosong)
//  `-- body
//      |-- head --- leftEye, rightEye, mouth (kurva Bezier ":3")
//      |-- turretRing --- turret (sendi) --- turretBase, turretTop, barrel, muzzle, barrelEnd
//      `-- hip (x4) --- upperLeg --- knee --- lowerLeg --- footPivot --- foot
// ============================================================
import { MyObject } from "../MyObject.js";
import * as Shape from "../Shapes.js";

// Tiap fungsi create... mengembalikan { vertices: [x,y,z,...], faces: [indeks segitiga], smooth }
// smooth = true  -> permukaan halus (normal dirata-ratakan)
// smooth = false -> permukaan rata/berfaset (balok, prisma)
function createMesh(vertices, faces, smooth) {
    return { vertices: vertices, faces: faces, smooth: smooth };
}

//
// elipsoid
//
function createEllipsoid(rx, ry, rz, rings = 8, seg = 12) {
    var vertices = [];
    var faces = [];

    for (var ring = 0; ring <= rings; ring++) {
        var latitude = Math.PI * ring / rings;
        for (var segment = 0; segment <= seg; segment++) {
            var longitude = 2 * Math.PI * segment / seg;
            vertices.push(
                rx * Math.sin(latitude) * Math.cos(longitude),
                ry * Math.cos(latitude),
                rz * Math.sin(latitude) * Math.sin(longitude)
            );
        }
    }

    for (var row = 0; row < rings; row++) {
        for (var side = 0; side < seg; side++) {
            var first = row * (seg + 1) + side;
            var nextRow = first + seg + 1;
            faces.push(first, nextRow, first + 1);
            faces.push(first + 1, nextRow, nextRow + 1);
        }
    }
    return createMesh(vertices, faces, true);
}

// prisma utk badan, kepala, kaki atas, turret
// depan & belakang diisi array koordinat bentuk, axis = arah perpanjangan
function createPrism(depan, belakang, tinggi, axis = "z") {
    if (depan.length < 3 || depan.length !== belakang.length) {
        throw new RangeError("bentuk harus sama & memiliki min 3 titik");
    }
    if (axis !== "x" && axis !== "z") {
        throw new RangeError('axis "x" atau "z".');
    }

    var vertices = [];
    var faces = [];
    var halfT = tinggi / 2;
    var count = depan.length;

    depan.forEach(function (point) {
        if (axis === "x") {
            vertices.push(-halfT, point[1], point[0]);
        } else {
            vertices.push(point[0], point[1], -halfT);
        }
    });
    belakang.forEach(function (point) {
        if (axis === "x") {
            vertices.push(halfT, point[1], point[0]);
        } else {
            vertices.push(point[0], point[1], halfT);
        }
    });

    // faces
    for (var i = 1; i < count - 1; i++) {
        faces.push(0, i + 1, i, count, count + i, count + i + 1);
    }

    for (var edge = 0; edge < count; edge++) {
        var next = (edge + 1) % count;
        faces.push(edge, next, count + next, edge, count + next, count + edge);
    }
    return createMesh(vertices, faces, false);
}

//
//cylinder
//
function createCylinder(radius, height, axis = "y", segments = 12) {
    var vertices = [];
    var faces = [];
    var halfHeight = height / 2;

    for (var end = 0; end < 2; end++) {
        var axialPosition = end === 0 ? -halfHeight : halfHeight;
        for (var i = 0; i < segments; i++) {
            var angle = 2 * Math.PI * i / segments;
            var first = radius * Math.cos(angle);
            var second = radius * Math.sin(angle);
            if (axis === "z") {
                vertices.push(first, second, axialPosition);
            } else {
                vertices.push(first, axialPosition, second);
            }
        }
    }
    for (var cap = 0; cap < 2; cap++) {
        if (axis === "z") {
            vertices.push(0, 0, cap === 0 ? -halfHeight : halfHeight);
        } else {
            vertices.push(0, cap === 0 ? -halfHeight : halfHeight, 0);
        }
    }

    for (var segment = 0; segment < segments; segment++) {
        var next = (segment + 1) % segments;
        var far = segment + segments;
        var farNext = next + segments;
        faces.push(segment, next, farNext, segment, farNext, far);
        faces.push(segments * 2, next, segment);
        faces.push(segments * 2 + 1, far, farNext);
    }
    return createMesh(vertices, faces, true);
}

//
//paraboloid
// telapak bulat dari tumpukan cincin. Jari-jari mengikuti r(y) = R * sqrt(1 - (y/H)^2)
function createParaboloidFoot(radius, height, segments = 12, rings = 5) {
    var vertices = [];
    var faces = [];

    for (var ring = 0; ring <= rings; ring++) {
        var fraction = ring / rings;
        var ringRadius = radius * Math.sqrt(Math.max(0, 1 - fraction * fraction));
        var y = height * fraction;
        for (var segment = 0; segment <= segments; segment++) {
            var angle = 2 * Math.PI * segment / segments;
            vertices.push(ringRadius * Math.cos(angle), y, ringRadius * Math.sin(angle));
        }
    }

    for (var row = 0; row < rings; row++) {
        for (var side = 0; side < segments; side++) {
            var first = row * (segments + 1) + side;
            var nextRow = first + segments + 1;
            faces.push(first, first + 1, nextRow);
            faces.push(first + 1, nextRow + 1, nextRow);
        }
    }
    return createMesh(vertices, faces, true);
}

//
// mulut ":3" = pipa tipis yang menyusuri kurva Bezier kubik
// curve = daftar segmen [P0, P1, P2, P3] (titik 2D [x, y]); tiap segmen = satu lengkung "3"
//
function createBezierTube(curve, radius, stepsPerSegment = 16, sides = 8) {
    // titik-titik sepanjang kurva (sambungan antar-segmen tidak diulang)
    var path = [];
    curve.forEach(function (segment, index) {
        for (var step = index === 0 ? 0 : 1; step <= stepsPerSegment; step++) {
            var t = step / stepsPerSegment;
            path.push([
                Shape.bezier(segment[0][0], segment[1][0], segment[2][0], segment[3][0], t),
                Shape.bezier(segment[0][1], segment[1][1], segment[2][1], segment[3][1], t)
            ]);
        }
    });

    var vertices = [];
    var faces = [];
    path.forEach(function (point, i) {
        // arah kurva di titik ini (selisih titik sebelum & sesudahnya)
        var before = path[Math.max(0, i - 1)], after = path[Math.min(path.length - 1, i + 1)];
        var tx = after[0] - before[0], ty = after[1] - before[1];
        var length = Math.hypot(tx, ty) || 1;
        var nx = -ty / length, ny = tx / length;           // tegak lurus kurva, di bidang xy
        for (var k = 0; k < sides; k++) {
            var angle = 2 * Math.PI * k / sides;
            vertices.push(
                point[0] + radius * Math.cos(angle) * nx,
                point[1] + radius * Math.cos(angle) * ny,
                radius * Math.sin(angle)                    // tebal pipa ke arah z
            );
        }
    });
    for (var i = 0; i < path.length - 1; i++) {
        for (var k = 0; k < sides; k++) {
            var a = i * sides + k, b = i * sides + (k + 1) % sides;
            faces.push(a, b, a + sides, b, b + sides, a + sides);
        }
    }
    // tutup kedua ujung pipa
    [0, path.length - 1].forEach(function (end) {
        var center = vertices.length / 3;
        vertices.push(path[end][0], path[end][1], 0);
        for (var k = 0; k < sides; k++) {
            faces.push(center, end * sides + k, end * sides + (k + 1) % sides);
        }
    });
    return createMesh(vertices, faces, true);
}


//
//shapesnya
//
// nilai awal toggle animasi khusus Gundog (diubah dengan toggle [2] di halaman)
const ANIMATION_ON_AT_START = true;

export class Character extends MyObject {
    animationOn = ANIMATION_ON_AT_START;   // true = kaki melangkah & turret menoleh, false = berhenti di pose terakhir
    clock = 0;                             // waktu animasi Gundog sendiri (hanya maju saat animasi menyala)
    lastTime = null;

    constructor(GL, SHADER_PROGRAM, locations) {
        super(GL, SHADER_PROGRAM, locations);
        // Akar ini hanya induk transformasi; semua bagian yang terlihat adalah anaknya.

        // kecerahan abu-abu (sama seperti karakter pertama: 0 = hitam, 1 = putih)
        var armor = 0.80;
        var armorLight = 0.68;
        var armorShade = 0.68;
        var armorDark = 0.3;
        var dark = 0.15;
        var red = [0.85, 0.08, 0.07];   // mata & mulut berwarna merah (satu-satunya bagian berwarna)

        //coordinat 3d badan & kepala
        // X = kiri/kanan, Y = atas/bawah
        var bodyOutline = [
            [0.6, 0.55],
            [0.85,0.1],
            [0.6, -0.5],
            [-0.6, -0.5],
            [-0.85, 0.1],
            [-0.6, 0.55]
        ];
        var headOutlineBelakang = [
            [0.6, 0.45],
            [0.7,0.15],
            [0.6, -0.5],
            [-0.6, -0.5],
            [-0.7, 0.15],
            [-0.6, 0.45]
        ];
        var headOutlineDepan = [
            [0.5, 0.3],
            [0.6,0.1],
            [0.5, -0.4],
            [-0.5, -0.4],
            [-0.6, 0.1],
            [-0.5, 0.3]
        ];

        //badan
        var body = this.addMesh(createPrism(bodyOutline, bodyOutline, 1.9), armor, 0, 0, 0.15);
        this.childs.push(body);

        //kepala
        var head = this.addMesh(createPrism(headOutlineDepan, headOutlineBelakang, 0.48), armorLight, 0, 0.03, -0.99);
        body.childs.push(head);

        // muka: mata (ellipsoid / sphere pipih, merah)
        var leftEye = this.addMesh(createEllipsoid(0.075, 0.085, 0.035), red, -0.22, 0.15, -0.25, false);
        head.childs.push(leftEye);
        var rightEye = this.addMesh(createEllipsoid(0.075, 0.085, 0.035), red, 0.22, 0.15, -0.25, false);
        head.childs.push(rightEye);

        // muka: mulut ":3" = dua lengkung kurva Bezier kubik yang bertemu di tengah (seperti huruf "3" diputar)
        //   tiap segmen = [titik awal, kontrol 1, kontrol 2, titik akhir], koordinat (x, y) di bidang muka
        var mouthCurve = [
            [[-0.24, -0.04], [-0.24, -0.20], [-0.02, -0.20], [0.0, -0.06]],    // lengkung kiri
            [[0.0, -0.06],   [0.02, -0.20],  [0.24, -0.20],  [0.24, -0.04]]    // lengkung kanan
        ];
        //   pipa cukup tebal (radius 0.03) dan pusatnya di depan permukaan muka -> mulut timbul (3D), merah
        var mouth = this.addMesh(createBezierTube(mouthCurve, 0.03), red, 0, 0, -0.255, false);
        head.childs.push(mouth);

        var face = this.addMesh(createPrism(headOutlineDepan, headOutlineDepan, 0.02), armorDark, 0, 0, -0.25);
        head.childs.push(face);
        // turret
        //turret ring
        var turretRing = this.addMesh(createCylinder(0.31, 0.16), armorShade, 0, 0.52, 0.12);
        body.childs.push(turretRing);

        // turret pivot point
        this.turret = this.createJoint(0, 0.18, 0.12);
        turretRing.childs.push(this.turret);

        //turret body
        var turretBaseOutline = [
            [-0.48, -0.11],
            [-0.25, 0.23],
            [0.3, 0.23],
            [0.49, -0.11]
        ];
        var turretTopOutline = [
            [0.08, -0.1],
            [0.08, 0.13],
            [0.22, 0.2],
            [0.43, 0.1],
            [0.46, -0.1]
        ];
        var turretBase = this.addMesh(createPrism(turretBaseOutline, turretBaseOutline, 0.62, "x"), armor, 0, 0, 0);
        this.turret.childs.push(turretBase);
        var turretTop = this.addMesh(createPrism(turretTopOutline, turretTopOutline, 0.68, "x"), armorShade, 0, 0, 0.02);
        this.turret.childs.push(turretTop);

        //turret
        var barrel = this.addMesh(createCylinder(0.105, 0.82, "z"), armorLight, 0, 0.04, -0.76);
        this.turret.childs.push(barrel);
        var muzzle = this.addMesh(createCylinder(0.14, 0.13, "z"), armorShade, 0, 0.04, -1.2);
        this.turret.childs.push(muzzle);
        var barrelEnd = this.addMesh(createCylinder(0.075, 0.015, "z"), dark, 0, 0.04, -1.275);
        this.turret.childs.push(barrelEnd);


        //kaki
        this.legs = [];
        var legPositions = [
            // x, y, z, derajat kemiringan
            [-0.95, 0.1, -0.70, -12],//kiri depan
            [0.95, 0.1, -0.70, 12],//kanan depan
            [-0.95, 0.1, 0.68, -12],//kiri belakang
            [0.95, 0.1, 0.68, 12]//kanan belakang
        ];

        // bentuk 2d kaki
        var kaki2d = [
            [0.1,0.6],
            [0.3,0.55],
            [0.1,-0.6],
            [-0.1,-0.65],
            [-0.2,0.4]
        ]
        legPositions.forEach((position, index) => {
            // pivot point/titik relatif parent/sendi badan
            var hip = this.createJoint(position[0], position[1], position[2]);
            body.childs.push(hip);
            var slope = LIBS.degToRad(position[3]);
            LIBS.rotateZ(hip.POSITION_MATRIX, slope);

            // add kaki
            var upperLeg = this.addMesh(createPrism(kaki2d, kaki2d, 0.2, "x"), armorShade, 0, -0.32, 0);
            hip.childs.push(upperLeg);

            // sendi lutut
            var knee = this.createJoint(0, -0.63, 0);
            upperLeg.childs.push(knee);

            // cylinder
            var lowerLeg = this.addMesh(createCylinder(0.09, 0.9), armorShade, 0, -0.43, 0);
            knee.childs.push(lowerLeg);

            //sendi
            var footPivot = this.createJoint(0, -0.47, 0);
            lowerLeg.childs.push(footPivot);

            // kaki
            LIBS.rotateZ(footPivot.POSITION_MATRIX, -slope);
            var foot = this.addMesh(createParaboloidFoot(0.19, 0.2), armorLight, 0, 0, 0);
            footPivot.childs.push(foot);

            // push kaki
            this.legs.push({
                hip: hip,
                knee: knee,
                footPivot: footPivot,
                phase: index === 0 || index === 3 ? 0 : 1
            });
        });
    }

    createJoint(x, y, z) {
        // Sendi tidak punya bentuk sendiri: hanya titik putar. Anak-anaknya ikut transformasinya.
        var joint = new MyObject(this.GL, this.SHADER_PROGRAM, this.locations);
        LIBS.translateX(joint.POSITION_MATRIX, x);
        LIBS.translateY(joint.POSITION_MATRIX, y);
        LIBS.translateZ(joint.POSITION_MATRIX, z);
        return joint;
    }

    addMesh(mesh, brightness, x, y, z, hatching = true) {
        // Ubah bentuk jadi MyObject (dengan normal untuk cahaya), lalu letakkan di posisi lokal terhadap induk.
        var shape = Shape.fromMesh(mesh.vertices, mesh.faces, mesh.smooth);
        var part = new MyObject(this.GL, this.SHADER_PROGRAM, this.locations);
        part.vertex = shape.vertices;
        part.normals = shape.normals;
        part.faces = shape.indices;
        if (Array.isArray(brightness)) part.color = brightness;   // [r, g, b] = berwarna
        else part.brightness = brightness;                         // angka = abu-abu
        part.hatching = hatching ? 1 : 0;
        LIBS.translateX(part.POSITION_MATRIX, x);
        LIBS.translateY(part.POSITION_MATRIX, y);
        LIBS.translateZ(part.POSITION_MATRIX, z);
        return part;
    }

    animasi(time) {
        // time dalam milidetik. Gelombang sinus berulang; fase berlawanan membuat kaki bergantian.
        // jam sendiri: berhenti saat animasi dimatikan, lanjut dari pose yang sama saat dinyalakan lagi
        if (this.lastTime === null) this.lastTime = time;
        if (this.animationOn) this.clock += time - this.lastTime;
        this.lastTime = time;
        var cycle = this.clock * 0.004;
        this.legs.forEach(function (leg) {
            // Pinggul mengayun depan/belakang. Lutut hanya menekuk pada separuh ayunan ke belakang.
            var swing = 0.38 * Math.sin(cycle + leg.phase * Math.PI);
            var kneeBend = Math.max(0, -swing) * 0.65;
            LIBS.set_I4(leg.hip.MOVE_MATRIX);
            LIBS.rotateX(leg.hip.MOVE_MATRIX, swing);

            LIBS.set_I4(leg.knee.MOVE_MATRIX);
            LIBS.rotateX(leg.knee.MOVE_MATRIX, kneeBend);

            LIBS.set_I4(leg.footPivot.MOVE_MATRIX);
            LIBS.rotateX(leg.footPivot.MOVE_MATRIX, -(swing + kneeBend));
        });

        // Reset dulu sebelum mengisi putaran, supaya putaran tidak menumpuk tiap frame.
        LIBS.set_I4(this.turret.MOVE_MATRIX);
        LIBS.rotateY(this.turret.MOVE_MATRIX, 0.2 * Math.sin(cycle * 0.45));
    }
}
