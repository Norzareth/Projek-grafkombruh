// ============================================================
//  environment.js : maze walls and a simple floor
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

export class Environment extends MyObject {
    constructor(GL, SHADER_PROGRAM, locations) {
        super(GL, SHADER_PROGRAM, locations);

        const bounds = getBounds(MAZE_POINTS);
        this.floorY = FLOOR_Y;

        const floorWidth = bounds.maxX - bounds.minX + FLOOR_PADDING * 2;
        const floorDepth = bounds.maxZ - bounds.minZ + FLOOR_PADDING * 2;
        const floorX = (bounds.minX + bounds.maxX) / 2;
        const floorZ = (bounds.minZ + bounds.maxZ) / 2;
        this.childs.push(this.addBlock(
            floorWidth,
            FLOOR_THICKNESS,
            floorDepth,
            floorX,
            FLOOR_Y - FLOOR_THICKNESS / 2,
            floorZ,
            BRIGHTNESS.floor
        ));

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
