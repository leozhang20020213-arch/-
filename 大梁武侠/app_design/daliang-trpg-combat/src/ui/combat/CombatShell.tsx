import { useState, type FC, type ReactNode } from "react";

export interface CombatShellProps {
  /** Top combat bar */
  top: ReactNode;
  /** Left panel (320px) */
  left: ReactNode;
  /** Allow the secondary combat ledger to fold into a narrow desk-edge tab. */
  leftCollapsible?: boolean;
  /** Start with the secondary ledger folded so the combat stage owns the desk. */
  leftInitiallyCollapsed?: boolean;
  /** Short text shown on the folded ledger tab. */
  leftCollapsedLabel?: string;
  /** Center panel (flex 1) */
  center: ReactNode;
  /** Right panel (380px) */
  right: ReactNode;
  /** Collapse an unused context panel to a narrow status rail. */
  rightCollapsed?: boolean;
  /** Short text shown in the collapsed context rail. */
  rightCollapsedLabel?: string;
  /** Bottom phase bar */
  bottom: ReactNode;
  /** Drawer overlay layer */
  drawer?: ReactNode;
  /** Modal overlay (prompt, dice roll) */
  modal?: ReactNode;
}

/**
 * CombatShell — Full-viewport desktop combat layout.
 *
 * Grid rows:  TopBar (56px) | Main 3-column (1fr) | PhaseBar (48px)
 *
 * Main 3-column:  Left (320px) | Center (flex 1) | Right (380px)
 *
 * Replaces the app-shell 5-row grid for all combat routes
 * (playerScene, playerCombat, dmScene, dmCombat).
 */
export const CombatShell: FC<CombatShellProps> = ({
  top,
  left,
  leftCollapsible = false,
  leftInitiallyCollapsed = false,
  leftCollapsedLabel = "战况卷宗",
  center,
  right,
  rightCollapsed = false,
  rightCollapsedLabel = "目标情报",
  bottom,
  drawer,
  modal,
}) => {
  const [leftExpanded, setLeftExpanded] = useState(!leftInitiallyCollapsed);
  const leftCollapsed = leftCollapsible && !leftExpanded;

  return (
    <div className="combat-shell">
      {top}

      <div className={`combat-main${leftCollapsed ? " left-collapsed" : ""}${rightCollapsed ? " right-collapsed" : ""}`}>
        <div className={`combat-left${leftCollapsed ? " is-collapsed" : ""}`}>
          {leftCollapsed ? (
            <button
              className="combat-ledger-rail"
              type="button"
              aria-label={`展开${leftCollapsedLabel}`}
              aria-expanded="false"
              onClick={() => setLeftExpanded(true)}
            >
              <span>{leftCollapsedLabel}</span>
              <small>队伍 · 进度 · 动态</small>
            </button>
          ) : (
            <>
              {leftCollapsible && (
                <div className="combat-ledger-heading">
                  <strong>{leftCollapsedLabel}</strong>
                  <button
                    type="button"
                    aria-label={`收起${leftCollapsedLabel}`}
                    aria-expanded="true"
                    onClick={() => setLeftExpanded(false)}
                  >
                    收起
                  </button>
                </div>
              )}
              {left}
            </>
          )}
        </div>
        <div className="combat-center">{center}</div>
        <div className={`combat-right${rightCollapsed ? " is-collapsed" : ""}`}>
          {rightCollapsed ? (
            <aside className="combat-context-rail" aria-label={`${rightCollapsedLabel}尚未展开`}>
              <span>{rightCollapsedLabel}</span>
              <small>点击人物查看</small>
            </aside>
          ) : right}
        </div>
      </div>

      <div className="combat-bottom">{bottom}</div>
      {drawer}
      {modal}
    </div>
  );
};
