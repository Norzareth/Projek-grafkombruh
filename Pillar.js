import { MyObject } from "./MyObject.js";
import * as Shape from "./Shapes.js";

// Edit daftar ini untuk mengatur pilar di maze. width adalah diameter pilar.
export const PILLARS = [
    { x: -522, z: 196, width: 5, height: 50 },
    { x: -522, z: 32, width: 4, height: 50 },
    { x: 522, z: 196, width: 4, height: 50 },
    { x: 522, z: 32, width: 5, height: 50 },
    { x: 10, z: 158, width: 10, height: 32 },
    { x: 100, z: 158, width: 10, height: 32 },
    { x: -30, z: 158, width: 10, height: 32 },
    { x: -206, z: 158, width: 10, height: 32 },
    { x: 286, z: 158, width: 10, height: 32 },
    { x: 406, z: 158, width: 10, height: 32 },
    { x: 466, z: 158, width: 10, height: 32 },
    { x: -90, z: 158, width: 10, height: 32 },
    { x: -186, z: 158, width: 10, height: 32 },
    { x: -396, z: 158, width: 10, height: 32 },
    { x: -456, z: 158, width: 10, height: 32 },
    { x: -306, z: 158, width: 10, height: 32 },
    { x: -520, z: 110, width: 20, height: 70 },


];

export class Pillar extends MyObject {
    constructor(GL, SHADER_PROGRAM, locations, config, floorY) {
        super(GL, SHADER_PROGRAM, locations);

        const { x, z, width, height, brightness = 0.48 } = config;
        if (![x, z, width, height, floorY].every(Number.isFinite) || width <= 0 || height <= 0) {
            throw new Error("Pillar requires finite x, z, floorY and positive width and height.");
        }

        LIBS.set_position(this.POSITION_MATRIX, x, floorY, z);
        const barWidth = Math.min(width / 3, Math.max(0.16, width * 0.075));
        const barDepth = barWidth;
        const segmentHeight = height / 4;

        for (const sideX of [-1, 1]) {
            for (const sideZ of [-1, 1]) {
                this.addBar(
                    barWidth, height, barDepth,
                    sideX * (width / 2 - barWidth / 2), height / 2,
                    sideZ * (width / 2 - barDepth / 2), brightness
                );
            }
        }

        for (let level = 0; level <= 4; level++) {
            const y = level * segmentHeight;
            for (const side of [-1, 1]) {
                this.addBar(width, barWidth, barDepth, 0, y, side * (width / 2 - barDepth / 2), brightness);
                this.addBar(barDepth, barWidth, width, side * (width / 2 - barDepth / 2), y, 0, brightness);
            }
        }

        const diagonalLength = Math.hypot(width - barWidth * 2, segmentHeight);
        const diagonalAngle = Math.atan2(segmentHeight, width - barWidth * 2);
        for (let level = 0; level < 4; level++) {
            const y = (level + 0.5) * segmentHeight;
            for (const side of [-1, 1]) {
                for (const direction of [-1, 1]) {
                    const frontBrace = this.addBar(
                        barWidth * 0.72, diagonalLength, barDepth * 0.72,
                        0, y, side * (width / 2 - barDepth / 2), brightness
                    );
                    LIBS.rotateZ(frontBrace.MOVE_MATRIX, direction * diagonalAngle);

                    const sideBrace = this.addBar(
                        barDepth * 0.72, diagonalLength, barWidth * 0.72,
                        side * (width / 2 - barDepth / 2), y, 0, brightness
                    );
                    LIBS.rotateX(sideBrace.MOVE_MATRIX, -direction * diagonalAngle);
                }
            }
        }
    }

    addBar(width, height, depth, x, y, z, brightness) {
        const shape = Shape.box(width, height, depth);
        const bar = new MyObject(this.GL, this.SHADER_PROGRAM, this.locations);
        bar.vertex = shape.vertices;
        bar.normals = shape.normals;
        bar.faces = shape.indices;
        bar.brightness = brightness;
        bar.hatching = 4;
        LIBS.set_position(bar.POSITION_MATRIX, x, y, z);
        this.childs.push(bar);
        return bar;
    }
}
