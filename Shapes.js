// Shapes.js; pembuat bentuk. Semua fungsi mengembalikan { vertices, normals, indices }
export const bezier = (p0, p1, p2, p3, t) => {
    const u = 1 - t;
    return u*u*u*p0 + 3*u*u*t*p1 + 3*u*t*t*p2 + t*t*t*p3;
};

function computeNormals(vertices, indices) {
    const normals = new Array(vertices.length).fill(0);
    for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i] * 3, b = indices[i+1] * 3, c = indices[i+2] * 3;
        const ux = vertices[b] - vertices[a], uy = vertices[b+1] - vertices[a+1], uz = vertices[b+2] - vertices[a+2];
        const vx = vertices[c] - vertices[a], vy = vertices[c+1] - vertices[a+1], vz = vertices[c+2] - vertices[a+2];
        const nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx;
        for (const k of [a, b, c]) { normals[k] += nx; normals[k+1] += ny; normals[k+2] += nz; }
    }
    for (let i = 0; i < normals.length; i += 3) {
        const length = Math.hypot(normals[i], normals[i+1], normals[i+2]) || 1;
        normals[i] /= length; normals[i+1] /= length; normals[i+2] /= length;
    }
    return normals;
}

function finish(vertices, indices) {
    const shape = { vertices, normals: computeNormals(vertices, indices), indices };
    let facing = 0;
    for (let i = 0; i < vertices.length; i++) facing += vertices[i] * shape.normals[i];
    if (facing < 0) {
        shape.normals = shape.normals.map(n => -n);
        for (let i = 0; i < indices.length; i += 3) [indices[i+1], indices[i+2]] = [indices[i+2], indices[i+1]];
    }
    return shape;
}

export function move(shape, offsetX, offsetY, offsetZ) {
    for (let i = 0; i < shape.vertices.length; i += 3) {
        shape.vertices[i] += offsetX; shape.vertices[i+1] += offsetY; shape.vertices[i+2] += offsetZ;
    }
    return shape;
}

function sphereSurface(rx, ry, rz, latBands, longBands, thetaStart, thetaRange) {
    const vertices = [], indices = [];
    for (let lat = 0; lat <= latBands; lat++) {
        const theta = thetaStart + lat * thetaRange / latBands;
        for (let long = 0; long <= longBands; long++) {
            const phi = long * 2 * Math.PI / longBands;
            vertices.push(rx * Math.cos(phi) * Math.sin(theta), ry * Math.cos(theta), rz * Math.sin(phi) * Math.sin(theta));
        }
    }
    for (let row = 0; row < latBands; row++) {
        for (let col = 0; col < longBands; col++) {
            const current = row * (longBands + 1) + col, below = current + longBands + 1;
            indices.push(current, current + 1, below, below, current + 1, below + 1);
        }
    }
    return { vertices, indices };
}


export function curvedBox(width, depth, height, segmentsY) {
    const ringPoints = 32, boxiness = 0.25;     // boxiness: makin kecil makin kotak
    const vertices = [], indices = [];

    for (let i = 0; i <= segmentsY; i++) {
        const v = i / segmentsY;                                  // 0 = bawah, 1 = atas
        const bendZ = bezier(0.0, -0.9, -0.9, 0.5, v);            // lengkung punggung
        const scale = bezier(1.15, 1.0, 1.0, 0.85, v);            
        for (let j = 0; j < ringPoints; j++) {
            const c = Math.cos(j * 2 * Math.PI / ringPoints), s = Math.sin(j * 2 * Math.PI / ringPoints);
            vertices.push(Math.sign(c) * Math.pow(Math.abs(c), boxiness) * width / 2 * scale,
                          (v - 0.5) * height,
                          Math.sign(s) * Math.pow(Math.abs(s), boxiness) * depth / 2 * scale + bendZ);
        }
    }
    for (let i = 0; i < segmentsY; i++) {                         // dinding samping
        for (let j = 0; j < ringPoints; j++) {
            const a = i * ringPoints + j, b = i * ringPoints + (j + 1) % ringPoints, c = a + ringPoints, d = b + ringPoints;
            indices.push(a, c, b, b, c, d);
        }
    }
    for (const [row, reverse] of [[0, true], [segmentsY, false]]) {   // tutup bawah & atas
        const center = vertices.length / 3;
        let cx = 0, cy = 0, cz = 0;
        for (let j = 0; j < ringPoints; j++) {
            const k = (row * ringPoints + j) * 3;
            cx += vertices[k]; cy += vertices[k+1]; cz += vertices[k+2];
        }
        vertices.push(cx / ringPoints, cy / ringPoints, cz / ringPoints);
        for (let j = 0; j < ringPoints; j++) {
            const a = row * ringPoints + j, b = row * ringPoints + (j + 1) % ringPoints;
            if (reverse) indices.push(center, b, a); else indices.push(center, a, b);
        }
    }
    return finish(vertices, indices);
}

