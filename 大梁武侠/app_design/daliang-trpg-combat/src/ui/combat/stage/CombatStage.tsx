import { useState, type FC } from "react";
import type { StageData } from "../../../types/combat";
import type { CombatState, Move } from "../../../combat/types";
import { deriveTargetState, targetLineTooltip } from "../../../lib/combat/targetValidation";
import { CombatantNode } from "./CombatantNode";
import { TargetLine, TargetLineLabel } from "./TargetLine";
import { SceneObjectiveMini } from "./SceneObjectiveMini";

/** One action-to-target line rendered on the combat stage. */
export interface CombatStageTargetLine {
  /** Defaults to state.activeActorId. */
  sourceActorId?: string;
  targetActorId: string;
  /** Defaults to CombatStage.selectedMove. */
  move?: Move;
}

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
  /** Actor IDs the caller currently permits as click targets. */
  targetableActorIds?: Iterable<string>;
  /**
   * Explicit target lines for one-to-many actions. When omitted, the legacy
   * selectedTargetId/selectedId single-line behaviour remains active.
   */
  targetLines?: readonly CombatStageTargetLine[];
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
 *   - Supports one-to-many target lines; legacy single-target props still work
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
  targetableActorIds,
  targetLines,
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

  // ---- Legacy single-target fallback ----
  const effectiveTargetId = selectedTargetId ?? activeSelected;

  const requestedTargetLines: readonly CombatStageTargetLine[] = targetLines ?? (
    effectiveTargetId
      ? [{ targetActorId: effectiveTargetId, move: selectedMove }]
      : []
  );

  // Resolve positions and legality independently for every target line.
  const resolvedTargetLines = requestedTargetLines.flatMap((request, index) => {
    const sourceActorId = request.sourceActorId ?? state.activeActorId;
    if (sourceActorId === request.targetActorId) return [];

    const source = data.combatants.find((combatant) => combatant.id === sourceActorId);
    const target = data.combatants.find((combatant) => combatant.id === request.targetActorId);
    if (!source || !target) return [];

    const move = request.move ?? selectedMove;
    const targetState = deriveTargetState(
      state,
      request.targetActorId,
      move,
      sourceActorId,
    );
    const tooltip = targetLineTooltip(
      source.name,
      target.name,
      targetState.distanceBand,
      move?.name,
      targetState.isRangeValid,
      targetState.actualDistanceBand,
    );

    return [{
      key: `${sourceActorId}:${request.targetActorId}:${move?.id ?? "no-move"}:${index}`,
      source,
      target,
      move,
      targetState,
      tooltip,
    }];
  });

  // ---- Determine which actors are defeated / targetable ----
  const defeatedIds = new Set(
    state.actors
      .filter((a) => a.hp <= 0)
      .map((a) => a.id),
  );

  const targetableIds = new Set(
    targetableActorIds ?? state.actors
      .filter((a) => a.side !== "player" && a.hp > 0)
      .map((a) => a.id),
  );

  const targetedIds = new Set(
    targetLines === undefined
      ? (effectiveTargetId ? [effectiveTargetId] : [])
      : targetLines.map((line) => line.targetActorId),
  );

  // ---- Group combatants by side ----
  const playerCombatants = data.combatants.filter((c) => c.side === "player");
  const enemyCombatants = data.combatants.filter((c) => c.side === "enemy");
  const allyCombatants = data.combatants.filter((c) => c.side === "ally");
  const neutralCombatants = data.combatants.filter((c) => c.side === "neutral");

  // ---- Render a single combatant node with all state computed ----
  function renderCombatant(c: (typeof data.combatants)[number]) {
    const isCurrent = c.id === state.activeActorId;
    const isTarget = targetedIds.has(c.id);
    const isDefeated = defeatedIds.has(c.id);
    const canTarget = targetableIds.has(c.id) && !isDefeated;

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
          preserveAspectRatio="none"
        >
          {resolvedTargetLines.map((line) => (
            <TargetLine
              key={line.key}
              x1={line.source.x}
              y1={line.source.y}
              x2={line.target.x}
              y2={line.target.y}
              band={line.targetState.distanceBand}
              isValid={line.targetState.isRangeValid}
              invalidReason={line.targetState.invalidReason}
              tooltip={line.tooltip}
              fromName={line.source.name}
              toName={line.target.name}
            />
          ))}
        </svg>

        {/* HTML labels stay legible when the SVG geometry is stretched. */}
        <div
          className="target-line-label-layer"
          style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none" }}
        >
          {resolvedTargetLines.map((line) => (
            <TargetLineLabel
              key={line.key}
              x1={line.source.x}
              y1={line.source.y}
              x2={line.target.x}
              y2={line.target.y}
              band={line.targetState.distanceBand}
              distanceLabel={line.targetState.actualDistanceBand}
              isValid={line.targetState.isRangeValid}
              invalidReason={line.targetState.invalidReason}
              tooltip={line.tooltip}
              fromName={line.source.name}
              toName={line.target.name}
              moveName={line.move?.name}
            />
          ))}
        </div>

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
