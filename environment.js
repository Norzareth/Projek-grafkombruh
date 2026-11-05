// ============================================================
//  environment.js : maze walls and a worn, uneven floor
//
//  Enter the wall outline as [x, z] points in world units. Each point is
//  connected to the next, and the final point is connected to the first.
//  Replace MAZE_POINTS to draw a different layout.
// ============================================================
import { MyObject } from "./MyObject.js";
import * as Shape from "./Shapes.js";

const MAZE_POINTS = [
    [-30, -30],
    [30, -30],
    [30, 30],
    [-30, 30]
];

const WALL = {
    height: 32,
    thickness: 1.6
};

const FLOOR_Y = -5.2;
const FLOOR_THICKNESS = 2;
const FLOOR_PADDING = 4;
const BRIGHTNESS = { floor: 0.85, wall: 0.55 };
const TERRAIN = {
    gridSize: 96,
    patchCount: 42,
    maxRelief: 0.22,
    baseRecess: 0.25,
    crackCount: 22
};

function getBounds(points) {
    if (!Array.isArray(points) || points.length < 3) {
        throw new Error("MAZE_POINTS must contain at least three [x, z] coordinates.");
    }

    points.forEach((point, index) => {
        if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)) {
            throw new Error(`MAZE_POINTS[${index}] must be a pair of finite numbers [x, z].`);
        }
    });
    if (new Set(points.map(([x, z]) => `${x},${z}`)).size < 3) {
        throw new Error("MAZE_POINTS must contain at least three distinct coordinates.");
    }

    const xs = points.map(([x]) => x);
    const zs = points.map(([, z]) => z);
    return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minZ: Math.min(...zs),
        maxZ: Math.max(...zs)
    };
}

function planWalls(points) {
    return points.flatMap((point, index) => {
        const next = points[(index + 1) % points.length];
        const dx = next[0] - point[0];
        const dz = next[1] - point[1];
        const length = Math.hypot(dx, dz);

        if (length === 0) return [];

        return [{
            x: (point[0] + next[0]) / 2,
            z: (point[1] + next[1]) / 2,
            length: length + WALL.thickness,
            rotationY: Math.atan2(-dz, dx)
        }];
    });
}

function createRandom(seed) {
    let state = seed;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

function createTerrain(width, depth) {
    const random = createRandom(183746);
    const patches = Array.from({ length: TERRAIN.patchCount }, () => ({
        x: (random() - 0.5) * width,
        z: (random() - 0.5) * depth,
        radius: 1.1 + random() * 1.6,
        height: (random() * 2 - 1) * TERRAIN.maxRelief
    }));
    const heightAt = (x, z) => patches.reduce((height, patch) => {
        const dx = (x - patch.x) / patch.radius;
        const dz = (z - patch.z) / patch.radius;
        return height + patch.height * Math.exp(-3.5 * (dx * dx + dz * dz));
    }, 0);

    const columns = TERRAIN.gridSize;
    const rows = TERRAIN.gridSize;
    const stride = columns + 1;
    const vertices = [];
    const normals = [];
    const vertexColors = [];
    const indices = [];
    const stepX = width / columns;
    const stepZ = depth / rows;

    for (let row = 0; row <= rows; row++) {
        const z = -depth / 2 + row * stepZ;
        for (let column = 0; column <= columns; column++) {
            const x = -width / 2 + column * stepX;
            const y = heightAt(x, z);
            const slopeX = (heightAt(x + 0.05, z) - heightAt(x - 0.05, z)) / 0.1;
            const slopeZ = (heightAt(x, z + 0.05) - heightAt(x, z - 0.05)) / 0.1;
            const normalLength = Math.hypot(slopeX, 1, slopeZ);
            const tone = Math.max(0.48, Math.min(1.3, 0.9 + y / TERRAIN.maxRelief * 0.48));
            vertices.push(x, y, z);
            normals.push(-slopeX / normalLength, 1 / normalLength, -slopeZ / normalLength);
            vertexColors.push(tone, tone, tone);
        }
    }

    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
            const a = row * stride + column;
            const b = a + 1;
            const c = a + stride;
            const d = c + 1;
            indices.push(a, c, b, b, c, d);
        }
    }

    const crackVertices = [];
    const crackIndices = [];
    for (let crack = 0; crack < TERRAIN.crackCount; crack++) {
        const angle = random() * Math.PI * 2;
        const length = 1.5 + random() * 3.5;
        const segments = 4 + Math.floor(random() * 4);
        const halfWidth = 0.025 + random() * 0.025;
        const marginX = Math.min(6, width / 2);
        const marginZ = Math.min(6, depth / 2);
        let x = (random() - 0.5) * (width - marginX * 2);
        let z = (random() - 0.5) * (depth - marginZ * 2);
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
                crackVertices.push(crackX, heightAt(crackX, crackZ) + 0.008, crackZ);
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

    return { vertices, normals, vertexColors, indices, crackVertices, crackIndices };
}

