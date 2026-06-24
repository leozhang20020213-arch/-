import { useState, type FC } from "react";
import type { StageData } from "../../../types/combat";
import type { CombatState, Move } from "../../../combat/types";
import { deriveTargetState, targetLineTooltip } from "../../../lib/combat/targetValidation";
import { CombatantNode } from "./CombatantNode";
import { TargetLine } from "./TargetLine";
import { SceneObjectiveMini } from "./SceneObjectiveMini";

export interface CombatStageProps {
  data: StageData;
  /** Full combat state (for distance lookups and active actor) */
  state: CombatState;
  /** External selected combatant ID (from stage click) */
  selectedId?: string;
  /** Currently selected TARGET ID (the one the right-panel dropdown points to) */
  selectedTargetId?: string;
  /** Called when a combatant node is clicked */
  onSelectCombatant?: (id: string) => void;
  /** Currently selected move (for distance validation) */
  selectedMove?: Move;
}

/**
 * Tactical Combat Stage — the main battlefield.
 *
 * Layout:
 *   ┌─ Scene header (name + tags) ──────────┐
 *   │   SVG overlay:                          │
 *   │     - Target line (dynamic, one line)   │
 *   │   Combatant nodes (absolute positioned) │
 *   └─ Scene objectives (progress bars) ──────┘
 *
 * Key design decisions:
 *   - Only ONE target line is shown: from {activeActorId} → {selectedTargetId}
 *   - Static distance lines between all pairs are HIDDEN (clutter)
 *   - Current actor card gets the "current-actor" gold glow
 *   - Selected target card gets the "targeted" red ring
 *   - Defeated actors are dimmed and unclickable
 *   - Clicking an enemy on stage sets it as the selected target
 */
export const CombatStage: FC<CombatStageProps> = ({
  data,
  state,
  selectedId,
  selectedTargetId,
  onSelectCombatant,
  selectedMove,
}) => {
  // Internal fallback selected ID when no external control
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

  // ---- Determine the effective target ID ----
  // Priority: external selectedTargetId > selectedId (stage click) > internal
  const effectiveTargetId = selectedTargetId ?? activeSelected;

  // Derive target state for the target line
  const targetState = deriveTargetState(
    state,
    effectiveTargetId,
    selectedMove,
  );

  // ---- Find positions for the target line ----
  const actingCombatant = data.combatants.find(
    (c) => c.id === state.activeActorId,
  );
  const targetCombatant = effectiveTargetId
    ? data.combatants.find((c) => c.id === effectiveTargetId)
    : undefined;

  const showTargetLine = Boolean(
    actingCombatant &&
    targetCombatant &&
    effectiveTargetId &&
    effectiveTargetId !== state.activeActorId,
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

  // ---- Determine which actors are defeated ----
  const defeatedIds = new Set(
    state.actors
      .filter((a) => a.hp <= 0)
      .map((a) => a.id),
  );

  // ---- Determine which actors can be targeted ----
  // Enemy and pressure actors that are alive can be targeted
  const targetableIds = new Set(
    state.actors
      .filter((a) => a.side !== "player" && a.hp > 0)
      .map((a) => a.id),
  );

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
          {/* Side zone labels */}
          <div className="battlefield-zone-label zone-player">我方</div>
          <div className="battlefield-zone-label zone-enemy">敌方</div>
        </div>

        {/* SVG target line layer */}
        <svg
          className="distance-svg-layer"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Only the active target line — static distance lines removed */}
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
              fromName={actingCombatant!.name}
              toName={targetCombatant!.name}
            />
          )}
        </svg>

        {/* Combatant nodes layer */}
        <div className="combatant-layer">
          {data.combatants.map((c) => {
            const isCurrent = c.id === state.activeActorId;
            const isTarget = c.id === effectiveTargetId;
            const isDefeated = defeatedIds.has(c.id);
            const canTarget = targetableIds.has(c.id);

            return (
              <CombatantNode
                key={c.id}
                combatant={c}
                isSelected={activeSelected === c.id && !isCurrent && !isTarget}
                isCurrentActor={isCurrent}
                isTargeted={isTarget}
                isDefeated={isDefeated}
                canBeTargeted={canTarget}
                onSelect={handleSelect}
              />
            );
          })}
        </div>
      </div>

      {/* ---- Scene objectives ---- */}
      <SceneObjectiveMini objectives={data.objectives} />
    </div>
  );
};
