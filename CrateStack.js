import { MyObject } from "./MyObject.js";
import * as Shape from "./Shapes.js";

// Posisi x/z adalah koordinat dunia, bukan posisi relatif terhadap ruangan.
export const CRATE_STACKS = [
    { x: 0, z: -27.5, crateWidth: 4, crateHeight: 4, crateDepth: 4, scale: 1, rotation: 0 },
    { x: 104, z: 68.5, crateWidth: 4, crateHeight: 4, crateDepth: 4, scale: 1, rotation: 0 },
    { x: -522, z: 223.5, crateWidth: 4, crateHeight: 4, crateDepth: 4, scale: 1, rotation: 0 },
    { x: -522, z: 4.5, crateWidth: 4, crateHeight: 4, crateDepth: 4, scale: 1, rotation: 0 },
    { x: 522, z: 223.5, crateWidth: 4, crateHeight: 4, crateDepth: 4, scale: 1, rotation: 0 },
    { x: 236, z: 160, crateWidth: 4, crateHeight: 4, crateDepth: 4, scale: 1, rotation: 0.3 },
    { x: 58, z: 157, crateWidth: 4, crateHeight: 4, crateDepth: 4, scale: 1, rotation: 0.1 },
    { x: 210, z: 160, crateWidth: 4, crateHeight: 4, crateDepth: 4, scale: 1, rotation: 0.2 },
    { x: 315, z: 160, crateWidth: 4, crateHeight: 4, crateDepth: 4, scale: 1, rotation: 0},
    { x: 361, z: 160, crateWidth: 4, crateHeight: 4, crateDepth: 4, scale: 1, rotation: 0.1 },
    { x: -236, z: 160, crateWidth: 4, crateHeight: 4, crateDepth: 4, scale: 1, rotation: -0.3 },
    { x: -58, z: 157, crateWidth: 4, crateHeight: 4, crateDepth: 4, scale: 1, rotation: -0.1 },
    { x: -220, z: 160, crateWidth: 4, crateHeight: 4, crateDepth: 4, scale: 1, rotation: -0.2 },
    { x: -315, z: 160, crateWidth: 4, crateHeight: 4, crateDepth: 4, scale: 1, rotation: 0},
    { x: -361, z: 160, crateWidth: 4, crateHeight: 4, crateDepth: 4, scale: 1, rotation: -0.1 },

];

const FRAME_BRIGHTNESS = 0.62;

export class CrateStack extends MyObject {
    constructor(GL, SHADER_PROGRAM, locations, config, floorY) {
        super(GL, SHADER_PROGRAM, locations);

        const {
            x, z, crateWidth, crateHeight, crateDepth, scale, rotation
        } = config;
        const dimensions = [crateWidth, crateHeight, crateDepth, scale];
        const coordinates = [x, z, rotation, floorY];
        if (!dimensions.every(value => Number.isFinite(value) && value > 0)
            || !coordinates.every(Number.isFinite)) {
            throw new Error("Invalid crate stack configuration: dimensions and world coordinates must be finite.");
        }

        for (const scaleAxis of [LIBS.scaleX, LIBS.scaleY, LIBS.scaleZ]) {
            scaleAxis(this.POSITION_MATRIX, scale);
        }
        LIBS.rotateY(this.POSITION_MATRIX, rotation);
        LIBS.set_position(this.POSITION_MATRIX, x, floorY, z);

        const halfWidth = crateWidth / 2;
        const halfHeight = crateHeight / 2;
        const halfDepth = crateDepth / 2;
        const crates = [
            { x: -halfWidth, y: halfHeight, z: 0 },
            { x: halfWidth, y: halfHeight, z: 0 },
            { x: 0, y: crateHeight + halfHeight, z: 0 }
        ];
        crates.forEach(position => this.addCrate(position, crateWidth, crateHeight, crateDepth));
    }

    addCrate(position, width, height, depth) {
        const body = this.addBox(width, height, depth, 0.38);
        LIBS.set_position(body.POSITION_MATRIX, position.x, position.y, position.z);
        this.childs.push(body);

        const braceWidth = width * 0.09;
        const braceLength = Math.hypot(width, height) * 0.84;
        const braceAngle = Math.atan2(height, width);
        for (const side of [-1, 1]) {
            const brace = this.addBox(braceWidth, braceLength, depth * 0.045, FRAME_BRIGHTNESS);
            LIBS.rotateZ(brace.MOVE_MATRIX, side * braceAngle);
            LIBS.set_position(brace.POSITION_MATRIX, position.x, position.y, position.z + side * (depth / 2 + depth * 0.026));
            this.childs.push(brace);
        }
    }

    addBox(width, height, depth, brightness) {
        const shape = Shape.box(width, height, depth);
        const part = new MyObject(this.GL, this.SHADER_PROGRAM, this.locations);
        part.vertex = shape.vertices;
        part.normals = shape.normals;
        part.faces = shape.indices;
        part.brightness = brightness;
        return part;
    }
}
