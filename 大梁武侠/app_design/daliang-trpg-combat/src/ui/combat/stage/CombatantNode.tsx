import type { FC } from "react";
import type { Combatant } from "../../../types/combat";

export interface CombatantNodeProps {
  combatant: Combatant;
  isSelected: boolean;
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
 * Shows: avatar | name | HP bar | momentum pill | status badges.
 * Selected state adds a gold glow border.
 */
export const CombatantNode: FC<CombatantNodeProps> = ({
  combatant,
  isSelected,
  onSelect,
}) => {
  const hpPct = combatant.maxHp > 0
    ? Math.round((combatant.hp / combatant.maxHp) * 100)
    : 0;
  const hpColor = hpPct <= 25 ? "var(--hp-red)" : hpPct <= 50 ? "var(--yang-die)" : "var(--shield-green)";
  const isDying = combatant.hp <= 0;

  return (
    <button
      className={`combatant-node${isSelected ? " selected" : ""}${isDying ? " dying" : ""}`}
      type="button"
      onClick={() => onSelect(combatant.id)}
      style={{
        left: `${combatant.x}%`,
        top: `${combatant.y}%`,
      }}
      aria-label={`${combatant.name}，气血${combatant.hp}/${combatant.maxHp}，势${combatant.momentum}`}
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
      </div>

      {/* Info column */}
      <div className="combatant-info">
        <span className="combatant-name">{combatant.name}</span>

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

      {/* Dying overlay */}
      {isDying && <div className="combatant-dying-overlay">濒死</div>}
    </button>
  );
};
