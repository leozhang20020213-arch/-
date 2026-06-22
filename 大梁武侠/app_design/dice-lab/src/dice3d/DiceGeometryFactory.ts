import * as THREE from "three";
import { createDiceMeshSpec } from "./diceGeometry";
import type { DiceFace, DiceMeshSpec, Die3DType } from "./diceTypes";

export enum DiceReadMode {
  UP_FACE = "UP_FACE",
  DOWN_FACE = "DOWN_FACE",
  CAMERA_FACE = "CAMERA_FACE",
  OVERLAY_LABEL = "OVERLAY_LABEL",
}

export interface DiceDefinition extends DiceMeshSpec {
  type: Die3DType;
  sides: number;
  sizeScale: number;
  geometryType: string;
  readMode: DiceReadMode;
  valueToFaces: Record<number, string[]>;
}

const SIZE_SCALE: Record<Die3DType, number> = {
  D4: 0.78,
  D6: 0.9,
  D8: 1.0,
  D10: 1.08,
  D12: 1.18,
  D20: 1.3,
};

const GEOMETRY_TYPE: Record<Die3DType, string> = {
  D4: "tetrahedron",
  D6: "cube",
  D8: "octahedron",
  D10: "pentagonal_trapezohedron",
  D12: "dodecahedron",
  D20: "icosahedron",
};

export function createDiceDefinition(type: Die3DType): DiceDefinition {
  const base = createDiceMeshSpec(type);
  const sizeScale = SIZE_SCALE[type];
  const faces = base.faces.map((face, index) => ({
    ...face,
    faceId: `${type.toLowerCase()}-face-${index + 1}`,
    normal: face.normal.clone(),
    center: face.center.clone().multiplyScalar(sizeScale),
  }));

  return {
    ...base,
    type,
    sides: Number(type.slice(1)),
    sizeScale,
    geometryType: GEOMETRY_TYPE[type],
    readMode: DiceReadMode.UP_FACE,
    geometry: scaleGeometry(base.geometry, sizeScale),
    radius: base.radius * sizeScale,
    faces,
    physicsVertices: base.physicsVertices.map((vertex) => vertex.clone().multiplyScalar(sizeScale)),
    physicsFaces: base.physicsFaces.map((face) => [...face]),
    valueToFaces: createValueToFaces(faces),
  };
}

function scaleGeometry(geometry: THREE.BufferGeometry, scale: number): THREE.BufferGeometry {
  const copy = geometry.clone();
  copy.scale(scale, scale, scale);
  copy.computeBoundingSphere();
  copy.computeVertexNormals();
  return copy;
}

function createValueToFaces(faces: Array<DiceFace & { faceId: string }>): Record<number, string[]> {
  return faces.reduce<Record<number, string[]>>((map, face) => {
    map[face.value] = [...(map[face.value] ?? []), face.faceId];
    return map;
  }, {});
}
