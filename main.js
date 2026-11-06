// main.js : setup WebGL, kamera, mouse, dan loop render untuk environment dan karakter.
import { Character as Mouthe } from "./Mouthe/Character.js";   // karakter pertama (Mouthe)
import { Environment } from "./environment.js";
import { Character as Gundog } from "./Gundog/Character.js";   // karakter kedua (Gundog)
import { Character as Knifo } from "./Knifo/Character.js";     // karakter ketiga (Knifo)

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
    varying vec3 v_worldPosition;
    varying vec3 v_worldNormal;
    void main(void) {
        vec4 worldPosition = u_model * vec4(a_position, 1.0);
        gl_Position = u_projection * u_view * worldPosition;
        v_normal = mat3(u_view * u_model) * a_normal;
        v_vertexColor = a_vertexColor;
        v_worldPosition = worldPosition.xyz;
        v_worldNormal = mat3(u_model) * a_normal;
    }
`;

const FRAGMENT_SHADER = `
    precision mediump float;
    varying vec3 v_normal;
    varying vec3 v_vertexColor;
    varying vec3 v_worldPosition;
    varying vec3 v_worldNormal;
    uniform vec3 u_color;
    uniform float u_hatch;      // material: 2 lantai, 3 dinding, 4 rangka pilar
    uniform vec3 u_redLightPosition;
    uniform vec3 u_redLightDirection;
    uniform float u_redLightEnabled;
    uniform float u_redLightRange;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    float valueNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
            f.y
        );
    }

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

        if (u_hatch > 4.5) {
            float beamPulse = 0.9 + 0.1 * sin(v_worldPosition.z * 2.0);
            gl_FragColor = vec4(vec3(1.0, 0.015, 0.01) * beamPulse, 0.2);
            return;
        }

        vec3 fromLight = v_worldPosition - u_redLightPosition;
        float lightDistance = length(fromLight);
        vec3 lightRay = fromLight / max(lightDistance, 0.0001);
        float cone = smoothstep(0.82, 0.96, dot(normalize(u_redLightDirection), lightRay));
        float reach = 1.0 - smoothstep(u_redLightRange * 0.65, u_redLightRange, lightDistance);
        vec3 worldNormal = normalize(v_worldNormal) * (gl_FrontFacing ? 1.0 : -1.0);
        float redIllumination = max(dot(worldNormal, -lightRay), 0.0) * cone * reach * u_redLightEnabled;
        color += vec3(1.0, 0.015, 0.01) * redIllumination * 2.0;

        if (u_hatch > 1.5 && u_hatch < 2.5) {
            vec2 surface = v_worldPosition.xz * 0.42;
            float broad = valueNoise(surface * 0.22);
            float grain = valueNoise(surface * 2.8);
            float fine = hash(floor(surface * 18.0));
            float scuff = valueNoise(vec2(surface.x * 0.55 + surface.y * 0.18, surface.y * 3.0));
            float mottling = broad * 0.48 + grain * 0.30 + fine * 0.14 + scuff * 0.08;
            float seams = smoothstep(0.0, 0.055, min(
                min(fract(v_worldPosition.x / 7.0), 1.0 - fract(v_worldPosition.x / 7.0)),
                min(fract(v_worldPosition.z / 7.0), 1.0 - fract(v_worldPosition.z / 7.0))
            ));
            float floorTexture = mix(0.52 + mottling * 0.72, 0.32 + mottling * 0.38, 1.0 - seams);
            color *= floorTexture;
        } else if (u_hatch > 2.5 && u_hatch < 3.5) {
            vec3 weights = pow(abs(normalize(v_worldNormal)), vec3(4.0));
            weights /= max(weights.x + weights.y + weights.z, 0.0001);
            vec2 surfaceX = v_worldPosition.zy * vec2(0.72, 0.48);
            vec2 surfaceY = v_worldPosition.xz * vec2(0.72, 0.72);
            vec2 surfaceZ = v_worldPosition.xy * vec2(0.72, 0.48);
            float broad = valueNoise(surfaceX * 0.18) * weights.x
                        + valueNoise(surfaceY * 0.18) * weights.y
                        + valueNoise(surfaceZ * 0.18) * weights.z;
            float medium = valueNoise(surfaceX * vec2(1.8, 2.7)) * weights.x
                         + valueNoise(surfaceY * 1.8) * weights.y
                         + valueNoise(surfaceZ * vec2(1.8, 2.7)) * weights.z;
            float grit = hash(floor(surfaceX * 22.0)) * weights.x
                       + hash(floor(surfaceY * 22.0)) * weights.y
                       + hash(floor(surfaceZ * 22.0)) * weights.z;
            float verticalStreak = valueNoise(vec2(surfaceX.x * 0.22, surfaceX.y * 3.5)) * weights.x
                                 + valueNoise(vec2(surfaceY.x * 0.22, surfaceY.y * 3.5)) * weights.y
                                 + valueNoise(vec2(surfaceZ.x * 0.22, surfaceZ.y * 3.5)) * weights.z;
            float scratchX = valueNoise(vec2(surfaceX.x * 6.0, surfaceX.y * 0.35));
            float scratchY = valueNoise(vec2(surfaceY.x * 6.0, surfaceY.y * 0.35));
            float scratchZ = valueNoise(vec2(surfaceZ.x * 6.0, surfaceZ.y * 0.35));
            float scratches = smoothstep(0.72, 0.96,
                scratchX * weights.x + scratchY * weights.y + scratchZ * weights.z);
            float grime = broad * 0.35 + medium * 0.35 + grit * 0.18 + verticalStreak * 0.12;
            color *= 0.38 + grime * 0.78 - scratches * 0.12;
        } else if (u_hatch > 3.5) {
            vec2 surface = v_worldPosition.xy * 1.7 + v_worldPosition.zy * 0.7;
            float oxide = valueNoise(surface * 0.32) * 0.52
                        + valueNoise(surface * 2.4) * 0.32
                        + hash(floor(surface * 14.0)) * 0.16;
            color *= 0.38 + oxide * 0.72;
        } else if (u_hatch > 0.5) {
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

// Koordinat karakter memakai posisi dunia X/Z (Y dihitung dari FLOOR_Y dan footY).
// Batas ruang dari MAZE_LAYOUT saat ini, format X[min, max], Z[min, max]:
// R1: X[-32, 32],   Z[-32, 32]       R2: X[-136, -72], Z[52, 116]
// R3: X[72, 136],   Z[52, 116]        R4: X[-220, -156], Z[108, 172]
// R5: X[-220, -156], Z[-4, 60]        R6: X[156, 220], Z[108, 172]
// R7: X[156, 220], Z[-4, 60]
// Atur posisi karakter secara manual hanya dengan x dan z.
const GUNDOG = {
    x: 110, z: 6,
    footY: -1.7,
    faceCharacter: true,
    target: "knifo",
    rotationY: 0 // rotasi tambahan di sumbu Y, radian (90 derajat = Math.PI / 2)
};
const KNIFO = {
    x: 75, z: 80,
    footY: 0,
    faceCharacter: false,
    target: "mouthe",
    rotationY: 4.85
};
const MOUTHE = {
    x: -190, z: 125,
    footY: -5.88,
    faceCharacter: false,
    target: "knifo",
    rotationY: 0
};
const CHARACTER_PLACEMENTS = { mouthe: MOUTHE, gundog: GUNDOG, knifo: KNIFO };
const CHARACTER_FORWARD = { mouthe: 1, gundog: -1, knifo: 1 };

function characterYaw(name) {
    const character = CHARACTER_PLACEMENTS[name];
    const rotationY = character.rotationY ?? 0;
    if (!Number.isFinite(rotationY)) throw new Error(`${name}.rotationY must be a finite angle in radians.`);
    if (!character.faceCharacter) return rotationY;

    const target = CHARACTER_PLACEMENTS[character.target];
    if (!target || target === character) {
        throw new Error(`Invalid facing target "${character.target}" for ${name}.`);
    }

    const dx = target.x - character.x;
    const dz = target.z - character.z;
    if (dx === 0 && dz === 0) return rotationY;

    const forward = CHARACTER_FORWARD[name];
    return Math.atan2(forward * dx, forward * dz) + rotationY;
}
const CHARACTER_YAWS = {
    mouthe: characterYaw("mouthe"),
    gundog: characterYaw("gundog"),
    knifo: characterYaw("knifo")
};

function validateCharacterPositions() {
    for (const [name, position] of Object.entries(CHARACTER_PLACEMENTS)) {
        if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) {
            throw new Error(`${name} position requires finite x and z coordinates.`);
        }
    }
}

