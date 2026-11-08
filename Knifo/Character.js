// karakter Knifo (Content Warning)

import { MyObject } from "./MyObject.js";
import * as Shape from "../Shapes.js";

// bilah pisau: profil 2D diberi ketebalan
function flatPrism(profile, depth) {
    const z = depth / 2;
    const n = profile.length;
    const vertices = [], normals = [], indices = [];

    const addFace = (points, normal, order) => {
        const start = vertices.length / 3;
        for (const p of points) {
            vertices.push(p[0], p[1], p[2]);
            normals.push(normal[0], normal[1], normal[2]);
        }
        for (const o of order) indices.push(start + o);
    };

    // sisi depan dan belakang
    const front = profile.map(p => [p[0], p[1], z]);
    const back = profile.map(p => [p[0], p[1], -z]);
    const fan = [], fanBack = [];
    for (let i = 1; i < n - 1; i++) {
        fan.push(0, i, i + 1);
        fanBack.push(0, i + 1, i);
    }
    addFace(front, [0, 0, 1], fan);
    addFace(back, [0, 0, -1], fanBack);

    // sisi samping
    for (let i = 0; i < n; i++) {
        const a = profile[i], b = profile[(i + 1) % n];
        const ex = b[0] - a[0], ey = b[1] - a[1];
        const len = Math.hypot(ex, ey) || 1;
        const nrm = [ey / len, -ex / len, 0];
        addFace(
            [[a[0], a[1], z], [b[0], b[1], z], [b[0], b[1], -z], [a[0], a[1], -z]],
            nrm,
            [0, 2, 1, 0, 3, 2]
        );
    }

    return { vertices, normals, indices };
}

// langkah akhir bentuk berputar: normal halus dan menghadap keluar
function finishMesh(vertices, indices, columns, rings) {
    // normal halus
    const normals = new Array(vertices.length).fill(0);
    for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i] * 3;
        const b = indices[i + 1] * 3;
        const c = indices[i + 2] * 3;

        const ux = vertices[b] - vertices[a];
        const uy = vertices[b + 1] - vertices[a + 1];
        const uz = vertices[b + 2] - vertices[a + 2];
        const vx = vertices[c] - vertices[a];
        const vy = vertices[c + 1] - vertices[a + 1];
        const vz = vertices[c + 2] - vertices[a + 2];

        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;

        for (const k of [a, b, c]) {
            normals[k] += nx;
            normals[k + 1] += ny;
            normals[k + 2] += nz;
        }
    }

    // samakan normal di garis sambungan
    for (let i = 0; i < rings; i++) {
        const first = i * (columns + 1) * 3;
        const last = first + columns * 3;
        for (let k = 0; k < 3; k++) {
            const sum = normals[first + k] + normals[last + k];
            normals[first + k] = sum;
            normals[last + k] = sum;
        }
    }

    for (let i = 0; i < normals.length; i += 3) {
        const length3 = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
        normals[i] /= length3;
        normals[i + 1] /= length3;
        normals[i + 2] /= length3;
    }

    // normal menghadap keluar
    let centerY = 0;
    for (let i = 1; i < vertices.length; i += 3) centerY += vertices[i];
    centerY /= vertices.length / 3;

    let facing = 0;
    for (let i = 0; i < vertices.length; i += 3) {
        facing +=
            vertices[i] * normals[i] +
            (vertices[i + 1] - centerY) * normals[i + 1] +
            vertices[i + 2] * normals[i + 2];
    }
    if (facing < 0) {
        for (let i = 0; i < normals.length; i++) normals[i] = -normals[i];
        for (let i = 0; i < indices.length; i += 3) {
            [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
        }
    }

    return { vertices, normals, indices };
}

// sepatu
function createShoe(halfWidth, height, halfLength, columns = 32, rows = 28) {
    const p = 2.4;                           // makin besar, makin penuh/kotak
    const vertices = [];
    const indices = [];

    for (let i = 0; i <= rows; i++) {
        const u = -1 + (2 * i) / rows;       // -1 = tumit, +1 = ujung depan
        const envelope = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), p)), 1 / p);
        const w = halfWidth * envelope;
        const h = height * envelope * (1 - 0.30 * u);   // tumit lebih tinggi

        for (let j = 0; j <= columns; j++) {
            const angle = (j / columns) * Math.PI * 2;
            const sinA = Math.sin(angle);
            vertices.push(
                w * Math.cos(angle),
                sinA > 0 ? h * sinA : 0,     // separuh atas melengkung, bawah datar (sol)
                halfLength * u
            );
        }
    }

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < columns; j++) {
            const a = i * (columns + 1) + j;
            const b = a + 1;
            const c = a + columns + 1;
            const d = c + 1;
            indices.push(a, c, b);
            indices.push(b, c, d);
        }
    }

    return finishMesh(vertices, indices, columns, rows + 1);
}

