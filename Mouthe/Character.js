import { MyObject } from "../MyObject.js";
import * as Shape from "../Shapes.js";

const ANIMATION_ON_AT_START = true; 
const FROZEN_TIME = 0.5;             // pose awal saat animasi belum pernah dijalankan
const HEAD_TURN = { angle: 0.45, speed: 1.2 }; // sudut maksimum dan kecepatan menoleh kiri-kanan

const TORSO = { width: 2.3, depth: 1, height: 3.2, segments: 24 };
const HEAD = { radiusX: 2.7, radiusZ: 2.2, upperHeight: 1.9, lowerHeight: 1.1, offsetY: 2.75, offsetZ: 1.5 };
const EYE = {
    sphereRadius: 0.12, eyelidRadius: 0.34,
    spread: 0.65,          // jarak mata dari tengah
    theta: 1.05,           // tinggi di kepala (0 = paling atas)
    eyelidSink: -0.12,     // kelopak sedikit tertanam di kepala
    eyeLift: 0.21          // bola mata di puncak kelopak
};
const TEETH = {
    countPerRow: 28, width: 0.19, height: 0.22, depth: 0.12,
    startFraction: 0.12, spanFraction: 0.76,   // bagian keliling bibir yang diisi gigi
    lipRadiusScale: 0.96, restHeight: 0.08     // posisi gigi dari pusat & dari garis mulut
};
const ARM = { upperLength: 1.7, forearmLength: 1.7, handLength: 0.8, shoulderY: 1.3, shoulderZ: 0.15 };
const LEG = {
    thighLength: 1.7, shinLength: 1.7, ankleLength: 0.3,
    hipY: -1.55, hipZ: 0,                  // posisi pinggul relatif terhadap torso
    footOffsetY: -0.12, footOffsetZ: 0.4     // posisi telapak dari ankle
};
// bola penutup sambungan 
const JOINT = { shoulderRadius: 0.26, elbowRadius: 0.19, hipRadius: 0.36, kneeRadius: 0.24, ankleRadius: 0.17 };

// pose lengan
const RIGHT_ARM_POSE = { shoulderX: -0.9, upperForward: 0.25, upperSide: -0.50, forearmForward: 0.15, forearmSide: 0.15, swingDirection: 1, swingAmount: 0.2 };
const LEFT_ARM_POSE  = { shoulderX: 0.95, upperForward: -0.15, upperSide: 0.90, forearmForward: -0.25, forearmSide: -1.15, swingDirection: -1, swingAmount: 0.2 };

// pose kaki saat diam
const RIGHT_LEG_STILL_POSE = { hipX: -0.6, thighAngle: 0.20, kneeAngle: 0.05, ankleFactor: 0.9 };    
const LEFT_LEG_STILL_POSE  = { hipX: 0.6, thighAngle: -0.30, kneeAngle: 0.30, ankleFactor: 0.9 };    

// pose kaki saat berjalan 
const walkingLegPoses = step => ({
    right: { hipX: -0.6, thighAngle: -0.1 + step * 0.45, kneeAngle: 0.2 + Math.max(0, -step) * 0.9, ankleFactor: 0.5 },
    left:  { hipX: 0.6,  thighAngle: -0.1 - step * 0.45, kneeAngle: 0.2 + Math.max(0,  step) * 0.9, ankleFactor: 0.5 }
});

function pointOnUpperHead(theta, phi, outward) {
    const x = HEAD.radiusX * Math.cos(phi) * Math.sin(theta);
    const y = HEAD.upperHeight * Math.cos(theta);
    const z = HEAD.radiusZ * Math.sin(phi) * Math.sin(theta);
    const nx = x / (HEAD.radiusX * HEAD.radiusX), ny = y / (HEAD.upperHeight * HEAD.upperHeight), nz = z / (HEAD.radiusZ * HEAD.radiusZ);
    const length = Math.hypot(nx, ny, nz);
    return [x + nx / length * outward, y + ny / length * outward, z + nz / length * outward];
}

export class Character extends MyObject {
    animationOn = ANIMATION_ON_AT_START;   // toggle animasi
    hasAnimated = false;
    clock = FROZEN_TIME;
    lastTime = null;

