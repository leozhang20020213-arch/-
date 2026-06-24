import type { FC } from "react";
import type { Combatant } from "../../../types/combat";

export interface CombatantNodeProps {
  combatant: Combatant;
  /** Whether this combatant node is currently selected (clicked / hover-highlighted) */
  isSelected: boolean;
  /** Whether this combatant is the CURRENT ACTOR (taking their turn) */
  isCurrentActor: boolean;
  /** Whether this combatant is the selected TARGET of the current action */
  isTargeted: boolean;
  /** Whether this combatant has been defeated (HP <= 0) */
  isDefeated: boolean;
  /** Whether this combatant can be targeted (false = greyed out, not clickable) */
  canBeTargeted: boolean;
  onSelect: (id: string) => void;
}

const MOMENTUM_CLASS: Record<string, string> = {
  "阴盛": "shi-yin",
  "阳盛": "shi-yang",
  "合势": "shi-he",
  "圆融": "shi-harmony",
  "崩势": "shi-collapse",
  "失势": "shi-lost",
};

/**
 * A single combatant node on the tactical stage.
 *
 * Visual states (in priority order — first matching wins for the border):
 *   current-actor + targeted  → dual ring (inner gold glow + outer target ring)
 *   current-actor             → strong gold glow + pulsing border
 *   targeted                  → red target ring + crosshair corners
 *   defeated                  → dimmed, red overlay, "濒死" label
 *   untargetable              → greyed out, not clickable
 *   normal                    → default dark card
 *
 * Side-based positioning hint:
 *   player side → slight warm tint
 *   enemy side  → slight cool tint
 */
export const CombatantNode: FC<CombatantNodeProps> = ({
  combatant,
  isSelected,
  isCurrentActor,
  isTargeted,
  isDefeated,
  canBeTargeted,
  onSelect,
}) => {
  const hpPct = combatant.maxHp > 0
    ? Math.round((combatant.hp / combatant.maxHp) * 100)
    : 0;
  const hpColor =
    hpPct <= 25 ? "var(--hp-red)" :
    hpPct <= 50 ? "var(--yang-die)" :
    "var(--shield-green)";
  const isDying = combatant.hp <= 0;

  // Build class list
  const classes = ["combatant-node"];
  if (isCurrentActor) classes.push("current-actor");
  if (isTargeted) classes.push("targeted");
  if (isSelected && !isCurrentActor && !isTargeted) classes.push("selected");
  if (isDefeated || isDying) classes.push("defeated");
  if (!canBeTargeted && !isCurrentActor) classes.push("untargetable");
  if (combatant.side === "player") classes.push("side-player");
  if (combatant.side === "enemy") classes.push("side-enemy");
  if (combatant.side === "ally") classes.push("side-ally");
  if (combatant.side === "neutral") classes.push("side-neutral");

  const isClickable = canBeTargeted || isCurrentActor;

  return (
    <button
      className={classes.join(" ")}
      type="button"
      onClick={() => {
        if (isClickable) {
          onSelect(combatant.id);
        }
      }}
      style={{
        left: `${combatant.x}%`,
        top: `${combatant.y}%`,
      }}
      disabled={!isClickable}
      aria-label={`${combatant.name}，气血${combatant.hp}/${combatant.maxHp}，势${combatant.momentum}${isCurrentActor ? "，当前行动" : ""}${isTargeted ? "，当前目标" : ""}${isDying ? "，濒死" : ""}`}
      title={
        isCurrentActor && isTargeted
          ? `${combatant.name} — 当前行动者 & 目标`
          : isCurrentActor
            ? `${combatant.name} — 当前行动者`
            : isTargeted
              ? `${combatant.name} — 当前目标`
              : combatant.name
      }
    >
      {/* Avatar */}
      <div className="combatant-avatar">
        {combatant.avatar ? (
          <img src={combatant.avatar} alt="" />
        ) : (
          <span className="combatant-avatar-placeholder">
            {combatant.name.charAt(0)}
          </span>
        )}
        {/* Current actor indicator dot */}
        {isCurrentActor && <span className="current-actor-dot" />}
      </div>

      {/* Info column */}
      <div className="combatant-info">
        <span className="combatant-name">
          {combatant.name}
          {isCurrentActor && <span className="current-tag">行动中</span>}
          {isTargeted && !isCurrentActor && <span className="target-tag">目标</span>}
        </span>

        {/* HP bar */}
        <div className="combatant-hp-row">
          <div className="combatant-hp-bar">
            <div
              className="combatant-hp-fill"
              style={{ width: `${hpPct}%`, background: hpColor }}
            />
          </div>
          <span className="combatant-hp-text" style={{ color: hpColor }}>
            {combatant.hp}/{combatant.maxHp}
          </span>
        </div>

        {/* Momentum pill */}
        <span className={`combatant-momentum ${MOMENTUM_CLASS[combatant.momentum] ?? ""}`}>
          {combatant.momentum}
        </span>
      </div>

      {/* Status badges */}
      {combatant.statuses.length > 0 && (
        <div className="combatant-statuses">
          {combatant.statuses.map((s) => (
            <span key={s} className="combatant-status-badge">{s}</span>
          ))}
        </div>
      )}

      {/* Defeated overlay */}
      {isDefeated && <div className="combatant-defeated-overlay">退场</div>}

      {/* Target ring corners (visible only when targeted) */}
      {isTargeted && (
        <div className="target-corners" aria-hidden="true">
          <span className="target-corner tl" />
          <span className="target-corner tr" />
          <span className="target-corner bl" />
          <span className="target-corner br" />
        </div>
      )}
    </button>
  );
};