// Skala seragam per karakter. Ubah angka ini untuk memperbesar atau memperkecil model.
const CHARACTER_SCALE = {
    mouthe: 1,
    gundog: 3,
    knifo: 3
};
// Pengali kecepatan animasi: 1 = normal, 2 = dua kali lebih cepat,
// 0.5 = setengah kecepatan. Nilai 0 menghentikan animasi tanpa mematikan toggle.
const ANIMATION_SPEED = {
    mouthe: 2,
    gundog: 1,
    knifo: 3
};
const MOUTHE_FOOT_Y = -5.88; // perkiraan posisi telapak Mouthe dari akar pada pose berdiri
const CHARACTER_FORWARD_SPEED = 20; // satuan dunia per detik
// Gerak maju dan rotasi otomatis tiap karakter.
// forward.distance dalam satuan dunia; rotation.angle dalam radian.
// rotation.direction: 1 = putar positif Y (dari +Z menuju +X), -1 = arah sebaliknya.
// rotation.speed dalam radian per detik.
const CHARACTER_MOTION = {
    mouthe: {
        forward: { distance: 1000, speed: CHARACTER_FORWARD_SPEED },
        rotation: { direction: 1, angle: Math.PI * 2, speed: Math.PI / 4 }
    },
    gundog: {
        forward: { distance: 30, speed: CHARACTER_FORWARD_SPEED },
        rotation: { direction: 1, angle: Math.PI * 2, speed: Math.PI / 4 }
    },
    knifo: {
        forward: { distance: 100, speed: CHARACTER_FORWARD_SPEED },
        rotation: { direction: 1, angle: Math.PI / 2, speed: Math.PI / 2 }
    }
};
const KNIFO_SCENE = {
    autoStart: true,
    sequencePending: true
};

