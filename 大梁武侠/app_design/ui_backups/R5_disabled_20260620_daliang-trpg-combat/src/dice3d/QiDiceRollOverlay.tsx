import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { QiDie } from "../combat/types";
import { affinityFromNature, dieTypeFromSides, type DiceRollResult } from "./diceTypes";

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
  const rollSeed = useMemo(() => Date.now(), [dice]);

  useEffect(() => {
    if (!mountRef.current) return undefined;
    const width = mountRef.current.clientWidth || 640;
    const height = 300;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 4.4, 7.6);
    camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xfff4df, 1.8));
    const light = new THREE.DirectionalLight(0xffffff, 2.4);
    light.position.set(4, 8, 5);
    scene.add(light);
    const table = new THREE.Mesh(new THREE.CircleGeometry(3.6, 64), new THREE.MeshStandardMaterial({ color: 0x6d4b2c, roughness: 0.82 }));
    table.rotation.x = -Math.PI / 2;
    table.position.y = -0.62;
    scene.add(table);

    const meshes = dice.map((die, index) => {
      const mesh = new THREE.Mesh(createGeometry(die.sides), createMaterial(die.nature));
      mesh.position.set((index - (dice.length - 1) / 2) * 1.05, 0, 0);
      mesh.rotation.set(Math.random(), Math.random(), Math.random());
      scene.add(mesh);
      return mesh;
    });

    const targetResults = dice.map((die) => ({ id: die.id, value: Math.floor(Math.random() * die.sides) + 1 }));
    const startedAt = performance.now();
    let frame = 0;
    let stopped = false;

    function render(now: number) {
      if (stopped) return;
      const elapsed = now - startedAt;
      const progress = skipAnimation ? 1 : Math.min(1, elapsed / 980);
      meshes.forEach((mesh, index) => {
        mesh.rotation.x += (0.08 + index * 0.012) * (1 - progress + 0.18);
        mesh.rotation.y += (0.11 + index * 0.01) * (1 - progress + 0.16);
        mesh.position.y = Math.sin(progress * Math.PI) * 0.55;
      });
      renderer.render(scene, camera);
      if (progress < 1) {
        frame = requestAnimationFrame(render);
      } else {
        setResults(targetResults);
      }
    }

    frame = requestAnimationFrame(render);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      renderer.dispose();
      mountRef.current?.replaceChildren();
    };
  }, [dice, rollSeed, skipAnimation]);

  return (
    <div className="modal-backdrop">
      <section className="panel prompt-modal dice-roll-overlay">
        <div className="panel-title">
          <h2>气骰投掷</h2>
          <button className="icon-button close-button" type="button" onClick={onClose} aria-label="关闭投骰">×</button>
        </div>
        <div className="dice-canvas" ref={mountRef} data-testid="three-dice-canvas" />
        <div className="mini-dice-list">
          {dice.map((die) => {
            const result = results.find((item) => item.id === die.id);
            return (
              <span className="identity-pill" key={die.id}>
                {affinityLabel(affinityFromNature(die.nature))} {dieTypeFromSides(die.sides)}：{result?.value ?? "投掷中"}
              </span>
            );
          })}
        </div>
        <label className="check-row">
          <input type="checkbox" checked={skipAnimation} onChange={(event) => setSkipAnimation(event.target.checked)} />
          跳过动画
        </label>
        <div className="split-actions">
          <button type="button" onClick={onClose}>取消</button>
          <button className="primary-action" type="button" disabled={results.length !== dice.length} onClick={() => onConfirm(results)}>确认结果并写入事件</button>
        </div>
      </section>
    </div>
  );
}

function createGeometry(sides: number): THREE.BufferGeometry {
  if (sides === 4) return new THREE.TetrahedronGeometry(0.48);
  if (sides === 6) return new THREE.BoxGeometry(0.72, 0.72, 0.72);
  if (sides === 8) return new THREE.OctahedronGeometry(0.55);
  if (sides === 12) return new THREE.DodecahedronGeometry(0.52);
  if (sides === 20) return new THREE.IcosahedronGeometry(0.54);
  return new THREE.ConeGeometry(0.5, 0.86, 10);
}

function createMaterial(nature: QiDie["nature"]): THREE.Material {
  const color = nature === "yin" ? 0x2f3b55 : nature === "yang" ? 0xb87627 : nature === "neutral" ? 0x7a684b : 0x8f8a74;
  return new THREE.MeshStandardMaterial({ color, metalness: 0.18, roughness: 0.38 });
}

function affinityLabel(affinity: "yin" | "yang" | "neutral") {
  if (affinity === "yin") return "阴";
  if (affinity === "yang") return "阳";
  return "中";
}
