import { RefObject, useEffect, useRef } from "react";
import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { DicePhysics, type DiceBodyHandle } from "./DicePhysics";
import { createDiceMesh } from "./DiceMesh";
import type { Dice3DState } from "./diceTypes";
import { createRollAnimationPlan, sampleRollAnimation, type DiceRollAnimationPlan } from "./DiceRollController";
import { clampToTray, resolveDiceOverlap, type DicePlacementItem } from "./DicePlacementResolver";
import { createPredeterminedResult, resolveResultFromPose } from "./DiceResultResolver";

interface DiceSceneProps {
  dice: Dice3DState[];
  rollingToken: number;
  singleRollRequest: { id: string; token: number } | null;
  onRollStart: (ids: string[]) => void;
  onRollComplete: (results: Array<{ id: string; value: number }>) => void;
  onDiePositionChange: (id: string, position: THREE.Vector3) => void;
  onDicePositionChange: (positions: Array<{ id: string; position: THREE.Vector3 }>) => void;
  onRollOne: (id: string) => void;
  resultMode?: "predetermined" | "physics";
  skipAnimation?: boolean;
}

interface SceneDie {
  id: string;
  visual: ReturnType<typeof createDiceMesh>;
  body: DiceBodyHandle;
  rollPlan: DiceRollAnimationPlan | null;
  rollStartedAt: number;
  baseY: number;
  predeterminedResult: number | null;
}

interface PointerState {
  pointerId: number;
  dieId: string;
  startX: number;
  startY: number;
  startPosition: THREE.Vector3;
  lastLegalPosition: THREE.Vector3;
  isDragging: boolean;
  downAt: number;
}

const DRAG_DELAY_MS = 180;
const DRAG_DISTANCE_PX = 6;
const STUDIO_HDRI_URL = new URL("../assets/materials/polyhaven/studio_small_03_1k.hdr", import.meta.url).href;

declare global {
  interface Window {
    __diceSceneDebug?: {
      rolling: Array<{ id: string; elapsed: number; duration: number }>;
      dice: Array<{ id: string; x: number; z: number; radius: number }>;
      dieCount: number;
      frameNow: number;
    };
  }
}