export class Environment extends MyObject {
    constructor(GL, SHADER_PROGRAM, locations) {
        super(GL, SHADER_PROGRAM, locations);

        const bounds = getBounds(MAZE_POINTS);
        this.floorY = FLOOR_Y;

        const floorWidth = bounds.maxX - bounds.minX + FLOOR_PADDING * 2;
        const floorDepth = bounds.maxZ - bounds.minZ + FLOOR_PADDING * 2;
        const floorX = (bounds.minX + bounds.maxX) / 2;
        const floorZ = (bounds.minZ + bounds.maxZ) / 2;
        const terrain = createTerrain(floorWidth, floorDepth);
        this.childs.push(this.addBlock(
            floorWidth,
            FLOOR_THICKNESS + TERRAIN.baseRecess,
            floorDepth,
            floorX,
            FLOOR_Y - TERRAIN.baseRecess - (FLOOR_THICKNESS + TERRAIN.baseRecess) / 2,
            floorZ,
            BRIGHTNESS.floor
        ));

        const floorSurface = new MyObject(this.GL, this.SHADER_PROGRAM, this.locations);
        floorSurface.vertex = terrain.vertices;
        floorSurface.normals = terrain.normals;
        floorSurface.vertexColors = terrain.vertexColors;
        floorSurface.faces = terrain.indices;
        floorSurface.brightness = BRIGHTNESS.floor;
        floorSurface.hatching = 0;
        LIBS.set_position(floorSurface.POSITION_MATRIX, floorX, FLOOR_Y, floorZ);
        this.childs.push(floorSurface);

        const cracks = new MyObject(this.GL, this.SHADER_PROGRAM, this.locations);
        cracks.vertex = terrain.crackVertices;
        cracks.normals = terrain.crackVertices.map((_, index) => index % 3 === 1 ? 1 : 0);
        cracks.faces = terrain.crackIndices;
        cracks.brightness = 0.28;
        cracks.hatching = 0;
        LIBS.set_position(cracks.POSITION_MATRIX, floorX, FLOOR_Y, floorZ);
        this.childs.push(cracks);

        planWalls(MAZE_POINTS).forEach(wall => {
            this.childs.push(this.addBlock(
                wall.length,
                WALL.height,
                WALL.thickness,
                wall.x,
                FLOOR_Y + WALL.height / 2,
                wall.z,
                BRIGHTNESS.wall,
                wall.rotationY
            ));
        });
    }

    addBlock(width, height, depth, x, y, z, brightness, rotationY = 0) {
        const shape = Shape.box(width, height, depth);
        const part = new MyObject(this.GL, this.SHADER_PROGRAM, this.locations);
        part.vertex = shape.vertices;
        part.normals = shape.normals;
        part.faces = shape.indices;
        part.brightness = brightness;
        LIBS.rotateY(part.POSITION_MATRIX, rotationY);
        LIBS.set_position(part.POSITION_MATRIX, x, y, z);
        return part;
    }
}
