// MyObject.js : satu bagian tubuh karakter (node pada hierarki)
//
// POSITION_MATRIX = letak tetap terhadap induk (titik sendi)
// MOVE_MATRIX     = pose/gerakan, diisi ulang tiap frame
// childs          = anak-anaknya, ikut bergerak bersama induk
//
// urutan matriks (konvensi baris LIBS): MODEL = MOVE x POSITION x induk

const STRIDE = 24;          // 6 float per titik (x y z nx ny nz) x 4 byte
const NORMAL_OFFSET = 12;

export class MyObject {
    GL = null;
    SHADER_PROGRAM = null;
    locations = null;           // { position, normal, model, color, hatching }

    vertex = [];
    normals = [];
    faces = [];
    brightness = 0.8;           // abu-abu 0..1
    hatching = 1;               // 1 = ada arsiran, 0 = polos

    OBJECT_VERTEX = null;
    OBJECT_FACES = null;

    POSITION_MATRIX = LIBS.get_I4();
    MOVE_MATRIX = LIBS.get_I4();
    MODEL_MATRIX = LIBS.get_I4();

    childs = [];

    constructor(GL, SHADER_PROGRAM, locations) {
        this.GL = GL;
        this.SHADER_PROGRAM = SHADER_PROGRAM;
        this.locations = locations;
    }

    hasShape() {
        return this.faces.length > 0;
    }

    // posisi dan normal digabung selang-seling
    interleave() {
        const data = new Float32Array((this.vertex.length / 3) * 6);
        let w = 0;
        for (let i = 0; i < this.vertex.length; i += 3) {
            data[w++] = this.vertex[i];
            data[w++] = this.vertex[i + 1];
            data[w++] = this.vertex[i + 2];
            data[w++] = this.normals[i];
            data[w++] = this.normals[i + 1];
            data[w++] = this.normals[i + 2];
        }
        return data;
    }

    // kirim bentuk ke GPU (bagian ini dan semua anak)
    setup() {
        const GL = this.GL;

        if (this.hasShape()) {
            this.OBJECT_VERTEX = GL.createBuffer();
            GL.bindBuffer(GL.ARRAY_BUFFER, this.OBJECT_VERTEX);
            GL.bufferData(GL.ARRAY_BUFFER, this.interleave(), GL.STATIC_DRAW);

            this.OBJECT_FACES = GL.createBuffer();
            GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, this.OBJECT_FACES);
            GL.bufferData(GL.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.faces), GL.STATIC_DRAW);
        }

        for (const child of this.childs) child.setup();
    }

    updateModel(parentMatrix) {
        const local = LIBS.multiply(this.MOVE_MATRIX, this.POSITION_MATRIX);
        this.MODEL_MATRIX = LIBS.multiply(local, parentMatrix);
        return this.MODEL_MATRIX;
    }

    draw() {
        const GL = this.GL, loc = this.locations;

        GL.useProgram(this.SHADER_PROGRAM);
        GL.uniformMatrix4fv(loc.model, false, this.MODEL_MATRIX);
        GL.uniform3f(loc.color, this.brightness, this.brightness, this.brightness);
        GL.uniform1f(loc.hatching, this.hatching);

        GL.bindBuffer(GL.ARRAY_BUFFER, this.OBJECT_VERTEX);
        GL.vertexAttribPointer(loc.position, 3, GL.FLOAT, false, STRIDE, 0);
        GL.vertexAttribPointer(loc.normal, 3, GL.FLOAT, false, STRIDE, NORMAL_OFFSET);

        GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, this.OBJECT_FACES);
        GL.drawElements(GL.TRIANGLES, this.faces.length, GL.UNSIGNED_SHORT, 0);
    }

    // akar dipanggil dengan LIBS.get_I4()
    render(parentMatrix) {
        const model = this.updateModel(parentMatrix);
        if (this.hasShape()) this.draw();
        for (const child of this.childs) child.render(model);
    }
}