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
 * Layout (slot-based, side-partitioned):
 *   ┌─ Scene header (name + tags) ────────────────────┐
 *   │   ┌── Player Zone ──┬─ Center ──┬─ Enemy Zone ─┐ │
 *   │   │  combatant cards │  target   │ combatant     │ │
 *   │   │  (slot-aligned)  │  line(s)  │ cards         │ │
 *   │   │                  │  labels   │ (slot-aligned)│ │
 *   │   └─────────────────┴───────────┴──────────────┘ │
 *   └─ Scene objectives (progress bars) ──────────────┘
 *
 * Key design decisions:
 *   - Combatants positioned by slot system (x,y in 0–100% viewBox space)
 *   - Side zones rendered as visual containers with labels
 *   - Only ONE target line shown: from {activeActorId} → {selectedTargetId}
 *   - Current actor card gets the "current-actor" gold glow
 *   - Selected target card gets the "targeted" red ring
 *   - Defeated actors are dimmed and unclickable
 *   - Zone labels ("我方" / "敌方") shown as headers
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

  // ---- Determine which actors are defeated / targetable ----
  const defeatedIds = new Set(
    state.actors
      .filter((a) => a.hp <= 0)
      .map((a) => a.id),
  );

  const targetableIds = new Set(
    state.actors
      .filter((a) => a.side !== "player" && a.hp > 0)
      .map((a) => a.id),
  );

  // ---- Group combatants by side ----
  const playerCombatants = data.combatants.filter((c) => c.side === "player");
  const enemyCombatants = data.combatants.filter((c) => c.side === "enemy");
  const allyCombatants = data.combatants.filter((c) => c.side === "ally");
  const neutralCombatants = data.combatants.filter((c) => c.side === "neutral");

  // ---- Render a single combatant node with all state computed ----
  function renderCombatant(c: (typeof data.combatants)[number]) {
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
  }

  const playerCount = playerCombatants.length;
  const enemyCount = enemyCombatants.length;
  const allyCount = allyCombatants.length;
  const neutralCount = neutralCombatants.length;
  const hasOthers = allyCount > 0 || neutralCount > 0;

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

      {/* ---- Battlefield area (nodes + SVG lines + side zones) ---- */}
      <div className="tactical-battlefield">
        {/* Atmospheric background */}
        <div className="battlefield-bg">
          <div className="rain-overlay" />
          <div className="ground-texture" />
        </div>

        {/* Side zone backgrounds — visual containers for each faction */}
        <div className="side-zones-layer">
          {/* Player zone (left) */}
          <div className={`side-zone-bg player-zone-bg${playerCount > 0 ? " has-actors" : ""}`}>
            <div className="side-zone-label-top">
              <span className="side-zone-title">我方</span>
              <span className="side-zone-count">{playerCount}人</span>
            </div>
          </div>

          {/* Enemy zone (right) */}
          <div className={`side-zone-bg enemy-zone-bg${enemyCount > 0 ? " has-actors" : ""}`}>
            <div className="side-zone-label-top enemy-label-top">
              <span className="side-zone-count">{enemyCount}人</span>
              <span className="side-zone-title">敌方</span>
            </div>
          </div>

          {/* Ally zone (bottom-left, only when present) */}
          {allyCount > 0 && (
            <div className="side-zone-bg ally-zone-bg has-actors">
              <div className="side-zone-label-top">
                <span className="side-zone-title">友方</span>
                <span className="side-zone-count">{allyCount}人</span>
              </div>
            </div>
          )}

          {/* Neutral zone (bottom-center, only when present) */}
          {neutralCount > 0 && (
            <div className="side-zone-bg neutral-zone-bg has-actors">
              <div className="side-zone-label-top">
                <span className="side-zone-title">其他</span>
                <span className="side-zone-count">{neutralCount}人</span>
              </div>
            </div>
          )}
        </div>

        {/* SVG target line layer */}
        <svg
          className="distance-svg-layer"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
        >
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

        {/* Combatant nodes layer — absolutely positioned in viewBox space */}
        <div className="combatant-layer">
          {/* Player cards */}
          {playerCombatants.map(renderCombatant)}

          {/* Enemy cards */}
          {enemyCombatants.map(renderCombatant)}

          {/* Ally cards */}
          {allyCombatants.map(renderCombatant)}

          {/* Neutral cards */}
          {neutralCombatants.map(renderCombatant)}

          {/* Empty state hints */}
          {data.combatants.length === 0 && (
            <div className="battlefield-empty">
              <span>暂无角色入场</span>
            </div>
          )}
        </div>

        {/* Center-field distance / interaction hint */}
        {hasOthers && (
          <div className="battlefield-extra-zones-hint">
            {allyCount > 0 && <span>友方 {allyCount}人</span>}
            {neutralCount > 0 && <span>其他 {neutralCount}</span>}
          </div>
        )}
      </div>

      {/* ---- Scene objectives ---- */}
      <SceneObjectiveMini objectives={data.objectives} />
    </div>
  );
};