// kurva Bezier kubik (dipakai untuk profil jubah)
function bezier(p0, p1, p2, p3, t) {
    const u = 1 - t;
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

// bola / elipsoid
function createSphere(rx, ry, rz, latBands = 16, longBands = 24) {
    const vertices = [], normals = [], indices = [];
    for (let lat = 0; lat <= latBands; lat++) {
        const theta = lat * Math.PI / latBands;
        for (let lon = 0; lon <= longBands; lon++) {
            const phi = lon * 2 * Math.PI / longBands;
            const x = rx * Math.cos(phi) * Math.sin(theta);
            const y = ry * Math.cos(theta);
            const z = rz * Math.sin(phi) * Math.sin(theta);
            vertices.push(x, y, z);
            const nx = x / (rx * rx), ny = y / (ry * ry), nz = z / (rz * rz);
            const l = Math.hypot(nx, ny, nz) || 1;
            normals.push(nx / l, ny / l, nz / l);
        }
    }
    for (let row = 0; row < latBands; row++) {
        for (let col = 0; col < longBands; col++) {
            const current = row * (longBands + 1) + col, below = current + longBands + 1;
            indices.push(current, current + 1, below, below, current + 1, below + 1);
        }
    }
    return { vertices, normals, indices };
}

// frustum (kerucut terpancung), menggantung ke arah -Y dari titik sendi
function createFrustum(rTop, rBottom, height, columns = 28) {
    const vertices = [], normals = [], indices = [];
    const slope = (rBottom - rTop) / height;

    for (const [r, y] of [[rTop, 0], [rBottom, -height]]) {
        for (let j = 0; j <= columns; j++) {
            const angle = (j / columns) * Math.PI * 2;
            const nx = Math.cos(angle), nz = Math.sin(angle);
            const l = Math.hypot(nx, slope, nz);
            vertices.push(r * nx, y, r * nz);
            normals.push(nx / l, slope / l, nz / l);
        }
    }
    for (let j = 0; j < columns; j++) {
        const a = j, b = j + 1, c = columns + 1 + j, d = c + 1;
        indices.push(a, b, c);
        indices.push(b, d, c);
    }

    // tutup atas dan bawah (titik sendiri, normal rata)
    for (const [r, y, ny] of [[rTop, 0, 1], [rBottom, -height, -1]]) {
        const center = vertices.length / 3;
        vertices.push(0, y, 0);
        normals.push(0, ny, 0);
        for (let j = 0; j <= columns; j++) {
            const angle = (j / columns) * Math.PI * 2;
            vertices.push(r * Math.cos(angle), y, r * Math.sin(angle));
            normals.push(0, ny, 0);
        }
        for (let j = 0; j < columns; j++) {
            if (ny > 0) indices.push(center, center + j + 2, center + j + 1);
            else        indices.push(center, center + j + 1, center + j + 2);
        }
    }
    return { vertices, normals, indices };
}

// cylinder = frustum dengan dua jari-jari sama
const createCylinder = (radius, height, columns = 28) => createFrustum(radius, radius, height, columns);

// jari mulus: tabung disapu di sepanjang kurva melewati sendi
function createSweptTube(points, radii, planeW, columns = 18, perSeg = 8, capRings = 6) {
    const n = points.length;
    const P = i => points[Math.min(n - 1, Math.max(0, i))];
    const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
    const W = norm(planeW);

    // titik sepanjang kurva
    const path = [];
    for (let s = 0; s < n - 1; s++) {
        const p0 = P(s - 1), p1 = P(s), p2 = P(s + 1), p3 = P(s + 2);
        const steps = perSeg + (s === n - 2 ? 1 : 0);
        for (let k = 0; k < steps; k++) {
            const t = k / perSeg, t2 = t * t, t3 = t2 * t;
            const pos = [0, 0, 0], tan = [0, 0, 0];
            for (let c = 0; c < 3; c++) {
                pos[c] = 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t +
                    (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 +
                    (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3);
                tan[c] = 0.5 * ((-p0[c] + p2[c]) +
                    2 * (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t +
                    3 * (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t2);
            }
            const sm = t * t * (3 - 2 * t);
            path.push({ p: pos, t: norm(tan), r: radii[s] + (radii[s + 1] - radii[s]) * sm });
        }
    }

    // cincin
    const rings = [];     // { center, tangent, radius }
    const first = path[0], last = path[path.length - 1];
    for (let i = 0; i < capRings; i++) {
        const phi = (Math.PI / 2) * (1 - i / capRings);
        rings.push({
            c: first.p.map((v, k) => v - first.t[k] * first.r * Math.sin(phi)),
            t: first.t, r: first.r * Math.cos(phi)
        });
    }
    for (const q of path) rings.push({ c: q.p, t: q.t, r: q.r });
    for (let i = 1; i <= capRings; i++) {
        const phi = (Math.PI / 2) * (i / capRings);
        rings.push({
            c: last.p.map((v, k) => v + last.t[k] * last.r * Math.sin(phi)),
            t: last.t, r: last.r * Math.cos(phi)
        });
    }

    let vertices = [];
    for (const ring of rings) {
        const t = ring.t;
        const b = norm([t[1] * W[2] - t[2] * W[1], t[2] * W[0] - t[0] * W[2], t[0] * W[1] - t[1] * W[0]]);
        for (let j = 0; j <= columns; j++) {
            const a = (j / columns) * Math.PI * 2;
            const ca = Math.cos(a) * ring.r, sa = Math.sin(a) * ring.r;
            vertices.push(
                ring.c[0] + W[0] * ca + b[0] * sa,
                ring.c[1] + W[1] * ca + b[1] * sa,
                ring.c[2] + W[2] * ca + b[2] * sa
            );
        }
    }

    // pusatkan di titik berat
    const center = [0, 0, 0];
    const count = vertices.length / 3;
    for (let i = 0; i < vertices.length; i += 3) {
        center[0] += vertices[i]; center[1] += vertices[i + 1]; center[2] += vertices[i + 2];
    }
    center.forEach((_, k) => center[k] /= count);
    for (let i = 0; i < vertices.length; i += 3) {
        vertices[i] -= center[0]; vertices[i + 1] -= center[1]; vertices[i + 2] -= center[2];
    }

    const indices = [];
    for (let i = 0; i < rings.length - 1; i++) {
        for (let j = 0; j < columns; j++) {
            const a = i * (columns + 1) + j;
            const b = a + 1;
            const c = a + columns + 1;
            const d = c + 1;
            indices.push(a, b, c);
            indices.push(b, d, c);
        }
    }

    const mesh = finishMesh(vertices, indices, columns, rings.length);
    mesh.center = center;
    return mesh;
}

// tubuh + kepala satu permukaan (bentuk hantu)
function createGhostBody(columns) {
    const hemY = -0.85;           // dasar jubah
    const shoulderY = 1.225;      // akhir bagian jubah
    const headY = 1.43;           // pusat kepala (awal kubah)
    const headRx = 0.64;          // jari-jari kepala (sumbu X)
    const headRy = 0.84;          // tinggi kubah kepala

    const smooth = (a, b, x) => {
        const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
        return t * t * (3 - 2 * t);
    };

    // profil (y, radius, v)
    const profile = [];

    // bagian jubah
    const rowsRobe = 40;
    for (let i = 0; i <= rowsRobe; i++) {
        const y = hemY + (headY - hemY) * i / rowsRobe;
        const v = Math.min(1, (y - hemY) / (shoulderY - hemY));
        // profil jubah: kurva Bezier kubik dari hem ke bahu
        let r = bezier(1.30, 0.90, 0.68, 0.66, v);
        // peralihan ke kepala
        r = r + (headRx - r) * smooth(shoulderY, headY, y);
        // lekukan leher
        r *= 1 - 0.03 * Math.exp(-Math.pow((y - 1.0) / 0.2, 2));
        profile.push({ y, r, v: (y - hemY) / (shoulderY - hemY) });
    }

    // kubah kepala
    const rowsDome = 18;
    for (let i = 1; i <= rowsDome; i++) {
        const phi = (i / rowsDome) * Math.PI / 2;
        profile.push({
            y: headY + headRy * Math.sin(phi),
            r: headRx * Math.cos(phi),
            v: 1.2
        });
    }

    const vertices = [];
    const indices = [];

    for (const p of profile) {
        // penampang makin bulat di kepala
        const head = smooth(0.9, headY, p.y);
        const depthScale = 0.82 + (0.89 - 0.82) * head;
        const zShift = 0.02 * head;

        for (let j = 0; j <= columns; j++) {
            const angle = (j / columns) * Math.PI * 2;

            // gelombang kain di hem
            const hemWeight = p.v < 1 ? 1 - p.v : 0;
            const wave = Math.sin(angle * 6) * 0.055 * Math.pow(hemWeight, 8);
            const ripple = Math.cos(angle * 6) * 0.035 * Math.pow(hemWeight, 5);

            const r = p.r + ripple;
            vertices.push(
                r * Math.cos(angle),
                p.y + wave,
                r * depthScale * Math.sin(angle) + zShift
            );
        }
    }

    const rows = profile.length - 1;
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < columns; j++) {
            const a = i * (columns + 1) + j;
            const b = a + 1;
            const c = a + columns + 1;
            const d = c + 1;

            indices.push(a, c, b);
            indices.push(b, c, d);
        }
    }

    // tutup bawah
    const bottomCenter = vertices.length / 3;
    vertices.push(0, hemY, 0);
    for (let j = 0; j < columns; j++) {
        indices.push(bottomCenter, j + 1, j);
    }

    // hitung normal
    const normals = new Array(vertices.length).fill(0);

    for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i] * 3;
        const b = indices[i + 1] * 3;
        const c = indices[i + 2] * 3;

        const ux = vertices[b] - vertices[a];
        const uy = vertices[b + 1] - vertices[a + 1];
        const uz = vertices[b + 2] - vertices[a + 2];

        const vx = vertices[c] - vertices[a];
        const vy = vertices[c + 1] - vertices[a + 1];
        const vz = vertices[c + 2] - vertices[a + 2];

        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;

        for (const k of [a, b, c]) {
            normals[k] += nx;
            normals[k + 1] += ny;
            normals[k + 2] += nz;
        }
    }

    for (let i = 0; i < normals.length; i += 3) {
        const length = Math.hypot(
            normals[i],
            normals[i + 1],
            normals[i + 2]
        ) || 1;

        normals[i] /= length;
        normals[i + 1] /= length;
        normals[i + 2] /= length;
    }

    // normal menghadap keluar
    let centerY = 0;
    for (let i = 1; i < vertices.length; i += 3) {
        centerY += vertices[i];
    }
    centerY /= vertices.length / 3;

    let facing = 0;
    for (let i = 0; i < vertices.length; i += 3) {
        facing +=
            vertices[i] * normals[i] +
            (vertices[i + 1] - centerY) * normals[i + 1] +
            vertices[i + 2] * normals[i + 2];
    }

    if (facing < 0) {
        for (let i = 0; i < normals.length; i++) {
            normals[i] = -normals[i];
        }

        for (let i = 0; i < indices.length; i += 3) {
            [indices[i + 1], indices[i + 2]] =
                [indices[i + 2], indices[i + 1]];
        }
    }

    return { vertices, normals, indices };
}

