import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import * as CANNON from "cannon-es";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import type { QiDie } from "../combat/types";
import type { QiZone } from "../combat/types";
import {
  type Dice3DState,
  type DiceRollResult,
  affinityFromNature,
  dieTypeFromSides,
  createDiceId,
} from "./diceTypes";
import { createDiceDefinition } from "./DiceGeometryFactory";
import { createDiceBodyMaterial, createFaceTexture } from "./DiceMaterialFactory";
import { createDiceMesh, type DiceMeshHandle } from "./DiceMesh";
import { DicePhysics, type DiceBodyHandle } from "./DicePhysics";
import {
  resolveDiceOverlap,
  getInitialDicePosition,
  clampToTray,
  TRAY_BOUNDS,
} from "./DicePlacementResolver";
import {
  resolveResultFromPose,
  initialQuaternionForMaxFaceDown,
} from "./DiceResultResolver";
import {
  type DiceRollAnimationPlan,
  createRollAnimationPlan,
  sampleRollAnimation,
} from "./DiceRollController";

// Import HDRI (Vite treats as URL when suffixed with ?url)
import studioHDRI from "../assets/materials/polyhaven/studio_small_03_1k.hdr?url";

// ============================================================
// Props (unchanged from original)
// ============================================================
export interface QiDiceTrayProps {
  dice: QiDie[];
  rolling: boolean;
  onRollComplete: (results: Array<{ id: string; value: number }>) => void;
  highlightedIds?: string[];
  selectedIds?: string[];
  onSelectDie?: (dieId: string) => void;
  /** @deprecated use slot system */
  canDragDie?: (dieId: string) => boolean;
  /** @deprecated */
  onDragStartDie?: (dieId: string) => void;
  /** @deprecated */
  onDragEndDie?: () => void;
  /** @deprecated */
  sorted?: boolean;
  compact?: boolean;
  slotDice?: { yin: string[]; yang: string[] };
  onAssignToSlot?: (dieId: string, slot: "yin" | "yang") => boolean;
  onRemoveFromSlot?: (dieId: string) => void;
  canInteract?: boolean;
}

// ============================================================
// Zone bounds (3D world space)
// ============================================================
const QI_HAI_BOUNDS = { minX: -1.4, maxX: 1.4, minZ: -1.55, maxZ: 0.85 };
const TEMP_QI_BOUNDS = { minX: -1.4, maxX: 1.4, minZ: 1.05, maxZ: 1.95 };
const YIN_SLOT_BOUNDS = { minX: -3.55, maxX: -1.65, minZ: -1.45, maxZ: 1.45 };
const YANG_SLOT_BOUNDS = { minX: 1.65, maxX: 3.55, minZ: -1.45, maxZ: 1.45 };

type SlotType = "yin" | "yang" | null;

function getSlotAtPosition(pos: THREE.Vector3): SlotType {
  if (pos.x >= YIN_SLOT_BOUNDS.minX && pos.x <= YIN_SLOT_BOUNDS.maxX &&
      pos.z >= YIN_SLOT_BOUNDS.minZ && pos.z <= YIN_SLOT_BOUNDS.maxZ) return "yin";
  if (pos.x >= YANG_SLOT_BOUNDS.minX && pos.x <= YANG_SLOT_BOUNDS.maxX &&
      pos.z >= YANG_SLOT_BOUNDS.minZ && pos.z <= YANG_SLOT_BOUNDS.maxZ) return "yang";
  return null;
}

function getZonePosition(zone: QiZone): THREE.Vector3 {
  switch (zone) {
    case "YIN_SLOT": return new THREE.Vector3(-2.6, 0, 0);
    case "YANG_SLOT": return new THREE.Vector3(2.6, 0, 0);
    case "TEMP_QI": return new THREE.Vector3(0, 0, 1.5);
    case "QI_SEA": return new THREE.Vector3(
      (Math.random() - 0.5) * 2.4, 0, (Math.random() - 0.5) * 2.0
    );
    default: return new THREE.Vector3(0, 0, 0);
  }
}

