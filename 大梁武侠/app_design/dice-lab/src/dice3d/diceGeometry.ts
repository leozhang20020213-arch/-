import * as THREE from "three";
import type { DiceFace, DiceMeshSpec, Die3DType } from "./diceTypes";

const SCALE = 0.86;

export function createDiceMeshSpec(type: Die3DType): DiceMeshSpec {
  switch (type) {
    case "D4":
      return fromGeometry(new THREE.TetrahedronGeometry(SCALE, 0), 4);
    case "D6":
      return createD6Spec();
    case "D8":
      return fromGeometry(new THREE.OctahedronGeometry(SCALE, 0), 8);
    case "D10":
      return createD10Spec();
    case "D12":
      return fromGeometry(new THREE.DodecahedronGeometry(SCALE, 0), 12);
    case "D20":
      return fromGeometry(new THREE.IcosahedronGeometry(SCALE, 0), 20);
  }
}

function createD6Spec(): DiceMeshSpec {
  const geometry = new THREE.BoxGeometry(1.35, 1.35, 1.35);
  const half = 0.675;
  const faces: DiceFace[] = [
    { value: 1, normal: new THREE.Vector3(0, 1, 0), center: new THREE.Vector3(0, half, 0) },
    { value: 2, normal: new THREE.Vector3(1, 0, 0), center: new THREE.Vector3(half, 0, 0) },
    { value: 3, normal: new THREE.Vector3(0, 0, 1), center: new THREE.Vector3(0, 0, half) },
    { value: 4, normal: new THREE.Vector3(0, 0, -1), center: new THREE.Vector3(0, 0, -half) },
    { value: 5, normal: new THREE.Vector3(-1, 0, 0), center: new THREE.Vector3(-half, 0, 0) },
    { value: 6, normal: new THREE.Vector3(0, -1, 0), center: new THREE.Vector3(0, -half, 0) },
  ];
  const physicsVertices = [
    new THREE.Vector3(-half, -half, -half),
    new THREE.Vector3(half, -half, -half),
    new THREE.Vector3(half, half, -half),
    new THREE.Vector3(-half, half, -half),
    new THREE.Vector3(-half, -half, half),
    new THREE.Vector3(half, -half, half),
    new THREE.Vector3(half, half, half),
    new THREE.Vector3(-half, half, half),
  ];
  const physicsFaces = [
    [0, 1, 2, 3],
    [4, 7, 6, 5],
    [0, 4, 5, 1],
    [1, 5, 6, 2],
    [2, 6, 7, 3],
    [3, 7, 4, 0],
  ];
  return { geometry, faces, radius: 0.78, physicsVertices, physicsFaces };
}

function createD10Spec(): DiceMeshSpec {
  const top = new THREE.Vector3(0, SCALE, 0);
  const bottom = new THREE.Vector3(0, -SCALE, 0);
  const ring = Array.from({ length: 5 }, (_, index) => {
    const angle = (index / 5) * Math.PI * 2 + Math.PI / 2;
    return new THREE.Vector3(Math.cos(angle) * SCALE, 0, Math.sin(angle) * SCALE);
  });

  const vertices: number[] = [];
  const faceData: Array<{ normal: THREE.Vector3; center: THREE.Vector3 }> = [];
  const physicsVertices = [top, bottom, ...ring];
  const physicsFaces: number[][] = [];

  function addFace(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, face: number[]) {
    vertices.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    faceData.push({ normal: getNormal(a, b, c), center: getCenter([a, b, c]) });
    physicsFaces.push(face);
  }

  for (let index = 0; index < 5; index += 1) {
    const next = (index + 1) % 5;
    addFace(top, ring[index], ring[next], [0, index + 2, next + 2]);
    addFace(bottom, ring[next], ring[index], [1, next + 2, index + 2]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();

  return {
    geometry,
    faces: faceData.map((face, index) => ({ value: index + 1, normal: face.normal, center: face.center })),
    radius: SCALE,
    physicsVertices,
    physicsFaces,
  };
}

function fromGeometry(sourceGeometry: THREE.BufferGeometry, sides: number): DiceMeshSpec {
  const geometry = sourceGeometry.toNonIndexed();
  geometry.computeVertexNormals();
  const positions = geometry.getAttribute("position");
  const faceData: Array<{ normal: THREE.Vector3; center: THREE.Vector3 }> = [];
  const physicsVertices: THREE.Vector3[] = [];
  const physicsFaces: number[][] = [];

  for (let index = 0; index < positions.count; index += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(positions, index);
    const b = new THREE.Vector3().fromBufferAttribute(positions, index + 1);
    const c = new THREE.Vector3().fromBufferAttribute(positions, index + 2);
    const normal = getNormal(a, b, c);
    const center = getCenter([a, b, c]);
    const existing = faceData.find((item) => item.normal.dot(normal) > 0.995);
    if (!existing) {
      faceData.push({ normal, center });
    }
    physicsFaces.push([addUniqueVertex(physicsVertices, a), addUniqueVertex(physicsVertices, b), addUniqueVertex(physicsVertices, c)]);
  }

  const faces = faceData.slice(0, sides).map((face, index) => ({
    value: index + 1,
    normal: face.normal,
    center: face.center,
  }));

  return {
    geometry,
    faces,
    radius: SCALE,
    physicsVertices,
    physicsFaces,
  };
}

function getNormal(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3().subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize();
}

function getCenter(points: THREE.Vector3[]): THREE.Vector3 {
  return points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length);
}

function addUniqueVertex(vertices: THREE.Vector3[], vertex: THREE.Vector3): number {
  const existingIndex = vertices.findIndex((item) => item.distanceToSquared(vertex) < 0.000001);
  if (existingIndex >= 0) {
    return existingIndex;
  }
  vertices.push(vertex.clone());
  return vertices.length - 1;
}
