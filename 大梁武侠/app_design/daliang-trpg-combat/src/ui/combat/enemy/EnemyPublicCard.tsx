import type { FC } from "react";
import type { AppMode, EnemyPublicInfo } from "../../../types/combat";
import { EnemyWeaknessList } from "./EnemyWeaknessList";

export interface EnemyPublicCardProps {
  info: EnemyPublicInfo;
  mode: AppMode;
  /** Called when the card close/minimize button is clicked */
  onClose: () => void;
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
 * Enemy public info card — shown in the right panel when an enemy is selected on stage.
 *
 * Content order (player mode):
 *   1. Name + HP
 *   2. Momentum pill
 *   3. Status badges
 *   4. Description
 *   5. Public weaknesses (collapsible)
 *   6. Behavior hint
 *   7. Known moves
 *
 * DM mode additionally shows:
 *   - Hidden goal
 *   - Hidden statuses
 *   - Loot / clue
 *   - DM private note
 */
export const EnemyPublicCard: FC<EnemyPublicCardProps> = ({ info, mode, onClose }) => {
  const hpPct = info.maxHp > 0 ? Math.round((info.hp / info.maxHp) * 100) : 0;
  const hpColor =
    info.hp <= 0 ? "var(--hp-red)"
    : hpPct <= 25 ? "var(--hp-red)"
    : hpPct <= 50 ? "var(--yang-die)"
    : "var(--shield-green)";
  const isDying = info.hp <= 0;

  return (
    <article className="enemy-public-card">
      {/* Header row */}
      <div className="enemy-public-header">
        <h3 className="enemy-public-name">
          {info.name}
          {isDying && <span className="dying-tag">濒死</span>}
        </h3>
        <button className="enemy-public-close" type="button" onClick={onClose} aria-label="关闭">
          ×
        </button>
      </div>

      {/* HP bar */}
      <div className="enemy-public-hp-row">
        <div className="enemy-public-hp-bar">
          <div
            className="enemy-public-hp-fill"
            style={{ width: `${hpPct}%`, background: hpColor }}
          />
        </div>
        <span className="enemy-public-hp-text" style={{ color: hpColor }}>
          {info.hp}/{info.maxHp}
        </span>
      </div>

      {/* Momentum pill */}
      <span className={`enemy-public-momentum ${MOMENTUM_CLASS[info.momentum] ?? ""}`}>
        {info.momentum}
      </span>

      {/* Status badges */}
      {info.statuses.length > 0 && (
        <div className="enemy-public-statuses">
          {info.statuses.map((s) => (
            <span key={s} className="status-badge-sm">{s}</span>
          ))}
        </div>
      )}

      {/* Description */}
      <p className="enemy-public-desc">{info.description}</p>

      {/* Public weaknesses */}
      <section className="enemy-public-section">
        <h4>已知弱点</h4>
        <EnemyWeaknessList weaknesses={info.publicWeaknesses} />
      </section>

      {/* Behavior hint */}
      {info.behaviorHint && (
        <section className="enemy-public-section">
          <h4>行为倾向</h4>
          <p className="enemy-public-hint">{info.behaviorHint}</p>
        </section>
      )}

      {/* Known moves */}
      {info.knownMoves.length > 0 && (
        <section className="enemy-public-section">
          <h4>已知招式</h4>
          <div className="enemy-public-moves">
            {info.knownMoves.map((m) => (
              <span key={m} className="move-chip">{m}</span>
            ))}
          </div>
        </section>
      )}

      {/* ---- DM-only sections ---- */}
      {mode === "dm" && (
        <div className="enemy-dm-section">
          <div className="enemy-dm-divider">DM 专属信息</div>

          {info.hiddenGoal && (
            <section className="enemy-public-section">
              <h4>隐藏目标</h4>
              <p className="enemy-public-hint dm-only">{info.hiddenGoal}</p>
            </section>
          )}

          {info.hiddenStatuses && info.hiddenStatuses.length > 0 && (
            <section className="enemy-public-section">
              <h4>隐藏状态</h4>
              <div className="enemy-public-statuses">
                {info.hiddenStatuses.map((s) => (
                  <span key={s} className="status-badge-sm hidden-status">{s}</span>
                ))}
              </div>
            </section>
          )}

          {info.lootOrClue && (
            <section className="enemy-public-section">
              <h4>掉落 / 线索</h4>
              <p className="enemy-public-hint dm-only">{info.lootOrClue}</p>
            </section>
          )}

          {info.dmNote && (
            <section className="enemy-public-section">
              <h4>DM 备注</h4>
              <p className="enemy-public-hint dm-only">{info.dmNote}</p>
            </section>
          )}
        </div>
      )}
    </article>
  );
};
