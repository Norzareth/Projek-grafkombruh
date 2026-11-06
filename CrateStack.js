import { MyObject } from "./MyObject.js";
import * as Shape from "./Shapes.js";

// Ubah ukuran, skala, rotasi (radian), dan offset tiap tumpukan di sini.
// R1/R2/R3/R5/R7 berujung di z minimum; R4/R6 berujung di z maksimum.
export const CRATE_STACKS = [
    { room: "R1", end: "minZ", crateWidth: 4, crateHeight: 4, crateDepth: 4, scale: 1, rotation: 0, xOffset: 0, zOffset: 0 },
    { room: "R2", end: "minZ", crateWidth: 4, crateHeight: 4, crateDepth: 4, scale: 1, rotation: 0, xOffset: 0, zOffset: 0 },
    { room: "R3", end: "minZ", crateWidth: 4, crateHeight: 4, crateDepth: 4, scale: 1, rotation: 0, xOffset: 0, zOffset: 0 },
    { room: "R4", end: "maxZ", crateWidth: 4, crateHeight: 4, crateDepth: 4, scale: 1, rotation: 0, xOffset: 0, zOffset: 0 },
    { room: "R5", end: "minZ", crateWidth: 4, crateHeight: 4, crateDepth: 4, scale: 1, rotation: 0, xOffset: 0, zOffset: 0 },
    { room: "R6", end: "maxZ", crateWidth: 4, crateHeight: 4, crateDepth: 4, scale: 1, rotation: 0, xOffset: 0, zOffset: 0 },
    { room: "R7", end: "minZ", crateWidth: 4, crateHeight: 4, crateDepth: 4, scale: 1, rotation: 0, xOffset: 0, zOffset: 0 }
];

const END_WALL_CLEARANCE = 2.5;
const SIDE_WALL_CLEARANCE = 2.5;
const FRAME_BRIGHTNESS = 0.62;

export class CrateStack extends MyObject {
    constructor(GL, SHADER_PROGRAM, locations, room, config, floorY) {
        super(GL, SHADER_PROGRAM, locations);

        const {
            end, crateWidth, crateHeight, crateDepth,
            scale, rotation, xOffset, zOffset
        } = config;
        const dimensions = [crateWidth, crateHeight, crateDepth, scale];
        const coordinates = [rotation, xOffset, zOffset, floorY];
        if (!dimensions.every(value => Number.isFinite(value) && value > 0)
            || !coordinates.every(Number.isFinite)
            || (end !== "minZ" && end !== "maxZ")) {
            throw new Error(`Invalid crate stack configuration for ${config.room}.`);
        }

        const scaledWidth = crateWidth * scale;
        const scaledDepth = crateDepth * scale;
        const halfFootprintX = (Math.abs(Math.cos(rotation)) * scaledWidth
            + Math.abs(Math.sin(rotation)) * scaledDepth) / 2;
        const halfFootprintZ = (Math.abs(Math.sin(rotation)) * scaledWidth
            + Math.abs(Math.cos(rotation)) * scaledDepth) / 2;
        const roomCenterX = (room.x0 + room.x1) / 2;
        const roomCenterZ = (room.z0 + room.z1) / 2;
        const x = roomCenterX + xOffset;
        const z = end === "minZ"
            ? room.z0 + halfFootprintZ + END_WALL_CLEARANCE + zOffset
            : room.z1 - halfFootprintZ - END_WALL_CLEARANCE - zOffset;

        if (x - halfFootprintX < room.x0 + SIDE_WALL_CLEARANCE
            || x + halfFootprintX > room.x1 - SIDE_WALL_CLEARANCE
            || z - halfFootprintZ < room.z0 + SIDE_WALL_CLEARANCE
            || z + halfFootprintZ > room.z1 - SIDE_WALL_CLEARANCE) {
            throw new Error(`Crate stack for ${config.room} does not fit inside the room.`);
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