export function DiceScene({
  dice,
  rollingToken,
  singleRollRequest,
  onRollStart,
  onRollComplete,
  onDiePositionChange,
  onDicePositionChange,
  onRollOne,
  resultMode = "physics",
  skipAnimation = false,
}: DiceSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const physicsRef = useRef<DicePhysics | null>(null);
  const sceneDiceRef = useRef<Map<string, SceneDie>>(new Map());
  const frameRef = useRef<number | null>(null);
  const pointerRef = useRef<PointerState | null>(null);
  const lastTimeRef = useRef(performance.now());
  const latestDiceRef = useRef<Dice3DState[]>(dice);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerNdcRef = useRef(new THREE.Vector2());

  useEffect(() => setupScene(containerRef, sceneRef, cameraRef, rendererRef, physicsRef, frameRef), []);

  useEffect(() => {
    latestDiceRef.current = dice;
    const scene = sceneRef.current;
    const physics = physicsRef.current;
    if (!scene || !physics) {
      return;
    }

    const active = sceneDiceRef.current;
    for (const existing of active.values()) {
      if (!dice.some((item) => item.id === existing.id)) {
        scene.remove(existing.visual.mesh);
        physics.removeBody(existing.body);
        existing.visual.dispose();
        active.delete(existing.id);
      }
    }

    dice.forEach((die) => {
      const existing = active.get(die.id);
      if (existing) {
        if (!existing.rollPlan && pointerRef.current?.dieId !== die.id) {
          existing.visual.mesh.position.copy(die.position);
          existing.body.body.position.set(die.position.x, die.position.y, die.position.z);
        }
        return;
      }

      const visual = createDiceMesh(die);
      visual.mesh.position.copy(die.position);
      scene.add(visual.mesh);
      const body = physics.createDiceBody(
        die.id,
        die.type,
        visual.mesh.position,
        visual.physicsVertices,
        visual.physicsFaces,
      );
      body.body.quaternion.set(
        visual.mesh.quaternion.x,
        visual.mesh.quaternion.y,
        visual.mesh.quaternion.z,
        visual.mesh.quaternion.w,
      );
      active.set(die.id, {
        id: die.id,
        visual,
        body,
        rollPlan: null,
        rollStartedAt: 0,
        baseY: die.position.y,
        predeterminedResult: null,
      });
    });
  }, [dice]);

  useEffect(() => {
    if (rollingToken === 0) {
      return;
    }
    startRoll(Array.from(sceneDiceRef.current.keys()));
  }, [rollingToken]);

  useEffect(() => {
    if (!singleRollRequest) {
      return;
    }
    startRoll([singleRollRequest.id]);
  }, [singleRollRequest]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const activeContainer = container;

    function onPointerDown(event: PointerEvent) {
      const die = pickDie(event);
      if (!die) {
        return;
      }
      event.preventDefault();
      activeContainer.setPointerCapture(event.pointerId);
      pointerRef.current = {
        pointerId: event.pointerId,
        dieId: die.id,
        startX: event.clientX,
        startY: event.clientY,
        startPosition: die.visual.mesh.position.clone(),
        lastLegalPosition: die.visual.mesh.position.clone(),
        isDragging: false,
        downAt: performance.now(),
      };
    }

    function onPointerMove(event: PointerEvent) {
      const pointer = pointerRef.current;
      if (!pointer || pointer.pointerId !== event.pointerId) {
        return;
      }
      const die = sceneDiceRef.current.get(pointer.dieId);
      if (!die) {
        return;
      }
      const moved = Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY);
      const shouldDrag = pointer.isDragging || moved > DRAG_DISTANCE_PX || performance.now() - pointer.downAt > DRAG_DELAY_MS;
      if (!shouldDrag) {
        return;
      }
      pointer.isDragging = true;
      die.rollPlan = null;
      const point = getPointerTrayPoint(event);
      if (!point) {
        return;
      }
      const radius = die.visual.radius;
      const next = clampToTray(new THREE.Vector3(point.x, die.baseY, point.z), radius);
      pointer.lastLegalPosition.copy(next);
      die.visual.mesh.position.copy(next);
      die.body.body.position.set(next.x, next.y, next.z);
      onDiePositionChange(die.id, next.clone());
    }

    function onPointerUp(event: PointerEvent) {
      const pointer = pointerRef.current;
      if (!pointer || pointer.pointerId !== event.pointerId) {
        return;
      }
      const die = sceneDiceRef.current.get(pointer.dieId);
      pointerRef.current = null;
      if (!die) {
        return;
      }
      activeContainer.releasePointerCapture(event.pointerId);
      if (pointer.isDragging) {
        applyOverlapResolution(pointer.dieId);
        return;
      }
      onRollOne(pointer.dieId);
    }

    activeContainer.addEventListener("pointerdown", onPointerDown);
    activeContainer.addEventListener("pointermove", onPointerMove);
    activeContainer.addEventListener("pointerup", onPointerUp);
    activeContainer.addEventListener("pointercancel", onPointerUp);
    return () => {
      activeContainer.removeEventListener("pointerdown", onPointerDown);
      activeContainer.removeEventListener("pointermove", onPointerMove);
      activeContainer.removeEventListener("pointerup", onPointerUp);
      activeContainer.removeEventListener("pointercancel", onPointerUp);
    };
  }, [onDiePositionChange, onRollOne, onDicePositionChange]);

  useEffect(() => {
    function animate(now: number) {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const physics = physicsRef.current;
      const frameNow = performance.now();

      if (renderer && scene && camera && physics) {
        const delta = (frameNow - lastTimeRef.current) / 1000;
        lastTimeRef.current = frameNow;
        physics.step(delta);

        const completed: Array<{ id: string; value: number }> = [];
        const debugRolls: Array<{ id: string; elapsed: number; duration: number }> = [];

        for (const die of sceneDiceRef.current.values()) {
          if (die.rollPlan) {
            const elapsed = frameNow - die.rollStartedAt;
            debugRolls.push({ id: die.id, elapsed, duration: die.rollPlan.durationMs });
            const sample = sampleRollAnimation(die.rollPlan, elapsed);
            die.visual.mesh.quaternion.copy(sample.quaternion);
            die.visual.mesh.position.y = die.baseY + sample.lift;
            die.body.body.quaternion.set(sample.quaternion.x, sample.quaternion.y, sample.quaternion.z, sample.quaternion.w);
            die.body.body.position.set(die.visual.mesh.position.x, die.visual.mesh.position.y, die.visual.mesh.position.z);

            if (sample.done) {
              die.rollPlan = null;
              die.visual.mesh.position.y = die.baseY;
              die.body.body.position.y = die.baseY;
              const value =
                resultMode === "predetermined" && die.predeterminedResult
                  ? die.predeterminedResult
                  : resolveResultFromPose(die.visual.definition, die.visual.mesh.quaternion);
              completed.push({ id: die.id, value });
            }
          }
        }

        if (completed.length > 0) {
          applyOverlapResolution();
          onRollComplete(completed);
        }

        window.__diceSceneDebug = {
          rolling: debugRolls,
          dice: Array.from(sceneDiceRef.current.values()).map((die) => ({
            id: die.id,
            x: die.visual.mesh.position.x,
            z: die.visual.mesh.position.z,
            radius: die.visual.radius,
          })),
          dieCount: sceneDiceRef.current.size,
          frameNow,
        };

        renderer.render(scene, camera);
      }

      frameRef.current = window.requestAnimationFrame(animate);
    }

    frameRef.current = window.requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [onRollComplete, resultMode, onDicePositionChange]);

  function startRoll(ids: string[]) {
    const now = performance.now();
    const startedIds: string[] = [];
    for (const id of ids) {
      const die = sceneDiceRef.current.get(id);
      if (!die || pointerRef.current?.dieId === id) {
        continue;
      }
      die.predeterminedResult = resultMode === "predetermined" ? createPredeterminedResult(die.visual.definition) : null;
      die.rollStartedAt = now;
      die.rollPlan = sampleSkipOrCreatePlan(die, skipAnimation);
      startedIds.push(id);
    }
    if (startedIds.length > 0) {
      onRollStart(startedIds);
    }
  }

  function sampleSkipOrCreatePlan(die: SceneDie, skip: boolean): DiceRollAnimationPlan {
    const plan = createRollAnimationPlan(die.visual.definition, die.visual.mesh.quaternion, die.predeterminedResult ?? undefined);
    if (skip) {
      plan.durationMs = 1;
      plan.spinTurns = 0;
      plan.bounceHeight = 0;
    }
    return plan;
  }

  function applyOverlapResolution(anchorId?: string) {
    const items: DicePlacementItem[] = Array.from(sceneDiceRef.current.values()).map((die) => ({
      id: die.id,
      radius: die.visual.radius,
      position: die.visual.mesh.position.clone(),
    }));
    const resolved = resolveDiceOverlap(items, anchorId);
    const changed: Array<{ id: string; position: THREE.Vector3 }> = [];
    for (const die of sceneDiceRef.current.values()) {
      const position = resolved.get(die.id);
      if (!position) {
        continue;
      }
      position.y = die.baseY;
      die.visual.mesh.position.copy(position);
      die.body.body.position.set(position.x, position.y, position.z);
      changed.push({ id: die.id, position: position.clone() });
    }
    if (changed.length > 0) {
      onDicePositionChange(changed);
    }
  }

  function pickDie(event: PointerEvent): SceneDie | null {
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    if (!camera || !renderer) {
      return null;
    }
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNdcRef.current.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycasterRef.current.setFromCamera(pointerNdcRef.current, camera);
    const dice = Array.from(sceneDiceRef.current.values());
    const intersections = raycasterRef.current.intersectObjects(
      dice.map((die) => die.visual.mesh),
      false,
    );
    const hit = intersections[0]?.object;
    return dice.find((die) => die.visual.mesh === hit) ?? null;
  }

  function getPointerTrayPoint(event: PointerEvent): THREE.Vector3 | null {
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    if (!camera || !renderer) {
      return null;
    }
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNdcRef.current.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycasterRef.current.setFromCamera(pointerNdcRef.current, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.05);
    const point = new THREE.Vector3();
    return raycasterRef.current.ray.intersectPlane(plane, point) ? point : null;
  }

  return <div className="scene-container" ref={containerRef} aria-label="3D dice rolling area" />;
}

