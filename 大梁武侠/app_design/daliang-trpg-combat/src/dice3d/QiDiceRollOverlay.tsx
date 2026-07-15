import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { QiDie } from "../combat/types";
import {
  affinityFromNature,
  dieTypeFromSides,
  type DiceRollResult,
  type Dice3DState,
} from "./diceTypes";
import { createDiceDefinition } from "./DiceGeometryFactory";
import { createDiceMesh, type DiceMeshHandle } from "./DiceMesh";
import { packDicePositions } from "./DicePlacementResolver";
import { createRollAnimationPlan, sampleRollAnimation } from "./DiceRollController";

type RollPhase = "idle" | "rolling" | "arranging" | "done" | "fallback";

let sharedRenderer: THREE.WebGLRenderer | null = null;
const sharedTableGeometry = new THREE.BoxGeometry(8.4, 0.16, 5.3);
const sharedTableMaterial = new THREE.MeshStandardMaterial({ color: 0x302821, roughness: 0.82 });

function createResults(dice: QiDie[]): DiceRollResult[] {
  return dice.map((die) => ({
    id: die.id,
    value: Math.floor(Math.random() * die.sides) + 1,
  }));
}

export function QiDiceRollOverlay({
  dice,
  onConfirm,
  onClose: _onClose,
  presentation = "full",
  motionSpeed = 1,
  context = "new_scene",
}: {
  dice: QiDie[];
  onConfirm: (results: DiceRollResult[]) => void;
  onClose: () => void;
  presentation?: "full" | "fast" | "2d";
  motionSpeed?: 0.5 | 1 | 1.5 | 2;
  context?: "new_scene" | "new_entrant";
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const skipAnimationRef = useRef(false);
  const confirmedRef = useRef(false);
  const [results, setResults] = useState<DiceRollResult[]>([]);
  const [rollPhase, setRollPhase] = useState<RollPhase>("idle");
  const [rendererUnavailable, setRendererUnavailable] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reducedMotion) {
      skipAnimationRef.current = true;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.code === "Space") {
        event.preventDefault();
        skipAnimationRef.current = true;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (results.length !== dice.length || confirmedRef.current) return;
    const timer = window.setTimeout(() => confirmResults(), presentation === "2d" ? 260 : 90);
    return () => window.clearTimeout(timer);
  }, [dice.length, results]);

  useEffect(() => {
    if (rollPhase !== "idle") return;
    const container = mountRef.current;
    if (!container) return;

    const targetResults = createResults(dice);
    if (presentation === "2d") {
      setRollPhase("fallback");
      const timer = window.setTimeout(() => setResults(targetResults), Math.max(80, 180 / motionSpeed));
      return () => window.clearTimeout(timer);
    }
    const height = Math.max(150, container.clientHeight || 190);
    const width = Math.max(420, container.clientWidth || 720);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1410);
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 8.8, 0.65);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      sharedRenderer ??= new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer = sharedRenderer;
    } catch {
      setRendererUnavailable(true);
      setResults(targetResults);
      setRollPhase("fallback");
      return;
    }

    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffe8c4, 0x182427, 2.25));
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.1);
    dirLight.position.set(4, 8, 5);
    scene.add(dirLight);

    const table = new THREE.Mesh(sharedTableGeometry, sharedTableMaterial);
    table.position.y = -0.18;
    table.receiveShadow = true;
    scene.add(table);

    const meshHandles: DiceMeshHandle[] = [];
    const definitions: ReturnType<typeof createDiceDefinition>[] = [];
    dice.forEach((die) => {
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
      definitions.push(createDiceDefinition(state.type));
      const meshHandle = createDiceMesh(state);
      meshHandle.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      scene.add(meshHandle.mesh);
      meshHandles.push(meshHandle);
    });

    const natureRank = { yin: 0, yang: 1, raw: 2 } as const;
    const sortedDice = dice
      .map((die, index) => ({ die, definition: definitions[index], result: targetResults[index] }))
      .sort((a, b) => a.die.sides - b.die.sides
        || natureRank[a.die.nature] - natureRank[b.die.nature]
        || b.result.value - a.result.value);
    const packing = packDicePositions(
      sortedDice.map(({ die, definition }) => ({ id: die.id, radius: definition.radius })),
      { width: 7.55, depth: 4.35, gap: 0.34, maxColumns: Math.max(4, Math.ceil(Math.sqrt(dice.length))) },
    );
    const targetById = packing.positions;
    const startPositions = dice.map((die, index) => {
      const target = targetById.get(die.id) ?? new THREE.Vector3();
      const angle = (index / Math.max(1, dice.length)) * Math.PI * 2;
      return target.clone().add(new THREE.Vector3(Math.cos(angle) * 2.1, 0, Math.sin(angle) * 1.25));
    });
    meshHandles.forEach((handle, index) => {
      handle.mesh.scale.setScalar(packing.scale * 0.72);
      handle.mesh.position.copy(startPositions[index]);
    });
    const rollPlans = meshHandles.map((handle, index) =>
      createRollAnimationPlan(definitions[index], handle.mesh.quaternion.clone(), targetResults[index].value));

    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width < 1 || rect.height < 1) return;
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      renderer.setSize(rect.width, rect.height, false);
    });
    resizeObserver?.observe(container);

    const startedAt = performance.now();
    let frameId = 0;
    let stopped = false;
    let arrangingNotified = false;
    function render(now: number) {
      if (stopped) return;
      const rollDuration = (presentation === "fast" ? 250 : 720) / motionSpeed;
      const arrangeDuration = (presentation === "fast" ? 60 : 150) / motionSpeed;
      const elapsed = skipAnimationRef.current
        ? rollDuration + arrangeDuration
        : now - startedAt;
      const rolling = elapsed < rollDuration;
      const arrangeProgress = Math.min(1, Math.max(0, (elapsed - rollDuration) / arrangeDuration));
      if (!rolling && !arrangingNotified) {
        arrangingNotified = true;
        setRollPhase("arranging");
      }
      meshHandles.forEach((handle, index) => {
        if (rolling) {
          const sample = sampleRollAnimation(rollPlans[index], elapsed);
          handle.mesh.quaternion.copy(sample.quaternion);
          const target = targetById.get(dice[index].id) ?? startPositions[index];
          const progress = Math.min(1, elapsed / rollDuration);
          const orbit = Math.sin(progress * Math.PI * 2 + index * 0.73) * 0.08;
          handle.mesh.position.lerpVectors(startPositions[index], target, progress * 0.72);
          handle.mesh.position.x += orbit;
          handle.mesh.position.y = sample.lift + Math.sin(Math.PI * progress) * 0.32;
          return;
        }
        const finalSample = sampleRollAnimation(rollPlans[index], rollDuration);
        handle.mesh.quaternion.copy(finalSample.quaternion);
        const target = targetById.get(dice[index].id) ?? startPositions[index];
        const eased = 1 - Math.pow(1 - arrangeProgress, 3);
        handle.mesh.position.lerpVectors(startPositions[index], target, eased);
        handle.mesh.position.y = Math.sin(arrangeProgress * Math.PI) * 0.12;
      });
      renderer.render(scene, camera);
      if (rolling || arrangeProgress < 1) {
        frameId = requestAnimationFrame(render);
      } else {
        setResults(targetResults);
        setRollPhase("done");
      }
    }

    setRollPhase("rolling");
    frameId = requestAnimationFrame(render);
    return () => {
      stopped = true;
      cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      meshHandles.forEach((handle) => handle.dispose());
      renderer.renderLists.dispose();
      if (renderer.domElement.parentElement === container) container.removeChild(renderer.domElement);
    };
  }, [dice, motionSpeed, presentation]); // The renderer owns the complete roll lifecycle for this dice set.

  function confirmResults() {
    if (confirmedRef.current || results.length !== dice.length) return;
    confirmedRef.current = true;
    onConfirm(results);
  }

  const phaseMessage = rollPhase === "rolling"
    ? "气骰翻转中……"
    : rollPhase === "arranging"
      ? "按骰阶、气性与点数归位……"
      : rollPhase === "fallback"
        ? presentation === "2d"
          ? "稳定二维投掷：权威骰面已定。"
          : "三维渲染不可用，已使用等价随机投掷结果。"
        : rollPhase === "done"
          ? "骰面已定，正在写入气海。"
          : "准备投掷。";

  return (
    <div className="dice-roll-dock" role="status" aria-live="polite">
      <section
        className="dice-roll-overlay"
        aria-label={context === "new_entrant" ? "新参战者补投气骰" : "新场景气骰整体投掷"}
      >
        <div className="dice-roll-caption"><span>{context === "new_entrant" ? "新参战者 · 仅补投自身" : "新场景 · 气池入海"}</span><strong>{context === "new_entrant" ? "补投气骰" : "气骰整体投掷"}</strong><small>空格跳过表现</small></div>
        <div
          className={`dice-canvas${rendererUnavailable ? " is-fallback" : ""}`}
          ref={mountRef}
          data-testid="three-dice-canvas"
          aria-hidden="true"
        >
          {presentation === "2d" ? (
            <div className="dice-roll-2d" aria-hidden="true">
              {results.map((result) => {
                const die = dice.find((item) => item.id === result.id);
                return <span className={`nature-${die?.nature ?? "raw"}`} key={result.id}><b>{result.value}</b><small>D{die?.sides}</small></span>;
              })}
            </div>
          ) : null}
        </div>
        <p className={`dice-roll-phase phase-${rollPhase}`}>
          {phaseMessage}
        </p>
      </section>
    </div>
  );
}

function affinityLabel(affinity: "yin" | "yang" | "raw") {
  if (affinity === "yin") return "阴";
  if (affinity === "yang") return "阳";
  return "原";
}
