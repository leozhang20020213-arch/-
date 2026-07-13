import { useEffect, useId, useMemo, useRef, useState } from "react";
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
import { createDiceMesh, type DiceMeshHandle } from "./DiceMesh";
import { getInitialDicePosition } from "./DicePlacementResolver";
import { createRollAnimationPlan, sampleRollAnimation } from "./DiceRollController";

import studioHDRI from "../assets/materials/polyhaven/studio_small_03_1k.hdr?url";

type RollPhase = "idle" | "rolling" | "arranging" | "done" | "fallback";

function createResults(dice: QiDie[]): DiceRollResult[] {
  return dice.map((die) => ({
    id: die.id,
    value: Math.floor(Math.random() * die.sides) + 1,
  }));
}

export function QiDiceRollOverlay({
  dice,
  onConfirm,
  onClose,
}: {
  dice: QiDie[];
  onConfirm: (results: DiceRollResult[]) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const skipId = useId();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const skipAnimationRef = useRef(false);
  const confirmedRef = useRef(false);
  const [results, setResults] = useState<DiceRollResult[]>([]);
  const [skipAnimation, setSkipAnimation] = useState(false);
  const [rollPhase, setRollPhase] = useState<RollPhase>("idle");
  const [rendererUnavailable, setRendererUnavailable] = useState(false);

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
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reducedMotion) {
      skipAnimationRef.current = true;
      setSkipAnimation(true);
    }
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    if (rollPhase !== "idle") return;
    const container = mountRef.current;
    if (!container) return;

    const targetResults = createResults(dice);
    const height = Math.max(240, container.clientHeight || 300);
    const width = Math.max(320, container.clientWidth || 640);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1410);
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 4.4, 7.6);
    camera.lookAt(0, 0, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setRendererUnavailable(true);
      setResults(targetResults);
      setRollPhase("fallback");
      return;
    }

    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    container.appendChild(renderer.domElement);

    let environmentTexture: THREE.DataTexture | null = null;
    const hdriLoader = new RGBELoader();
    hdriLoader.load(
      studioHDRI,
      (texture) => {
        environmentTexture = texture;
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture;
      },
      undefined,
      () => {
        // The direct and ambient lights keep the tray usable without HDRI.
      },
    );

    scene.add(new THREE.AmbientLight(0xfff4df, 1.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.4);
    dirLight.position.set(4, 8, 5);
    scene.add(dirLight);

    const tableGeometry = new THREE.CircleGeometry(3.6, 64);
    const tableMaterial = new THREE.MeshStandardMaterial({ color: 0x3a3028, roughness: 0.72 });
    const table = new THREE.Mesh(tableGeometry, tableMaterial);
    table.rotation.x = -Math.PI / 2;
    table.position.y = -0.62;
    table.receiveShadow = true;
    scene.add(table);

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
      definitions.push(createDiceDefinition(state.type));
      const meshHandle = createDiceMesh(state);
      const position = getInitialDicePosition(index, dice.length);
      meshHandle.mesh.position.set(position.x, 0, position.z);
      meshHandle.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      scene.add(meshHandle.mesh);
      meshHandles.push(meshHandle);
    });

    const rollPlans = meshHandles.map((handle, index) =>
      createRollAnimationPlan(definitions[index], handle.mesh.quaternion.clone(), targetResults[index].value));
    const startPositions = meshHandles.map((handle) => handle.mesh.position.clone());
    const natureRank = { yin: 0, yang: 1, raw: 2 } as const;
    const sortedDice = dice
      .map((die, index) => ({ die, result: targetResults[index] }))
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
      targetById.set(die.id, new THREE.Vector3(
        (column - (itemsInRow - 1) / 2) * 0.92,
        0,
        (row - (rows - 1) / 2) * 1.02,
      ));
    });

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
      const rollDuration = 980;
      const arrangeDuration = 520;
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
          handle.mesh.position.y = sample.lift;
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
      environmentTexture?.dispose();
      tableGeometry.dispose();
      tableMaterial.dispose();
      renderer.dispose();
      container.replaceChildren();
    };
  }, [dice]); // The renderer owns the complete roll lifecycle for this dice set.

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
        ? "三维渲染不可用，已使用等价随机投掷结果。"
        : rollPhase === "done"
          ? "骰面已定，确认后写入气海。"
          : "准备投掷。";

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="panel prompt-modal dice-roll-overlay"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className="panel-title">
          <div>
            <p className="eyebrow">新场景 · 气池 → 气海</p>
            <h2 id={titleId}>气骰整体投掷</h2>
          </div>
          <button
            ref={closeButtonRef}
            className="icon-button close-button"
            type="button"
            onClick={onClose}
            aria-label="关闭投骰"
          >
            ×
          </button>
        </div>
        <div
          className={`dice-canvas${rendererUnavailable ? " is-fallback" : ""}`}
          ref={mountRef}
          data-testid="three-dice-canvas"
          aria-hidden="true"
        />
        <p id={descriptionId} className={`dice-roll-phase phase-${rollPhase}`} aria-live="polite">
          {phaseMessage}
        </p>
        <div className="mini-dice-list" aria-label="投骰结果">
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
        <label className="check-row" htmlFor={skipId}>
          <input
            id={skipId}
            type="checkbox"
            checked={skipAnimation}
            onChange={(event) => {
              skipAnimationRef.current = event.target.checked;
              setSkipAnimation(event.target.checked);
            }}
          />
          跳过动画
        </label>
        <div className="split-actions prompt-modal__actions">
          <button type="button" onClick={onClose}>取消</button>
          <button
            className="primary-action"
            type="button"
            disabled={results.length !== dice.length || confirmedRef.current}
            onClick={confirmResults}
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
