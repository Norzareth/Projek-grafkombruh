// main.js : setup WebGL, kamera, mouse, dan loop render. Karakter dibuat di Character.js
import { Character } from "./Character.js";
import { Environment } from "./environment.js";
import { Character as Tank } from "./tank/Character.js";   // karakter kedua (tank)

// ===== SHADER (cahaya sederhana + arsiran abu-abu) =====
const VERTEX_SHADER = `
    attribute vec3 a_position;
    attribute vec3 a_normal;
    uniform mat4 u_projection;
    uniform mat4 u_view;
    uniform mat4 u_model;
    varying vec3 v_normal;
    void main(void) {
        gl_Position = u_projection * u_view * u_model * vec4(a_position, 1.0);
        v_normal = mat3(u_view * u_model) * a_normal;
    }
`;

const FRAGMENT_SHADER = `
    precision mediump float;
    varying vec3 v_normal;
    uniform vec3 u_color;
    uniform float u_hatch;      // 1 = beri arsiran, 0 = polos

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    void main(void) {
        vec3 normal = normalize(v_normal);
        float backFaceDarkness = 1.0;
        if (!gl_FrontFacing) { normal = -normal; backFaceDarkness = 0.55; }

        vec3 lightDirection = normalize(vec3(-0.5, 0.7, 0.8));
        float diffuse = max(dot(normal, lightDirection), 0.0);
        float rim = 1.0 - abs(normal.z);
        float shade = 0.35 + 0.75 * diffuse - 0.25 * rim * rim;
        shade *= backFaceDarkness;
        vec3 color = u_color * shade;

        if (u_hatch > 0.5) {
            vec2 pixel = gl_FragCoord.xy;
            float lineA = step(0.55, sin((pixel.x + pixel.y) * 1.6) * 0.5 + 0.5);
            float lineB = step(0.55, sin((pixel.x - pixel.y) * 1.6) * 0.5 + 0.5);
            float darkness = clamp(1.0 - shade, 0.0, 1.0);
            float hatching = lineA * smoothstep(0.25, 0.5, darkness) * 0.35
                           + lineB * smoothstep(0.5, 0.8, darkness) * 0.35;
            float grain = (hash(floor(pixel)) - 0.5) * 0.08;
            color = color * (1.0 - hatching) + grain;
        }
        gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
`;

// ===== LETAK TANK di dalam maze (satuan dunia) =====
const TANK = {
    x: 11, z: 6,               // posisi di ruang awal (karakter pertama ada di 0, 0)
    scale: 3,                  // tank asli kecil (~2 satuan), diperbesar agar sepadan
    footY: -1.43,              // tinggi telapak kaki tank pada ukuran aslinya (ditaruh tepat di lantai)
    faceCharacter: true        // true = moncong menghadap karakter pertama
};

