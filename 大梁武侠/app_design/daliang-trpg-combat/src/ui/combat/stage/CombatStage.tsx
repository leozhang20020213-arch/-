import { useState, type FC } from "react";
import type { StageData } from "../../../types/combat";
import type { CombatState, Move } from "../../../combat/types";
import { deriveTargetState, targetLineTooltip } from "../../../lib/combat/targetValidation";
import { CombatantNode } from "./CombatantNode";
import { DistanceLine } from "./DistanceLine";
import { TargetLine } from "./TargetLine";
import { SceneObjectiveMini } from "./SceneObjectiveMini";

export interface CombatStageProps {
  data: StageData;
  /** Full combat state (for distance lookups) */
  state: CombatState;
  /** External selected ID (from stage click or dropdown) */
  selectedId?: string;
  /** Called when a combatant node is clicked */
  onSelectCombatant?: (id: string) => void;
  /** Currently selected move (for distance validation) */
  selectedMove?: Move;
}

/**
 * Tactical Combat Stage with target lines.
 *
 * Layout:
 *   ┌─ Scene header (name + tags) ──────┐
 *   │   SVG overlay:                     │
 *   │     - Distance lines (static)      │
 *   │     - Target line (dynamic)        │
 *   │   Combatant nodes (absolute)       │
 *   └─ Scene objectives (progress) ──────┘
 *
 * The target line connects the acting actor to the selected target.
 * It validates distance against the selected move's target range.
 */
export const CombatStage: FC<CombatStageProps> = ({
  data,
  state,
  selectedId,
  onSelectCombatant,
  selectedMove,
}) => {
  const [internalSelected, setInternalSelected] = useState<string | undefined>(
    selectedId ?? data.selectedCombatantId,
  );

  const activeSelected = selectedId ?? internalSelected;

  function handleSelect(id: string) {
    if (onSelectCombatant) {
      onSelectCombatant(id);
    } else {
      setInternalSelected(id === activeSelected ? undefined : id);
    }
  }

  // Compute target state for the target line
  const targetState = deriveTargetState(
    state,
    activeSelected,
    selectedMove,
  );

  // Find positions for the target line
  const actingCombatant = data.combatants.find(
    (c) => c.id === state.activeActorId,
  );
  const targetCombatant = targetState.selectedTargetId
    ? data.combatants.find((c) => c.id === targetState.selectedTargetId)
    : undefined;

  const showTargetLine = Boolean(
    actingCombatant &&
    targetCombatant &&
    targetState.selectedTargetId &&
    targetState.selectedTargetId !== state.activeActorId,
  );

  const tooltip = showTargetLine
    ? targetLineTooltip(
        actingCombatant!.name,
        targetCombatant!.name,
        targetState.distanceBand,
        selectedMove?.name,
        targetState.isRangeValid,
      )
    : "";

  return (
    <div className="tactical-stage">
      {/* ---- Scene header ---- */}
      <div className="tactical-stage-header">
        <span className="stage-scene-name">{data.sceneName}</span>
        <div className="stage-scene-tags">
          {data.sceneTags.map((tag) => (
            <span key={tag} className="stage-tag">{tag}</span>
          ))}
        </div>
      </div>

      {/* ---- Battlefield area (nodes + SVG lines) ---- */}
      <div className="tactical-battlefield">
        {/* Atmospheric background */}
        <div className="battlefield-bg">
          <div className="rain-overlay" />
          <div className="ground-texture" />
        </div>

        {/* SVG distance + target lines layer */}
        <svg
          className="distance-svg-layer"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Static distance lines between all connected combatants */}
          {data.distances.map((edge) => (
            <DistanceLine
              key={`${edge.from}-${edge.to}`}
              edge={edge}
              combatants={data.combatants}
            />
          ))}

          {/* Dynamic target line from acting actor to selected target */}
          {showTargetLine && (
            <TargetLine
              x1={actingCombatant!.x}
              y1={actingCombatant!.y}
              x2={targetCombatant!.x}
              y2={targetCombatant!.y}
              band={targetState.distanceBand}
              isValid={targetState.isRangeValid}
              invalidReason={targetState.invalidReason}
              tooltip={tooltip}
            />
          )}
        </svg>

        {/* Combatant nodes layer */}
        <div className="combatant-layer">
          {data.combatants.map((c) => (
            <CombatantNode
              key={c.id}
              combatant={c}
              isSelected={activeSelected === c.id}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </div>

      {/* ---- Scene objectives ---- */}
      <SceneObjectiveMini objectives={data.objectives} />
    </div>
  );
};
