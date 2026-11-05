// ============================================================
//  environment.js : maze untuk tempat karakter (trailer / promosi)
//
//  Denah dilihat dari atas (karakter menghadap +z, ke atas pada gambar):
//
//     [R4]                                                  [R6]
//      |                                                     |
//     [  ]--hallway--[R2]                  [R3]--hallway--[  ]
//      |                  \\______  ______//                  |
//     [R5]                       ||                        [R7]
//                                ||  hallway
//                               [R1]  <- ruangan awal
//
//  Dari R1 hallway ke +z lalu pertigaan membelah ke kiri (R2) dan kanan (R3).
//  Dari R2 urutan diulang ke kiri (-x): hallway, lalu pertigaan utara-selatan ke R4 & R5.
//  Dari R3 diulang ke kanan (+x): hallway, lalu pertigaan utara-selatan ke R6 & R7.
//
//  3 segment yang berulang: ruangan -> hallway -> pertigaan -> (2 ruangan baru)
//  Diulang 2 kali (BRANCH_OFFSETS.length) = 1 + 2 + 4 = 7 ruangan.
//
//  CARA KERJA
//    1. planMaze()  : menyusun daftar persegi panjang lantai (ruangan, hallway, pertigaan)
//                     dalam satuan sel kotak (1 sel = CELL satuan dunia).
//    2. Dinding     : dibuat otomatis di setiap tepi antara sel lantai dan sel kosong,
//                     lalu digabung per garis lurus. Bukaan hallway/pertigaan otomatis terbentuk.
//    3. Environment : root MyObject kosong; lantai & dinding adalah anaknya (childs.push).
//
//  Tidak ada library: bentuk memakai Shape.box dari Shapes.js, shader sama dengan karakter.
// ============================================================
import { MyObject } from "./MyObject.js";
import * as Shape from "./Shapes.js";

// ===== PENGATURAN (angka sel = jumlah kotak grid; ukuran dunia = sel x CELL) =====
const SCALE = 2;                        // PERBESAR / KECILKAN seluruh maze di sini (1 = ukuran awal)
const CELL = 2 * SCALE;                 // ukuran 1 sel dalam satuan dunia
const ROOM_SIZE = 16;                   // ruangan persegi 16 x 16 sel (genap)
const HALL_WIDTH = 4;                   // lebar hallway & jalan pertigaan (genap)
const HALL_LENGTH = 8;                  // panjang hallway (segment 2)
const BRANCH_OFFSETS = [26, 14];        // jarak pusat ruangan baru ke kiri/kanan pertigaan, per pengulangan
                                        //   (jumlah isi array = jumlah pengulangan = 2)
const WALL_HEIGHT = 16 * SCALE;         // tinggi dinding (satuan dunia)
const WALL_THICKNESS = 0.8 * SCALE;
const FLOOR_Y = -5.2;                   // tinggi permukaan lantai = telapak kaki karakter
const FLOOR_THICKNESS = 1 * SCALE;
const CEILING = false;                  // true = beri atap (false agar maze terlihat dari atas)

const BRIGHTNESS = { room: 0.90, hall: 0.80, junction: 0.85, wall: 0.55, ceiling: 0.85 };

// ---------- 1. DENAH ----------
// Persegi sel: { x0, x1, z0, z1, kind }  (x1 & z1 tidak termasuk). Pusat ruangan (x, z) dalam sel.
// Tiap ruangan punya arah maju (dx, dz): hallway keluar dari sisi depannya, pertigaan membentang
// ke kiri & kanan arah itu, dan ruangan baru di ujungnya menghadap ke arah ujung tersebut.
function planMaze() {
    const rects = [], rooms = [];

    function addRoomAndBranches(cx, cz, dx, dz, level) {
        const half = ROOM_SIZE / 2;
        const sx = dz, sz = -dx;                                      // arah samping (tegak lurus arah maju)

        // titik (f, s) = f sel ke depan, s sel ke samping, dihitung dari pusat ruangan ini
        const point = (f, s) => [cx + f * dx + s * sx, cz + f * dz + s * sz];
        const rect = (f0, f1, s0, s1, kind) => {
            const [xa, za] = point(f0, s0), [xb, zb] = point(f1, s1);
            rects.push({ x0: Math.min(xa, xb), x1: Math.max(xa, xb), z0: Math.min(za, zb), z1: Math.max(za, zb), kind });
        };

        rect(-half, half, -half, half, "room");                        // segment 1: ruangan
        rooms.push({ level, x: cx * CELL, z: cz * CELL });
        if (level >= BRANCH_OFFSETS.length) return;                    // ruangan terakhir: tidak ada lanjutan

        // segment 2: hallway lurus ke depan dari tengah sisi depan ruangan
        const hallEnd = half + HALL_LENGTH;
        rect(half, hallEnd, -HALL_WIDTH / 2, HALL_WIDTH / 2, "hall");

        // segment 3: pertigaan = jalan melintang kiri-kanan, hallway menabrak tengahnya
        const offset = BRANCH_OFFSETS[level];
        rect(hallEnd, hallEnd + HALL_WIDTH, -(offset - half), offset - half, "junction");

        // ruangan baru di ujung kiri & kanan -> ulangi dari segment 1
        const junctionCenter = hallEnd + HALL_WIDTH / 2;
        for (const side of [-1, 1]) {
            const [nx, nz] = point(junctionCenter, side * offset);
            addRoomAndBranches(nx, nz, side * sx, side * sz, level + 1);
        }
    }

    addRoomAndBranches(0, 0, 0, 1, 0);                                 // ruangan awal menghadap +z
    return { rects, rooms };
}