    constructor(GL, SHADER_PROGRAM, locations) {
        super(GL, SHADER_PROGRAM, locations);     

        // torso
        this.torso = this.addMesh(Shape.curvedBox(TORSO.width, TORSO.depth, TORSO.height, TORSO.segments), 0.78, 0, 0.3, 0);
        this.childs.push(this.torso);

        // head + jaw 
        this.head = this.addMesh(Shape.hemisphere(HEAD.radiusX, HEAD.upperHeight, HEAD.radiusZ, 28, 36, true), 0.82, 0, HEAD.offsetY, HEAD.offsetZ);
        this.torso.childs.push(this.head);

        const jawHingeZ = HEAD.radiusZ * 0.8;
        const lowerHead = Shape.hemisphere(HEAD.radiusX, HEAD.lowerHeight, HEAD.radiusZ, 28, 36, false);
        this.jaw = this.addMesh(Shape.move(lowerHead, 0, 0, jawHingeZ), 0.76, 0, 0, -jawHingeZ);
        this.head.childs.push(this.jaw);

        // mata
        const eyelidShape = Shape.ellipsoid(EYE.eyelidRadius, EYE.eyelidRadius, EYE.eyelidRadius, 20, 20);
        const eyeballShape = Shape.ellipsoid(EYE.sphereRadius, EYE.sphereRadius, EYE.sphereRadius, 16, 16);
        for (const side of [-1, 1]) {
            const phi = Math.PI / 2 - side * EYE.spread;
            const eyelid = this.addMesh(eyelidShape, 0.80, ...pointOnUpperHead(EYE.theta, phi, EYE.eyelidSink));
            this.head.childs.push(eyelid);
            const eyeball = this.addMesh(eyeballShape, 0.04, ...pointOnUpperHead(EYE.theta, phi, EYE.eyeLift), false);
            this.head.childs.push(eyeball);
        }

        // gigi: atas = anak head, bawah = anak jaw
        const toothShape = Shape.box(TEETH.width, TEETH.height, TEETH.depth);
        for (let i = 0; i < TEETH.countPerRow; i++) {
            const phi = Math.PI * (TEETH.startFraction + TEETH.spanFraction * i / (TEETH.countPerRow - 1));
            const x = HEAD.radiusX * TEETH.lipRadiusScale * Math.cos(phi);
            const z = HEAD.radiusZ * TEETH.lipRadiusScale * Math.sin(phi);
            const turnY = Math.atan2(-(HEAD.radiusZ * Math.cos(phi)), -(HEAD.radiusX * Math.sin(phi)));   

            const upperTooth = this.addMesh(toothShape, 0.98, x, -TEETH.restHeight, z);
            LIBS.rotateY(upperTooth.MOVE_MATRIX, turnY);
            this.head.childs.push(upperTooth);

            const lowerTooth = this.addMesh(toothShape, 0.98, x, TEETH.restHeight, z + jawHingeZ);   
            LIBS.rotateY(lowerTooth.MOVE_MATRIX, turnY);
            this.jaw.childs.push(lowerTooth);
        }

        // lengan 
        this.arms = [];
        for (const pose of [RIGHT_ARM_POSE, LEFT_ARM_POSE]) {
            const upperArm = this.addMesh(this.hanging(Shape.cylinder(0.26, 0.19, ARM.upperLength, 16), ARM.upperLength), 0.75, pose.shoulderX, ARM.shoulderY, ARM.shoulderZ);
            this.torso.childs.push(upperArm);
            const shoulderJoint = this.addJointSphere(JOINT.shoulderRadius, 0.75, pose.shoulderX, ARM.shoulderY, ARM.shoulderZ);
            this.torso.childs.push(shoulderJoint);

            const forearm = this.addMesh(this.hanging(Shape.cylinder(0.19, 0.13, ARM.forearmLength, 16), ARM.forearmLength), 0.75, 0, -ARM.upperLength, 0);
            upperArm.childs.push(forearm);
            upperArm.childs.push(this.addJointSphere(JOINT.elbowRadius, 0.75, 0, -ARM.upperLength, 0));

            const hand = this.addMesh(this.hanging(Shape.cone(0.18, ARM.handLength, 16), ARM.handLength), 0.75, 0, -ARM.forearmLength, 0);
            forearm.childs.push(hand);

            this.arms.push({ upperArm, forearm, pose });
        }

        // kaki
        this.legs = [];
        for (const side of ["right", "left"]) {
            const hipX = (side === "right" ? RIGHT_LEG_STILL_POSE : LEFT_LEG_STILL_POSE).hipX;

            const thigh = this.addMesh(this.hanging(Shape.cylinder(0.36, 0.24, LEG.thighLength, 16), LEG.thighLength), 0.72, hipX, LEG.hipY, LEG.hipZ);
            this.torso.childs.push(thigh);
            this.torso.childs.push(this.addJointSphere(JOINT.hipRadius, 0.72, hipX, LEG.hipY, LEG.hipZ));

            const shin = this.addMesh(this.hanging(Shape.cylinder(0.24, 0.17, LEG.shinLength, 16), LEG.shinLength), 0.72, 0, -LEG.thighLength, 0);
            thigh.childs.push(shin);
            thigh.childs.push(this.addJointSphere(JOINT.kneeRadius, 0.72, 0, -LEG.thighLength, 0));

            const ankle = this.addMesh(this.hanging(Shape.cylinder(0.17, 0.17, LEG.ankleLength, 16), LEG.ankleLength), 0.70, 0, -LEG.shinLength, 0);
            shin.childs.push(ankle);
            shin.childs.push(this.addJointSphere(JOINT.ankleRadius, 0.72, 0, -LEG.shinLength, 0));

            // telapak: balok trapesium
            const foot = this.addMesh(Shape.trapezoidBox(0.20, 0.42, 1.0, 0.5), 0.66, 0, -LEG.ankleLength + LEG.footOffsetY, LEG.footOffsetZ);
            LIBS.rotateX(foot.MOVE_MATRIX, Math.PI / 2);
            ankle.childs.push(foot);

            this.legs.push({ side, thigh, shin, ankle });
        }
    }

