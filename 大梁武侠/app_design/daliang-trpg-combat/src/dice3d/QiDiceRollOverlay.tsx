import { useEffect, useRef, useState } from "react";
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
  const [results, setResults] = useState<DiceRollResult[]>([]);
  const [skipAnimation, setSkipAnimation] = useState(false);
  const [rollPhase, setRollPhase] = useState<"idle" | "rolling" | "done">("idle");

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

    // Create roll plans
    const rollPlans = meshHandles.map((mh, i) => {
      const startQuat = mh.mesh.quaternion.clone();
      return createRollAnimationPlan(definitions[i], startQuat, targetResults[i].value);
    });

    // Animation loop
    const startedAt = performance.now();
    let frameId = 0;
    let stopped = false;

    function render(now: number) {
      if (stopped) return;
      const elapsed = now - startedAt;
      const progress = skipAnimation ? 1 : Math.min(1, elapsed / 980);

      meshHandles.forEach((mh, i) => {
        if (skipAnimation) {
          // Instant: set final quaternion
          const result = targetResults[i].value;
          const face = definitions[i].faces.find((f) => f.value === result) ?? definitions[i].faces[0];
          const q = new THREE.Quaternion().setFromUnitVectors(
            face.normal.clone().normalize(),
            new THREE.Vector3(0, 1, 0),
          );
          mh.mesh.quaternion.copy(q);
        } else {
          const sample = sampleRollAnimation(rollPlans[i], elapsed);
          mh.mesh.quaternion.copy(sample.quaternion);
          mh.mesh.position.y = sample.lift;
        }
      });

      renderer.render(scene, camera);

      if (progress < 1) {
        frameId = requestAnimationFrame(render);
      } else {
        // Read final results
        const finalResults = meshHandles.map((mh, i) => ({
          id: dice[i].id,
          value: resolveResultFromPose(definitions[i], mh.mesh.quaternion as unknown as THREE.Quaternion),
        }));
        setResults(finalResults);
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
  }, [dice, skipAnimation]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="modal-backdrop">
      <section className="panel prompt-modal dice-roll-overlay">
        <div className="panel-title">
          <h2>气骰投掷</h2>
          <button className="icon-button close-button" type="button" onClick={onClose} aria-label="关闭投骰">
            ×
          </button>
        </div>
        <div className="dice-canvas" ref={mountRef} data-testid="three-dice-canvas" />
        <div className="mini-dice-list">
          {dice.map((die) => {
            const result = results.find((item) => item.id === die.id);
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
            onChange={(event) => setSkipAnimation(event.target.checked)}
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
            确认结果并写入事件
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
