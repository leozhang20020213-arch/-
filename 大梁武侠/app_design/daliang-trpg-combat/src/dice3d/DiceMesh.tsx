import * as THREE from "three";
import type { Dice3DState, Die3DType } from "./diceTypes";
import { createDiceDefinition, type DiceDefinition } from "./DiceGeometryFactory";
import { createDiceBodyMaterial, createFaceTexture, getDiceTheme } from "./DiceMaterialFactory";

export interface DiceMeshHandle {
  state: Dice3DState;
  mesh: THREE.Mesh;
  edges: THREE.LineSegments;
  definition: DiceDefinition;
  faces: DiceDefinition["faces"];
  radius: number;
  physicsVertices: DiceDefinition["physicsVertices"];
  physicsFaces: DiceDefinition["physicsFaces"];
  dispose: () => void;
}

export function createDiceMesh(state: Dice3DState): DiceMeshHandle {
  const spec = createDiceDefinition(state.type);
  const material = createDiceBodyMaterial(state.affinity);
  const mesh = new THREE.Mesh(spec.geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.copy(state.position);
  mesh.rotation.copy(state.rotation);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(spec.geometry),
    new THREE.LineBasicMaterial({ color: getDiceTheme(state.affinity).edge, transparent: true, opacity: 0.9 }),
  );
  mesh.add(edges);
  const labels = spec.faces.map((face) => createFaceLabel(face.value, face.center, face.normal, state.type, state.affinity));
  labels.forEach((label) => mesh.add(label));

  return {
    state,
    mesh,
    edges,
    definition: spec,
    faces: spec.faces,
    radius: spec.radius,
    physicsVertices: spec.physicsVertices,
    physicsFaces: spec.physicsFaces,
    dispose: () => {
      spec.geometry.dispose();
      material.map?.dispose();
      material.normalMap?.dispose();
      material.roughnessMap?.dispose();
      material.metalnessMap?.dispose();
      material.dispose();
      edges.geometry.dispose();
      const edgeMaterial = edges.material;
      if (Array.isArray(edgeMaterial)) {
        edgeMaterial.forEach((item) => item.dispose());
      } else {
        edgeMaterial.dispose();
      }
      labels.forEach((label) => {
        label.geometry.dispose();
        const labelMaterial = label.material;
        if (Array.isArray(labelMaterial)) {
          labelMaterial.forEach((item) => item.dispose());
        } else {
          const material = labelMaterial as THREE.MeshBasicMaterial;
          material.map?.dispose();
          labelMaterial.dispose();
        }
      });
    },
  };
}

function createFaceLabel(
  value: number,
  center: THREE.Vector3,
  normal: THREE.Vector3,
  type: Die3DType,
  affinity: Dice3DState["affinity"],
): THREE.Mesh {
  const texture = createFaceTexture(value, affinity);
  const labelSize = type === "D20" || type === "D12" ? 0.34 : type === "D10" ? 0.38 : 0.44;
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(labelSize, labelSize),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.02,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  label.position.copy(center.clone().add(normal.clone().multiplyScalar(0.035)));
  label.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize());
  return label;
}
