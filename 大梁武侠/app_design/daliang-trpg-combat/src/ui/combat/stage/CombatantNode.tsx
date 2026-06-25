import type { FC } from "react";
import type { Combatant } from "../../../types/combat";

export interface CombatantNodeProps {
  combatant: Combatant;
  isSelected: boolean;
  isCurrentActor: boolean;
  isTargeted: boolean;
  isDefeated: boolean;
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
 * Compact combatant card — two rows, all gameplay info inline.
 *
 * Row 1: [avatar 22px] name | 行动中/目标 tag | 阴盛 pill | 32/40 HP
 * Row 2: HP bar (full width)
 * Status badges: inline after momentum if present
 *
 * Total card height ~40px (vs ~64px previously).
 * Width ~148px (vs 170px).
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
      onClick={() => { if (isClickable) onSelect(combatant.id); }}
      style={{ left: `${combatant.x}%`, top: `${combatant.y}%` }}
      disabled={!isClickable}
      aria-label={`${combatant.name}，气血${combatant.hp}/${combatant.maxHp}，势${combatant.momentum}${isCurrentActor ? "，当前行动" : ""}${isTargeted ? "，当前目标" : ""}${isDying ? "，濒死" : ""}`}
      title={
        isCurrentActor && isTargeted ? `${combatant.name} — 当前行动者 & 目标`
        : isCurrentActor ? `${combatant.name} — 当前行动者`
        : isTargeted ? `${combatant.name} — 当前目标`
        : combatant.name
      }
    >
      {/* Current actor indicator dot */}
      {isCurrentActor && <span className="current-actor-dot" />}

      {/* Row 1: avatar + name + tags + momentum + HP */}
      <div className="combatant-row1">
        <div className="combatant-avatar">
          {combatant.avatar
            ? <img src={combatant.avatar} alt="" />
            : <span className="combatant-avatar-placeholder">{combatant.name.charAt(0)}</span>
          }
        </div>

        <span className="combatant-name">
          {combatant.name}
          {isCurrentActor && <span className="current-tag">行</span>}
          {isTargeted && !isCurrentActor && <span className="target-tag">目标</span>}
        </span>

        <span className={`combatant-momentum ${MOMENTUM_CLASS[combatant.momentum] ?? ""}`}>
          {combatant.momentum}
        </span>

        {combatant.statuses.length > 0 && (
          <span className="combatant-status-inline">
            {combatant.statuses.map((s) => (
              <span key={s} className="combatant-status-badge">{s}</span>
            ))}
          </span>
        )}

        <span className="combatant-hp-text" style={{ color: hpColor }}>
          {combatant.hp}/{combatant.maxHp}
        </span>
      </div>

      {/* Row 2: HP bar */}
      <div className="combatant-hp-bar">
        <div
          className="combatant-hp-fill"
          style={{ width: `${hpPct}%`, background: hpColor }}
        />
      </div>

      {/* Defeated overlay */}
      {isDefeated && <div className="combatant-defeated-overlay">退场</div>}

      {/* Target ring corners */}
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
