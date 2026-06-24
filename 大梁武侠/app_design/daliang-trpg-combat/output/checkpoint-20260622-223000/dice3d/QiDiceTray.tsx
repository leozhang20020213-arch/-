import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { QiDie } from "../combat/types";

// ============================================================
// QiDiceTray — Inline 3D Dice Tray with 5-phase animation
//
// Phase 1: ENTRY   — Dice fly in from frame edges (staggered, 400ms each)
// Phase 2: PHYSICS — Dice collide, bounce, and settle (~1.5s)
// Phase 3: SORT    — Dice animate to sorted grid positions (500ms)
// Phase 4: REVEAL  — Dice rotate value-face toward camera (300ms)
// Phase 5: READY   — Dice are draggable to yin/yang slots
// ============================================================

export interface QiDiceTrayProps {
  dice: QiDie[];
  rolling: boolean;
  onRollComplete: (results: Array<{ id: string; value: number }>) => void;
  highlightedIds?: string[];
  selectedIds?: string[];
  onSelectDie?: (dieId: string) => void;
  /** @deprecated use new slot system */
  canDragDie?: (dieId: string) => boolean;
  /** @deprecated use new slot system */
  onDragStartDie?: (dieId: string) => void;
  /** @deprecated use new slot system */
  onDragEndDie?: () => void;
  /** @deprecated sorting is now always applied in Phase 3 */
  sorted?: boolean;
  compact?: boolean;
  slotDice?: { yin: string[]; yang: string[] };
  onAssignToSlot?: (dieId: string, slot: "yin" | "yang") => boolean;
  onRemoveFromSlot?: (dieId: string) => void;
  canInteract?: boolean;
}

// ============================================================
// Phase enum
// ============================================================
const Phase = {
  IDLE: 0,
  ENTRY: 1,
  PHYSICS: 2,
  SORT: 3,
  REVEAL: 4,
  READY: 5,
  ROLLING: 6,
} as const;
type Phase = (typeof Phase)[keyof typeof Phase];

// ============================================================
// Constants
// ============================================================
const ENTRY_DURATION = 560;       // ms per die
const ENTRY_STAGGER = 70;         // ms stagger between dice
const PHYSICS_DURATION = 2200;    // ms max for physics settle
const SORT_DURATION = 520;        // ms for sort animation
const REVEAL_DURATION = 360;      // ms for reveal rotation
const REVEAL_STAGGER = 45;        // ms stagger for reveal

const QI_HAI_BOUNDS = {
  xMin: -1.4, xMax: 1.4,
  zMin: -1.55, zMax: 0.85,
};
const TEMP_QI_BOUNDS = {
  xMin: -1.4, xMax: 1.4,
  zMin: 1.05, zMax: 1.95,
};
const YIN_SLOT_BOUNDS = {
  xMin: -3.55, xMax: -1.65,
  zMin: -1.45, zMax: 1.45,
};
const YANG_SLOT_BOUNDS = {
  xMin: 1.65, xMax: 3.55,
  zMin: -1.45, zMax: 1.45,
};

const DIE_REST_Y = 0.10;
const DRAG_LIFT_Y = 0.55;
const DRAG_SCALE = 1.15;

// ============================================================
// Geometry helpers — kept from existing code
// ============================================================

interface DieFace {
  normal: THREE.Vector3;
  vertices: THREE.Vector3[];
}

function extractFaces(geometry: THREE.BufferGeometry): DieFace[] {
  const positions = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const faceMap = new Map<string, DieFace>();
  const eps = 0.001;

  const triCount = index ? index.count / 3 : positions.count / 3;
  for (let t = 0; t < triCount; t++) {
    const i0 = index ? index.getX(t * 3) : t * 3;
    const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;
    const a = new THREE.Vector3(positions.getX(i0), positions.getY(i0), positions.getZ(i0));
    const b = new THREE.Vector3(positions.getX(i1), positions.getY(i1), positions.getZ(i1));
    const c = new THREE.Vector3(positions.getX(i2), positions.getY(i2), positions.getZ(i2));
    const normal = new THREE.Vector3()
      .crossVectors(new THREE.Vector3().subVectors(b, a), new THREE.Vector3().subVectors(c, a))
      .normalize();
    const key = `${Math.round(normal.x / eps) * eps},${Math.round(normal.y / eps) * eps},${Math.round(normal.z / eps) * eps}`;
    if (!faceMap.has(key)) faceMap.set(key, { normal: normal.clone(), vertices: [] });
  }
  return Array.from(faceMap.values());
}

const DIE_GEOM_SPECS: Record<string, { create: () => THREE.BufferGeometry; faceValues: number[] }> = {
  D4: {
    create: () => new THREE.TetrahedronGeometry(0.92, 0),
    faceValues: [1, 2, 3, 4],
  },
  D6: {
    create: () => new THREE.BoxGeometry(1.32, 1.32, 1.32, 1, 1, 1),
    faceValues: [1, 6, 3, 4, 2, 5],
  },
  D8: {
    create: () => new THREE.OctahedronGeometry(0.92, 0),
    faceValues: [1, 2, 3, 4, 5, 6, 7, 8],
  },
  D10: {
    create: () => {
      const geo = new THREE.BufferGeometry();
      const n = 5;
      const top = new THREE.Vector3(0, 0.72, 0);
      const bot = new THREE.Vector3(0, -0.72, 0);
      const positions: number[] = [];
      const indices: number[] = [];
      for (let i = 0; i < n; i++) {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        const r = 0.56;
        positions.push(Math.cos(angle) * r, 0.27, Math.sin(angle) * r);
        positions.push(Math.cos(angle + Math.PI / n) * r, -0.27, Math.sin(angle + Math.PI / n) * r);
      }
      for (let i = 0; i < n; i++) {
        const t0 = i * 2;
        const t1 = (i * 2 + 2) % (n * 2);
        const b0 = i * 2 + 1;
        const b1 = (i * 2 + 3) % (n * 2);
        indices.push(b0, b1, t1, t0, t1, b0, b1, t1, t1);
      }
      const topIdx = positions.length / 3;
      positions.push(top.x, top.y, top.z);
      const botIdx = positions.length / 3;
      positions.push(bot.x, bot.y, bot.z);
      for (let i = 0; i < n; i++) {
        const t0 = i * 2;
        const t1 = (i * 2 + 2) % (n * 2);
        indices.push(t0, t1, topIdx);
      }
      for (let i = 0; i < n; i++) {
        const b0 = i * 2 + 1;
        const b1 = (i * 2 + 3) % (n * 2);
        indices.push(botIdx, b1, b0);
      }
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      return geo;
    },
    faceValues: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  },
  D12: {
    create: () => new THREE.DodecahedronGeometry(0.60, 0),
    faceValues: Array.from({ length: 12 }, (_, i) => i + 1),
  },
  D20: {
    create: () => new THREE.IcosahedronGeometry(0.64, 0),
    faceValues: Array.from({ length: 20 }, (_, i) => i + 1),
  },
};

function sidesToDieType(sides: number): string {
  return `D${sides}`;
}

// ============================================================
// Materials
// ============================================================

function createDieMaterial(nature: string): THREE.MeshStandardMaterial {
  const colors: Record<string, { body: number; roughness: number; metalness: number; emissive: number; emissiveIntensity: number }> = {
    yin: { body: 0x0a0a0a, roughness: 0.48, metalness: 0.18, emissive: 0x111111, emissiveIntensity: 0.25 },
    yang: { body: 0xfafaf5, roughness: 0.40, metalness: 0.06, emissive: 0x000000, emissiveIntensity: 0 },
    raw: { body: 0x144a80, roughness: 0.44, metalness: 0.22, emissive: 0x0a1a30, emissiveIntensity: 0.30 },
  };
  const c = colors[nature] ?? colors.raw;
  return new THREE.MeshStandardMaterial({
    color: c.body,
    roughness: c.roughness,
    metalness: c.metalness,
    emissive: new THREE.Color(c.emissive),
    emissiveIntensity: c.emissiveIntensity,
  });
}

