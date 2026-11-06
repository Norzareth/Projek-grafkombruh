// ============================================================
//  environment.js : maze 7 ruangan, dinding, dan lantai tidak rata
//
//  Denah dilihat dari atas (karakter menghadap +z, ke atas pada gambar):
//
//     [R4]                                                  [R6]
//      |                                                     |
//     [J2]--H2--[R2]                            [R3]--H3--[J3]
//      |              \______  ______/                       |
//     [R5]                   [J1]                           [R7]
//                             |
//                            [H1]
//                             |
//                            [R1]  <- ruangan awal (pusat di 0, 0)
//
//  Tiga segment yang berulang:  ruangan (R)  ->  hallway (H)  ->  pertigaan (J)  -> 2 ruangan baru
//    R1 -> H1 -> J1 -> R2 (kiri, -x) & R3 (kanan, +x)
//    R2 -> H2 -> J2 -> R4 (utara, +z) & R5 (selatan, -z)       (hallway H2 menuju -x)
//    R3 -> H3 -> J3 -> R6 (utara, +z) & R7 (selatan, -z)       (hallway H3 menuju +x)
//
//  CARA MENGATUR UKURAN: ubah angka di MAZE_LAYOUT di bawah (satuan dunia).
//    ruangan   { width, depth }  : width = lebar sepanjang sumbu X, depth = panjang sepanjang sumbu Z
//    hallway   { length, width } : length = panjang searah jalannya, width = lebar jalannya
//    pertigaan { width, toRx, toRy } : width = lebar jalan melintang,
//                toRx = jarak dari sumbu hallway sampai dinding terdekat ruangan Rx
//                       (= panjang jalan melintang ke ruangan itu, termasuk setengah lebar hallway)
//  Posisi semua bagian dihitung otomatis dari ukuran ini. Jika ada yang bertabrakan atau tidak
//  muat, kode melempar pesan error yang menyebut bagian mana yang bermasalah.
//
//  LANTAI: tiap ruangan/hallway/pertigaan mendapat permukaan tidak rata (bukit kecil acak) dan retakan,
//  dihitung dari satu fungsi tinggi yang sama sehingga tepinya menyambung. Atur lewat TERRAIN.
// ============================================================
import { MyObject } from "./MyObject.js";
import * as Shape from "./Shapes.js";
import { Pillar, PILLARS } from "./Pillar.js";
import { CrateStack, CRATE_STACKS } from "./CrateStack.js";

// ===== UKURAN MAZE (satuan dunia) =====
const MAZE_LAYOUT = {
    // segment 1 pertama: ruangan awal
    R1: { width: 80, depth: 64 },
    // segment 2 & 3 (setelah R1): hallway lurus ke +z, lalu pertigaan ke kiri (R2) dan kanan (R3)
    H1: { length: 32, width: 40 },
    J1: { width: 40, toR2: 72, toR3: 72 },
    R2: { width: 64, depth: 64 },
    R3: { width: 64, depth: 64 },

    // pengulangan dari R2: hallway menuju kiri (-x), pertigaan utara-selatan
    H2: { length: 32, width: 40 },
    J2: { width: 40, toR4: 24, toR5: 24 },
    R4: { width: 64, depth: 64 },
    R5: { width: 64, depth: 64 },

    // pengulangan dari R3: hallway menuju kanan (+x), pertigaan utara-selatan
    H3: { length: 32, width: 16 },
    J3: { width: 40, toR6: 24, toR7: 24 },
    R6: { width: 64, depth: 64 },
    R7: { width: 64, depth: 64 }
};

const WALL = {
    height: 32,
    thickness: 1.6,
    dimpleDepth: 0.75,
    dimpleDensity: 0.012,
    dimpleRadiusMin: 0.55,
    dimpleRadiusMax: 1.7,
    meshStep: 0.55
};

const FLOOR_Y = -5.2;
const FLOOR_THICKNESS = 2;
const BRIGHTNESS = { floor: 0.85, wall: 0.55 };
const TERRAIN = {
    step: 0.75,            // jarak antar titik permukaan lantai (makin kecil makin halus, makin berat)
    patchDensity: 9,       // jumlah bukit/cekungan kecil per 1000 satuan luas
    maxRelief: 0.22,       // tinggi maksimum bukit
    baseRecess: 0.25,      // alas lantai ditaruh sedikit di bawah permukaan
    crackDensity: 4.8,     // jumlah retakan per 1000 satuan luas
    maxTileSamples: 200    // permukaan besar dipotong per sekian titik (batas buffer WebGL)
};