function qiDieToDiceState(die: QiDie): Dice3DState {
  return {
    id: die.id,
    type: dieTypeFromSides(die.sides),
    affinity: affinityFromNature(die.nature),
    result: die.value ?? null,
    position: getZonePosition(die.zone as QiZone),
    radius: 0,
    rotation: new THREE.Euler(),
    isRolling: false,
    isDragging: false,
    lastResult: die.value ?? null,
  };
}

// ============================================================
// Internal per-die 3D state
// ============================================================
interface SceneDie {
  meshHandle: DiceMeshHandle;
  bodyHandle: DiceBodyHandle;
  definition: ReturnType<typeof createDiceDefinition>;
  rollPlan: DiceRollAnimationPlan | null;
  rollStartTime: number;
  predeterminedResult: number | null;
}

// ============================================================
// Component
// ============================================================
export function QiDiceTray({
  dice,
  rolling,
  onRollComplete,
  highlightedIds = [],
  selectedIds = [],
  onSelectDie,
  canDragDie: _canDragDie,
  compact = false,
  slotDice = { yin: [], yang: [] },
  onAssignToSlot,
  onRemoveFromSlot,
  canInteract = true,
}: QiDiceTrayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const physicsRef = useRef<DicePhysics | null>(null);
  const sceneDiceRef = useRef<Map<string, SceneDie>>(new Map());
  const frameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const latestDiceRef = useRef<QiDie[]>(dice);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const pointerRef = useRef<{
    dieId: string | null;
    startX: number;
    startY: number;
    startPos: THREE.Vector3;
    isDragging: boolean;
    moved: boolean;
    startTime: number;
  }>({ dieId: null, startX: 0, startY: 0, startPos: new THREE.Vector3(), isDragging: false, moved: false, startTime: 0 });

  // Keep latest dice ref in sync
  latestDiceRef.current = dice;

  // ============================================================
  // Scene Setup
  // ============================================================
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const w = container.clientWidth || 800;
    const h = compact ? 160 : container.clientHeight || 400;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    sceneRef.current = scene;

    // Camera — top-down isometric
    const camera = new THREE.PerspectiveCamera(45, w / Math.max(1, h), 0.1, 100);
    camera.position.set(0, 9.4, 0.28);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // HDRI environment map
    new RGBELoader().load(studioHDRI, (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = texture;
      scene.background = new THREE.Color(0x050505);
    });

    // Lights
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9f8f79, 1.9));
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.4);
    dirLight.position.set(4, 7, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(512, 512);
    scene.add(dirLight);

    // Tray floor
    const trayGeo = new THREE.BoxGeometry(8.2, 0.18, 7.2);
    const trayMat = new THREE.MeshStandardMaterial({ color: 0x2a2218, roughness: 0.78 });
    const tray = new THREE.Mesh(trayGeo, trayMat);
    tray.position.y = -0.1;
    tray.receiveShadow = true;
    scene.add(tray);

    // Tray walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a3028, roughness: 0.72 });
    const walls: Array<[number, number, number, number, number, number]> = [
      [0, 0.12, -3.55, 8.2, 0.24, 0.24],  // north
      [0, 0.12, 3.55, 8.2, 0.24, 0.24],   // south
      [-4.15, 0.12, 0, 0.24, 0.24, 7.2],  // west
      [4.15, 0.12, 0, 0.24, 0.24, 7.2],   // east
    ];
    walls.forEach(([x, y, z, w, h2, d]) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h2, d), wallMat);
      wall.position.set(x, y, z);
      wall.receiveShadow = true;
      scene.add(wall);
    });

    // Slot indicators — subtle colored base plates
    const yinSlotGeo = new THREE.BoxGeometry(1.9, 0.02, 2.9);
    const yinSlotMat = new THREE.MeshStandardMaterial({
      color: 0x1a2a3a, roughness: 0.5, transparent: true, opacity: 0.35
    });
    const yinPlate = new THREE.Mesh(yinSlotGeo, yinSlotMat);
    yinPlate.position.set(-2.6, -0.05, 0);
    scene.add(yinPlate);

    const yangSlotGeo = new THREE.BoxGeometry(1.9, 0.02, 2.9);
    const yangSlotMat = new THREE.MeshStandardMaterial({
      color: 0x3a2a1a, roughness: 0.5, transparent: true, opacity: 0.35
    });
    const yangPlate = new THREE.Mesh(yangSlotGeo, yangSlotMat);
    yangPlate.position.set(2.6, -0.05, 0);
    scene.add(yangPlate);

    // Physics
    const physics = new DicePhysics();
    physicsRef.current = physics;

    // Resize handler
    const onResize = () => {
      const cw = container.clientWidth || 800;
      const ch = compact ? 160 : container.clientHeight || 400;
      camera.aspect = cw / Math.max(1, ch);
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    };
    window.addEventListener("resize", onResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(frameRef.current);
      sceneDiceRef.current.forEach((sd) => sd.meshHandle.dispose());
      sceneDiceRef.current.clear();
      physics.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================
  // Dice Sync — create/update/remove 3D dice when props.dice changes
  // ============================================================
  useEffect(() => {
    const scene = sceneRef.current;
    const physics = physicsRef.current;
    if (!scene || !physics) return;

    const currentIds = new Set(dice.map((d) => d.id));
    const existingIds = new Set(sceneDiceRef.current.keys());

    // Remove dice no longer present
    existingIds.forEach((id) => {
      if (!currentIds.has(id)) {
        const sd = sceneDiceRef.current.get(id)!;
        scene.remove(sd.meshHandle.mesh);
        physics.removeBody(sd.bodyHandle);
        sd.meshHandle.dispose();
        sceneDiceRef.current.delete(id);
      }
    });

    // Add new dice
    dice.forEach((die, index) => {
      if (sceneDiceRef.current.has(die.id)) return;

      const state = qiDieToDiceState(die);
      const definition = createDiceDefinition(state.type);
      const bodyMat = createDiceBodyMaterial(state.affinity);
      const meshHandle = createDiceMesh(state);
      scene.add(meshHandle.mesh);

      // Position within zone
      const zonePos = getZonePosition(die.zone as QiZone);
      const pos = clampToTray(new THREE.Vector3(
        zonePos.x + (Math.random() - 0.5) * 0.8,
        0,
        zonePos.z + (Math.random() - 0.5) * 0.8,
      ), definition.radius);
      meshHandle.mesh.position.copy(pos);

      const bodyHandle = physics.createDiceBody(
        die.id, state.type, pos,
        definition.physicsVertices, definition.physicsFaces,
      );

      const sd: SceneDie = {
        meshHandle,
        bodyHandle,
        definition,
        rollPlan: null,
        rollStartTime: 0,
        predeterminedResult: null,
      };
      sceneDiceRef.current.set(die.id, sd);
    });

    // Update positions for non-rolling dice
    dice.forEach((die) => {
      const sd = sceneDiceRef.current.get(die.id);
      if (!sd || sd.rollPlan) return;
      // Only update if zone changed
      const zonePos = getZonePosition(die.zone as QiZone);
      if (sd.meshHandle.mesh.position.distanceTo(zonePos) > 2) {
        const pos = clampToTray(zonePos, sd.definition.radius);
        sd.meshHandle.mesh.position.copy(pos);
        sd.bodyHandle.body.position.set(pos.x, pos.y, pos.z);
      }
    });
  }, [dice]);

  // ============================================================
  // Rolling trigger
  // ============================================================
  const startRoll = useCallback((dieIds?: string[]) => {
    const targets = dieIds
      ? dieIds.map((id) => sceneDiceRef.current.get(id)).filter(Boolean) as SceneDie[]
      : Array.from(sceneDiceRef.current.values());

    targets.forEach((sd) => {
      const dieState = latestDiceRef.current.find((d) => d.id === sd.bodyHandle.id);
      if (!dieState) return;

      const startQuat = sd.meshHandle.mesh.quaternion.clone();
      const targetValue = Math.floor(Math.random() * dieState.sides) + 1;
      sd.predeterminedResult = targetValue;
      sd.rollPlan = createRollAnimationPlan(sd.definition, startQuat, targetValue);
      sd.rollStartTime = performance.now();
    });
  }, []);

  useEffect(() => {
    if (!rolling || sceneDiceRef.current.size === 0) return;
    // Small delay to let dice sync complete
    const timer = setTimeout(() => startRoll(), 50);
    return () => clearTimeout(timer);
  }, [rolling, startRoll]);

  // ============================================================
  // Pointer events — drag and click
  // ============================================================
  useEffect(() => {
    const container = containerRef.current;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    const physics = physicsRef.current;
    if (!container || !renderer || !camera || !scene || !physics) return;

    const getPointerNDC = (e: PointerEvent): THREE.Vector2 => {
      const rect = container.getBoundingClientRect();
      return new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
    };

    const pickDie = (e: PointerEvent): SceneDie | null => {
      const ndc = getPointerNDC(e);
      raycasterRef.current.setFromCamera(ndc, camera);
      const meshes = Array.from(sceneDiceRef.current.values()).map((sd) => sd.meshHandle.mesh);
      const hits = raycasterRef.current.intersectObjects(meshes, false);
      if (hits.length === 0) return null;
      const hitMesh = hits[0].object as THREE.Mesh;
      return Array.from(sceneDiceRef.current.values()).find((sd) => sd.meshHandle.mesh === hitMesh || sd.meshHandle.mesh.children.includes(hitMesh)) ?? null;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!canInteract) return;
      const sd = pickDie(e);
      if (!sd) return;

      pointerRef.current = {
        dieId: sd.bodyHandle.id,
        startX: e.clientX,
        startY: e.clientY,
        startPos: sd.meshHandle.mesh.position.clone(),
        isDragging: false,
        moved: false,
        startTime: performance.now(),
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      const ptr = pointerRef.current;
      if (!ptr.dieId) return;
      const sd = sceneDiceRef.current.get(ptr.dieId);
      if (!sd) return;

      const dx = e.clientX - ptr.startX;
      const dy = e.clientY - ptr.startY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const elapsed = performance.now() - ptr.startTime;

      if (!ptr.isDragging && (dist > 6 || elapsed > 180)) {
        ptr.isDragging = true;
        // Lift die
        sd.meshHandle.mesh.position.y += 0.55;
        sd.meshHandle.mesh.scale.setScalar(1.15);
      }

      if (ptr.isDragging) {
        ptr.moved = true;
        const ndc = getPointerNDC(e);
        raycasterRef.current.setFromCamera(ndc, camera);
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.05);
        const target = new THREE.Vector3();
        raycasterRef.current.ray.intersectPlane(plane, target);
        if (target) {
          const clamped = clampToTray(target, sd.definition.radius);
          sd.meshHandle.mesh.position.set(clamped.x, 0.55, clamped.z);
          sd.bodyHandle.body.position.set(clamped.x, 0.55, clamped.z);
          sd.bodyHandle.body.velocity.set(0, 0, 0);
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const ptr = pointerRef.current;
      if (!ptr.dieId) return;
      const sd = sceneDiceRef.current.get(ptr.dieId);
      if (!sd) { ptr.dieId = null; return; }

      if (ptr.isDragging && ptr.moved) {
        // Drop die — check slot
        sd.meshHandle.mesh.position.y = 0;
        sd.meshHandle.mesh.scale.setScalar(1);
        const pos = sd.meshHandle.mesh.position.clone();
        const slot = getSlotAtPosition(pos);

        if (slot && onAssignToSlot) {
          const ok = onAssignToSlot(ptr.dieId, slot);
          if (!ok) {
            // Snap back
            sd.meshHandle.mesh.position.copy(ptr.startPos);
            sd.bodyHandle.body.position.set(ptr.startPos.x, ptr.startPos.y, ptr.startPos.z);
          } else {
            // Clamp to slot zone
            const bounds = slot === "yin" ? YIN_SLOT_BOUNDS : YANG_SLOT_BOUNDS;
            pos.x = Math.max(bounds.minX + sd.definition.radius, Math.min(bounds.maxX - sd.definition.radius, pos.x));
            pos.z = Math.max(bounds.minZ + sd.definition.radius, Math.min(bounds.maxZ - sd.definition.radius, pos.z));
            sd.meshHandle.mesh.position.set(pos.x, 0, pos.z);
            sd.bodyHandle.body.position.set(pos.x, 0, pos.z);
          }
        }

        // Resolve overlaps after drag
        const diceMap = new Map<string, THREE.Vector3>();
        sceneDiceRef.current.forEach((s, id) => {
          diceMap.set(id, s.meshHandle.mesh.position.clone());
        });
        const resolved = resolveDiceOverlap(
          Array.from(sceneDiceRef.current.entries()).map(([id, s]) => ({
            id,
            position: s.meshHandle.mesh.position.clone(),
            radius: s.definition.radius,
          })),
          undefined,
        );
        resolved.forEach((pos, id) => {
          const s = sceneDiceRef.current.get(id);
          if (s && s !== sd) {
            s.meshHandle.mesh.position.copy(pos);
            s.bodyHandle.body.position.set(pos.x, pos.y, pos.z);
          }
        });
      } else if (!ptr.moved) {
        // Click — select die
        onSelectDie?.(ptr.dieId);
      }

      ptr.dieId = null;
      ptr.isDragging = false;
      ptr.moved = false;
    };

    container.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      container.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [canInteract, onSelectDie, onAssignToSlot]);

  // ============================================================
  // Animation Loop
  // ============================================================
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    const physics = physicsRef.current;
    if (!scene || !camera || !renderer || !physics) return;

    let running = true;
    lastTimeRef.current = performance.now();

    function loop(now: number) {
      if (!running) return;
      const delta = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;

      // Step physics
      physics!.step(delta);

      // Sync physics bodies to meshes (for non-animated dice)
      sceneDiceRef.current.forEach((sd) => {
        if (sd.rollPlan) return; // animated dice handled below
        sd.meshHandle.mesh.position.copy(sd.bodyHandle.body.position as unknown as THREE.Vector3);
        sd.meshHandle.mesh.quaternion.copy(sd.bodyHandle.body.quaternion as unknown as THREE.Quaternion);
      });

      // Process roll animations
      const completed: DiceRollResult[] = [];
      sceneDiceRef.current.forEach((sd) => {
        if (!sd.rollPlan) return;
        const elapsed = now - sd.rollStartTime;
        const sample = sampleRollAnimation(sd.rollPlan, elapsed);

        sd.meshHandle.mesh.quaternion.copy(sample.quaternion);
        sd.meshHandle.mesh.position.y = sample.lift;
        sd.bodyHandle.body.position.set(
          sd.meshHandle.mesh.position.x,
          sample.lift,
          sd.meshHandle.mesh.position.z,
        );
        sd.bodyHandle.body.quaternion.copy(sample.quaternion as unknown as CANNON.Quaternion);

        if (sample.done) {
          sd.meshHandle.mesh.position.y = 0;
          const q = sd.meshHandle.mesh.quaternion;
          const result = resolveResultFromPose(sd.definition, q as unknown as THREE.Quaternion);
          completed.push({ id: sd.bodyHandle.id, value: result });
          sd.rollPlan = null;
        }
      });

      // Notify completion
      if (completed.length > 0 && onRollComplete) {
        onRollComplete(completed);
      }

      // Highlight selected dice
      sceneDiceRef.current.forEach((sd) => {
        const isSelected = selectedIds.includes(sd.bodyHandle.id);
        const edges = sd.meshHandle.mesh.children.find(
          (c) => c instanceof THREE.LineSegments,
        ) as THREE.LineSegments | undefined;
        if (edges) {
          (edges.material as THREE.LineBasicMaterial).color.set(
            isSelected ? 0xffd76b : 0x888888,
          );
        }
      });

      renderer!.render(scene!, camera!);
      frameRef.current = requestAnimationFrame(loop);
    }

    frameRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(frameRef.current);
    };
  }, [selectedIds, onRollComplete]);

  // ============================================================
  // Render
  // ============================================================
  return (
    <div
      ref={containerRef}
      className="qi-dice-tray-container"
      style={{
        width: "100%",
        height: compact ? 160 : "100%",
        position: "relative",
        overflow: "hidden",
        borderRadius: 8,
        cursor: canInteract ? "grab" : "default",
        background: "#050505",
      }}
    />
  );
}