function createFaceTexture(value: number, nature: string): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Background patch for the number to sit on
  if (nature === "yang") {
    // Light semi-transparent circle for contrast on white die
    ctx.fillStyle = "rgba(0,0,0,0.10)";
  } else if (nature === "yin") {
    // Slightly lighter patch so white text pops on pure black die
    ctx.fillStyle = "rgba(255,255,255,0.10)";
  } else {
    // raw — gold rim
    ctx.fillStyle = "rgba(0,0,0,0.15)";
  }
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 12, 0, Math.PI * 2);
  ctx.fill();

  // Outer ring for definition
  ctx.strokeStyle = nature === "raw" ? "rgba(242,193,78,0.45)" : "rgba(255,255,255,0.20)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 12, 0, Math.PI * 2);
  ctx.stroke();

  const colors: Record<string, string> = {
    yin: "#ffffff",
    yang: "#17120d",
    raw: "#f2c14e",
  };
  ctx.fillStyle = colors[nature] ?? colors.raw;
  ctx.font = "bold 180px 'Microsoft YaHei', 'PingFang SC', Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Subtle text shadow for depth
  ctx.shadowColor = nature === "yang" ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 6;
  ctx.fillText(String(value), size / 2, size / 2 + 4);
  ctx.shadowBlur = 0;

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createZoneLabelSprite(label: string, color: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(24, 18, 14, 0.68)";
  ctx.strokeStyle = "rgba(232, 201, 137, 0.78)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(18, 28, 476, 72, 24);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = "bold 42px Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 256, 65);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.95, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.05, 0.26, 1);
  sprite.renderOrder = 10;
  return sprite;
}

function createShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.05,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, "rgba(0,0,0,0.45)");
  gradient.addColorStop(0.35, "rgba(0,0,0,0.22)");
  gradient.addColorStop(0.7, "rgba(0,0,0,0.06)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// ============================================================
// Face resolution
// ============================================================

function resolveUpFaceValue(
  faces: DieFace[],
  faceValues: number[],
  quat: THREE.Quaternion,
): number {
  if (faces.length === 0 || faceValues.length === 0) return 1;
  const worldUp = new THREE.Vector3(0, 1, 0);
  let best = 0;
  let bestDot = -Infinity;
  for (let i = 0; i < faces.length; i++) {
    const worldNormal = faces[i].normal.clone().applyQuaternion(quat).normalize();
    const dot = worldNormal.dot(worldUp);
    if (dot > bestDot) {
      bestDot = dot;
      best = i;
    }
  }
  return faceValues[best] ?? best + 1;
}

function initialQuatForMaxFaceDown(faces: DieFace[], faceValues: number[]): THREE.Quaternion {
  const worldDown = new THREE.Vector3(0, -1, 0);
  let best = 0;
  let bestDot = -Infinity;
  for (let i = 0; i < faces.length; i++) {
    const dot = faces[i].normal.dot(worldDown);
    if (dot > bestDot) {
      bestDot = dot;
      best = i;
    }
  }
  const axis = new THREE.Vector3()
    .crossVectors(faces[best].normal.clone().normalize(), worldDown)
    .normalize();
  const angle = Math.acos(Math.min(1, faces[best].normal.clone().normalize().dot(worldDown)));
  return new THREE.Quaternion().setFromAxisAngle(
    axis.length() < 0.01 ? new THREE.Vector3(1, 0, 0) : axis,
    angle,
  );
}

function computeValueUpQuat(dieType: string, value: number): THREE.Quaternion | null {
  const spec = DIE_GEOM_SPECS[dieType];
  if (!spec) return null;
  const faces = extractFaces(spec.create());
  const faceIndex = spec.faceValues.indexOf(value);
  if (faceIndex < 0 || faceIndex >= faces.length) return null;
  const upNormal = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  q.setFromUnitVectors(faces[faceIndex].normal.clone().normalize(), upNormal);
  return q;
}

// ============================================================
// Roll animation (kept for backward compat)
// ============================================================

interface RollPlan {
  targetValue: number;
  targetQuat: THREE.Quaternion;
  startQuat: THREE.Quaternion;
  spinAxis: THREE.Vector3;
  spinTurns: number;
  duration: number;
  bounceHeight: number;
}

function createRollPlan(dieType: string): RollPlan {
  const spec = DIE_GEOM_SPECS[dieType];
  const faces = extractFaces(spec.create());
  const targetValue = spec.faceValues[Math.floor(Math.random() * spec.faceValues.length)];
  const startQuat = initialQuatForMaxFaceDown(faces, spec.faceValues);
  const targetIdx = spec.faceValues.indexOf(targetValue);
  const targetFaceNormal = faces[targetIdx]?.normal ?? new THREE.Vector3(0, 1, 0);
  const targetQuat = new THREE.Quaternion().setFromUnitVectors(
    targetFaceNormal.clone().normalize(),
    new THREE.Vector3(0, 1, 0),
  );
  return {
    targetValue,
    targetQuat,
    startQuat,
    spinAxis: new THREE.Vector3(
      Math.random() - 0.5,
      0.3 + Math.random() * 0.4,
      Math.random() - 0.5,
    ).normalize(),
    spinTurns: 2 + Math.random() * 2,
    duration: 900 + Math.random() * 400,
    bounceHeight: 0.1 + Math.random() * 0.3,
  };
}

function sampleRollAnimation(
  plan: RollPlan,
  elapsed: number,
): { quat: THREE.Quaternion; yOffset: number; done: boolean } {
  const t = Math.min(1, elapsed / plan.duration);
  const ease = 1 - Math.pow(1 - t, 3);
  const quat = new THREE.Quaternion().slerpQuaternions(plan.startQuat, plan.targetQuat, ease);
  const spinAngle = plan.spinTurns * Math.PI * 2 * (1 - Math.pow(1 - t, 4));
  const spinQ = new THREE.Quaternion().setFromAxisAngle(plan.spinAxis, spinAngle);
  quat.premultiply(spinQ);
  const bounce = Math.sin(t * Math.PI) * plan.bounceHeight * (1 - t);
  return { quat, yOffset: bounce, done: t >= 1 };
}

// ============================================================
// Sorting & grid helpers
// ============================================================

const NATURE_SORT: Record<string, number> = { yin: 0, yang: 1, raw: 2 };

function sortedDiceForTray(dice: QiDie[], values?: Map<string, number>): QiDie[] {
  return [...dice].sort((a, b) => {
    const sideDiff = a.sides - b.sides;
    if (sideDiff !== 0) return sideDiff;
    const natureDiff = (NATURE_SORT[a.nature] ?? 9) - (NATURE_SORT[b.nature] ?? 9);
    if (natureDiff !== 0) return natureDiff;
    return (values?.get(b.id) ?? b.value ?? 0) - (values?.get(a.id) ?? a.value ?? 0);
  });
}

function trayPosition(index: number, count: number, compact: boolean): THREE.Vector3 {
  const columns = Math.min(5, Math.max(1, count));
  const rows = Math.ceil(count / columns);
  const col = index % columns;
  const row = Math.floor(index / columns);
  const spacingX = compact ? 1.45 : 1.75;
  const spacingZ = compact ? 1.35 : 1.55;
  const x = (col - (columns - 1) / 2) * spacingX;
  const z = (row - (rows - 1) / 2) * spacingZ;
  // Offset grid to be centered in QI_HAI zone
  const offsetX = (QI_HAI_BOUNDS.xMin + QI_HAI_BOUNDS.xMax) / 2;
  return new THREE.Vector3(x + offsetX, DIE_REST_Y, z);
}

function tempQiPosition(index: number, count: number, compact: boolean): THREE.Vector3 {
  const columns = Math.min(5, Math.max(1, count));
  const col = index % columns;
  const spacingX = compact ? 1.05 : 1.25;
  const x = (col - (columns - 1) / 2) * spacingX;
  const offsetX = (TEMP_QI_BOUNDS.xMin + TEMP_QI_BOUNDS.xMax) / 2;
  const z = (TEMP_QI_BOUNDS.zMin + TEMP_QI_BOUNDS.zMax) / 2;
  return new THREE.Vector3(x + offsetX, DIE_REST_Y, z);
}

function slotPosition(slot: "yin" | "yang", dieIndex: number, totalInSlot: number): THREE.Vector3 {
  const bounds = slot === "yin" ? YIN_SLOT_BOUNDS : YANG_SLOT_BOUNDS;
  const cx = (bounds.xMin + bounds.xMax) / 2;
  const cz = (bounds.zMin + bounds.zMax) / 2;
  const spread = 0.35;
  const offset = (dieIndex - (totalInSlot - 1) / 2) * spread;
  return new THREE.Vector3(cx, DIE_REST_Y, cz + offset);
}

function randomScatterPosition(): THREE.Vector3 {
  const margin = 0.3;
  return new THREE.Vector3(
    QI_HAI_BOUNDS.xMin + margin + Math.random() * (QI_HAI_BOUNDS.xMax - QI_HAI_BOUNDS.xMin - margin * 2),
    DIE_REST_Y + Math.random() * 0.15,
    QI_HAI_BOUNDS.zMin + margin + Math.random() * (QI_HAI_BOUNDS.zMax - QI_HAI_BOUNDS.zMin - margin * 2),
  );
}

function randomTempPosition(): THREE.Vector3 {
  const margin = 0.12;
  return new THREE.Vector3(
    TEMP_QI_BOUNDS.xMin + margin + Math.random() * (TEMP_QI_BOUNDS.xMax - TEMP_QI_BOUNDS.xMin - margin * 2),
    DIE_REST_Y + Math.random() * 0.12,
    TEMP_QI_BOUNDS.zMin + margin + Math.random() * (TEMP_QI_BOUNDS.zMax - TEMP_QI_BOUNDS.zMin - margin * 2),
  );
}

function isInZone(pos: THREE.Vector3, bounds: typeof QI_HAI_BOUNDS): boolean {
  return (
    pos.x >= bounds.xMin &&
    pos.x <= bounds.xMax &&
    pos.z >= bounds.zMin &&
    pos.z <= bounds.zMax
  );
}

function clampToZone(pos: THREE.Vector3, bounds: typeof QI_HAI_BOUNDS, margin = 0.05): THREE.Vector3 {
  return new THREE.Vector3(
    Math.max(bounds.xMin + margin, Math.min(bounds.xMax - margin, pos.x)),
    pos.y,
    Math.max(bounds.zMin + margin, Math.min(bounds.zMax - margin, pos.z)),
  );
}

// ============================================================
// Entry positions — random positions outside visible area
// ============================================================

function randomEdgePosition(frustumHalfW: number, frustumHalfH: number): THREE.Vector3 {
  const edge = Math.floor(Math.random() * 4); // 0=left, 1=right, 2=top, 3=bottom
  const boardXMin = Math.max(-frustumHalfW + 0.35, YIN_SLOT_BOUNDS.xMin - 0.28);
  const boardXMax = Math.min(frustumHalfW - 0.35, YANG_SLOT_BOUNDS.xMax + 0.28);
  const boardZMin = Math.max(-frustumHalfH + 0.25, QI_HAI_BOUNDS.zMin - 0.28);
  const boardZMax = Math.min(frustumHalfH - 0.25, TEMP_QI_BOUNDS.zMax + 0.22);
  let x: number, z: number;
  switch (edge) {
    case 0: // left
      x = boardXMin;
      z = boardZMin + Math.random() * (boardZMax - boardZMin);
      break;
    case 1: // right
      x = boardXMax;
      z = boardZMin + Math.random() * (boardZMax - boardZMin);
      break;
    case 2: // top
      x = boardXMin + Math.random() * (boardXMax - boardXMin);
      z = boardZMax;
      break;
    default: // bottom
      x = boardXMin + Math.random() * (boardXMax - boardXMin);
      z = boardZMin;
      break;
  }
  return new THREE.Vector3(x, 1.15 + Math.random() * 0.55, z);
}

// ============================================================
// Value label sprite
// ============================================================

function ensureValueLabel(mesh: THREE.Mesh, value: number, nature: string) {
  const existing = mesh.children.find((c) => c.name === "face-label");
  if (existing) {
    mesh.remove(existing);
    const sprite = existing as THREE.Sprite;
    (sprite.material as THREE.SpriteMaterial).map?.dispose();
    (sprite.material as THREE.SpriteMaterial).dispose();
  }
  const tex = createFaceTexture(value, nature);
  const spriteMat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    opacity: 0.96,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.name = "face-label";
  sprite.scale.set(0.92, 0.92, 1);
  sprite.position.set(0, 0.95, 0);
  mesh.add(sprite);
}

// ============================================================
// Easing functions
// ============================================================

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// ============================================================
// Per-die animation state
// ============================================================

interface DieAnimState {
  entryStartPos: THREE.Vector3;
  entryTargetPos: THREE.Vector3;
  entryStartTime: number;
  entryDelay: number;

  physVel: THREE.Vector3;
  physAngVel: THREE.Vector3;

  sortStartPos: THREE.Vector3;
  sortTargetPos: THREE.Vector3;

  revealStartQuat: THREE.Quaternion;
  revealTargetQuat: THREE.Quaternion;
  revealStartTime: number;
  revealDelay: number;
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
  canDragDie,
  onDragStartDie,
  onDragEndDie,
  sorted: _sorted,
  compact = false,
  slotDice,
  onAssignToSlot,
  onRemoveFromSlot,
  canInteract = true,
}: QiDiceTrayProps) {
  // ── Refs ──
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const groundPlaneRef = useRef<THREE.Mesh | null>(null);
  const yinZoneMarkerRef = useRef<THREE.Mesh | null>(null);
  const yangZoneMarkerRef = useRef<THREE.Mesh | null>(null);
  const staticObjectsRef = useRef<THREE.Object3D[]>([]);

  const meshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const shadowsRef = useRef<Map<string, THREE.Sprite>>(new Map());
  const shadowTexRef = useRef<THREE.CanvasTexture | null>(null);
  const animStatesRef = useRef<Map<string, DieAnimState>>(new Map());

  const phaseRef = useRef<Phase>(Phase.IDLE);
  const phaseStartRef = useRef<number>(0);
  const animFrameRef = useRef<number>(0);

  const rollPlansRef = useRef<Map<string, RollPlan>>(new Map());
  const rollStartRef = useRef<number>(0);
  const rollResultsRef = useRef<Array<{ id: string; value: number }>>([]);

  const dragRef = useRef<{
    dieId: string;
    mesh: THREE.Mesh;
    originalSlot: "yin" | "yang" | null;
    hoveredZone: "yin" | "yang" | "qihai" | null;
    originalPos: THREE.Vector3;
  } | null>(null);
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());

  // Callback refs
  const onRollCompleteRef = useRef(onRollComplete);
  const onSelectDieRef = useRef(onSelectDie);
  const onAssignToSlotRef = useRef<(dieId: string, slot: "yin" | "yang") => boolean>(onAssignToSlot);
  const onRemoveFromSlotRef = useRef(onRemoveFromSlot);
  const canDragDieRef = useRef(canDragDie);
  const onDragStartDieRef = useRef(onDragStartDie);
  const onDragEndDieRef = useRef(onDragEndDie);
  onRollCompleteRef.current = onRollComplete;
  onSelectDieRef.current = onSelectDie;
  onAssignToSlotRef.current = onAssignToSlot;
  onRemoveFromSlotRef.current = onRemoveFromSlot;
  canDragDieRef.current = canDragDie;
  onDragStartDieRef.current = onDragStartDie;
  onDragEndDieRef.current = onDragEndDie;

  const frustumSizeRef = useRef(compact ? 5.2 : 6.0);

  // Refs to avoid stale closures in animation loop and event handlers
  const diceRef = useRef(dice);
  const slotDiceRef = useRef(slotDice);
  const compactRef = useRef(compact);
  const canInteractRef = useRef(canInteract);
  diceRef.current = dice;
  slotDiceRef.current = slotDice;
  compactRef.current = compact;
  canInteractRef.current = canInteract;
  frustumSizeRef.current = compact ? 5.2 : 6.0;

  // ── Helpers ──

  function getShadowTex(): THREE.CanvasTexture {
    if (!shadowTexRef.current) shadowTexRef.current = createShadowTexture();
    return shadowTexRef.current;
  }

  function getSlotForDie(dieId: string): "yin" | "yang" | null {
    const sd = slotDiceRef.current;
    if (sd?.yin?.includes(dieId)) return "yin";
    if (sd?.yang?.includes(dieId)) return "yang";
    return null;
  }

  function diceInSlots(): Set<string> {
    const set = new Set<string>();
    const sd = slotDiceRef.current;
    sd?.yin?.forEach((id) => set.add(id));
    sd?.yang?.forEach((id) => set.add(id));
    return set;
  }

  // ── Scene bootstrap ──

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const frustumSize = frustumSizeRef.current;
    const aspect = container.clientWidth / Math.max(1, container.clientHeight);

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    sceneRef.current = scene;

    // Orthographic angled camera: readable board layout with enough 3D depth.
    const camera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      50,
    );
    camera.position.set(0, 5.6, 2.4);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Lighting — enhanced for dice visibility on dark background
    // Strong ambient so dice never disappear in shadow
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    // Key light — top-down for face readability
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(0, 8, 1.5);
    scene.add(key);
    // Fill light — from front-right
    const fill = new THREE.DirectionalLight(0xfff8ee, 1.0);
    fill.position.set(3, 4, 4);
    scene.add(fill);
    // Rim light — gold warm from left
    const rim = new THREE.DirectionalLight(0xf2c14e, 0.6);
    rim.position.set(-3, 3, -2);
    scene.add(rim);
    // Bottom bounce — subtle cool fill from below
    const bounce = new THREE.DirectionalLight(0x8899bb, 0.35);
    bounce.position.set(0, 1.5, -5);
    scene.add(bounce);

    // Ground plane for raycasting (invisible)
    const groundGeo = new THREE.PlaneGeometry(20, 20);
    const groundMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
    const groundPlane = new THREE.Mesh(groundGeo, groundMat);
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.y = 0;
    groundPlane.name = "ground-plane";
    scene.add(groundPlane);
    groundPlaneRef.current = groundPlane;

    // Zone markers — semi-transparent colored planes
    function createZoneMarker(
      bounds: typeof QI_HAI_BOUNDS,
      color: number,
      opacity: number,
      name: string,
    ): THREE.Mesh {
      const w = bounds.xMax - bounds.xMin;
      const h = bounds.zMax - bounds.zMin;
      const geo = new THREE.PlaneGeometry(w, h);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthTest: true,
        depthWrite: false,
      });
      const marker = new THREE.Mesh(geo, mat);
      marker.rotation.x = -Math.PI / 2;
      marker.position.set((bounds.xMin + bounds.xMax) / 2, 0.005, (bounds.zMin + bounds.zMax) / 2);
      marker.name = name;
      marker.renderOrder = 0;
      scene.add(marker);
      return marker;
    }

    // QiHai zone — subtle dark border indicator
    const qiHaiMarker = createZoneMarker(QI_HAI_BOUNDS, 0x2a2a28, 0.04, "qi-hai-zone");
    const tempQiMarker = createZoneMarker(TEMP_QI_BOUNDS, 0x5b4b7d, 0.16, "temp-qi-zone");
    // Add a thin border using EdgesGeometry + LineSegments
    const borderGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(
      QI_HAI_BOUNDS.xMax - QI_HAI_BOUNDS.xMin,
      QI_HAI_BOUNDS.zMax - QI_HAI_BOUNDS.zMin,
    ));
    const borderLine = new THREE.LineSegments(
      borderGeo,
      new THREE.LineBasicMaterial({ color: 0x3a3a36, transparent: true, opacity: 0.5, depthTest: false }),
    );
    borderLine.rotation.x = -Math.PI / 2;
    borderLine.position.set(
      (QI_HAI_BOUNDS.xMin + QI_HAI_BOUNDS.xMax) / 2,
      0.006,
      (QI_HAI_BOUNDS.zMin + QI_HAI_BOUNDS.zMax) / 2,
    );
    borderLine.name = "qi-hai-border";
    scene.add(borderLine);

    const yinMarker = createZoneMarker(YIN_SLOT_BOUNDS, 0x4466aa, 0.18, "yin-slot-zone");
    const yangMarker = createZoneMarker(YANG_SLOT_BOUNDS, 0xaa8833, 0.18, "yang-slot-zone");
    yinZoneMarkerRef.current = yinMarker;
    yangZoneMarkerRef.current = yangMarker;

    const yinLabel = createZoneLabelSprite("阴槽", "#f8fbff");
    yinLabel.position.set((YIN_SLOT_BOUNDS.xMin + YIN_SLOT_BOUNDS.xMax) / 2, 0.08, YIN_SLOT_BOUNDS.zMax - 0.28);
    scene.add(yinLabel);
    const seaLabel = createZoneLabelSprite("气海", "#f0d28a");
    seaLabel.position.set((QI_HAI_BOUNDS.xMin + QI_HAI_BOUNDS.xMax) / 2, 0.08, QI_HAI_BOUNDS.zMin + 0.24);
    scene.add(seaLabel);
    const yangLabel = createZoneLabelSprite("阳槽", "#1c1711");
    yangLabel.position.set((YANG_SLOT_BOUNDS.xMin + YANG_SLOT_BOUNDS.xMax) / 2, 0.08, YANG_SLOT_BOUNDS.zMax - 0.28);
    scene.add(yangLabel);
    const tempLabel = createZoneLabelSprite("临气槽", "#e4dcff");
    tempLabel.position.set((TEMP_QI_BOUNDS.xMin + TEMP_QI_BOUNDS.xMax) / 2, 0.08, TEMP_QI_BOUNDS.zMax - 0.18);
    scene.add(tempLabel);

    // Track static objects for cleanup
    staticObjectsRef.current = [groundPlane, qiHaiMarker, tempQiMarker, borderLine, yinMarker, yangMarker, yinLabel, seaLabel, yangLabel, tempLabel];

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── Pointer event handlers (drag system) ──
    const raycaster = raycasterRef.current;
    const mouse = mouseRef.current;

    function getWorldPosFromMouse(event: MouseEvent | PointerEvent): THREE.Vector3 | null {
      if (!container || !camera) return null;
      const rect = container.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObject(groundPlane, false);
      if (hits.length > 0) {
        return hits[0].point.clone();
      }
      return null;
    }

    function pickDieAtMouse(event: MouseEvent | PointerEvent): { id: string; mesh: THREE.Mesh } | null {
      if (!container || !camera) return null;
      const rect = container.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const meshes = Array.from(meshesRef.current.values());
      const hits = raycaster.intersectObjects(meshes, false);
      if (hits.length > 0) {
        const hitMesh = hits[0].object as THREE.Mesh;
        for (const [id, mesh] of meshesRef.current) {
          if (mesh === hitMesh) return { id, mesh };
        }
      }
      return null;
    }

    function onPointerDown(event: PointerEvent) {
      if (!canInteractRef.current || (phaseRef.current !== Phase.READY && phaseRef.current !== Phase.IDLE)) return;
      const picked = pickDieAtMouse(event);
      if (!picked) return;
      if (canDragDieRef.current?.(picked.id) === false) return;
      renderer.domElement.setPointerCapture?.(event.pointerId);

      const slot = getSlotForDie(picked.id);
      dragRef.current = {
        dieId: picked.id,
        mesh: picked.mesh,
        originalSlot: slot,
        hoveredZone: null,
        originalPos: picked.mesh.position.clone(),
      };

      // Lift the die
      picked.mesh.position.y = DRAG_LIFT_Y;
      picked.mesh.scale.setScalar(DRAG_SCALE);

      // Store original userData for visual state
      picked.mesh.userData._dragging = true;

      onDragStartDieRef.current?.(picked.id);
      event.preventDefault();
    }

    function onPointerMove(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;

      const worldPos = getWorldPosFromMouse(event);
      if (!worldPos) return;

      // Move die to world position (keep lift Y)
      worldPos.y = DRAG_LIFT_Y;
      drag.mesh.position.copy(worldPos);

      // Determine hovered zone
      const pos2D = new THREE.Vector3(worldPos.x, 0, worldPos.z);
      let hovered: "yin" | "yang" | "qihai" | null = null;
      if (isInZone(pos2D, YIN_SLOT_BOUNDS)) hovered = "yin";
      else if (isInZone(pos2D, YANG_SLOT_BOUNDS)) hovered = "yang";
      else if (isInZone(pos2D, QI_HAI_BOUNDS) || isInZone(pos2D, TEMP_QI_BOUNDS)) hovered = "qihai";

      drag.hoveredZone = hovered;

      // Update zone marker highlights
      updateZoneHighlights(hovered, drag.originalSlot);
    }

    function onPointerUp(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      renderer.domElement.releasePointerCapture?.(event.pointerId);

      // Reset die visual
      drag.mesh.scale.setScalar(1);
      drag.mesh.userData._dragging = false;

      const dropPos = new THREE.Vector3(drag.mesh.position.x, 0, drag.mesh.position.z);

      let assignSucceeded = false;
      if (drag.originalSlot === null) {
        // Was in 气海
        if (isInZone(dropPos, YIN_SLOT_BOUNDS)) {
          assignSucceeded = onAssignToSlotRef.current?.(drag.dieId, "yin") === true;
        } else if (isInZone(dropPos, YANG_SLOT_BOUNDS)) {
          assignSucceeded = onAssignToSlotRef.current?.(drag.dieId, "yang") === true;
        }
        // If not assigned (invalid drop or rejected), snap back
        if (!assignSucceeded) {
          drag.mesh.position.copy(drag.originalPos);
        }
      } else {
        // Was in a slot
        if (
          (isInZone(dropPos, QI_HAI_BOUNDS) || isInZone(dropPos, TEMP_QI_BOUNDS)) &&
          !isInZone(dropPos, YIN_SLOT_BOUNDS) &&
          !isInZone(dropPos, YANG_SLOT_BOUNDS)
        ) {
          onRemoveFromSlotRef.current?.(drag.dieId);
        } else if (
          drag.originalSlot === "yin" &&
          isInZone(dropPos, YANG_SLOT_BOUNDS)
        ) {
          assignSucceeded = onAssignToSlotRef.current?.(drag.dieId, "yang") === true;
          if (!assignSucceeded) drag.mesh.position.copy(drag.originalPos);
        } else if (
          drag.originalSlot === "yang" &&
          isInZone(dropPos, YIN_SLOT_BOUNDS)
        ) {
          assignSucceeded = onAssignToSlotRef.current?.(drag.dieId, "yin") === true;
          if (!assignSucceeded) drag.mesh.position.copy(drag.originalPos);
        } else {
          // Snap back to slot position
          drag.mesh.position.copy(drag.originalPos);
        }
      }

      // Reset zone highlights
      resetZoneHighlights();

      onDragEndDieRef.current?.();
      dragRef.current = null;
    }

    function updateZoneHighlights(
      hovered: "yin" | "yang" | "qihai" | null,
      originalSlot: "yin" | "yang" | null,
    ) {
      const yinMarker = yinZoneMarkerRef.current;
      const yangMarker = yangZoneMarkerRef.current;

      if (yinMarker) {
        const mat = yinMarker.material as THREE.MeshBasicMaterial;
        if (originalSlot === null && hovered === "yin") {
          mat.color.set(0x44aa44); // green — valid drop
          mat.opacity = 0.35;
        } else if (originalSlot === "yin" && hovered === "yin") {
          mat.color.set(0xaa4444); // red — same slot
          mat.opacity = 0.25;
        } else {
          mat.color.set(0x4466aa);
          mat.opacity = 0.18;
        }
      }
      if (yangMarker) {
        const mat = yangMarker.material as THREE.MeshBasicMaterial;
        if (originalSlot === null && hovered === "yang") {
          mat.color.set(0x44aa44);
          mat.opacity = 0.35;
        } else if (originalSlot === "yang" && hovered === "yang") {
          mat.color.set(0xaa4444);
          mat.opacity = 0.25;
        } else {
          mat.color.set(0xaa8833);
          mat.opacity = 0.18;
        }
      }
    }

    function resetZoneHighlights() {
      const yinMarker = yinZoneMarkerRef.current;
      const yangMarker = yangZoneMarkerRef.current;
      if (yinMarker) {
        const mat = yinMarker.material as THREE.MeshBasicMaterial;
        mat.color.set(0x4466aa);
        mat.opacity = 0.18;
      }
      if (yangMarker) {
        const mat = yangMarker.material as THREE.MeshBasicMaterial;
        mat.color.set(0xaa8833);
        mat.opacity = 0.18;
      }
    }

    function onClick(event: MouseEvent) {
      // Only handle click if we didn't just do a drag
      if (dragRef.current) return;
      if (!canInteractRef.current || (phaseRef.current !== Phase.READY && phaseRef.current !== Phase.IDLE)) return;
      const picked = pickDieAtMouse(event);
      if (picked) {
        onSelectDieRef.current?.(picked.id);
      }
    }

    renderer.domElement.style.pointerEvents = "auto";
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.userSelect = "none";
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    container.addEventListener("click", onClick);

    // ── Resize handler ──
    function onResize() {
      if (!container || !camera || !renderer) return;
      const newAspect = container.clientWidth / Math.max(1, container.clientHeight);
      const fs = frustumSizeRef.current;
      camera.left = (fs * newAspect) / -2;
      camera.right = (fs * newAspect) / 2;
      camera.top = fs / 2;
      camera.bottom = fs / -2;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }
    window.addEventListener("resize", onResize);

    // ── Main render loop ──
    function animate(now: number) {
      animFrameRef.current = requestAnimationFrame(animate);

      // Update shadows positions
      shadowsRef.current.forEach((shadow, id) => {
        const mesh = meshesRef.current.get(id);
        if (mesh) {
          shadow.position.set(mesh.position.x, 0.005, mesh.position.z);
        }
      });

      // Run phase-based animations
      runPhaseAnimation(now);

      renderer.render(scene, camera);
    }
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("click", onClick);
      container.removeChild(renderer.domElement);
      renderer.dispose();

      // Clean up scene objects
      meshesRef.current.forEach((mesh) => {
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          (mesh.material as THREE.Material).dispose();
        }
      });
      shadowsRef.current.forEach((shadow) => {
        (shadow.material as THREE.SpriteMaterial).map?.dispose();
        (shadow.material as THREE.SpriteMaterial).dispose();
      });
      shadowsRef.current.clear();
      shadowTexRef.current?.dispose();
      shadowTexRef.current = null;

      // Dispose static scene objects (zone markers, border, ground plane)
      staticObjectsRef.current.forEach((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            (obj.material as THREE.Material).dispose();
          }
        }
        if (obj instanceof THREE.LineSegments) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            (obj.material as THREE.Material).dispose();
          }
        }
        if (obj instanceof THREE.Sprite) {
          (obj.material as THREE.SpriteMaterial).map?.dispose();
          (obj.material as THREE.SpriteMaterial).dispose();
        }
      });
      staticObjectsRef.current = [];
      scene.clear();
    };
  }, [compact]);

  // ── Phase animation runner ──

  function runPhaseAnimation(now: number) {
    const phase = phaseRef.current;
    const scene = sceneRef.current;
    if (!scene) return;

    switch (phase) {
      case Phase.IDLE:
        break;

      case Phase.ENTRY:
        runEntryPhase(now);
        break;

      case Phase.PHYSICS:
        runPhysicsPhase(now);
        break;

      case Phase.SORT:
        runSortPhase(now);
        break;

      case Phase.REVEAL:
        runRevealPhase(now);
        break;

      case Phase.ROLLING:
        runRollingPhase(now);
        break;

      case Phase.READY:
        // Dice are static; drag handles interaction
        break;
    }
  }

  function runEntryPhase(now: number) {
    const elapsed = now - phaseStartRef.current;
    let allArrived = true;

    animStatesRef.current.forEach((state, id) => {
      const mesh = meshesRef.current.get(id);
      if (!mesh) return;

      const dieElapsed = elapsed - state.entryDelay;
      if (dieElapsed <= 0) {
        // Not started yet — keep at edge position
        mesh.position.copy(state.entryStartPos);
        allArrived = false;
        return;
      }

      const duration = ENTRY_DURATION;
      const t = Math.min(1, dieElapsed / duration);
      const ease = easeOutBack(t);

      // Lerp position
      mesh.position.lerpVectors(state.entryStartPos, state.entryTargetPos, ease);

      // Arc: Y starts high, descends
      mesh.position.y = state.entryStartPos.y + (state.entryTargetPos.y - state.entryStartPos.y) * ease;

      // Visible tumbling during the throw-in arc.
      mesh.rotation.x += 0.08 + (1 - ease) * 0.05;
      mesh.rotation.y += 0.11 + (1 - ease) * 0.07;
      mesh.rotation.z += 0.09 + (1 - ease) * 0.04;

      if (t < 1) allArrived = false;
    });

    if (allArrived && animStatesRef.current.size > 0) {
      // Snap all dice to their target positions
      animStatesRef.current.forEach((state, id) => {
        const mesh = meshesRef.current.get(id);
        if (mesh) {
          mesh.position.copy(state.entryTargetPos);
        }
      });

      // Transition to PHYSICS
      transitionToPhysics(now);
    }
  }

  function transitionToPhysics(now: number) {
    phaseRef.current = Phase.PHYSICS;
    phaseStartRef.current = now;

    // Initialize physics velocities
    animStatesRef.current.forEach((state, id) => {
      const mesh = meshesRef.current.get(id);
      const owningBounds = diceRef.current.find((die) => die.id === id)?.zone === "TEMP_QI" ? TEMP_QI_BOUNDS : QI_HAI_BOUNDS;
      const center = new THREE.Vector3(
        (owningBounds.xMin + owningBounds.xMax) / 2,
        DIE_REST_Y,
        (owningBounds.zMin + owningBounds.zMax) / 2,
      );
      const towardCenter = mesh ? center.sub(mesh.position).normalize() : new THREE.Vector3();
      state.physVel = new THREE.Vector3(
        towardCenter.x * 1.25 + (Math.random() - 0.5) * 1.1,
        Math.random() * 0.85 + 0.85,
        towardCenter.z * 1.25 + (Math.random() - 0.5) * 1.1,
      );
      state.physAngVel = new THREE.Vector3(
        (Math.random() - 0.5) * 6.5,
        (Math.random() - 0.5) * 6.5,
        (Math.random() - 0.5) * 6.5,
      );
    });
  }

  function runPhysicsPhase(now: number) {
    const dt = Math.min(0.05, (now - phaseStartRef.current) / 1000);
    // Use fixed small dt for stability
    const fixedDt = 0.016;
    const elapsed = now - phaseStartRef.current;

    // Gather all physics dice (only those not being dragged and not in slots)
    const slotIds = diceInSlots();
    const physDice: Array<{ id: string; mesh: THREE.Mesh; state: DieAnimState }> = [];
    animStatesRef.current.forEach((state, id) => {
      if (slotIds.has(id)) return;
      const mesh = meshesRef.current.get(id);
      if (mesh && !mesh.userData._dragging) {
        physDice.push({ id, mesh, state });
      }
    });

    // Step physics
    let totalSpeed = 0;

    for (const die of physDice) {
      const vel = die.state.physVel;
      const angVel = die.state.physAngVel;
      const mesh = die.mesh;

      // Gravity (Y)
      vel.y -= 2.5 * fixedDt;

      // Ground friction (XZ)
      vel.x *= 0.97;
      vel.z *= 0.97;
      vel.y *= 0.995;
      angVel.multiplyScalar(0.96);

      // Update position
      mesh.position.x += vel.x * fixedDt;
      mesh.position.y += vel.y * fixedDt;
      mesh.position.z += vel.z * fixedDt;

      // Ground collision
      if (mesh.position.y < DIE_REST_Y) {
        mesh.position.y = DIE_REST_Y;
        if (vel.y < -0.05) {
          vel.y *= -0.46; // bounce
          vel.x *= 0.86;
          vel.z *= 0.86;
        } else {
          vel.y = 0;
        }
      }

      // Boundary constraints — push back into 气海
      const sourceDie = diceRef.current.find((item) => item.id === die.id);
      const owningBounds = sourceDie?.zone === "TEMP_QI" ? TEMP_QI_BOUNDS : QI_HAI_BOUNDS;
      const clamped = clampToZone(mesh.position, owningBounds, 0.15);
      if (clamped.x !== mesh.position.x) {
        mesh.position.x = clamped.x;
        vel.x *= -0.5;
      }
      if (clamped.z !== mesh.position.z) {
        mesh.position.z = clamped.z;
        vel.z *= -0.5;
      }

      // Update rotation from angular velocity
      mesh.rotateX(angVel.x * fixedDt);
      mesh.rotateY(angVel.y * fixedDt);
      mesh.rotateZ(angVel.z * fixedDt);

      totalSpeed += Math.abs(vel.x) + Math.abs(vel.z) + Math.abs(vel.y);
    }

    // Die-die collision (simple repulsion in XZ plane)
    for (let i = 0; i < physDice.length; i++) {
      for (let j = i + 1; j < physDice.length; j++) {
        const a = physDice[i];
        const b = physDice[j];
        const dx = b.mesh.position.x - a.mesh.position.x;
        const dz = b.mesh.position.z - a.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const minDist = 1.10; // collision radius for scaled-up dice

        if (dist < minDist && dist > 0.001) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const nz = dz / dist;

          // Push apart
          const pushEach = overlap * 0.5;
          a.mesh.position.x -= nx * pushEach;
          a.mesh.position.z -= nz * pushEach;
          b.mesh.position.x += nx * pushEach;
          b.mesh.position.z += nz * pushEach;

          // Exchange velocities along collision normal
          const relVelX = a.state.physVel.x - b.state.physVel.x;
          const relVelZ = a.state.physVel.z - b.state.physVel.z;
          const relVelN = relVelX * nx + relVelZ * nz;

          if (relVelN > 0) {
            const restitution = 0.64;
            const impulse = relVelN * (1 + restitution) * 0.5;
            a.state.physVel.x -= impulse * nx;
            a.state.physVel.z -= impulse * nz;
            b.state.physVel.x += impulse * nx;
            b.state.physVel.z += impulse * nz;
          }
        }
      }
    }

    // Check if settled
    const avgSpeed = physDice.length > 0 ? totalSpeed / physDice.length : 0;
    const isSettled = avgSpeed < 0.02 || elapsed > PHYSICS_DURATION;

    if (isSettled && physDice.length > 0) {
      // Snap dice to ground
      for (const die of physDice) {
        die.mesh.position.y = DIE_REST_Y;
      }
      transitionToSort(now);
    }
  }

  function transitionToSort(now: number) {
    phaseRef.current = Phase.SORT;
    phaseStartRef.current = now;

    const slotIds = diceInSlots();
    const currentDice = diceRef.current;
    const trayDice = currentDice.filter((d) => !slotIds.has(d.id));
    const valueMap = new Map<string, number>();
    rollResultsRef.current.forEach((r) => valueMap.set(r.id, r.value));
    const seaSorted = sortedDiceForTray(trayDice.filter((die) => die.zone !== "TEMP_QI"), valueMap);
    const tempSorted = sortedDiceForTray(trayDice.filter((die) => die.zone === "TEMP_QI"), valueMap);

    // Store sort start/target positions
    seaSorted.forEach((die, index) => {
      const state = animStatesRef.current.get(die.id);
      const mesh = meshesRef.current.get(die.id);
      if (!state || !mesh) return;

      state.sortStartPos = mesh.position.clone();
      state.sortTargetPos = trayPosition(index, seaSorted.length, compactRef.current);
    });
    tempSorted.forEach((die, index) => {
      const state = animStatesRef.current.get(die.id);
      const mesh = meshesRef.current.get(die.id);
      if (!state || !mesh) return;

      state.sortStartPos = mesh.position.clone();
      state.sortTargetPos = tempQiPosition(index, tempSorted.length, compactRef.current);
    });

    // Dice not in tray (in slots) don't participate
  }

  function runSortPhase(now: number) {
    const elapsed = now - phaseStartRef.current;
    const duration = SORT_DURATION;
    const t = Math.min(1, elapsed / duration);
    const ease = easeOutCubic(t);

    let allDone = true;

    animStatesRef.current.forEach((state, id) => {
      const mesh = meshesRef.current.get(id);
      if (!mesh || mesh.userData._dragging) return;
      if (!state.sortTargetPos) return;

      mesh.position.lerpVectors(state.sortStartPos, state.sortTargetPos, ease);
      mesh.position.y = DIE_REST_Y; // keep on ground

      if (t < 1) allDone = false;
    });

    if (allDone && animStatesRef.current.size > 0) {
      transitionToReveal(now);
    }
  }

  function transitionToReveal(now: number) {
    phaseRef.current = Phase.REVEAL;
    phaseStartRef.current = now;

    // Set up reveal rotations
    let staggerIndex = 0;
    const slotIds = diceInSlots();
    const currentDice = diceRef.current;

    currentDice.forEach((die) => {
      if (slotIds.has(die.id)) return;
      const state = animStatesRef.current.get(die.id);
      const mesh = meshesRef.current.get(die.id);
      if (!state || !mesh) return;

      state.revealStartQuat = mesh.quaternion.clone();
      state.revealDelay = staggerIndex * REVEAL_STAGGER;
      state.revealStartTime = now + state.revealDelay;

      // Target: value face up if value known, otherwise slight random tilt
      if (die.value != null) {
        const dieType = sidesToDieType(die.sides);
        const q = computeValueUpQuat(dieType, die.value);
        state.revealTargetQuat = q ?? mesh.quaternion.clone();
      } else {
        // Small random orientation so blank dice still look 3D
        const euler = new THREE.Euler(
          (Math.random() - 0.5) * 0.2,
          Math.random() * Math.PI * 2,
          (Math.random() - 0.5) * 0.2,
        );
        state.revealTargetQuat = new THREE.Quaternion().setFromEuler(euler);
      }
      staggerIndex++;
    });
  }

  function runRevealPhase(now: number) {
    let allDone = true;

    animStatesRef.current.forEach((state, id) => {
      const mesh = meshesRef.current.get(id);
      if (!mesh || mesh.userData._dragging) return;
      if (!state.revealTargetQuat) return;

      const dieElapsed = now - state.revealStartTime;
      if (dieElapsed < 0) {
        allDone = false;
        return;
      }

      const t = Math.min(1, dieElapsed / REVEAL_DURATION);
      const ease = easeOutCubic(t);

      // Slerp toward target
      mesh.quaternion.slerpQuaternions(state.revealStartQuat, state.revealTargetQuat, ease);

      if (t < 1) allDone = false;
    });

    if (allDone && animStatesRef.current.size > 0) {
      phaseRef.current = Phase.READY;
    }
  }

  function runRollingPhase(now: number) {
    const elapsed = now - rollStartRef.current;
    const currentDice = diceRef.current;
    let allDone = true;

    currentDice.forEach((die) => {
      const plan = rollPlansRef.current.get(die.id);
      const mesh = meshesRef.current.get(die.id);
      if (!plan || !mesh) return;

      const { quat, yOffset, done } = sampleRollAnimation(plan, elapsed);
      mesh.quaternion.copy(quat);
      mesh.position.y = DIE_REST_Y + yOffset;

      if (!done) allDone = false;
    });

    if (allDone && currentDice.length > 0) {
      // Collect results
      const results: Array<{ id: string; value: number }> = [];
      currentDice.forEach((die) => {
        const plan = rollPlansRef.current.get(die.id);
        const mesh = meshesRef.current.get(die.id);
        if (plan) {
          results.push({ id: die.id, value: plan.targetValue });
          if (mesh) {
            mesh.quaternion.copy(plan.targetQuat);
            mesh.position.y = DIE_REST_Y;
            ensureValueLabel(mesh, plan.targetValue, die.nature);
          }
        }
      });
      rollPlansRef.current.clear();
      rollResultsRef.current = results;

      // Transition to sort → reveal → ready
      onRollCompleteRef.current(results);
      transitionToSort(now);
    }
  }

  // ── Sync dice meshes with data ──

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const currentIds = new Set(dice.map((d) => d.id));
    const slotIds = diceInSlots();

    // Remove old meshes and shadows
    for (const [id, mesh] of meshesRef.current) {
      if (!currentIds.has(id)) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          (mesh.material as THREE.Material).dispose();
        }
        // Dispose children (edge, label)
        mesh.children.forEach((child) => {
          if (child instanceof THREE.LineSegments) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else {
              (child.material as THREE.Material).dispose();
            }
          }
          if (child instanceof THREE.Sprite) {
            (child.material as THREE.SpriteMaterial).map?.dispose();
            (child.material as THREE.SpriteMaterial).dispose();
          }
        });
        meshesRef.current.delete(id);
        animStatesRef.current.delete(id);
      }
    }
    for (const [id, shadow] of shadowsRef.current) {
      if (!currentIds.has(id)) {
        scene.remove(shadow);
        (shadow.material as THREE.SpriteMaterial).dispose();
        shadowsRef.current.delete(id);
      }
    }

    // Detect new dice (those not already in meshesRef or animStatesRef)
    const newDieIds = dice.filter((d) => !meshesRef.current.has(d.id)).map((d) => d.id);

    // Add/update meshes
    dice.forEach((die) => {
      const dieType = sidesToDieType(die.sides);
      const spec = DIE_GEOM_SPECS[dieType];
      if (!spec) return;

      const inSlot = slotIds.has(die.id);

      let mesh = meshesRef.current.get(die.id);
      if (!mesh) {
        const geo = spec.create();
        const mat = createDieMaterial(die.nature);
        mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { dieId: die.id };
        mesh.name = `die-${die.id}`;

        // Gold edge wireframe — brighter and more visible
        const edgeGeo = new THREE.EdgesGeometry(geo, 15);
        const edgeMat = new THREE.LineBasicMaterial({
          color: 0xe8c97a,
          transparent: true,
          opacity: 0.72,
          depthTest: true,
          depthWrite: false,
        });
        const edges = new THREE.LineSegments(edgeGeo, edgeMat);
        edges.name = "selection-edge";
        edges.renderOrder = 1;
        mesh.add(edges);

        scene.add(mesh);
        meshesRef.current.set(die.id, mesh);

        // Position: slot dice go to slot zone, new tray dice start entry animation
        if (inSlot) {
          const slot = getSlotForDie(die.id)!;
          const slotDiceList = slot === "yin" ? (slotDice?.yin ?? []) : (slotDice?.yang ?? []);
          const idx = slotDiceList.indexOf(die.id);
          mesh.position.copy(slotPosition(slot, idx >= 0 ? idx : 0, slotDiceList.length));
        } else if (phaseRef.current === Phase.READY || phaseRef.current === Phase.IDLE) {
          // New die — will start entry animation
          // Position will be set in entry init
        }
      }

      // ── Visual feedback ──
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const isSelected = selectedIds.includes(die.id);
      const isHighlighted = highlightedIds.includes(die.id);
      if (isSelected) {
        mat.emissive = new THREE.Color(0xffd76b);
        mat.emissiveIntensity = 0.85;
      } else if (isHighlighted) {
        mat.emissive = new THREE.Color(0x88aacc);
        mat.emissiveIntensity = 0.45;
      } else {
        // Restore nature-specific subtle emissive
        mat.emissive = new THREE.Color(die.nature === "yin" ? 0x111111 : die.nature === "raw" ? 0x0a1a30 : 0x000000);
        mat.emissiveIntensity = die.nature === "yang" ? 0 : 0.25;
      }

      const edge = mesh.children.find((c) => c.name === "selection-edge") as THREE.LineSegments | undefined;
      const edgeMat = edge?.material as THREE.LineBasicMaterial | undefined;
      if (edgeMat) {
        edgeMat.color = new THREE.Color(
          isSelected ? 0xffd76b : isHighlighted ? 0x88ccff : 0xe8c97a,
        );
        edgeMat.opacity = isSelected ? 1.0 : isHighlighted ? 0.9 : 0.72;
      }

      // Value label
      if (die.value != null) {
        ensureValueLabel(mesh, die.value, die.nature);
      }

      // Ground shadow
      if (!shadowsRef.current.has(die.id)) {
        const sTex = getShadowTex();
        const shadowMat = new THREE.SpriteMaterial({
          map: sTex,
          transparent: true,
          opacity: 0.7,
          depthTest: true,
          depthWrite: false,
        });
        const shadow = new THREE.Sprite(shadowMat);
        shadow.name = "ground-shadow";
        shadow.scale.set(1.15, 1.15, 1);
        shadow.position.set(mesh.position.x, 0.005, mesh.position.z);
        shadow.renderOrder = 1;
        scene.add(shadow);
        shadowsRef.current.set(die.id, shadow);
      }
    });

    // ── Initialize entry animation for new dice ──
    if (newDieIds.length > 0 && phaseRef.current !== Phase.ROLLING) {
      const camera = cameraRef.current;
      if (!camera) return;
      const fs = frustumSizeRef.current;
      const aspect = containerRef.current
        ? containerRef.current.clientWidth / Math.max(1, containerRef.current.clientHeight)
        : 1;
      const fHalfW = (fs * aspect) / 2;
      const fHalfH = fs / 2;

      let staggerIndex = 0;
      // Count existing dice that are still in entry
      animStatesRef.current.forEach((s) => {
        if (s.entryTargetPos) staggerIndex++;
      });

      newDieIds.forEach((id) => {
        const die = dice.find((d) => d.id === id);
        if (!die || slotIds.has(die.id)) return;

        const startPos = randomEdgePosition(fHalfW, fHalfH);
        const targetPos = die.zone === "TEMP_QI" ? randomTempPosition() : randomScatterPosition();

        animStatesRef.current.set(id, {
          entryStartPos: startPos,
          entryTargetPos: targetPos,
          entryStartTime: 0,
          entryDelay: staggerIndex * ENTRY_STAGGER,
          physVel: new THREE.Vector3(),
          physAngVel: new THREE.Vector3(),
          sortStartPos: new THREE.Vector3(),
          sortTargetPos: new THREE.Vector3(),
          revealStartQuat: new THREE.Quaternion(),
          revealTargetQuat: new THREE.Quaternion(),
          revealStartTime: 0,
          revealDelay: 0,
        });

        // Place mesh at start position
        const mesh = meshesRef.current.get(id);
        if (mesh) {
          mesh.position.copy(startPos);
          mesh.rotation.set(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
          );
        }
        staggerIndex++;
      });

      // Start or restart entry phase
      if (phaseRef.current === Phase.IDLE || phaseRef.current === Phase.READY) {
        phaseRef.current = Phase.ENTRY;
        phaseStartRef.current = performance.now();
        // Update entry start times
        animStatesRef.current.forEach((state) => {
          state.entryStartTime = performance.now();
        });
      } else if (phaseRef.current === Phase.ENTRY) {
        // Already in entry phase — update start times for new dice
        newDieIds.forEach((id) => {
          const state = animStatesRef.current.get(id);
          if (state) {
            state.entryStartTime = performance.now();
          }
        });
      }
      // If in PHYSICS or later, new dice enter individually
      // (they'll complete entry when their stagger delay elapses)
    }

    // ── Position slot dice ──
    const sd = slotDiceRef.current;
    if (sd) {
      ["yin", "yang"].forEach((slot) => {
        const ids = slot === "yin" ? (sd.yin ?? []) : (sd.yang ?? []);
        ids.forEach((id, idx) => {
          const mesh = meshesRef.current.get(id);
          if (mesh && !mesh.userData._dragging) {
            const targetPos = slotPosition(slot as "yin" | "yang", idx, ids.length);
            mesh.position.copy(targetPos);
          }
        });
      });
    }

    sceneRef.current = scene;
  }, [dice, selectedIds, highlightedIds, compact, slotDice]);

  // ── Rolling animation trigger ──

  useEffect(() => {
    if (!rolling) {
      rollPlansRef.current.clear();
      rollStartRef.current = 0;
      return;
    }

    const scene = sceneRef.current;
    if (!scene) return;

    // Create roll plans
    dice.forEach((die) => {
      if (!rollPlansRef.current.has(die.id)) {
        rollPlansRef.current.set(die.id, createRollPlan(sidesToDieType(die.sides)));
      }
    });

    rollStartRef.current = performance.now();
    phaseRef.current = Phase.ROLLING;

    // The animation loop handles ROLLING phase via runRollingPhase()
  }, [rolling, dice]);

  // ── Position tray dice when not in animation or when positions need update ──
  // This handles the case where dice change externally while in READY phase
  useEffect(() => {
    if (phaseRef.current !== Phase.READY) return;
    const scene = sceneRef.current;
    if (!scene) return;

    const slotIds = diceInSlots();
    const trayDice = dice.filter((d) => !slotIds.has(d.id));
    const seaSorted = sortedDiceForTray(trayDice.filter((die) => die.zone !== "TEMP_QI"));
    const tempSorted = sortedDiceForTray(trayDice.filter((die) => die.zone === "TEMP_QI"));

    seaSorted.forEach((die, index) => {
      const mesh = meshesRef.current.get(die.id);
      if (!mesh || mesh.userData._dragging) return;
      const target = trayPosition(index, seaSorted.length, compact);

      // Only move if die is not near target (avoid jitter)
      if (mesh.position.distanceToSquared(target) > 0.01) {
        // Animate smoothly
        const state = animStatesRef.current.get(die.id);
        if (state) {
          state.sortStartPos = mesh.position.clone();
          state.sortTargetPos = target;
        }
        phaseRef.current = Phase.SORT;
        phaseStartRef.current = performance.now();
      }
    });
    tempSorted.forEach((die, index) => {
      const mesh = meshesRef.current.get(die.id);
      if (!mesh || mesh.userData._dragging) return;
      const target = tempQiPosition(index, tempSorted.length, compact);

      if (mesh.position.distanceToSquared(target) > 0.01) {
        const state = animStatesRef.current.get(die.id);
        if (state) {
          state.sortStartPos = mesh.position.clone();
          state.sortTargetPos = target;
        }
        phaseRef.current = Phase.SORT;
        phaseStartRef.current = performance.now();
      }
    });
  }, [dice, compact, slotDice]);

  // ── Render ──

  const h = compact ? 160 : 220;
  return (
    <div
      ref={containerRef}
      className="qi-dice-tray-container"
      style={{
        width: "100%",
        height: h,
        position: "relative",
        overflow: "hidden",
        borderRadius: 8,
        cursor: canInteract ? "grab" : "default",
      }}
    >
      {/* ART SLOT: dice-tray-bg — dark parchment texture */}
      {/* ART SLOT: dice-shadow — 48×48 soft drop shadow per die */}
      {/* ART SLOT: tray-rim — decorative border/rim */}
    </div>
  );
}