if (Object.values(ANIMATION_SPEED).some(speed => !Number.isFinite(speed) || speed < 0)) {
    throw new Error("ANIMATION_SPEED values must be finite numbers greater than or equal to 0.");
}
for (const [name, motion] of Object.entries(CHARACTER_MOTION)) {
    if (!Number.isFinite(motion.forward.distance) || motion.forward.distance < 0
        || !Number.isFinite(motion.forward.speed)
        || (motion.forward.distance > 0 && motion.forward.speed <= 0)
        || ![-1, 1].includes(motion.rotation.direction)
        || !Number.isFinite(motion.rotation.angle) || motion.rotation.angle < 0
        || !Number.isFinite(motion.rotation.speed)
        || (motion.rotation.angle > 0 && motion.rotation.speed <= 0)) {
        throw new Error(`Invalid forward or rotation settings for ${name}.`);
    }
}

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
        hatching: GL.getUniformLocation(SHADER_PROGRAM, "u_hatch"),
        redLightPosition: GL.getUniformLocation(SHADER_PROGRAM, "u_redLightPosition"),
        redLightDirection: GL.getUniformLocation(SHADER_PROGRAM, "u_redLightDirection"),
        redLightEnabled: GL.getUniformLocation(SHADER_PROGRAM, "u_redLightEnabled"),
        redLightRange: GL.getUniformLocation(SHADER_PROGRAM, "u_redLightRange")
    };
    GL.enableVertexAttribArray(locations.position);
    GL.enableVertexAttribArray(locations.normal);
    GL.enableVertexAttribArray(locations.vertexColor);
    GL.uniform3f(locations.redLightPosition, 0, 0, 0);
    GL.uniform3f(locations.redLightDirection, 0, 0, -1);
    GL.uniform1f(locations.redLightEnabled, 0);
    GL.uniform1f(locations.redLightRange, 48);

    // proyeksi perspektif
    const _Pmatrix = GL.getUniformLocation(SHADER_PROGRAM, "u_projection");
    const _Vmatrix = GL.getUniformLocation(SHADER_PROGRAM, "u_view");
    const near = 0.1, far = 2000.0;
    const fovSlider = document.getElementById("fovSlider");
    const fovValue = document.getElementById("fovValue");
    let fovY = Number(fovSlider.value) * Math.PI / 180;
    const updateProjection = () => {
        fovY = Number(fovSlider.value) * Math.PI / 180;
        const f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
        const projection = new Float32Array([
            f / (CANVAS.width / CANVAS.height), 0, 0, 0,
            0, f, 0, 0,
            0, 0, (far + near) * nf, -1,
            0, 0, 2 * far * near * nf, 0
        ]);
        GL.uniformMatrix4fv(_Pmatrix, false, projection);
        fovValue.textContent = `${fovSlider.value}°`;
    };
    fovSlider.addEventListener("input", updateProjection);
    updateProjection();

    GL.enable(GL.DEPTH_TEST);
    GL.viewport(0, 0, CANVAS.width, CANVAS.height);

    /*===== FREECAM (click to capture mouse; Esc to release) =====*/
    const camera = { x: 0, y: 3, z: 18, yaw: 0, pitch: -0.12 };
    const CAMERA_STORAGE_KEY = "projek-grafkombruh.camera.v1";
    const pressedKeys = new Set();
    let moveSpeed = 12;
    const MOVE_SPEED_MIN = 1;
    const MOVE_SPEED_MAX = 1000;
    const MOUSE_SENSITIVITY = 0.0025;
    let lookSensitivity = 1;
    const LOOK_SENSITIVITY_STEP = 0.1;
    const LOOK_SENSITIVITY_MIN = 0.1;
    const LOOK_SENSITIVITY_MAX = 4;
    const PITCH_LIMIT = Math.PI / 2 - 0.01;
    let cameraStorageAvailable = true;
    try {
        const savedCamera = sessionStorage.getItem(CAMERA_STORAGE_KEY);
        if (savedCamera) {
            const state = JSON.parse(savedCamera);
            const values = [state.x, state.y, state.z, state.yaw, state.pitch, state.moveSpeed, state.lookSensitivity];
            if (!values.every(Number.isFinite)) throw new Error("Saved camera state contains invalid values.");
            Object.assign(camera, {
                x: state.x,
                y: state.y,
                z: state.z,
                yaw: state.yaw,
                pitch: Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, state.pitch))
            });
            moveSpeed = Math.max(MOVE_SPEED_MIN, Math.min(MOVE_SPEED_MAX, state.moveSpeed));
            lookSensitivity = Math.max(LOOK_SENSITIVITY_MIN, Math.min(LOOK_SENSITIVITY_MAX, state.lookSensitivity));
        }
    } catch (error) {
        console.warn("Could not restore saved camera state; using the default camera.", error);
        try {
            sessionStorage.removeItem(CAMERA_STORAGE_KEY);
        } catch (storageError) {
            cameraStorageAvailable = false;
            console.warn("Could not access session storage for the camera.", storageError);
        }
    }
    const saveCameraState = () => {
        if (!cameraStorageAvailable) return;
        try {
            sessionStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify({
                x: camera.x,
                y: camera.y,
                z: camera.z,
                yaw: camera.yaw,
                pitch: camera.pitch,
                moveSpeed,
                lookSensitivity
            }));
        } catch (error) {
            cameraStorageAvailable = false;
            console.warn("Could not save camera state.", error);
        }
    };
    saveCameraState();
    window.addEventListener("pagehide", saveCameraState);
    let lastCameraSave = performance.now();
    const controls = document.getElementById("cameraControls");
    window.addEventListener("keydown", event => {
        if (event.key.toLowerCase() !== "e" || event.repeat) return;
        document.body.classList.toggle("ui-hidden");
        event.preventDefault();
    });
    const updateControls = () => {
        const cameraHint = document.pointerLockElement === CANVAS
            ? "WASD move  |  Space rise  |  Shift descend  |  E UI  |  Esc release mouse"
            : "Click to control camera  |  WASD move  |  Space rise  |  Shift descend  |  E UI";
        controls.textContent = `${cameraHint}  |  Wheel speed: ${moveSpeed.toFixed(1)}`
            + `  |  -/= look sensitivity: ${lookSensitivity.toFixed(1)}x`;
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
        camera.yaw -= event.movementX * MOUSE_SENSITIVITY * lookSensitivity;
        camera.pitch = Math.max(
            -PITCH_LIMIT,
            Math.min(PITCH_LIMIT, camera.pitch - event.movementY * MOUSE_SENSITIVITY * lookSensitivity)
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
        if (document.pointerLockElement !== CANVAS) return;
        if (event.code === "Minus" || key === "-") {
            if (!event.repeat) {
                lookSensitivity = Math.max(LOOK_SENSITIVITY_MIN, lookSensitivity - LOOK_SENSITIVITY_STEP);
                updateControls();
            }
            event.preventDefault();
            return;
        }
        if (event.code === "Equal" || key === "=") {
            if (!event.repeat) {
                lookSensitivity = Math.min(LOOK_SENSITIVITY_MAX, lookSensitivity + LOOK_SENSITIVITY_STEP);
                updateControls();
            }
            event.preventDefault();
            return;
        }
        if (!["w", "a", "s", "d", " ", "shift"].includes(key)) return;
        event.preventDefault();
        pressedKeys.add(key);
    });
    window.addEventListener("keyup", event => pressedKeys.delete(event.key.toLowerCase()));
    window.addEventListener("blur", () => pressedKeys.clear());
    window.onresize = () => {
        CANVAS.width = innerWidth; CANVAS.height = innerHeight;
        GL.viewport(0, 0, CANVAS.width, CANVAS.height);
        updateProjection();
    };

