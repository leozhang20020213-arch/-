import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import type { QiDie } from "../combat/types";
import {
  affinityFromNature,
  dieTypeFromSides,
  type DiceRollResult,
  type Dice3DState,
} from "./diceTypes";
import { createDiceDefinition } from "./DiceGeometryFactory";
import { createDiceBodyMaterial } from "./DiceMaterialFactory";
import { createDiceMesh, type DiceMeshHandle } from "./DiceMesh";
import {
  resolveDiceOverlap,
  getInitialDicePosition,
  clampToTray,
} from "./DicePlacementResolver";
import {
  createRollAnimationPlan,
  sampleRollAnimation,
} from "./DiceRollController";
import {
  resolveResultFromPose,
} from "./DiceResultResolver";

// HDRI for consistent lighting
import studioHDRI from "../assets/materials/polyhaven/studio_small_03_1k.hdr?url";

export function QiDiceRollOverlay({
  dice,
  onConfirm,
  onClose,
}: {
  dice: QiDie[];
  onConfirm: (results: DiceRollResult[]) => void;
  onClose: () => void;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const skipAnimationRef = useRef(false);
  const [results, setResults] = useState<DiceRollResult[]>([]);
  const [skipAnimation, setSkipAnimation] = useState(false);
  const [rollPhase, setRollPhase] = useState<"idle" | "rolling" | "arranging" | "done">("idle");

  const sortedResults = useMemo(() => {
    const natureRank = { yin: 0, yang: 1, raw: 2 } as const;
    return [...results].sort((a, b) => {
      const aDie = dice.find((die) => die.id === a.id);
      const bDie = dice.find((die) => die.id === b.id);
      if (!aDie || !bDie) return 0;
      return aDie.sides - bDie.sides
        || natureRank[aDie.nature] - natureRank[bDie.nature]
        || b.value - a.value;
    });
  }, [dice, results]);

  useEffect(() => {
    if (rollPhase !== "idle") return;
    const container = mountRef.current;
    if (!container) return;

    const w = container.clientWidth || 640;
    const h = 300;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1410);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 4.4, 7.6);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    container.appendChild(renderer.domElement);

    // HDRI
    new RGBELoader().load(studioHDRI, (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = texture;
    });

    // Lights
    scene.add(new THREE.AmbientLight(0xfff4df, 1.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.4);
    dirLight.position.set(4, 8, 5);
    scene.add(dirLight);

    // Table surface
    const tableGeo = new THREE.CircleGeometry(3.6, 64);
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x3a3028, roughness: 0.72 });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.rotation.x = -Math.PI / 2;
    table.position.y = -0.62;
    table.receiveShadow = true;
    scene.add(table);

    // Create PBR dice meshes
    const meshHandles: DiceMeshHandle[] = [];
    const definitions: ReturnType<typeof createDiceDefinition>[] = [];

    dice.forEach((die, index) => {
      const state: Dice3DState = {
        id: die.id,
        type: dieTypeFromSides(die.sides),
        affinity: affinityFromNature(die.nature),
        result: null,
        position: new THREE.Vector3(),
        radius: 0,
        rotation: new THREE.Euler(),
        isRolling: false,
        isDragging: false,
        lastResult: null,
      };
      const def = createDiceDefinition(state.type);
      definitions.push(def);

      const meshHandle = createDiceMesh(state);
      const pos = getInitialDicePosition(index, dice.length);
      meshHandle.mesh.position.set(pos.x, 0, pos.z);
      meshHandle.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      scene.add(meshHandle.mesh);
      meshHandles.push(meshHandle);
    });

    // Generate target results
    const targetResults = dice.map((die) => ({
      id: die.id,
      value: Math.floor(Math.random() * die.sides) + 1,
    }));

    // Create roll plans and stable post-roll positions. Results always settle
    // D4→D20, then 阴→阳→原, then high→low.
    const rollPlans = meshHandles.map((mh, i) => {
      const startQuat = mh.mesh.quaternion.clone();
      return createRollAnimationPlan(definitions[i], startQuat, targetResults[i].value);
    });
    const startPositions = meshHandles.map((handle) => handle.mesh.position.clone());
    const natureRank = { yin: 0, yang: 1, raw: 2 } as const;
    const sortedDice = dice
      .map((die, index) => ({ die, index, result: targetResults[index] }))
      .sort((a, b) => a.die.sides - b.die.sides
        || natureRank[a.die.nature] - natureRank[b.die.nature]
        || b.result.value - a.result.value);
    const targetById = new Map<string, THREE.Vector3>();
    const columns = Math.min(6, Math.max(1, dice.length));
    const rows = Math.ceil(dice.length / columns);
    sortedDice.forEach(({ die }, sortedIndex) => {
      const row = Math.floor(sortedIndex / columns);
      const column = sortedIndex % columns;
      const itemsInRow = Math.min(columns, dice.length - row * columns);
      const x = (column - (itemsInRow - 1) / 2) * 0.92;
      const z = (row - (rows - 1) / 2) * 1.02;
      targetById.set(die.id, new THREE.Vector3(x, 0, z));
    });

    // Animation loop
    const startedAt = performance.now();
    let frameId = 0;
    let stopped = false;
    let arrangingNotified = false;

    function render(now: number) {
      if (stopped) return;
      const elapsed = now - startedAt;
      const rollDuration = 980;
      const arrangeDuration = 520;
      const effectiveElapsed = skipAnimationRef.current
        ? rollDuration + arrangeDuration
        : elapsed;
      const rolling = effectiveElapsed < rollDuration;
      const arrangeProgress = Math.min(1, Math.max(0, (effectiveElapsed - rollDuration) / arrangeDuration));

      if (!rolling && !arrangingNotified) {
        arrangingNotified = true;
        setRollPhase("arranging");
      }

      meshHandles.forEach((mh, i) => {
        if (rolling) {
          const sample = sampleRollAnimation(rollPlans[i], effectiveElapsed);
          mh.mesh.quaternion.copy(sample.quaternion);
          mh.mesh.position.y = sample.lift;
        } else {
          const finalSample = sampleRollAnimation(rollPlans[i], rollDuration);
          mh.mesh.quaternion.copy(finalSample.quaternion);
          const target = targetById.get(dice[i].id) ?? startPositions[i];
          const eased = 1 - Math.pow(1 - arrangeProgress, 3);
          mh.mesh.position.lerpVectors(startPositions[i], target, eased);
          mh.mesh.position.y = Math.sin(arrangeProgress * Math.PI) * 0.12;
        }
      });

      renderer.render(scene, camera);

      if (rolling || arrangeProgress < 1) {
        frameId = requestAnimationFrame(render);
      } else {
        setResults(targetResults);
        setRollPhase("done");
      }
    }

    // Start
    setRollPhase("rolling");
    frameId = requestAnimationFrame(render);

    return () => {
      stopped = true;
      cancelAnimationFrame(frameId);
      meshHandles.forEach((mh) => mh.dispose());
      renderer.dispose();
      container.replaceChildren();
    };
  }, [dice]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="modal-backdrop">
      <section className="panel prompt-modal dice-roll-overlay">
        <div className="panel-title">
          <div>
            <p className="eyebrow">新场景 · 气池 → 气海</p>
            <h2>气骰整体投掷</h2>
          </div>
          <button className="icon-button close-button" type="button" onClick={onClose} aria-label="关闭投骰">
            ×
          </button>
        </div>
        <div className="dice-canvas" ref={mountRef} data-testid="three-dice-canvas" />
        <p className={`dice-roll-phase phase-${rollPhase}`} aria-live="polite">
          {rollPhase === "rolling" ? "气骰翻转中……"
            : rollPhase === "arranging" ? "按骰阶、气性与点数归位……"
            : rollPhase === "done" ? "骰面已定，确认后写入气海"
            : "准备投掷"}
        </p>
        <div className="mini-dice-list">
          {(sortedResults.length > 0 ? sortedResults : dice.map((die) => ({ id: die.id, value: 0 }))).map((item) => {
            const die = dice.find((candidate) => candidate.id === item.id)!;
            const result = results.find((candidate) => candidate.id === die.id);
            return (
              <span className="identity-pill" key={die.id}>
                {affinityLabel(affinityFromNature(die.nature))} {dieTypeFromSides(die.sides)}：
                {result?.value ?? "投掷中"}
              </span>
            );
          })}
        </div>
        <label className="check-row">
          <input
            type="checkbox"
            checked={skipAnimation}
            onChange={(event) => {
              skipAnimationRef.current = event.target.checked;
              setSkipAnimation(event.target.checked);
            }}
          />
          跳过动画
        </label>
        <div className="split-actions">
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button
            className="primary-action"
            type="button"
            disabled={results.length !== dice.length}
            onClick={() => onConfirm(results)}
          >
            确认骰面并整体入海
          </button>
        </div>
      </section>
    </div>
  );
}

function affinityLabel(affinity: "yin" | "yang" | "raw") {
  if (affinity === "yin") return "阴";
  if (affinity === "yang") return "阳";
  return "原";
}