// cylinder 
// segments = 4 -> balok trapesium
export function cylinder(radiusTop, radiusBottom, height, segments, depthScale = 1) {
    const vertices = [], indices = [];
    const yTop = height / 2, yBottom = -height / 2;
    const rotation = segments === 4 ? Math.PI / 4 : 0;            

    for (let i = 0; i <= segments; i++) {
        const angle = i * 2 * Math.PI / segments + rotation;
        vertices.push(radiusTop * Math.cos(angle), yTop, radiusTop * Math.sin(angle) * depthScale);
        vertices.push(radiusBottom * Math.cos(angle), yBottom, radiusBottom * Math.sin(angle) * depthScale);
    }
    for (let i = 0; i < segments; i++) {
        const topA = i * 2, bottomA = topA + 1, topB = (i + 1) * 2, bottomB = topB + 1;
        indices.push(topA, topB, bottomA, bottomA, topB, bottomB);
    }
    const topCenter = vertices.length / 3;    vertices.push(0, yTop, 0);
    const bottomCenter = vertices.length / 3; vertices.push(0, yBottom, 0);
    for (let i = 0; i < segments; i++) {
        indices.push(topCenter, i * 2 + 2, i * 2);
        indices.push(bottomCenter, i * 2 + 1, i * 2 + 3);
    }
    return finish(vertices, indices);
}

// balok trapesium
export const trapezoidBox = (radiusTop, radiusBottom, height, depthScale) =>
    cylinder(radiusTop, radiusBottom, height, 4, depthScale);

// cone
export function cone(radius, height, segments) {
    const vertices = [0, height / 2, 0], indices = [];            
    const pointOnCone = (u, v) => [
        radius * v * Math.cos(u),
        -height / 2 + height * v,
        radius * v * Math.sin(u)
    ];
    for (let i = 0; i <= segments; i++) {
        const angle = i * 2 * Math.PI / segments;
        vertices.push(...pointOnCone(angle, 1));
    }
    const tip = vertices.length / 3;
    vertices.push(...pointOnCone(0, 0));
    for (let i = 1; i <= segments; i++) {
        indices.push(tip, i, i + 1);                              
        indices.push(0, i + 1, i);                                
    }
    return finish(vertices, indices);
}

// setengah ellipsoid dengan bidang potongan tertutup
export function halfEllipsoid(rx, ry, rz, latBands, longBands, isUpperHalf) {
    const { vertices, indices } = sphereSurface(rx, ry, rz, latBands, longBands, isUpperHalf ? 0 : Math.PI / 2, Math.PI / 2);
    const center = vertices.length / 3;
    vertices.push(0, 0, 0);
    const edge = (isUpperHalf ? latBands : 0) * (longBands + 1);
    for (let j = 0; j < longBands; j++) {
        if (isUpperHalf) indices.push(center, edge + j + 1, edge + j); else indices.push(center, edge + j, edge + j + 1);
    }
    return finish(vertices, indices);
}

// ellipsoid 
export function ellipsoid(rx, ry, rz, latBands, longBands) {
    const { vertices, indices } = sphereSurface(rx, ry, rz, latBands, longBands, 0, Math.PI);
    return finish(vertices, indices);
}

// balok
export function box(width, height, depth) {
    const x = width / 2, y = height / 2, z = depth / 2;
    const faces = [
        [[-x,-y, z], [ x,-y, z], [ x, y, z], [-x, y, z]],   // depan
        [[ x,-y,-z], [-x,-y,-z], [-x, y,-z], [ x, y,-z]],   // belakang
        [[-x, y, z], [ x, y, z], [ x, y,-z], [-x, y,-z]],   // atas
        [[-x,-y,-z], [ x,-y,-z], [ x,-y, z], [-x,-y, z]],   // bawah
        [[ x,-y, z], [ x,-y,-z], [ x, y,-z], [ x, y, z]],   // kanan
        [[-x,-y,-z], [-x,-y, z], [-x, y, z], [-x, y,-z]]    // kiri
    ];
    const vertices = [], indices = [];
    faces.forEach((corners, n) => {
        corners.forEach(corner => vertices.push(...corner));
        indices.push(n*4, n*4 + 1, n*4 + 2, n*4, n*4 + 2, n*4 + 3);
    });
    return finish(vertices, indices);
}


export function fromMesh(positions, faces, smooth) {
    const count = positions.length / 3;
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < positions.length; i += 3) { cx += positions[i]; cy += positions[i+1]; cz += positions[i+2]; }
    cx /= count; cy /= count; cz /= count;

    const indices = [];
    for (let i = 0; i < faces.length; i += 3) {
        let [a, b, c] = [faces[i], faces[i+1], faces[i+2]];
        const ux = positions[b*3] - positions[a*3], uy = positions[b*3+1] - positions[a*3+1], uz = positions[b*3+2] - positions[a*3+2];
        const vx = positions[c*3] - positions[a*3], vy = positions[c*3+1] - positions[a*3+1], vz = positions[c*3+2] - positions[a*3+2];
        const nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx;
        const mx = (positions[a*3] + positions[b*3] + positions[c*3]) / 3 - cx;
        const my = (positions[a*3+1] + positions[b*3+1] + positions[c*3+1]) / 3 - cy;
        const mz = (positions[a*3+2] + positions[b*3+2] + positions[c*3+2]) / 3 - cz;
        if (nx*mx + ny*my + nz*mz < 0) [b, c] = [c, b];            
        indices.push(a, b, c);
    }

    if (smooth) return { vertices: positions.slice(), normals: computeNormals(positions, indices), indices };

    const vertices = [], flatIndices = [];
    indices.forEach((index, n) => {                                   
        vertices.push(positions[index*3], positions[index*3+1], positions[index*3+2]);
        flatIndices.push(n);
    });
    return { vertices, normals: computeNormals(vertices, flatIndices), indices: flatIndices };
}
