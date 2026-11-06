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

// ===== LETAK GUNDOG di dalam maze (satuan dunia) =====
const GUNDOG = {
    x: 11, z: 6,               // posisi di ruang awal (karakter pertama ada di 0, 0)
    footY: -1.7,              // tinggi telapak kaki gundog pada ukuran aslinya (ditaruh tepat di lantai)
    faceCharacter: true,
    target: "knifo",
    yaw: 0
};
const KNIFO = {
    x: -12, z: 6,
    footY: 0,
    faceCharacter: true,
    target: "mouthe",
    yaw: 0
};
const MOUTHE = {
    x: 0, z: 0,
    footY: -5.88,
    faceCharacter: true,
    target: "knifo",
    yaw: 0
};
const CHARACTER_PLACEMENTS = { mouthe: MOUTHE, gundog: GUNDOG, knifo: KNIFO };
const CHARACTER_FORWARD = { mouthe: 1, gundog: -1, knifo: 1 };

function characterYaw(name) {
    const character = CHARACTER_PLACEMENTS[name];
    if (!character.faceCharacter) return character.yaw;

    const target = CHARACTER_PLACEMENTS[character.target];
    if (!target || target === character) {
        throw new Error(`Invalid facing target "${character.target}" for ${name}.`);
    }

    const dx = target.x - character.x;
    const dz = target.z - character.z;
    if (dx === 0 && dz === 0) return character.yaw;

    const forward = CHARACTER_FORWARD[name];
    return Math.atan2(forward * dx, forward * dz);
}
const CHARACTER_YAWS = {
    mouthe: characterYaw("mouthe"),
    gundog: characterYaw("gundog"),
    knifo: characterYaw("knifo")
};

// Skala seragam per karakter. Ubah angka ini untuk memperbesar atau memperkecil model.
const CHARACTER_SCALE = {
    mouthe: 1,
    gundog: 3,
    knifo: 3
};
const MOUTHE_FOOT_Y = -5.88; // perkiraan posisi telapak Mouthe dari akar pada pose berdiri
const CHARACTER_FORWARD_SPEED = 50; // satuan dunia per detik

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


    //
    //knifo
    //

    const knifo = new Knifo(GL, SHADER_PROGRAM, locations);
    knifo.setup();
    knifo.setWorld(KNIFO.x, environment.floorY - Knifo.FOOT_Y, KNIFO.z, CHARACTER_YAWS.knifo, CHARACTER_SCALE.knifo);




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
            matrix: mouthe.POSITION_MATRIX,
            checkbox: document.getElementById("moveMouthe"),
            direction: forwardFromYaw(CHARACTER_YAWS.mouthe)
        },
        {
            key: "5",
            matrix: gundog.POSITION_MATRIX,
            checkbox: document.getElementById("moveGundog"),
            direction: forwardFromYaw(CHARACTER_YAWS.gundog, -1)
        },
        {
            key: "6",
            matrix: knifo.MOVE_MATRIX,
            checkbox: document.getElementById("moveKnifo"),
            direction: forwardFromYaw(CHARACTER_YAWS.knifo)
        }
    ];
    movementToggles.forEach(toggle => {
        toggle.startX = toggle.matrix[12];
        toggle.startZ = toggle.matrix[14];
        toggle.distance = 0;
        toggle.active = false;
        toggle.checkbox.checked = false;
        toggle.checkbox.addEventListener("change", () => {
            toggle.active = toggle.checkbox.checked;
            if (!toggle.active) {
                toggle.distance = 0;
                toggle.matrix[12] = toggle.startX;
                toggle.matrix[14] = toggle.startZ;
            }
            toggle.checkbox.blur();
        });
    });
    window.addEventListener("keydown", event => {
        const toggle = movementToggles.find(item => item.key === event.key);
        if (!toggle || event.repeat) return;
        toggle.checkbox.checked = !toggle.checkbox.checked;
        toggle.active = toggle.checkbox.checked;
        if (!toggle.active) {
            toggle.distance = 0;
            toggle.matrix[12] = toggle.startX;
            toggle.matrix[14] = toggle.startZ;
        }
        event.preventDefault();
    });

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

        movementToggles.forEach(toggle => {
            if (!toggle.active) return;
            toggle.distance += CHARACTER_FORWARD_SPEED * deltaTime;
            toggle.matrix[12] = toggle.startX + toggle.direction.x * toggle.distance;
            toggle.matrix[14] = toggle.startZ + toggle.direction.z * toggle.distance;
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

        mouthe.animasi((performance.now() - startTime) / 1000);   // detik
        mouthe.render(LIBS.get_I4());                              // akar dipanggil dengan matriks identitas
        environment.render(LIBS.get_I4());

        // gundog (shader & kamera sama)
        gundog.animasi(performance.now());                              // gundog memakai milidetik
        gundog.render(LIBS.get_I4());

        // knifo memakai waktu dalam detik, seperti Mouthe
        knifo.animasi((now - startTime) / 1000);
        knifo.render(LIBS.get_I4());

        window.requestAnimationFrame(animate);
    };
    animate();
}
window.addEventListener("load", main);
