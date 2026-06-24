import type { FC, ReactNode } from "react";

export interface RightCombatPanelProps {
  /** Moves & declaration content */
  actions: ReactNode;
  /** Enemy public cards (optional, shown below actions) */
  enemies?: ReactNode;
  /** Phase flow buttons (optional) */
  flowButtons?: ReactNode;
  /** Bottom hint text */
  hint?: string;
}

/**
 * Right combat panel (380px fixed width).
 * Focused on moves & declaration — the primary player action area.
 * Layout: Actions (moves/declaration) → Enemies (optional) → Flow buttons → Hint.
 */
export const RightCombatPanel: FC<RightCombatPanelProps> = ({
  actions,
  enemies,
  flowButtons,
  hint,
}) => {
  return (
    <div className="combat-right-panel">
      {actions}
      {enemies}
      {flowButtons}
      {hint && (
        <div
          style={{
            fontSize: "var(--fs-helper)",
            color: "var(--ink-subtle)",
            fontStyle: "italic",
            padding: "6px 0",
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
};