// ---------- 1. DENAH ----------
// Setiap bagian = persegi panjang di bidang xz: { name, kind, x0, x1, z0, z1 }
function planMaze(L) {
    const rects = [];
    const add = (name, kind, x0, x1, z0, z1) => rects.push({
        name, kind,
        x0: Math.min(x0, x1), x1: Math.max(x0, x1),
        z0: Math.min(z0, z1), z1: Math.max(z0, z1)
    });
    const find = name => rects.find(r => r.name === name);

    // pengulangan ke samping: ruangan -> hallway ke arah dirX -> pertigaan utara-selatan -> 2 ruangan
    function branchSideways(roomName, hallName, junctionName, northName, southName, dirX) {
        const room = find(roomName);
        const hall = L[hallName], junction = L[junctionName];
        const centerZ = (room.z0 + room.z1) / 2;
        const wallX = dirX < 0 ? room.x0 : room.x1;

        const hallEnd = wallX + dirX * hall.length;
        add(hallName, "hall", wallX, hallEnd, centerZ - hall.width / 2, centerZ + hall.width / 2);

        const junctionEnd = hallEnd + dirX * junction.width;
        const toNorth = junction["to" + northName], toSouth = junction["to" + southName];
        add(junctionName, "junction", hallEnd, junctionEnd, centerZ - toSouth, centerZ + toNorth);

        const centerX = (hallEnd + junctionEnd) / 2;
        const north = L[northName], south = L[southName];
        add(northName, "room", centerX - north.width / 2, centerX + north.width / 2,
            centerZ + toNorth, centerZ + toNorth + north.depth);
        add(southName, "room", centerX - south.width / 2, centerX + south.width / 2,
            centerZ - toSouth - south.depth, centerZ - toSouth);
    }

    // segment 1: ruangan awal di pusat (0, 0)
    add("R1", "room", -L.R1.width / 2, L.R1.width / 2, -L.R1.depth / 2, L.R1.depth / 2);
    // segment 2: hallway ke +z, segment 3: pertigaan kiri-kanan
    const hallEndZ = L.R1.depth / 2 + L.H1.length;
    add("H1", "hall", -L.H1.width / 2, L.H1.width / 2, L.R1.depth / 2, hallEndZ);
    const junctionEndZ = hallEndZ + L.J1.width;
    add("J1", "junction", -L.J1.toR2, L.J1.toR3, hallEndZ, junctionEndZ);
    const centerZ = (hallEndZ + junctionEndZ) / 2;
    add("R2", "room", -L.J1.toR2 - L.R2.width, -L.J1.toR2, centerZ - L.R2.depth / 2, centerZ + L.R2.depth / 2);
    add("R3", "room", L.J1.toR3, L.J1.toR3 + L.R3.width, centerZ - L.R3.depth / 2, centerZ + L.R3.depth / 2);

    branchSideways("R2", "H2", "J2", "R4", "R5", -1);
    branchSideways("R3", "H3", "J3", "R6", "R7", +1);
    return rects;
}