// alat bantu pose lengan (pose lewat arah, bukan sudut)
const v3 = {
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    neg: a => [-a[0], -a[1], -a[2]],
    scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
};
const IDENTITY_ROWS = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

// kerangka dengan sumbu Y menunjuk ke yAxis
function frameFromY(yAxis, zHint) {
    const y = v3.norm(yAxis);
    const z = v3.norm(v3.sub(zHint, v3.scale(y, v3.dot(zHint, y))));
    return [v3.cross(y, z), y, z];
}
const multiplyRows = (A, B) => A.map(row => [0, 1, 2].map(j => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
const transposeRows = A => [0, 1, 2].map(j => [A[0][j], A[1][j], A[2][j]]);

// arah ruas lengan
const ARM_POSE = {
    left:  { upper: v3.norm([-0.22, -0.72, 0.55]), forearm: v3.norm([-0.12, -0.12, 0.98]), palmHint: [0.8, 0.5, 0] },
    right: { upper: v3.norm([ 0.22, -0.65, 0.72]), forearm: v3.norm([-0.28,  0.25, 0.93]) }
};

// rotasi terhadap sumbu sembarang (Rodrigues)
function rotateAxisMatrix(axis, angle) {
    const len = Math.hypot(axis[0], axis[1], axis[2]);
    const x = axis[0] / len, y = axis[1] / len, z = axis[2] / len;
    const c = Math.cos(angle), s = Math.sin(angle), k = 1 - c;

    const R = [
        [c + x*x*k,     x*y*k - z*s,  x*z*k + y*s],
        [y*x*k + z*s,   c + y*y*k,    y*z*k - x*s],
        [z*x*k - y*s,   z*y*k + x*s,  c + z*z*k  ]
    ];
    const m = LIBS.get_I4();
    for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) m[i * 4 + j] = R[j][i];
    return m;
}

// matriks scaling
function scaleMatrix(sx, sy, sz) {
    const m = LIBS.get_I4();
    m[0] = sx; m[5] = sy; m[10] = sz;
    return m;
}

export class Character extends MyObject {
    constructor(GL, SHADER_PROGRAM, locations) {
        super(GL, SHADER_PROGRAM, locations);

        // tubuh + kepala
        this.torso = this.addMesh(
            createGhostBody(48),
            0.68, 0, 0, 0
        );

        this.childs.push(this.torso);

        // wajah (this.head hanya titik acuan)
        this.head = this.group(0, 1.43, 0.02);
        this.torso.childs.push(this.head);

        // mata
        for (const side of [-1, 1]) {
            const left = side === 1;
            const eye = this.addMesh(
                left ? Shape.ellipsoid(0.09, 0.125, 0.055, 16, 16)
                     : Shape.ellipsoid(0.08, 0.11, 0.055, 16, 16),
                0.035, side * 0.16, left ? 0.17 : 0.14, 0.50,
                false
            );
            this.head.childs.push(eye);
        }

        // mulut
        const mouth = this.addMesh(
            Shape.ellipsoid(0.062, 0.08, 0.045, 14, 14),
            0.04, 0, -0.18, 0.53,
            false
        );
        this.head.childs.push(mouth);

        // kaki dan sepatu
        // kaki = cylinder, sepatu dan sol ikut kaki
        this.legs = [];

        for (const side of [-1, 1]) {
            const leg = this.addMesh(
                createCylinder(0.17, 0.67),
                0.48, side * 0.45, -0.80, 0
            );
            this.torso.childs.push(leg);

            // sepatu
            leg.childs.push(this.addMesh(
                createShoe(0.31, 0.36, 0.46),
                0.045, 0, -0.905, 0.18,
                false
            ));

            // sol
            leg.childs.push(this.addMesh(
                createShoe(0.325, 0.07, 0.48),
                0.30, 0, -0.91, 0.18,
                false
            ));

            this.legs.push(leg);
        }

        // lengan kiri
        this.leftUpperArm = this.addLimb(0.20, 0.165, 0.78, 0.68, -0.80, 0.80, 0.02);
        const leftUpperRows = this.aimLimb(this.leftUpperArm, IDENTITY_ROWS, ARM_POSE.left.upper);
        this.torso.childs.push(this.leftUpperArm);

        this.leftForearm = this.addLimb(0.165, 0.125, 0.60, 0.68, 0, -0.78, 0, true);
        // lengan bawah kiri
        this.setFrame(this.leftForearm, leftUpperRows,
            frameFromY(v3.neg(ARM_POSE.left.forearm), ARM_POSE.left.palmHint));
        this.leftUpperArm.childs.push(this.leftForearm);
        this.saveBasePose(this.leftUpperArm, this.leftForearm);

        // tangan kiri
        this.leftHand = this.group(0, -0.72, 0);
        this.leftForearm.childs.push(this.leftHand);

        this.leftHand.childs.push(this.addMesh(
            Shape.ellipsoid(0.15, 0.14, 0.05, 20, 20),
            0.70, 0, -0.10, 0
        ));

        // empat jari
        const fingers = [
            { x: -0.105, lens: [0.110, 0.080, 0.060], r: 0.038, splay: -0.08 },  // telunjuk
            { x: -0.035, lens: [0.125, 0.090, 0.065], r: 0.039, splay: -0.03 },  // jari tengah
            { x:  0.035, lens: [0.115, 0.085, 0.060], r: 0.038, splay:  0.03 },  // jari manis
            { x:  0.105, lens: [0.090, 0.065, 0.050], r: 0.034, splay:  0.09 }   // kelingking
        ];
        for (const f of fingers) {
            this.addFinger(this.leftHand, f.x, -0.22, 0, f.lens, f.r, 0.28, f.splay, 0.70);
        }

        // ibu jari
        this.addFinger(this.leftHand, -0.13, -0.05, 0, [0.10, 0.08], 0.042, 0.25, -0.65, 0.70);

        // lengan kanan (memegang pisau)
        this.rightUpperArm = this.addLimb(0.20, 0.165, 0.75, 0.68, 0.77, 0.80, 0.05);
        const rightUpperRows = this.aimLimb(this.rightUpperArm, IDENTITY_ROWS, ARM_POSE.right.upper);
        this.torso.childs.push(this.rightUpperArm);

        // siku
        this.rightForearm = this.addLimb(0.165, 0.125, 0.78, 0.68, 0, -0.75, 0, true);
        // kerangka lengan bawah
        const forearmY = v3.neg(ARM_POSE.right.forearm);
        const forearmX = v3.norm(v3.sub([0, -1, 0], v3.scale(forearmY, v3.dot([0, -1, 0], forearmY))));
        const rightForearmRows = [forearmX, forearmY, v3.cross(forearmX, forearmY)];
        this.setFrame(this.rightForearm, rightUpperRows, rightForearmRows);
        this.rightUpperArm.childs.push(this.rightForearm);
        this.saveBasePose(this.rightUpperArm, this.rightForearm);

        // tangan kanan
        this.rightPalm = this.group(0, -0.90, 0);
        this.rightForearm.childs.push(this.rightPalm);

        // kerangka tangan, diputar 180 derajat
        this.rightHand = this.group(0, 0, 0);
        this.rotate(this.rightHand, Math.PI, 0, 0);
        // tangan diperbesar
        for (const scale of [LIBS.scaleX, LIBS.scaleY, LIBS.scaleZ]) {
            scale(this.rightHand.POSITION_MATRIX, 1.3);
        }
        this.rightPalm.childs.push(this.rightHand);

        this.rightHand.childs.push(this.addMesh(
            Shape.ellipsoid(0.15, 0.14, 0.05, 20, 20),
            0.70, 0, -0.10, 0
        ));

        // jari melengkung ke gagang
        const gripCurl = [1.45, 1.55, 0.90];
        const gripFingers = [
            { x:  0.105, lens: [0.130, 0.095, 0.065], r: 0.038 },   // telunjuk (sisi bilah)
            { x:  0.035, lens: [0.145, 0.105, 0.070], r: 0.039 },   // jari tengah
            { x: -0.035, lens: [0.135, 0.095, 0.065], r: 0.038 },   // jari manis
            { x: -0.105, lens: [0.110, 0.080, 0.055], r: 0.034 }    // kelingking (sisi bawah)
        ];
        for (const f of gripFingers) {
            this.addFinger(this.rightHand, f.x, -0.20, 0, f.lens, f.r, gripCurl, 0, 0.70);
        }

        // ibu jari menyilang di atas gagang
        this.addFinger(this.rightHand, 0.09, 0.03, 0.03, [0.12, 0.09], 0.046, [0.85, 0.35], 0.10, 0.70);

        // pisau
        this.knife = new MyObject(this.GL, this.SHADER_PROGRAM, this.locations);
        this.setFrame(this.knife, IDENTITY_ROWS, [[0, -1, 0], [-1, 0, 0], [0, 0, -1]]);
        // letak pisau di telapak
        LIBS.set_position(this.knife.POSITION_MATRIX, 0, -0.08, -0.115);
        this.rightPalm.childs.push(this.knife);

        // gagang
        this.knifeHandle = this.addMesh(
            Shape.box(0.12, 0.66, 0.12),
            0.18, 0, 0, 0,
            false
        );
        this.knife.childs.push(this.knifeHandle);

        // bilah
        this.knifeBlade = this.addMesh(
            flatPrism([
                [-0.12, 0.33],
                [ 0.16, 0.33],
                [ 0.12, 1.00],
                [-0.12, 1.45]
            ], 0.06),
            0.82, 0, 0, 0,
            false
        );
        this.knife.childs.push(this.knifeBlade);

    }

    // tinggi telapak kaki (dipakai main.js)
    static FOOT_Y = -1.71;

    setFrame(part, parentRows, rows) {
        const relative = multiplyRows(rows, transposeRows(parentRows));
        const m = part.MOVE_MATRIX;
        LIBS.set_I4(m);
        for (let i = 0; i < 3; i++) {
            m[i * 4] = relative[i][0];
            m[i * 4 + 1] = relative[i][1];
            m[i * 4 + 2] = relative[i][2];
        }
        return rows;
    }

    aimLimb(part, parentRows, direction) {
        return this.setFrame(part, parentRows, frameFromY(v3.neg(direction), [0, 0, 1]));
    }

    // lengan = frustum, bola di sendi supaya sambungan mulus
    addLimb(rTop, rBottom, length, brightness, x, y, z, bottomCap = false) {
        const limb = this.addMesh(createFrustum(rTop, rBottom, length), brightness, x, y, z);
        limb.childs.push(this.addMesh(createSphere(rTop, rTop, rTop), brightness, 0, 0, 0));
        if (bottomCap) {
            limb.childs.push(this.addMesh(createSphere(rBottom, rBottom, rBottom), brightness, 0, -length, 0));
        }
        return limb;
    }

    // simpan pose dasar lengan
    saveBasePose(...parts) {
        for (const part of parts) part.baseMove = part.MOVE_MATRIX.slice();
    }

    // putar dari pose dasar terhadap sumbu sembarang
    swingAxis(part, axis, angle) {
        part.MOVE_MATRIX = LIBS.multiply(part.baseMove, rotateAxisMatrix(axis, angle));
    }

    group(x, y, z) {
        const g = new MyObject(this.GL, this.SHADER_PROGRAM, this.locations);
        LIBS.set_position(g.POSITION_MATRIX, x, y, z);
        return g;
    }

    addFinger(parent, x, y, z, lens, r, curl, splay, brightness) {
        const transformPoint = (m, p) => [0, 1, 2].map(j => p[0] * m[j] + p[1] * m[4 + j] + p[2] * m[8 + j] + m[12 + j]);

        const points = [];
        const radii = [];
        let chain = null;
        let planeW = [1, 0, 0];

        lens.forEach((len, k) => {
            const move = LIBS.get_I4();
            LIBS.rotateX(move, -(Array.isArray(curl) ? curl[k] : curl));
            if (k === 0) LIBS.rotateZ(move, splay);

            const position = LIBS.get_I4();
            LIBS.set_position(
                position,
                k === 0 ? x : 0,
                k === 0 ? y : -lens[k - 1],
                k === 0 ? z : 0
            );

            const local = LIBS.multiply(move, position);
            chain = chain ? LIBS.multiply(local, chain) : local;
            if (k === 0) planeW = [chain[0], chain[1], chain[2]];

            points.push(transformPoint(chain, [0, 0, 0]));
            radii.push(r * (1 - 0.08 * k));
        });

        points.push(transformPoint(chain, [0, -lens[lens.length - 1], 0]));
        radii.push(radii[radii.length - 1] * 0.92);

        const tube = createSweptTube(points, radii, planeW);
        parent.childs.push(this.addMesh(tube, brightness, tube.center[0], tube.center[1], tube.center[2]));
    }

    rotate(part, ry, rx, rz) {
        LIBS.rotateY(part.MOVE_MATRIX, ry);
        LIBS.rotateX(part.MOVE_MATRIX, rx);
        LIBS.rotateZ(part.MOVE_MATRIX, rz);
    }

    addMesh(shape, brightness, x, y, z, hatching = true) {
        const part = new MyObject(
            this.GL,
            this.SHADER_PROGRAM,
            this.locations
        );

        part.vertex = shape.vertices;
        part.normals = shape.normals;
        part.faces = shape.indices;
        part.brightness = brightness;
        part.hatching = hatching ? 1 : 0;

        LIBS.set_position(
            part.POSITION_MATRIX,
            x, y, z
        );

        return part;
    }

    // animasi diam (time dalam detik)
    animasi(time) {
        const t = time;

        // badan + kepala (satu mesh): napas, miring, naik-turun
        const nafas = Math.sin(t * 2.5);
        const bodyM = scaleMatrix(1 + 0.03 * nafas, 1 + 0.015 * Math.sin(t * 2.5 + 0.6), 1 + 0.03 * nafas);
        const twist = rotateAxisMatrix([0.2, 1, 0.15], Math.sin(t * 1.2) * 0.12);
        const bodyPose = LIBS.multiply(bodyM, twist);
        LIBS.rotateZ(bodyPose, Math.sin(t * 1.5) * 0.025);
        LIBS.translateY(bodyPose, Math.sin(t * 2) * 0.025);
        this.torso.MOVE_MATRIX = bodyPose;

        // wajah ikut badan
        LIBS.set_I4(this.head.MOVE_MATRIX);

        // kaki
        this.legs.forEach((leg, i) => {
            leg.MOVE_MATRIX = rotateAxisMatrix(
                [1, 0, 0.15 * (i ? 1 : -1)],
                Math.sin(t * 2 + i * Math.PI) * 0.22
            );
        });

        // lengan kiri
        this.swingAxis(this.leftUpperArm, [0.4, 0.2, 1], Math.sin(t * 2 + Math.PI) * 0.20);
        this.swingAxis(this.leftForearm, [1, -0.3, 0.2], Math.sin(t * 2 + 0.8) * 0.25);

        // lengan kanan (pisau)
        this.swingAxis(this.rightUpperArm, [0.3, 0.1, 1], Math.sin(t * 3) * 0.08);
        this.swingAxis(this.rightForearm, [1, 0.2, -0.25], Math.sin(t * 3 + 0.5) * 0.30);

        // pisau memanjang sedikit saat menusuk
        if (this.knife) {
            if (!this.knife.baseMove) this.knife.baseMove = this.knife.MOVE_MATRIX.slice();
            const k = 1 + 0.04 * Math.sin(t * 3 + 0.5);
            this.knife.MOVE_MATRIX = LIBS.multiply(this.knife.baseMove, scaleMatrix(1, k, 1));
        }
    }

    // klip animasi untuk storyboard
    // karakter menghadap +z; yaw PI/2 = menghadap kanan (+x)

    // posisi, arah, dan ukuran karakter (kaki tetap menapak saat membesar)
    setWorld(x, y, z, yaw, scale = 1) {
        const m = LIBS.multiply(scaleMatrix(scale, scale, scale), rotateAxisMatrix([0, 1, 0], yaw));
        LIBS.set_position(m, x, y + (scale - 1) * -Character.FOOT_Y, z);
        this.MOVE_MATRIX = m;
    }

    // pose badan saat berlari
    poseBody(t, bob = 0.025, lean = 0, bobSpeed = 2) {
        const nafas = Math.sin(t * 2.5);
        const m = scaleMatrix(1 + 0.03 * nafas, 1 + 0.015 * nafas, 1 + 0.03 * nafas);
        const r = LIBS.multiply(m, rotateAxisMatrix([1, 0, 0], lean));
        LIBS.translateY(r, bob * Math.abs(Math.sin(t * bobSpeed)));
        this.torso.MOVE_MATRIX = r;
        LIBS.set_I4(this.head.MOVE_MATRIX);
    }

    // siklus jalan/lari (raiseKnife 0..1 = lengan pisau terangkat)
    poseGait(phase, amp, armAmp, raiseKnife = 0) {
        this.legs.forEach((leg, i) => {
            const a = Math.sin(phase + i * Math.PI) * amp;
            leg.MOVE_MATRIX = rotateAxisMatrix([1, 0, 0], a);
        });
        // tangan kiri berlawanan dengan kaki kiri
        this.swingAxis(this.leftUpperArm, [1, 0, 0.1], Math.sin(phase) * armAmp);
        this.swingAxis(this.leftForearm, [1, 0, 0], -0.25 - 0.25 * Math.sin(phase));
        // tangan pisau diangkat saat mengejar
        this.swingAxis(this.rightUpperArm, [1, 0, 0], -raiseKnife * 0.9 + Math.sin(phase + Math.PI) * armAmp * 0.3);
        this.swingAxis(this.rightForearm, [1, 0, 0], -raiseKnife * 0.5);
    }

    // skala membesar hanya saat beat gilirannya, lalu kembali normal
    scaleBeat(t, bpm = 120, slot = 0, count = 3, maxScale = 1.6) {
        const beat = t * bpm / 60;
        const idx = Math.floor(beat), frac = beat - idx;
        if (((idx % count) + count) % count !== slot) return 1;
        return 1 + (maxScale - 1) * Math.sin(Math.PI * frac);
    }

    // jalan pelan menuju kamera
    clipWalkOut(p) {                       // p = 0..1
        const t = p * 6;
        this.poseBody(t * 0.9, 0.02, 0, 3);
        this.poseGait(t * 3, 0.35, 0.25);
        this.setWorld(0, 0, -5 + 5 * p, 0, 1);
    }

    // lari kiri ke kanan (side view)
    clipRunSide(p) {
        const t = p * 8;
        this.poseBody(t, 0.05, 0.18, 9);
        this.poseGait(t * 9, 0.8, 0.6, 1);
        this.setWorld(-6 + 12 * p, 0, 0, Math.PI / 2, 1);
    }

    // balik badan 180 derajat pelan-pelan
    clipTurnAround(p) {
        const e = p * p * (3 - 2 * p);     // smoothstep
        this.poseBody(p * 4, 0.02, 0, 3);
        this.poseGait(p * 4 * 2, 0.15 * Math.sin(Math.PI * p), 0.1);
        this.setWorld(0, 0, 0, Math.PI * e, 1);
    }

    // lari di tempat + scaling per beat
    clipInfiniteRun(t, slot = 0, scaleOn = true, bpm = 120) {
        this.poseBody(t, 0.05, 0.18, 9);
        this.poseGait(t * 9, 0.8, 0.6, 0.6);
        const sc = scaleOn ? this.scaleBeat(t, bpm, slot) : 1;
        this.setWorld(0, 0, 0, Math.PI / 2, sc);
    }

    // lari mengitari pilar (rotasi sumbu sembarang)
    clipOrbit(t, center = [0, 0, 0], radius = 2.5, axis = [0, 1, 0], speed = 0.9) {
        const ang = t * speed;
        this.poseBody(t, 0.05, 0.18, 9);
        this.poseGait(t * 9, 0.8, 0.6, 0.4);
        // hadap arah gerak, geser sejauh radius, lalu putar mengelilingi sumbu pilar
        let m = rotateAxisMatrix([0, 1, 0], Math.PI);
        LIBS.translateX(m, radius);
        m = LIBS.multiply(m, rotateAxisMatrix(axis, ang));
        m[12] += center[0]; m[13] += center[1]; m[14] += center[2];
        this.MOVE_MATRIX = m;
    }

    // urutan adegan; slot = giliran Knifo saat scaling per beat
    animasiStoryboard(time, slot = 0, loop = true) {
        const D = Character.STORY;
        const total = D.walk + D.run + D.turn + D.beats + D.normal + D.orbit;
        let t = loop ? time % total : Math.min(time, total);
        if (t < D.walk) return this.clipWalkOut(t / D.walk);
        t -= D.walk;
        if (t < D.run) return this.clipRunSide(t / D.run);
        t -= D.run;
        if (t < D.turn) return this.clipTurnAround(t / D.turn);
        t -= D.turn;
        if (t < D.beats) return this.clipInfiniteRun(t, slot, true);
        t -= D.beats;
        if (t < D.normal) return this.clipInfiniteRun(t, slot, false);
        t -= D.normal;
        return this.clipOrbit(t);
    }
}

// durasi tiap adegan (detik)
Character.STORY = { walk: 6, run: 8, turn: 4, beats: 8, normal: 2, orbit: 10 };