function main() {
    /*===== CANVAS & WEBGL =====*/
    const CANVAS = document.getElementById("myCanvas");
    CANVAS.width = window.innerWidth;
    CANVAS.height = window.innerHeight;
    const GL = CANVAS.getContext("webgl");

    const compile = (type, source) => {
        const shader = GL.createShader(type);
        GL.shaderSource(shader, source);
        GL.compileShader(shader);
        if (!GL.getShaderParameter(shader, GL.COMPILE_STATUS)) console.error(GL.getShaderInfoLog(shader));
        return shader;
    };
    const SHADER_PROGRAM = GL.createProgram();
    GL.attachShader(SHADER_PROGRAM, compile(GL.VERTEX_SHADER, VERTEX_SHADER));
    GL.attachShader(SHADER_PROGRAM, compile(GL.FRAGMENT_SHADER, FRAGMENT_SHADER));
    GL.linkProgram(SHADER_PROGRAM);
    GL.useProgram(SHADER_PROGRAM);

    const locations = {                  // alamat atribut & uniform di shader
        position: GL.getAttribLocation(SHADER_PROGRAM, "a_position"),
        normal:   GL.getAttribLocation(SHADER_PROGRAM, "a_normal"),
        model:    GL.getUniformLocation(SHADER_PROGRAM, "u_model"),
        color:    GL.getUniformLocation(SHADER_PROGRAM, "u_color"),
        hatching: GL.getUniformLocation(SHADER_PROGRAM, "u_hatch")
    };
    GL.enableVertexAttribArray(locations.position);
    GL.enableVertexAttribArray(locations.normal);

    // proyeksi perspektif
    const _Pmatrix = GL.getUniformLocation(SHADER_PROGRAM, "u_projection");
    const _Vmatrix = GL.getUniformLocation(SHADER_PROGRAM, "u_view");
    const fovY = Math.PI / 4, near = 0.1, far = 2000.0;
    const f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
    const PROJMATRIX = new Float32Array([
        f / (CANVAS.width / CANVAS.height), 0, 0, 0,   0, f, 0, 0,   0, 0, (far + near) * nf, -1,   0, 0, 2 * far * near * nf, 0]);
    GL.uniformMatrix4fv(_Pmatrix, false, PROJMATRIX);

    GL.enable(GL.DEPTH_TEST);
    GL.viewport(0, 0, CANVAS.width, CANVAS.height);

    /*===== KAMERA & MOUSE (drag = putar, scroll = zoom) =====*/
    let rotationX = 0.1, rotationY = -0.55, distance = 15;
    const DISTANCE_MIN = 8, DISTANCE_MAX = 900;     // jauhkan kamera (scroll) untuk melihat seluruh maze
    let dragging = false, lastX = 0, lastY = 0;

    CANVAS.onmousedown = e => { dragging = true; lastX = e.clientX; lastY = e.clientY; };
    window.onmouseup = () => { dragging = false; };
    CANVAS.onmousemove = e => {
        if (!dragging) return;
        rotationY += (e.clientX - lastX) * 0.01;
        rotationX += (e.clientY - lastY) * 0.01;
        lastX = e.clientX; lastY = e.clientY;
    };
    CANVAS.onwheel = e => {
        distance = Math.min(DISTANCE_MAX, Math.max(DISTANCE_MIN, distance + e.deltaY * 0.01));
        e.preventDefault();
    };
    window.onresize = () => {
        CANVAS.width = innerWidth; CANVAS.height = innerHeight;
        GL.viewport(0, 0, CANVAS.width, CANVAS.height);
    };

    /*===== KARAKTER =====*/
    const character = new Character(GL, SHADER_PROGRAM, locations);
    character.setup();                   // kirim semua bagian ke GPU (rekursif lewat childs)

    const environment = new Environment(GL, SHADER_PROGRAM, locations);   // maze (environment.js)
    environment.setup();

    // tank: memakai shader, kamera, dan arsiran yang sama dengan karakter pertama & maze
    const tank = new Tank(GL, SHADER_PROGRAM, locations);
    tank.setup();
    // letak tank: skala -> putar -> geser (urutan ini penting karena LIBS.scale hanya mengisi diagonal)
    LIBS.scaleX(tank.POSITION_MATRIX, TANK.scale);
    LIBS.scaleY(tank.POSITION_MATRIX, TANK.scale);
    LIBS.scaleZ(tank.POSITION_MATRIX, TANK.scale);
    if (TANK.faceCharacter) LIBS.rotateY(tank.POSITION_MATRIX, Math.atan2(TANK.x, TANK.z));   // moncong tank ke -z lokal
    LIBS.set_position(tank.POSITION_MATRIX, TANK.x, environment.floorY - TANK.footY * TANK.scale, TANK.z);

    const startTime = performance.now();
    const animate = () => {
        GL.clearColor(1, 1, 1, 1);
        GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);

        // kamera: urutan pemanggilan = urutan terjadinya (putar Y, putar X, geser mundur)
        const VIEWMATRIX = LIBS.get_I4();
        LIBS.rotateY(VIEWMATRIX, rotationY);
        LIBS.rotateX(VIEWMATRIX, rotationX);
        LIBS.translateY(VIEWMATRIX, 0.5);
        LIBS.translateZ(VIEWMATRIX, -distance);
        GL.uniformMatrix4fv(_Vmatrix, false, VIEWMATRIX);

        character.animasi((performance.now() - startTime) / 1000);   // detik
        character.render(LIBS.get_I4());                              // akar dipanggil dengan matriks identitas
        environment.render(LIBS.get_I4());

        // tank (shader & kamera sama)
        tank.animasi(performance.now());                              // tank memakai milidetik
        tank.render(LIBS.get_I4());

        window.requestAnimationFrame(animate);
    };
    animate();
}
window.addEventListener("load", main);