// Periksa ukuran: angka valid, hallway muat di dinding ruangan, tidak ada bagian yang saling tumpang tindih
function validateMaze(L, rects) {
    const positive = (label, value) => {
        if (!Number.isFinite(value) || value <= 0) throw new Error(`MAZE_LAYOUT: ${label} harus angka lebih besar dari 0 (sekarang ${value}).`);
    };
    for (const [name, cfg] of Object.entries(L)) {
        for (const [key, value] of Object.entries(cfg)) positive(`${name}.${key}`, value);
    }

    const fits = (inner, innerLabel, outer, outerLabel) => {
        if (inner > outer) throw new Error(`MAZE_LAYOUT: ${innerLabel} (${inner}) tidak muat di ${outerLabel} (${outer}).`);
    };
    fits(L.H1.width, "H1.width", L.R1.width, "R1.width (dinding tempat H1 keluar)");
    fits(L.H2.width, "H2.width", L.R2.depth, "R2.depth (dinding tempat H2 keluar)");
    fits(L.H3.width, "H3.width", L.R3.depth, "R3.depth (dinding tempat H3 keluar)");
    fits(L.J1.width, "J1.width", L.R2.depth, "R2.depth");
    fits(L.J1.width, "J1.width", L.R3.depth, "R3.depth");
    fits(L.J2.width, "J2.width", L.R4.width, "R4.width");
    fits(L.J2.width, "J2.width", L.R5.width, "R5.width");
    fits(L.J3.width, "J3.width", L.R6.width, "R6.width");
    fits(L.J3.width, "J3.width", L.R7.width, "R7.width");
    fits(L.H1.width / 2, "setengah H1.width", Math.min(L.J1.toR2, L.J1.toR3), "J1.toR2 / J1.toR3");
    fits(L.H2.width / 2, "setengah H2.width", Math.min(L.J2.toR4, L.J2.toR5), "J2.toR4 / J2.toR5");
    fits(L.H3.width / 2, "setengah H3.width", Math.min(L.J3.toR6, L.J3.toR7), "J3.toR6 / J3.toR7");

    const EPS = 1e-6;
    for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
            const a = rects[i], b = rects[j];
            const overlapX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
            const overlapZ = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
            if (overlapX > EPS && overlapZ > EPS) {
                throw new Error(`MAZE_LAYOUT: ${a.name} dan ${b.name} saling bertabrakan. `
                    + `Perbesar jarak (toRx / length) atau kecilkan ukuran ruangan.`);
            }
        }
    }
}

// ---------- 2. DINDING ----------
// Tiap sisi persegi dijadikan dinding, kecuali bagian yang menempel pada bagian lain (bukaan jalan).
function planWalls(rects) {
    const EPS = 1e-6;
    const walls = [];

    // sisi: { axis: "x" (dinding memanjang sepanjang x) / "z", fixed: koordinat garis, from, to }
    const sidesOf = r => [
        { axis: "x", fixed: r.z0, from: r.x0, to: r.x1, openTo: other => other.z1 },
        { axis: "x", fixed: r.z1, from: r.x0, to: r.x1, openTo: other => other.z0 },
        { axis: "z", fixed: r.x0, from: r.z0, to: r.z1, openTo: other => other.x1 },
        { axis: "z", fixed: r.x1, from: r.z0, to: r.z1, openTo: other => other.x0 }
    ];

    rects.forEach(rect => {
        sidesOf(rect).forEach(side => {
            // bagian sisi ini yang tertutup persegi lain yang menempel di garis yang sama
            const gaps = [];
            rects.forEach(other => {
                if (other === rect || Math.abs(side.openTo(other) - side.fixed) > EPS) return;
                const from = side.axis === "x" ? other.x0 : other.z0;
                const to = side.axis === "x" ? other.x1 : other.z1;
                const a = Math.max(side.from, from), b = Math.min(side.to, to);
                if (b - a > EPS) gaps.push([a, b]);
            });
            gaps.sort((p, q) => p[0] - q[0]);

            let cursor = side.from;
            const pieces = [];
            gaps.forEach(([a, b]) => {
                if (a - cursor > EPS) pieces.push([cursor, a]);
                cursor = Math.max(cursor, b);
            });
            if (side.to - cursor > EPS) pieces.push([cursor, side.to]);

            pieces.forEach(([a, b]) => {
                const length = b - a + WALL.thickness;                 // + tebal menutup sudut
                const middle = (a + b) / 2;
                walls.push(side.axis === "x"
                    ? { x: middle, z: side.fixed, width: length, depth: WALL.thickness }
                    : { x: side.fixed, z: middle, width: WALL.thickness, depth: length });
            });
        });
    });
    return walls;
}

