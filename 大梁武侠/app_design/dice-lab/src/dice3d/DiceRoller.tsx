import { useCallback, useRef, useState } from "react";
import * as THREE from "three";
import { DiceScene } from "./DiceScene";
import { createDiceDefinition } from "./DiceGeometryFactory";
import { getInitialDicePosition, resolveDiceOverlap } from "./DicePlacementResolver";
import { initialQuaternionForMaxFaceDown } from "./DiceResultResolver";
import { createDiceId, DIE_TYPES, type Dice3DState, type DiceAffinity, type Die3DType } from "./diceTypes";

const AFFINITIES: Array<{ value: DiceAffinity; label: string }> = [
  { value: "neutral", label: "Neutral" },
  { value: "yin", label: "Yin" },
  { value: "yang", label: "Yang" },
];

function createInitialDie(type: Die3DType, affinity: DiceAffinity, index: number, total: number): Dice3DState {
  const definition = createDiceDefinition(type);
  const rotation = new THREE.Euler().setFromQuaternion(initialQuaternionForMaxFaceDown(definition));
  return {
    id: createDiceId(),
    type,
    affinity,
    result: null,
    position: getInitialDicePosition(index, total),
    radius: definition.radius,
    rotation,
    isRolling: false,
    isDragging: false,
    lastResult: null,
  };
}

export function DiceRoller() {
  const [selectedType, setSelectedType] = useState<Die3DType>("D20");
  const [selectedAffinity, setSelectedAffinity] = useState<DiceAffinity>("neutral");
  const [dice, setDice] = useState<Dice3DState[]>(() => [createInitialDie("D20", "neutral", 0, 1)]);
  const [rollingToken, setRollingToken] = useState(0);
  const [singleRollRequest, setSingleRollRequest] = useState<{ id: string; token: number } | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [skipAnimation, setSkipAnimation] = useState(false);
  const selectedTypeRef = useRef<Die3DType>("D20");
  const selectedAffinityRef = useRef<DiceAffinity>("neutral");

  const handleAddDie = () => {
    setDice((previous) => {
      const next = [
        ...previous,
        createInitialDie(selectedTypeRef.current, selectedAffinityRef.current, previous.length, previous.length + 1),
      ];
      return applyResolvedPositions(next);
    });
  };

  const handleClearDice = () => {
    setDice([createInitialDie(selectedTypeRef.current, selectedAffinityRef.current, 0, 1)]);
  };

  const handleRoll = () => {
    if (dice.length === 0 || isRolling) {
      return;
    }
    setDice((previous) => previous.map((die) => ({ ...die, result: null, isRolling: true })));
    setRollingToken((token) => token + 1);
  };

  const handleRollOne = useCallback((id: string) => {
    if (isRolling) {
      return;
    }
    setDice((previous) => previous.map((die) => (die.id === id ? { ...die, result: null, isRolling: true } : die)));
    setSingleRollRequest((previous) => ({ id, token: (previous?.token ?? 0) + 1 }));
  }, [isRolling]);

  const handleRollStart = useCallback((ids: string[]) => {
    setDice((previous) => previous.map((die) => (ids.includes(die.id) ? { ...die, result: null, isRolling: true } : die)));
    setIsRolling(true);
  }, []);

  const handleRollComplete = useCallback((results: Array<{ id: string; value: number }>) => {
    setDice((previous) => {
      const updated = applyResolvedPositions(previous).map((die) => {
        const result = results.find((item) => item.id === die.id);
        if (!result) {
          return die;
        }
        return {
          ...die,
          result: result.value,
          lastResult: result.value,
          isRolling: false,
        };
      });
      setIsRolling(updated.some((die) => die.isRolling));
      return updated;
    });
  }, []);

  const handleDiePositionChange = useCallback((id: string, position: THREE.Vector3) => {
    setDice((previous) => previous.map((die) => (die.id === id ? { ...die, position: position.clone() } : die)));
  }, []);

  const handleDicePositionChange = useCallback((positions: Array<{ id: string; position: THREE.Vector3 }>) => {
    setDice((previous) =>
      previous.map((die) => {
        const item = positions.find((position) => position.id === die.id);
        return item ? { ...die, position: item.position.clone() } : die;
      }),
    );
  }, []);

  return (
    <main className="prototype-page">
      <header className="prototype-header">
        <p>Top-down 3D dice prototype</p>
        <h1>Dice3D Prototype</h1>
      </header>

      <DiceScene
        dice={dice}
        rollingToken={rollingToken}
        singleRollRequest={singleRollRequest}
        onRollStart={handleRollStart}
        onRollComplete={handleRollComplete}
        onDiePositionChange={handleDiePositionChange}
        onDicePositionChange={handleDicePositionChange}
        onRollOne={handleRollOne}
        skipAnimation={skipAnimation}
      />

      <section className="control-strip" aria-label="dice controls">
        <label>
          Add die
          <select
            value={selectedType}
            onChange={(event) => {
              const nextType = event.target.value as Die3DType;
              selectedTypeRef.current = nextType;
              setSelectedType(nextType);
            }}
          >
            {DIE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label>
          Affinity
          <select
            value={selectedAffinity}
            onChange={(event) => {
              const nextAffinity = event.target.value as DiceAffinity;
              selectedAffinityRef.current = nextAffinity;
              setSelectedAffinity(nextAffinity);
            }}
          >
            {AFFINITIES.map((affinity) => (
              <option key={affinity.value} value={affinity.value}>
                {affinity.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={handleAddDie} disabled={isRolling || dice.length >= 8}>
          Add
        </button>
        <button type="button" onClick={handleClearDice} disabled={isRolling}>
          Reset
        </button>
        <label>
          <input
            type="checkbox"
            checked={skipAnimation}
            onChange={(event) => setSkipAnimation(event.target.checked)}
            disabled={isRolling}
          />
          skip animation
        </label>
        <button className="roll-button" type="button" onClick={handleRoll} disabled={isRolling}>
          {isRolling ? "Rolling" : "Roll"}
        </button>
      </section>
    </main>
  );
}

function applyResolvedPositions(dice: Dice3DState[]): Dice3DState[] {
  const resolved = resolveDiceOverlap(
    dice.map((die) => ({
      id: die.id,
      position: die.position,
      radius: die.radius,
    })),
  );
  return dice.map((die) => ({
    ...die,
    position: resolved.get(die.id)?.clone() ?? die.position,
  }));
}