function setupScene(
  containerRef: RefObject<HTMLDivElement | null>,
  sceneRef: RefObject<THREE.Scene | null>,
  cameraRef: RefObject<THREE.PerspectiveCamera | null>,
  rendererRef: RefObject<THREE.WebGLRenderer | null>,
  physicsRef: RefObject<DicePhysics | null>,
  frameRef: RefObject<number | null>,
) {
  const container = containerRef.current;
  if (!container) {
    return () => undefined;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#f5efe4");
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 9.4, 0.28);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  let environmentTexture: THREE.Texture | null = null;
  let disposed = false;
  new RGBELoader().load(STUDIO_HDRI_URL, (texture) => {
    if (disposed) {
      texture.dispose();
      return;
    }
    texture.mapping = THREE.EquirectangularReflectionMapping;
    environmentTexture = texture;
    scene.environment = texture;
  });

  scene.add(new THREE.HemisphereLight("#ffffff", "#9f8f79", 1.9));

  const keyLight = new THREE.DirectionalLight("#ffffff", 2.4);
  keyLight.position.set(4, 7, 5);
  keyLight.castShadow = true;
  scene.add(keyLight);

  const tray = new THREE.Mesh(
    new THREE.BoxGeometry(8.2, 0.18, 7.2),
    new THREE.MeshStandardMaterial({ color: "#d9c9af", roughness: 0.8 }),
  );
  tray.position.y = -0.1;
  tray.receiveShadow = true;
  scene.add(tray);

  const rimMaterial = new THREE.MeshStandardMaterial({ color: "#8e7656", roughness: 0.75 });
  [
    { x: 0, z: -3.65, sx: 8.4, sz: 0.22 },
    { x: 0, z: 3.65, sx: 8.4, sz: 0.22 },
    { x: -4.2, z: 0, sx: 0.22, sz: 7.2 },
    { x: 4.2, z: 0, sx: 0.22, sz: 7.2 },
  ].forEach((rim) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(rim.sx, 0.55, rim.sz), rimMaterial);
    mesh.position.set(rim.x, 0.22, rim.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  });

  const physics = new DicePhysics();
  sceneRef.current = scene;
  cameraRef.current = camera;
  rendererRef.current = renderer;
  physicsRef.current = physics;

  function resize() {
    if (!containerRef.current || !cameraRef.current || !rendererRef.current) {
      return;
    }
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();
    rendererRef.current.setSize(width, height);
  }

  window.addEventListener("resize", resize);

  return () => {
    disposed = true;
    window.removeEventListener("resize", resize);
    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current);
    }
    environmentTexture?.dispose();
    physics.dispose();
    renderer.dispose();
    container.removeChild(renderer.domElement);
  };
}