/*===== KARAKTER =====*/

    //
    //mouthe
    // 

    const mouthe = new Mouthe(GL, SHADER_PROGRAM, locations);
    mouthe.setup();                   // kirim semua bagian ke GPU (rekursif lewat childs)
    for (const scale of [LIBS.scaleX, LIBS.scaleY, LIBS.scaleZ]) {
        scale(mouthe.POSITION_MATRIX, CHARACTER_SCALE.mouthe);
    }
    LIBS.rotateY(mouthe.POSITION_MATRIX, CHARACTER_YAWS.mouthe);
    LIBS.set_position(
        mouthe.POSITION_MATRIX,
        MOUTHE.x,
        (1 - CHARACTER_SCALE.mouthe) * MOUTHE.footY,
        MOUTHE.z
    );

    const environment = new Environment(GL, SHADER_PROGRAM, locations);   // maze (environment.js)
    environment.setup();
    validateCharacterPositions();
    const roofToggle = document.getElementById("toggleRoof");
    roofToggle.checked = environment.roof.visible;
    roofToggle.addEventListener("change", () => {
        environment.roof.visible = roofToggle.checked;
        roofToggle.blur();
    });
    window.addEventListener("keydown", event => {
        if (event.key !== "7" || event.repeat) return;
        roofToggle.checked = !roofToggle.checked;
        environment.roof.visible = roofToggle.checked;
        event.preventDefault();
    });


    //
    // gundog: memakai shader, kamera, dan arsiran yang sama dengan karakter pertama & maze
    //

    const gundog = new Gundog(GL, SHADER_PROGRAM, locations);
    gundog.setup();
    // letak gundog: skala -> putar -> geser (urutan ini penting karena LIBS.scale hanya mengisi diagonal)
    LIBS.scaleX(gundog.POSITION_MATRIX, CHARACTER_SCALE.gundog);
    LIBS.scaleY(gundog.POSITION_MATRIX, CHARACTER_SCALE.gundog);
    LIBS.scaleZ(gundog.POSITION_MATRIX, CHARACTER_SCALE.gundog);
    LIBS.rotateY(gundog.POSITION_MATRIX, CHARACTER_YAWS.gundog);
    LIBS.set_position(
        gundog.POSITION_MATRIX,
        GUNDOG.x,
        environment.floorY - GUNDOG.footY * CHARACTER_SCALE.gundog,
        GUNDOG.z
    );
    const lightToggle = document.getElementById("toggleGundogLight");
    lightToggle.checked = gundog.lightOn;
    lightToggle.addEventListener("change", () => {
        gundog.setLightOn(lightToggle.checked);
        lightToggle.blur();
    });
    window.addEventListener("keydown", event => {
        if (event.key.toLowerCase() !== "l" || event.repeat) return;
        gundog.setLightOn(!gundog.lightOn);
        lightToggle.checked = gundog.lightOn;
        event.preventDefault();
    });


    //
    //knifo
    //

    const knifo = new Knifo(GL, SHADER_PROGRAM, locations);
    knifo.setup();
    knifo.setWorld(KNIFO.x, environment.floorY - Knifo.FOOT_Y, KNIFO.z, CHARACTER_YAWS.knifo, CHARACTER_SCALE.knifo);
    knifo.animationOn = true;




    /*===== TOGGLE ANIMASI: satu per karakter, saling terpisah =====
       Tombol [1] atau kotak centang "Mouthe"  -> hanya menyalakan/mematikan animasi Mouthe (karakter pertama)
       Tombol [2] atau kotak centang "Gundog"  -> hanya menyalakan/mematikan animasi Gundog (karakter kedua)
       Tombol [3] atau kotak centang "Knifo"   -> hanya menyalakan/mematikan animasi Knifo (karakter ketiga). */
    const animationToggles = [
        { key: "1", character: mouthe, checkbox: document.getElementById("toggleMouthe") },
        { key: "2", character: gundog, checkbox: document.getElementById("toggleGundog") },
        { key: "3", character: knifo, checkbox: document.getElementById("toggleKnifo") }
    ];
    animationToggles.forEach(toggle => {
        toggle.checkbox.checked = toggle.character.animationOn;
        toggle.checkbox.addEventListener("change", () => {
            toggle.character.animationOn = toggle.checkbox.checked;
            toggle.checkbox.blur();                       // agar tombol Space (naik) tidak ikut menekan kotak ini
        });
    });
    window.addEventListener("keydown", event => {            // bekerja juga saat mouse terkunci (kamera aktif)
        const toggle = animationToggles.find(item => item.key === event.key);
        if (!toggle || event.repeat) return;
        toggle.checkbox.checked = !toggle.checkbox.checked;
        toggle.character.animationOn = toggle.checkbox.checked;
    });

    /*===== TOGGLE GERAK MAJU: terpisah dari animasi pose =====*/
    const forwardFromYaw = (yaw, localDirection = 1) => ({
        x: localDirection * Math.sin(yaw),
        z: localDirection * Math.cos(yaw)
    });
    const movementToggles = [
        {
            key: "4",
            name: "mouthe",
            matrix: mouthe.POSITION_MATRIX,
            checkbox: document.getElementById("moveMouthe"),
            localDirection: 1
        },
        {
            key: "5",
            name: "gundog",
            matrix: gundog.POSITION_MATRIX,
            checkbox: document.getElementById("moveGundog"),
            localDirection: -1
        },
        {
            key: "6",
            name: "knifo",
            matrix: knifo.MOVE_MATRIX,
            checkbox: document.getElementById("moveKnifo"),
            localDirection: 1
        }
    ];
    const setMovementActive = (toggle, active) => {
        if (active) {
            if (toggle.distance >= CHARACTER_MOTION[toggle.name].forward.distance) {
                toggle.distance = 0;
                toggle.matrix[12] = toggle.startX;
                toggle.matrix[14] = toggle.startZ;
            }
            toggle.active = CHARACTER_MOTION[toggle.name].forward.distance > 0;
        } else {
            toggle.active = false;
            toggle.distance = 0;
            toggle.matrix[12] = toggle.startX;
            toggle.matrix[14] = toggle.startZ;
        }
        toggle.checkbox.checked = toggle.active;
    };
    movementToggles.forEach(toggle => {
        toggle.startX = toggle.matrix[12];
        toggle.startZ = toggle.matrix[14];
        toggle.distance = 0;
        toggle.active = false;
        toggle.checkbox.checked = false;
        toggle.checkbox.addEventListener("change", () => {
            setMovementActive(toggle, toggle.checkbox.checked);
            toggle.checkbox.blur();
        });
    });
    window.addEventListener("keydown", event => {
        const toggle = movementToggles.find(item => item.key === event.key);
        if (!toggle || event.repeat) return;
        setMovementActive(toggle, !toggle.active);
        event.preventDefault();
    });

    const rotationToggles = [
        { key: "8", name: "mouthe", matrix: mouthe.POSITION_MATRIX, checkbox: document.getElementById("rotateMouthe") },
        { key: "9", name: "gundog", matrix: gundog.POSITION_MATRIX, checkbox: document.getElementById("rotateGundog") },
        { key: "0", name: "knifo", matrix: knifo.MOVE_MATRIX, checkbox: document.getElementById("rotateKnifo") }
    ];
    const setRotationActive = (toggle, active) => {
        const rotation = CHARACTER_MOTION[toggle.name].rotation;
        if (active && toggle.angle >= rotation.angle) {
            LIBS.rotateY(toggle.matrix, -rotation.direction * toggle.angle);
            toggle.angle = 0;
        }
        toggle.active = active && rotation.angle > 0;
        toggle.checkbox.checked = toggle.active;
    };
    rotationToggles.forEach(toggle => {
        toggle.angle = 0;
        toggle.active = false;
        toggle.checkbox.checked = false;
        toggle.checkbox.addEventListener("change", () => {
            setRotationActive(toggle, toggle.checkbox.checked);
            toggle.checkbox.blur();
        });
    });
    window.addEventListener("keydown", event => {
        const toggle = rotationToggles.find(item => item.key === event.key);
        if (!toggle || event.repeat) return;
        setRotationActive(toggle, !toggle.active);
        event.preventDefault();
    });

    // if (KNIFO_SCENE.autoStart) {
    //     const knifoMovement = movementToggles.find(item => item.name === "knifo");
    //     setMovementActive(knifoMovement, true);
    // }

    const startTime = performance.now();
    let previousFrameTime = startTime;
    const animate = () => {
        const now = performance.now();
        const deltaTime = Math.min((now - previousFrameTime) / 1000, 0.1);
        previousFrameTime = now;
        if (now - lastCameraSave >= 250) {
            saveCameraState();
            lastCameraSave = now;
        }

        const forward = Number(pressedKeys.has("w")) - Number(pressedKeys.has("s"));
        const strafe = Number(pressedKeys.has("d")) - Number(pressedKeys.has("a"));
        const moveLength = Math.hypot(forward, strafe) || 1;
        camera.x += (-Math.sin(camera.yaw) * forward + Math.cos(camera.yaw) * strafe)
            * moveSpeed * deltaTime / moveLength;
        camera.z += (-Math.cos(camera.yaw) * forward - Math.sin(camera.yaw) * strafe)
            * moveSpeed * deltaTime / moveLength;
        camera.y += (Number(pressedKeys.has(" ")) - Number(pressedKeys.has("shift")))
            * moveSpeed * deltaTime;

        movementToggles.forEach(toggle => {
            if (!toggle.active) return;
            const forward = CHARACTER_MOTION[toggle.name].forward;
            toggle.distance = Math.min(forward.distance, toggle.distance + forward.speed * deltaTime);
            const rotation = rotationToggles.find(item => item.name === toggle.name);
            const currentYaw = CHARACTER_YAWS[toggle.name]
                + (rotation ? CHARACTER_MOTION[toggle.name].rotation.direction * rotation.angle : 0);
            const direction = forwardFromYaw(currentYaw, toggle.localDirection);
            toggle.matrix[12] = toggle.startX + direction.x * toggle.distance;
            toggle.matrix[14] = toggle.startZ + direction.z * toggle.distance;
            if (toggle.distance >= forward.distance) {
                toggle.active = false;
                toggle.checkbox.checked = false;
                if (toggle.name === "knifo" && KNIFO_SCENE.sequencePending) {
                    KNIFO_SCENE.sequencePending = false;
                    knifo.animationOn = false;
                    animationToggles.find(item => item.character === knifo).checkbox.checked = false;
                }
            }
        });

        rotationToggles.forEach(toggle => {
            if (!toggle.active) return;
            const rotation = CHARACTER_MOTION[toggle.name].rotation;
            const step = Math.min(rotation.speed * deltaTime, rotation.angle - toggle.angle);
            LIBS.rotateY(toggle.matrix, rotation.direction * step);
            toggle.angle += step;
            if (toggle.angle >= rotation.angle) {
                toggle.active = false;
                toggle.checkbox.checked = false;
            }
        });

        GL.clearColor(1, 1, 1, 1);
        GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);

        const VIEWMATRIX = LIBS.get_I4();
        LIBS.rotateY(VIEWMATRIX, -camera.yaw);
        LIBS.rotateX(VIEWMATRIX, -camera.pitch);
        VIEWMATRIX[12] = -(VIEWMATRIX[0] * camera.x + VIEWMATRIX[4] * camera.y + VIEWMATRIX[8] * camera.z);
        VIEWMATRIX[13] = -(VIEWMATRIX[1] * camera.x + VIEWMATRIX[5] * camera.y + VIEWMATRIX[9] * camera.z);
        VIEWMATRIX[14] = -(VIEWMATRIX[2] * camera.x + VIEWMATRIX[6] * camera.y + VIEWMATRIX[10] * camera.z);
        GL.uniformMatrix4fv(_Vmatrix, false, VIEWMATRIX);

        const elapsedSeconds = (now - startTime) / 1000;
        gundog.animasi(now * ANIMATION_SPEED.gundog);                   // gundog memakai milidetik
        gundog.render(LIBS.get_I4());
        const barrelLight = gundog.getBarrelLight();
        GL.uniform3fv(locations.redLightPosition, barrelLight.position);
        GL.uniform3fv(locations.redLightDirection, barrelLight.direction);
        GL.uniform1f(locations.redLightEnabled, gundog.lightOn ? 1 : 0);

        mouthe.animasi(elapsedSeconds * ANIMATION_SPEED.mouthe);
        mouthe.render(LIBS.get_I4());                              // akar dipanggil dengan matriks identitas
        environment.render(LIBS.get_I4());

        // knifo memakai waktu dalam detik, seperti Mouthe
        knifo.animasi(elapsedSeconds * ANIMATION_SPEED.knifo);
        knifo.render(LIBS.get_I4());

        window.requestAnimationFrame(animate);
    };
    animate();
}
window.addEventListener("load", main);