// ---------- 3. LANTAI (permukaan tidak rata + retakan) ----------
function createRandom(seed) {
    let state = seed;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

// titik sampel sepanjang satu sumbu: ujung a, kelipatan step di antaranya, ujung b
// (kelipatan step sama untuk semua persegi -> tepi persegi bertetangga menyambung)
function sampleAxis(a, b, step) {
    const values = [a];
    for (let k = Math.floor(a / step) + 1; k * step < b - 1e-6; k++) {
        if (k * step > a + 1e-6) values.push(k * step);
    }
    values.push(b);
    return values;
}

function createTerrain(rects) {
    const random = createRandom(183746);

    // bukit/cekungan kecil tersebar di setiap bagian lantai
    const patches = [];
    rects.forEach(rect => {
        const area = (rect.x1 - rect.x0) * (rect.z1 - rect.z0);
        const count = Math.max(1, Math.round(TERRAIN.patchDensity * area / 1000));
        for (let i = 0; i < count; i++) {
            patches.push({
                x: rect.x0 + random() * (rect.x1 - rect.x0),
                z: rect.z0 + random() * (rect.z1 - rect.z0),
                radius: 1.1 + random() * 1.6,
                height: (random() * 2 - 1) * TERRAIN.maxRelief
            });
        }
    });
    const reach = patch => patch.radius * 3.2;                          // di luar ini pengaruhnya hampir nol
    const makeHeightAt = list => (x, z) => list.reduce((height, patch) => {
        const dx = (x - patch.x) / patch.radius;
        const dz = (z - patch.z) / patch.radius;
        return height + patch.height * Math.exp(-3.5 * (dx * dx + dz * dz));
    }, 0);
    const heightAtAll = makeHeightAt(patches);

    // satu potongan permukaan untuk daerah [xs] x [zs]
    const surfaces = [];
    const buildSurface = (xs, zs) => {
        const nearby = patches.filter(p => p.x + reach(p) >= xs[0] && p.x - reach(p) <= xs[xs.length - 1]
            && p.z + reach(p) >= zs[0] && p.z - reach(p) <= zs[zs.length - 1]);
        const heightAt = makeHeightAt(nearby);
        const stride = xs.length;
        const vertices = [], normals = [], vertexColors = [], indices = [];

        zs.forEach(z => xs.forEach(x => {
            const y = heightAt(x, z);
            const slopeX = (heightAt(x + 0.05, z) - heightAt(x - 0.05, z)) / 0.1;
            const slopeZ = (heightAt(x, z + 0.05) - heightAt(x, z - 0.05)) / 0.1;
            const normalLength = Math.hypot(slopeX, 1, slopeZ);
            const tone = Math.max(0.48, Math.min(1.3, 0.9 + y / TERRAIN.maxRelief * 0.48));
            vertices.push(x, y, z);
            normals.push(-slopeX / normalLength, 1 / normalLength, -slopeZ / normalLength);
            vertexColors.push(tone, tone, tone);
        }));
        for (let row = 0; row < zs.length - 1; row++) {
            for (let column = 0; column < xs.length - 1; column++) {
                const a = row * stride + column, b = a + 1, c = a + stride, d = c + 1;
                indices.push(a, c, b, b, c, d);
            }
        }
        surfaces.push({ vertices, normals, vertexColors, indices });
    };

    rects.forEach(rect => {
        const xs = sampleAxis(rect.x0, rect.x1, TERRAIN.step);
        const zs = sampleAxis(rect.z0, rect.z1, TERRAIN.step);
        const size = TERRAIN.maxTileSamples;
        for (let i = 0; i < xs.length - 1; i += size) {
            for (let j = 0; j < zs.length - 1; j += size) {
                buildSurface(xs.slice(i, i + size + 1), zs.slice(j, j + size + 1));
            }
        }
    });

    // retakan tipis di atas permukaan
    const crackVertices = [];
    const crackIndices = [];
    rects.forEach(rect => {
        const width = rect.x1 - rect.x0, depth = rect.z1 - rect.z0;
        const count = Math.round(TERRAIN.crackDensity * width * depth / 1000);
        for (let crack = 0; crack < count; crack++) {
            const angle = random() * Math.PI * 2;
            const length = 1.5 + random() * 3.5;
            const segments = 4 + Math.floor(random() * 4);
            const halfWidth = 0.025 + random() * 0.025;
            const marginX = Math.min(6, width / 2);
            const marginZ = Math.min(6, depth / 2);
            let x = rect.x0 + marginX + random() * (width - marginX * 2);
            let z = rect.z0 + marginZ + random() * (depth - marginZ * 2);
            const directionX = Math.cos(angle);
            const directionZ = Math.sin(angle);

            for (let segment = 0; segment <= segments; segment++) {
                const t = segment / segments;
                const bend = (random() - 0.5) * 0.35;
                const centerX = x + directionX * length / segments + -directionZ * bend;
                const centerZ = z + directionZ * length / segments + directionX * bend;
                const taper = Math.sin(Math.PI * t) * 0.65 + 0.35;
                const offsetX = -directionZ * halfWidth * taper;
                const offsetZ = directionX * halfWidth * taper;
                for (const side of [-1, 1]) {
                    const crackX = centerX + offsetX * side;
                    const crackZ = centerZ + offsetZ * side;
                    crackVertices.push(crackX, heightAtAll(crackX, crackZ) + 0.008, crackZ);
                }

                if (segment > 0) {
                    const current = crackVertices.length / 3 - 2;
                    const previous = current - 2;
                    crackIndices.push(previous, current, previous + 1, previous + 1, current, current + 1);
                }
                x = centerX;
                z = centerZ;
            }
        }
    });

    return { surfaces, crackVertices, crackIndices };
}

function createRoofSurface(rect) {
    const vertices = [], normals = [], indices = [];
    const xs = sampleAxis(rect.x0, rect.x1, 2);
    const zs = sampleAxis(rect.z0, rect.z1, 2);
    const maxTileSamples = TERRAIN.maxTileSamples;

    for (let rowStart = 0; rowStart < zs.length - 1; rowStart += maxTileSamples) {
        const rowEnd = Math.min(rowStart + maxTileSamples, zs.length - 1);
        for (let columnStart = 0; columnStart < xs.length - 1; columnStart += maxTileSamples) {
            const columnEnd = Math.min(columnStart + maxTileSamples, xs.length - 1);
            const faceStart = vertices.length / 3;

            for (let row = rowStart; row <= rowEnd; row++) {
                for (let column = columnStart; column <= columnEnd; column++) {
                    vertices.push(xs[column], 0, zs[row]);
                    normals.push(0, -1, 0);
                }
            }

            const columns = columnEnd - columnStart + 1;
            const rows = rowEnd - rowStart + 1;
            for (let row = 0; row < rows - 1; row++) {
                for (let column = 0; column < columns - 1; column++) {
                    const a = faceStart + row * columns + column;
                    const b = a + 1, c = a + columns, d = c + 1;
                    indices.push(a, b, c, b, d, c);
                }
            }
        }
    }

    return { vertices, normals, indices };
}

function createDimpledWall(width, height, depth, x, z) {
    const vertices = [], normals = [], vertexColors = [], indices = [];
    const extents = { x: width, y: height, z: depth };
    const seed = (Math.abs(Math.round(x * 1009 + z * 9176 + width * 199 + depth * 313)) >>> 0) || 1;
    const random = createRandom(seed);
    const faces = [
        { normalAxis: "x", normalSign: -1, uAxis: "z", uSign: 1, vAxis: "y", vSign: 1 },
        { normalAxis: "x", normalSign: 1, uAxis: "z", uSign: -1, vAxis: "y", vSign: 1 },
        { normalAxis: "z", normalSign: -1, uAxis: "x", uSign: -1, vAxis: "y", vSign: 1 },
        { normalAxis: "z", normalSign: 1, uAxis: "x", uSign: 1, vAxis: "y", vSign: 1 },
        { normalAxis: "y", normalSign: -1, uAxis: "x", uSign: 1, vAxis: "z", vSign: 1 },
        { normalAxis: "y", normalSign: 1, uAxis: "x", uSign: -1, vAxis: "z", vSign: 1 }
    ];
    const axisIndex = { x: 0, y: 1, z: 2 };
    const binSize = WALL.dimpleRadiusMax * 2;

    faces.forEach(face => {
        const uLength = extents[face.uAxis], vLength = extents[face.vAxis];
        const columns = Math.max(1, Math.ceil(uLength / WALL.meshStep));
        const rows = Math.max(1, Math.ceil(vLength / WALL.meshStep));
        const maxRadius = Math.min(WALL.dimpleRadiusMax, uLength / 2, vLength / 2);
        const minRadius = Math.min(WALL.dimpleRadiusMin, maxRadius);
        const dimpled = face.normalAxis !== "y" && maxRadius >= WALL.dimpleRadiusMin;
        const faceStart = vertices.length / 3;
        const normal = [0, 0, 0];
        normal[axisIndex[face.normalAxis]] = face.normalSign;
        const uDirection = [0, 0, 0];
        uDirection[axisIndex[face.uAxis]] = face.uSign;
        const vDirection = [0, 0, 0];
        vDirection[axisIndex[face.vAxis]] = face.vSign;

        const dimpleBins = new Map();
        if (dimpled) {
            const area = (uLength - 2 * minRadius) * (vLength - 2 * minRadius);
            const count = Math.round(area * WALL.dimpleDensity);
            for (let i = 0; i < count; i++) {
                const radius = minRadius + random() * (maxRadius - minRadius);
                const dimple = {
                    u: radius + random() * (uLength - 2 * radius),
                    v: radius + random() * (vLength - 2 * radius),
                    radius,
                    strength: WALL.dimpleDepth * (0.7 + random() * 0.6)
                };
                const key = `${Math.floor(dimple.u / binSize)},${Math.floor(dimple.v / binSize)}`;
                if (!dimpleBins.has(key)) dimpleBins.set(key, []);
                dimpleBins.get(key).push(dimple);
            }
        }

        for (let row = 0; row <= rows; row++) {
            const v = vLength * row / rows;
            for (let column = 0; column <= columns; column++) {
                const u = uLength * column / columns;
                let depth = 0, slopeU = 0, slopeV = 0;

                if (dimpled) {
                    const binU = Math.floor(u / binSize), binV = Math.floor(v / binSize);
                    for (let binRow = binV - 1; binRow <= binV + 1; binRow++) {
                        for (let binColumn = binU - 1; binColumn <= binU + 1; binColumn++) {
                            const dimples = dimpleBins.get(`${binColumn},${binRow}`) || [];
                            for (const dimple of dimples) {
                                const du = u - dimple.u, dv = v - dimple.v;
                                if (Math.abs(du) >= dimple.radius || Math.abs(dv) >= dimple.radius) continue;

                                const radiusSquared = dimple.radius * dimple.radius;
                                const distanceSquared = (du * du + dv * dv) / radiusSquared;
                                if (distanceSquared >= 1) continue;

                                const remaining = 1 - distanceSquared;
                                const dimpleDepth = dimple.strength * remaining * remaining;
                                if (dimpleDepth > depth) {
                                    depth = dimpleDepth;
                                    slopeU = 4 * dimple.strength * remaining * du / radiusSquared;
                                    slopeV = 4 * dimple.strength * remaining * dv / radiusSquared;
                                }
                            }
                        }
                    }
                }

                const point = [0, 0, 0];
                point[axisIndex[face.uAxis]] = face.uSign * (u - uLength / 2);
                point[axisIndex[face.vAxis]] = face.vSign * (v - vLength / 2);
                point[axisIndex[face.normalAxis]] = face.normalSign * (extents[face.normalAxis] / 2 - depth);
                vertices.push(point[0], point[1], point[2]);

                const nx = normal[0] - uDirection[0] * slopeU - vDirection[0] * slopeV;
                const ny = normal[1] - uDirection[1] * slopeU - vDirection[1] * slopeV;
                const nz = normal[2] - uDirection[2] * slopeU - vDirection[2] * slopeV;
                const normalLength = Math.hypot(nx, ny, nz);
                normals.push(nx / normalLength, ny / normalLength, nz / normalLength);

                const tone = 1 - 0.22 * depth / WALL.dimpleDepth;
                vertexColors.push(tone, tone, tone);
            }
        }

        for (let row = 0; row < rows; row++) {
            for (let column = 0; column < columns; column++) {
                const a = faceStart + row * (columns + 1) + column;
                const b = a + 1, c = a + columns + 1, d = c + 1;
                indices.push(a, b, c, b, d, c);
            }
        }
    });

    return { vertices, normals, vertexColors, indices };
}

// ---------- 4. OBJEK ENVIRONMENT ----------
export class Environment extends MyObject {
    constructor(GL, SHADER_PROGRAM, locations) {
        super(GL, SHADER_PROGRAM, locations);

        const rects = planMaze(MAZE_LAYOUT);
        validateMaze(MAZE_LAYOUT, rects);
        this.floorY = FLOOR_Y;
        this.rects = rects;                                    // semua bagian maze (ruangan, hallway, pertigaan)
        this.rooms = {};                                       // pusat tiap ruangan: this.rooms.R1.x / .z
        rects.filter(r => r.kind === "room").forEach(r => {
            this.rooms[r.name] = { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 };
        });

        // alas lantai tiap bagian
        const slabHeight = FLOOR_THICKNESS + TERRAIN.baseRecess;
        rects.forEach(r => {
            this.childs.push(this.addBlock(
                r.x1 - r.x0, slabHeight, r.z1 - r.z0,
                (r.x0 + r.x1) / 2, FLOOR_Y - TERRAIN.baseRecess - slabHeight / 2, (r.z0 + r.z1) / 2,
                BRIGHTNESS.floor
            ));
        });

        // permukaan lantai tidak rata + retakan (koordinat dunia, diangkat ke FLOOR_Y)
        const terrain = createTerrain(rects);
        terrain.surfaces.forEach(surface => {
            const floorSurface = new MyObject(this.GL, this.SHADER_PROGRAM, this.locations);
            floorSurface.vertex = surface.vertices;
            floorSurface.normals = surface.normals;
            floorSurface.vertexColors = surface.vertexColors;
            floorSurface.faces = surface.indices;
            floorSurface.brightness = BRIGHTNESS.floor;
            floorSurface.hatching = 2;
            LIBS.set_position(floorSurface.POSITION_MATRIX, 0, FLOOR_Y, 0);
            this.childs.push(floorSurface);
        });

        const cracks = new MyObject(this.GL, this.SHADER_PROGRAM, this.locations);
        cracks.vertex = terrain.crackVertices;
        cracks.normals = terrain.crackVertices.map((_, index) => index % 3 === 1 ? 1 : 0);
        cracks.faces = terrain.crackIndices;
        cracks.brightness = 0.28;
        cracks.hatching = 2;
        LIBS.set_position(cracks.POSITION_MATRIX, 0, FLOOR_Y, 0);
        this.childs.push(cracks);

        this.roof = new MyObject(this.GL, this.SHADER_PROGRAM, this.locations);
        this.roof.visible = false;
        const roofY = FLOOR_Y + WALL.height - 0.1;
        rects.forEach(rect => {
            const surface = createRoofSurface(rect);
            const roofSection = new MyObject(this.GL, this.SHADER_PROGRAM, this.locations);
            roofSection.vertex = surface.vertices;
            roofSection.normals = surface.normals;
            roofSection.faces = surface.indices;
            roofSection.brightness = BRIGHTNESS.floor;
            roofSection.hatching = 2;
            LIBS.set_position(roofSection.POSITION_MATRIX, 0, roofY, 0);
            this.roof.childs.push(roofSection);
        });
        this.childs.push(this.roof);

        // dinding
        planWalls(rects).forEach(wall => {
            this.childs.push(this.addDimpledBlock(
                wall.width, WALL.height, wall.depth,
                wall.x, FLOOR_Y + WALL.height / 2, wall.z,
                BRIGHTNESS.wall
            ));
        });

        PILLARS.forEach(config => {
            this.childs.push(new Pillar(
                this.GL,
                this.SHADER_PROGRAM,
                this.locations,
                config,
                FLOOR_Y
            ));
        });

        const roomsByName = new Map(rects.filter(rect => rect.kind === "room").map(room => [room.name, room]));
        CRATE_STACKS.forEach(config => {
            const room = roomsByName.get(config.room);
            if (!room) throw new Error(`Crate stack references unknown room "${config.room}".`);
            this.childs.push(new CrateStack(
                this.GL,
                this.SHADER_PROGRAM,
                this.locations,
                room,
                config,
                FLOOR_Y
            ));
        });
    }

    // balok berukuran (width, height, depth) dengan pusat di (x, y, z) relatif terhadap akar
    addBlock(width, height, depth, x, y, z, brightness) {
        const shape = Shape.box(width, height, depth);
        const part = new MyObject(this.GL, this.SHADER_PROGRAM, this.locations);
        part.vertex = shape.vertices;
        part.normals = shape.normals;
        part.faces = shape.indices;
        part.brightness = brightness;
        LIBS.set_position(part.POSITION_MATRIX, x, y, z);
        return part;
    }

    addDimpledBlock(width, height, depth, x, y, z, brightness) {
        const shape = createDimpledWall(width, height, depth, x, z);
        const part = new MyObject(this.GL, this.SHADER_PROGRAM, this.locations);
        part.vertex = shape.vertices;
        part.normals = shape.normals;
        part.vertexColors = shape.vertexColors;
        part.faces = shape.indices;
        part.brightness = brightness;
        part.hatching = 3;
        LIBS.set_position(part.POSITION_MATRIX, x, y, z);
        return part;
    }
}