// ---------- 2. DINDING dari tepi sel lantai ----------
// Mengembalikan daftar { x, z, width, depth } (pusat & ukuran di bidang xz, satuan dunia)
function planWalls(rects) {
    const floor = new Set();
    rects.forEach(r => { for (let x = r.x0; x < r.x1; x++) for (let z = r.z0; z < r.z1; z++) floor.add(x + "," + z); });
    const isFloor = (x, z) => floor.has(x + "," + z);

    // kumpulkan sel-sel tepi per garis, lalu gabung yang berurutan menjadi satu dinding panjang
    const horizontalEdges = new Map(), verticalEdges = new Map();      // garis -> daftar posisi
    const add = (map, line, position) => { if (!map.has(line)) map.set(line, []); map.get(line).push(position); };

    rects.forEach(r => {
        for (let x = r.x0 - 1; x <= r.x1; x++) for (let z = r.z0 - 1; z <= r.z1; z++) {
            if (isFloor(x, z) !== isFloor(x, z - 1)) add(horizontalEdges, z, x);   // tepi sepanjang x di garis z
            if (isFloor(x, z) !== isFloor(x - 1, z)) add(verticalEdges, x, z);     // tepi sepanjang z di garis x
        }
    });

    const walls = [], T = WALL_THICKNESS;
    const merge = (map, isHorizontal) => map.forEach((positions, line) => {
        const sorted = [...new Set(positions)].sort((a, b) => a - b);
        let start = sorted[0], previous = sorted[0];
        const flush = end => {
            const length = (end - start + 1) * CELL + T;                    // + T menutup sudut
            const middle = (start + end + 1) / 2 * CELL;
            walls.push(isHorizontal ? { x: middle, z: line * CELL, width: length, depth: T }
                                    : { x: line * CELL, z: middle, width: T, depth: length });
        };
        for (const p of sorted.slice(1)) { if (p !== previous + 1) { flush(previous); start = p; } previous = p; }
        flush(previous);
    });
    merge(horizontalEdges, true);
    merge(verticalEdges, false);
    return walls;
}

// ---------- 3. OBJEK ENVIRONMENT ----------
export class Environment extends MyObject {
    constructor(GL, SHADER_PROGRAM, locations) {
        super(GL, SHADER_PROGRAM, locations);     // akar kosong; lantai & dinding = anaknya

        const { rects, rooms } = planMaze();
        this.floorY = FLOOR_Y;                    // tinggi permukaan lantai, untuk menaruh karakter
        this.rooms = rooms;                       // pusat tiap ruangan (satuan dunia), untuk menaruh karakter/kamera

        // lantai (dan atap) tiap segment
        rects.forEach(r => {
            const width = (r.x1 - r.x0) * CELL, depth = (r.z1 - r.z0) * CELL;
            const x = (r.x0 + r.x1) / 2 * CELL, z = (r.z0 + r.z1) / 2 * CELL;
            this.childs.push(this.addBlock(width, FLOOR_THICKNESS, depth, x, FLOOR_Y - FLOOR_THICKNESS / 2, z, BRIGHTNESS[r.kind]));
            if (CEILING) this.childs.push(this.addBlock(width, FLOOR_THICKNESS, depth, x, FLOOR_Y + WALL_HEIGHT + FLOOR_THICKNESS / 2, z, BRIGHTNESS.ceiling));
        });

        // dinding
        planWalls(rects).forEach(w => {
            this.childs.push(this.addBlock(w.width, WALL_HEIGHT, w.depth, w.x, FLOOR_Y + WALL_HEIGHT / 2, w.z, BRIGHTNESS.wall));
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
}
