// MyObject.js : satu bagian karakter (node pada pohon hierarki)
//
//   POSITION_MATRIX : letak TETAP terhadap induk (titik sendi)
//   MOVE_MATRIX     : pose / gerakan, diisi ulang tiap frame
//   childs          : anak-anaknya, diisi dengan  induk.childs.push(anak)
//
//   render(PARENT_MATRIX):  MODEL = PARENT x POSITION x MOVE, gambar bentuknya,
//   lalu render semua anak memakai MODEL milik sendiri -> anak selalu ikut induknya.
export class MyObject {
    GL = null;
    SHADER_PROGRAM = null;
    locations = null;                 // alamat atribut & uniform shader { position, normal, model, color, hatching }

    // bentuk: vertex & normal = x,y,z per titik; faces = indeks segitiga
    vertex = [];
    normals = [];
    vertexColors = [];
    vertexUVs = [];
    faces = [];
    brightness = 0.8;                 // kecerahan abu-abu (0..1)
    color = null;                     // [r, g, b] bila bagian ini berwarna (mengganti abu-abu)
    hatching = 1;                     // 1 = beri arsiran, 0 = polos
    visible = true;
    transparent = false;

    OBJECT_VERTEX = null;
    OBJECT_COLOR = null;
    OBJECT_FACES = null;
    OBJECT_UV = null;
    texture = null;

    POSITION_MATRIX = LIBS.get_I4();
    MOVE_MATRIX = LIBS.get_I4();
    MODEL_MATRIX = LIBS.get_I4();

    childs = [];

    constructor(GL, SHADER_PROGRAM, locations) {
        this.GL = GL;
        this.SHADER_PROGRAM = SHADER_PROGRAM;
        this.locations = locations;
    }

    // kirim bentuk ke GPU (objek ini + semua anaknya)
    setup() {
        const data = [];              // per titik: x y z nx ny nz
        for (let i = 0; i < this.vertex.length; i += 3) {
            data.push(this.vertex[i], this.vertex[i + 1], this.vertex[i + 2],
                      this.normals[i], this.normals[i + 1], this.normals[i + 2]);
        }
        this.OBJECT_VERTEX = this.GL.createBuffer();
        this.GL.bindBuffer(this.GL.ARRAY_BUFFER, this.OBJECT_VERTEX);
        this.GL.bufferData(this.GL.ARRAY_BUFFER, new Float32Array(data), this.GL.STATIC_DRAW);

        const colors = [];
        for (let i = 0; i < this.vertex.length; i += 3) {
            colors.push(
                this.vertexColors[i] ?? 1,
                this.vertexColors[i + 1] ?? 1,
                this.vertexColors[i + 2] ?? 1
            );
        }
        this.OBJECT_COLOR = this.GL.createBuffer();
        this.GL.bindBuffer(this.GL.ARRAY_BUFFER, this.OBJECT_COLOR);
        this.GL.bufferData(this.GL.ARRAY_BUFFER, new Float32Array(colors), this.GL.STATIC_DRAW);

        this.OBJECT_FACES = this.GL.createBuffer();
        this.GL.bindBuffer(this.GL.ELEMENT_ARRAY_BUFFER, this.OBJECT_FACES);
        this.GL.bufferData(this.GL.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.faces), this.GL.STATIC_DRAW);

        if (this.vertexUVs.length > 0) {
            this.OBJECT_UV = this.GL.createBuffer();
            this.GL.bindBuffer(this.GL.ARRAY_BUFFER, this.OBJECT_UV);
            this.GL.bufferData(this.GL.ARRAY_BUFFER, new Float32Array(this.vertexUVs), this.GL.STATIC_DRAW);
        }

        this.childs.forEach(child => child.setup());
    }

    render(PARENT_MATRIX) {
        if (!this.visible) return;

        this.MODEL_MATRIX = LIBS.multiply(this.MOVE_MATRIX, this.POSITION_MATRIX);
        this.MODEL_MATRIX = LIBS.multiply(this.MODEL_MATRIX, PARENT_MATRIX);

        if (this.faces.length > 0) {  // objek kosong (akar) hanya meneruskan transformasi
            if (this.transparent) {
                this.GL.enable(this.GL.BLEND);
                this.GL.blendFunc(this.GL.SRC_ALPHA, this.GL.ONE_MINUS_SRC_ALPHA);
                this.GL.depthMask(false);
            }
            this.GL.useProgram(this.SHADER_PROGRAM);
            this.GL.uniformMatrix4fv(this.locations.model, false, this.MODEL_MATRIX);
            const [r, g, b] = this.color || [this.brightness, this.brightness, this.brightness];
            this.GL.uniform3f(this.locations.color, r, g, b);
            this.GL.uniform1f(this.locations.hatching, this.hatching);
            const hasTexture = Boolean(this.textureReady && this.OBJECT_UV);
            this.GL.uniform1f(this.locations.hasTexture, hasTexture ? 1 : 0);
            this.GL.uniform1f(this.locations.textureOpacity, this.opacity ?? 1);

            this.GL.bindBuffer(this.GL.ARRAY_BUFFER, this.OBJECT_VERTEX);
            this.GL.vertexAttribPointer(this.locations.position, 3, this.GL.FLOAT, false, 24, 0);    // 6 angka x 4 byte
            this.GL.vertexAttribPointer(this.locations.normal, 3, this.GL.FLOAT, false, 24, 12);

            this.GL.bindBuffer(this.GL.ARRAY_BUFFER, this.OBJECT_COLOR);
            this.GL.vertexAttribPointer(this.locations.vertexColor, 3, this.GL.FLOAT, false, 0, 0);

            if (hasTexture) {
                this.GL.activeTexture(this.GL.TEXTURE0);
                this.GL.bindTexture(this.GL.TEXTURE_2D, this.texture);
                this.GL.uniform1i(this.locations.texture, 0);
                this.GL.bindBuffer(this.GL.ARRAY_BUFFER, this.OBJECT_UV);
                this.GL.vertexAttribPointer(this.locations.uv, 2, this.GL.FLOAT, false, 0, 0);
                this.GL.enableVertexAttribArray(this.locations.uv);
            } else {
                this.GL.disableVertexAttribArray(this.locations.uv);
                this.GL.vertexAttrib2f(this.locations.uv, 0, 0);
            }

            this.GL.bindBuffer(this.GL.ELEMENT_ARRAY_BUFFER, this.OBJECT_FACES);
            this.GL.drawElements(this.GL.TRIANGLES, this.faces.length, this.GL.UNSIGNED_SHORT, 0);
            if (this.transparent) {
                this.GL.depthMask(true);
                this.GL.disable(this.GL.BLEND);
            }
        }

        this.childs.forEach(child => child.render(this.MODEL_MATRIX));
    }
}