    addMesh(shape, brightness, x, y, z, hatching = true) {
        const part = new MyObject(this.GL, this.SHADER_PROGRAM, this.locations);
        part.vertex = shape.vertices;
        part.normals = shape.normals;
        part.faces = shape.indices;
        part.brightness = brightness;
        part.hatching = hatching ? 1 : 0;
        LIBS.set_position(part.POSITION_MATRIX, x, y, z);
        return part;
    }

    addJointSphere(radius, brightness, x, y, z) {
        return this.addMesh(Shape.ellipsoid(radius, radius, radius, 16, 16), brightness, x, y, z);
    }

    // bentuk silinder/cone dibuat menggantung ke bawah dari sendinya
    hanging(shape, length) {
        return Shape.move(shape, 0, -length / 2, 0);
    }

    // gerakan
    animasi(time) {
        if (this.lastTime === null) this.lastTime = time;
        if (this.animationOn) this.clock += time - this.lastTime;
        this.lastTime = time;

        if (!this.animationOn && this.hasAnimated) return;

        const t = this.clock;
        const legStep = Math.sin(t * 3);               // langkah kaki
        const armSwing = Math.sin(t * 3 + Math.PI);    // lengan berlawanan dengan kaki

        // torso
        LIBS.set_I4(this.torso.MOVE_MATRIX);
        LIBS.rotateX(this.torso.MOVE_MATRIX, 0.1 + Math.sin(t * 2) * 0.03);
        LIBS.translateY(this.torso.MOVE_MATRIX, Math.sin(t * 3) * 0.12);

        // head: menoleh (Y), miring (Z), mengangguk (X)
        // jaw: membuka-menutup di engsel
        LIBS.set_I4(this.head.MOVE_MATRIX);
        LIBS.rotateY(this.head.MOVE_MATRIX, Math.sin(t * HEAD_TURN.speed) * HEAD_TURN.angle);
        LIBS.rotateZ(this.head.MOVE_MATRIX, Math.sin(t * 1.2) * 0.03);
        LIBS.rotateX(this.head.MOVE_MATRIX, -0.18 + Math.sin(t * 1.5) * 0.04);
        LIBS.set_I4(this.jaw.MOVE_MATRIX);
        LIBS.rotateX(this.jaw.MOVE_MATRIX, 0.30);
        this.arms.forEach(({ upperArm, forearm, pose }) => {
            LIBS.set_I4(upperArm.MOVE_MATRIX);
            LIBS.rotateX(upperArm.MOVE_MATRIX, pose.upperForward + pose.swingDirection * armSwing * pose.swingAmount);
            LIBS.rotateZ(upperArm.MOVE_MATRIX, pose.upperSide);
            LIBS.set_I4(forearm.MOVE_MATRIX);
            LIBS.rotateX(forearm.MOVE_MATRIX, pose.forearmForward);
            LIBS.rotateZ(forearm.MOVE_MATRIX, pose.forearmSide);
        });

        const legPoses = this.animationOn ? walkingLegPoses(legStep) : { right: RIGHT_LEG_STILL_POSE, left: LEFT_LEG_STILL_POSE };
        this.legs.forEach(({ side, thigh, shin, ankle }) => {
            const pose = legPoses[side];
            LIBS.set_I4(thigh.MOVE_MATRIX);
            LIBS.rotateX(thigh.MOVE_MATRIX, pose.thighAngle);
            LIBS.set_I4(shin.MOVE_MATRIX);
            LIBS.rotateX(shin.MOVE_MATRIX, pose.kneeAngle);
            LIBS.set_I4(ankle.MOVE_MATRIX);
            LIBS.rotateX(ankle.MOVE_MATRIX, -(pose.thighAngle + pose.kneeAngle) * pose.ankleFactor);
        });

        if (this.animationOn) this.hasAnimated = true;
    }
}
