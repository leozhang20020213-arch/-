import { useState, type FC } from "react";
import type { StageData } from "../../../types/combat";
import type { CombatState, Move } from "../../../combat/types";
import { deriveTargetState, targetLineTooltip } from "../../../lib/combat/targetValidation";
import { toDisplayPhase } from "../../../lib/combat/combatPhaseMachine";
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
        targetingActive={Boolean(selectedMove)}
        onSelect={handleSelect}
      />
    );
  }

  const playerCount = playerCombatants.length;
  const enemyCount = enemyCombatants.length;
  const allyCount = allyCombatants.length;
  const neutralCount = neutralCombatants.length;
  const alliedRoster = [...playerCombatants, ...allyCombatants];
  const opposingRoster = [...enemyCombatants, ...neutralCombatants];
  const activeActor = data.combatants.find((combatant) => combatant.id === state.activeActorId);
  const displayPhase = toDisplayPhase(state.phase);
  const focusLines = resolvedTargetLines.map((line, index) => ({
    ...line,
    displayY: ((index + 1) / (resolvedTargetLines.length + 1)) * 100,
  }));

  function renderRoster(
    roster: typeof data.combatants,
    label: string,
    detail: string,
    side: "allied" | "opposing",
  ) {
    return (
      <aside className={`battlefield-roster battlefield-roster--${side}`} aria-label={`${label}人物列`}>
        <header className="battlefield-roster__header">
          <strong>{label}</strong>
          <span>{detail}</span>
        </header>
        <div className="battlefield-roster__list">
          {roster.map(renderCombatant)}
          {roster.length === 0 && <span className="battlefield-roster__empty">无人入场</span>}
        </div>
      </aside>
    );
  }

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

      {/* Card-table battlefield: opponents above, current relation in the centre,
          the player's crew immediately above the hand below this stage. */}
      <div className="tactical-battlefield card-table-battlefield">
        {/* Atmospheric background */}
        <div className="battlefield-bg">
          <div className="rain-overlay" />
          <div className="ground-texture" />
        </div>

        {renderRoster(opposingRoster, "敌方", `${enemyCount}名敌人${neutralCount ? ` · ${neutralCount}名其他` : ""}`, "opposing")}

        <section className="engagement-focus" aria-label="当前目标线与交锋时点">
          <header className="engagement-focus__header">
            <span>{displayPhase}</span>
            <strong>{activeActor ? `${activeActor.name}行动` : "等待行动者"}</strong>
          </header>

          <div className="engagement-focus__canvas">
            {focusLines.length > 0 ? (
              <>
                <svg className="distance-svg-layer" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {focusLines.map((line) => (
                    <TargetLine
                      key={line.key}
                      x1={4}
                      y1={line.displayY}
                      x2={96}
                      y2={line.displayY}
                      band={line.targetState.distanceBand}
                      isValid={line.targetState.isRangeValid}
                      invalidReason={line.targetState.invalidReason}
                      tooltip={line.tooltip}
                      fromName={line.source.name}
                      toName={line.target.name}
                    />
                  ))}
                </svg>
                <div className="target-line-label-layer">
                  {focusLines.map((line) => (
                    <TargetLineLabel
                      key={line.key}
                      x1={4}
                      y1={line.displayY}
                      x2={96}
                      y2={line.displayY}
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
              </>
            ) : (
              <div className={`engagement-focus__empty${selectedMove ? " awaiting-target" : ""}`} aria-label={selectedMove ? `${selectedMove.name}等待目标` : "当前无目标线"}>
                {selectedMove ? <strong>{selectedMove.name}</strong> : <i aria-hidden="true" />}
              </div>
            )}
          </div>
        </section>

        {renderRoster(alliedRoster, "我方", `${playerCount}名玩家${allyCount ? ` · ${allyCount}名友方` : ""}`, "allied")}
      </div>

      {/* ---- Scene objectives ---- */}
      <SceneObjectiveMini objectives={data.objectives} />
    </div>
  );
};
