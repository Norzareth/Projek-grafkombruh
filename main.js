// main.js : setup WebGL, kamera, mouse, dan loop render. Karakter dibuat di Character.js
import { Character } from "./Character.js";
import { Environment } from "./environment.js";
import { Character as Tank } from "./tank/Character.js";   // karakter kedua (tank)

// ===== SHADER (cahaya sederhana + arsiran abu-abu) =====
const VERTEX_SHADER = `
    attribute vec3 a_position;
    attribute vec3 a_normal;
    attribute vec3 a_vertexColor;
    uniform mat4 u_projection;
    uniform mat4 u_view;
    uniform mat4 u_model;
    varying vec3 v_normal;
    varying vec3 v_vertexColor;
    void main(void) {
        gl_Position = u_projection * u_view * u_model * vec4(a_position, 1.0);
        v_normal = mat3(u_view * u_model) * a_normal;
        v_vertexColor = a_vertexColor;
    }
`;

const FRAGMENT_SHADER = `
    precision mediump float;
    varying vec3 v_normal;
    varying vec3 v_vertexColor;
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
        vec3 color = u_color * v_vertexColor * shade;

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
        vertexColor: GL.getAttribLocation(SHADER_PROGRAM, "a_vertexColor"),
        model:    GL.getUniformLocation(SHADER_PROGRAM, "u_model"),
        color:    GL.getUniformLocation(SHADER_PROGRAM, "u_color"),
        hatching: GL.getUniformLocation(SHADER_PROGRAM, "u_hatch")
    };
    GL.enableVertexAttribArray(locations.position);
    GL.enableVertexAttribArray(locations.normal);
    GL.enableVertexAttribArray(locations.vertexColor);

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

    /*===== FREECAM (click to capture mouse; Esc to release) =====*/
    const camera = { x: 0, y: 3, z: 18, yaw: 0, pitch: -0.12 };
    const pressedKeys = new Set();
    let moveSpeed = 12;
    const MOVE_SPEED_MIN = 1;
    const MOVE_SPEED_MAX = 60;
    const MOUSE_SENSITIVITY = 0.0025;
    const PITCH_LIMIT = Math.PI / 2 - 0.01;
    const controls = document.getElementById("cameraControls");
    const updateControls = () => {
        const cameraHint = document.pointerLockElement === CANVAS
            ? "WASD move  |  Space rise  |  Shift descend  |  Esc release mouse"
            : "Click to control camera  |  WASD move  |  Space rise  |  Shift descend";
        controls.textContent = `${cameraHint}  |  Wheel speed: ${moveSpeed.toFixed(1)}`;
    };
    updateControls();

    CANVAS.addEventListener("click", () => {
        if (document.pointerLockElement !== CANVAS) CANVAS.requestPointerLock();
    });
    document.addEventListener("pointerlockchange", () => {
        pressedKeys.clear();
        updateControls();
    });
    document.addEventListener("mousemove", event => {
        if (document.pointerLockElement !== CANVAS) return;
        camera.yaw -= event.movementX * MOUSE_SENSITIVITY;
        camera.pitch = Math.max(
            -PITCH_LIMIT,
            Math.min(PITCH_LIMIT, camera.pitch - event.movementY * MOUSE_SENSITIVITY)
        );
    });
    document.addEventListener("wheel", event => {
        if (document.pointerLockElement !== CANVAS) return;
        event.preventDefault();
        const delta = event.deltaY * (event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16
            : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? CANVAS.clientHeight : 1);
        moveSpeed = Math.max(MOVE_SPEED_MIN, Math.min(MOVE_SPEED_MAX, moveSpeed - delta * 0.02));
        updateControls();
    }, { passive: false });
    window.addEventListener("keydown", event => {
        const key = event.key.toLowerCase();
        if (!["w", "a", "s", "d", " ", "shift"].includes(key)) return;
        if (document.pointerLockElement !== CANVAS) return;
        event.preventDefault();
        pressedKeys.add(key);
    });
    window.addEventListener("keyup", event => pressedKeys.delete(event.key.toLowerCase()));
    window.addEventListener("blur", () => pressedKeys.clear());
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
    let previousFrameTime = startTime;
    const animate = () => {
        const now = performance.now();
        const deltaTime = Math.min((now - previousFrameTime) / 1000, 0.1);
        previousFrameTime = now;

        const forward = Number(pressedKeys.has("w")) - Number(pressedKeys.has("s"));
        const strafe = Number(pressedKeys.has("d")) - Number(pressedKeys.has("a"));
        const moveLength = Math.hypot(forward, strafe) || 1;
        camera.x += (-Math.sin(camera.yaw) * forward + Math.cos(camera.yaw) * strafe)
            * moveSpeed * deltaTime / moveLength;
        camera.z += (-Math.cos(camera.yaw) * forward - Math.sin(camera.yaw) * strafe)
            * moveSpeed * deltaTime / moveLength;
        camera.y += (Number(pressedKeys.has(" ")) - Number(pressedKeys.has("shift")))
            * moveSpeed * deltaTime;

        GL.clearColor(1, 1, 1, 1);
        GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);

        const VIEWMATRIX = LIBS.get_I4();
        LIBS.rotateY(VIEWMATRIX, -camera.yaw);
        LIBS.rotateX(VIEWMATRIX, -camera.pitch);
        VIEWMATRIX[12] = -(VIEWMATRIX[0] * camera.x + VIEWMATRIX[4] * camera.y + VIEWMATRIX[8] * camera.z);
        VIEWMATRIX[13] = -(VIEWMATRIX[1] * camera.x + VIEWMATRIX[5] * camera.y + VIEWMATRIX[9] * camera.z);
        VIEWMATRIX[14] = -(VIEWMATRIX[2] * camera.x + VIEWMATRIX[6] * camera.y + VIEWMATRIX[10] * camera.z);
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
