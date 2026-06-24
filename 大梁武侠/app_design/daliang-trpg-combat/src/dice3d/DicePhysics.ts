import * as CANNON from "cannon-es";
import * as THREE from "three";
import type { Die3DType } from "./diceTypes";

export interface DiceBodyHandle {
  id: string;
  type: Die3DType;
  body: CANNON.Body;
}

export class DicePhysics {
  readonly world: CANNON.World;
  private readonly groundBody: CANNON.Body;
  private readonly wallBodies: CANNON.Body[] = [];
  private readonly diceMaterial: CANNON.Material;
  private readonly floorMaterial: CANNON.Material;

  constructor() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0),
    });
    this.world.allowSleep = true;
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);

    this.floorMaterial = new CANNON.Material("tray");
    this.diceMaterial = new CANNON.Material("dice");
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.floorMaterial, this.diceMaterial, {
        friction: 0.92,
        restitution: 0.12,
        contactEquationStiffness: 1e7,
        contactEquationRelaxation: 4,
      }),
    );

    this.groundBody = new CANNON.Body({
      mass: 0,
      material: this.floorMaterial,
      shape: new CANNON.Plane(),
    });
    this.groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(this.groundBody);

    this.addWall(new CANNON.Vec3(0, 0.95, -3.55), new CANNON.Vec3(4.15, 0.95, 0.26));
    this.addWall(new CANNON.Vec3(0, 0.95, 3.55), new CANNON.Vec3(4.15, 0.95, 0.26));
    this.addWall(new CANNON.Vec3(-4.15, 0.95, 0), new CANNON.Vec3(0.26, 0.95, 3.55));
    this.addWall(new CANNON.Vec3(4.15, 0.95, 0), new CANNON.Vec3(0.26, 0.95, 3.55));
  }

  createDiceBody(
    id: string,
    type: Die3DType,
    position: THREE.Vector3,
    physicsVertices: THREE.Vector3[],
    physicsFaces: number[][],
  ): DiceBodyHandle {
    const orientedFaces = orientFacesOutward(physicsVertices, physicsFaces);
    const shape = new CANNON.ConvexPolyhedron({
      vertices: physicsVertices.map((vertex) => new CANNON.Vec3(vertex.x, vertex.y, vertex.z)),
      faces: orientedFaces,
    });
    shape.computeNormals();
    shape.computeEdges();
    shape.updateBoundingSphereRadius();

    const body = new CANNON.Body({
      mass: 3.2,
      material: this.diceMaterial,
      linearDamping: 0.46,
      angularDamping: 0.58,
      allowSleep: true,
      sleepSpeedLimit: 0.18,
      sleepTimeLimit: 0.28,
      shape,
      position: new CANNON.Vec3(position.x, position.y, position.z),
    });

    this.world.addBody(body);
    return { id, type, body };
  }

  removeBody(handle: DiceBodyHandle): void {
    this.world.removeBody(handle.body);
  }

  step(deltaSeconds: number): void {
    this.world.step(1 / 60, Math.min(deltaSeconds, 0.05), 3);
  }

  isBodyStopped(handle: DiceBodyHandle): boolean {
    const velocity = handle.body.velocity.length();
    const angularVelocity = handle.body.angularVelocity.length();
    return velocity < 0.16 && angularVelocity < 0.22;
  }

  dispose(): void {
    this.world.removeBody(this.groundBody);
    for (const wall of this.wallBodies) {
      this.world.removeBody(wall);
    }
  }

  private addWall(position: CANNON.Vec3, halfExtents: CANNON.Vec3): void {
    const body = new CANNON.Body({
      mass: 0,
      material: this.floorMaterial,
      shape: new CANNON.Box(halfExtents),
      position,
    });
    this.world.addBody(body);
    this.wallBodies.push(body);
  }
}

function orientFacesOutward(vertices: THREE.Vector3[], faces: number[][]): number[][] {
  return faces.map((face) => {
    if (face.length < 3) {
      return face;
    }

    const a = vertices[face[0]];
    const b = vertices[face[1]];
    const c = vertices[face[2]];
    const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    const center = face
      .reduce((sum, vertexIndex) => sum.add(vertices[vertexIndex]), new THREE.Vector3())
      .multiplyScalar(1 / face.length);

    return normal.dot(center) < 0 ? [...face].reverse() : face;
  });
}
