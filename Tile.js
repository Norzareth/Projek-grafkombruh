import { MyObject } from "./MyObject.js";

export class Tile extends MyObject {
    constructor(GL, SHADER_PROGRAM, locations, config) {
        super(GL, SHADER_PROGRAM, locations);

        const { x, y, z, width, depth, image, opacity = 1 } = config;
        if (![x, y, z, width, depth, opacity].every(Number.isFinite)
            || width <= 0 || depth <= 0 || opacity < 0 || opacity > 1) {
            throw new Error("Tile requires finite coordinates, positive dimensions, and opacity from 0 to 1.");
        }
        if (typeof image !== "string" || image.trim() === "") {
            throw new Error("Tile requires a PNG file URL or PNG data URL.");
        }

        this.vertex = [
            -width / 2, 0, -depth / 2,
            width / 2, 0, -depth / 2,
            width / 2, 0, depth / 2,
            -width / 2, 0, depth / 2
        ];
        this.normals = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];
        this.vertexUVs = [0, 0, 1, 0, 1, 1, 0, 1];
        this.faces = [0, 2, 1, 0, 3, 2];
        this.brightness = 0.85;
        this.hatching = 2;
        this.transparent = true;
        this.opacity = opacity;
        this.imageSource = image;
        this.textureReady = false;
        this.visible = false;
        LIBS.set_position(this.POSITION_MATRIX, x, y, z);
    }

    setup() {
        super.setup();

        this.texture = this.GL.createTexture();
        if (!this.texture) throw new Error("Could not create the tile texture.");

        this.GL.bindTexture(this.GL.TEXTURE_2D, this.texture);
        this.GL.texParameteri(this.GL.TEXTURE_2D, this.GL.TEXTURE_MIN_FILTER, this.GL.LINEAR);
        this.GL.texParameteri(this.GL.TEXTURE_2D, this.GL.TEXTURE_MAG_FILTER, this.GL.LINEAR);
        this.GL.texParameteri(this.GL.TEXTURE_2D, this.GL.TEXTURE_WRAP_S, this.GL.CLAMP_TO_EDGE);
        this.GL.texParameteri(this.GL.TEXTURE_2D, this.GL.TEXTURE_WRAP_T, this.GL.CLAMP_TO_EDGE);
        this.GL.bindTexture(this.GL.TEXTURE_2D, null);

        const image = new Image();
        image.onload = () => {
            this.GL.bindTexture(this.GL.TEXTURE_2D, this.texture);
            this.GL.pixelStorei(this.GL.UNPACK_FLIP_Y_WEBGL, true);
            this.GL.texImage2D(
                this.GL.TEXTURE_2D,
                0,
                this.GL.RGBA,
                this.GL.RGBA,
                this.GL.UNSIGNED_BYTE,
                image
            );
            this.GL.pixelStorei(this.GL.UNPACK_FLIP_Y_WEBGL, false);
            this.GL.bindTexture(this.GL.TEXTURE_2D, null);
            this.textureReady = true;
            this.visible = true;
        };
        image.onerror = () => {
            console.error(`Could not load tile image: ${this.imageSource}`);
        };
        image.src = this.imageSource;
    }
}
