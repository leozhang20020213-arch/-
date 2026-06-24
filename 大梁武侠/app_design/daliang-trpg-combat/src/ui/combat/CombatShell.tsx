import type { FC, ReactNode } from "react";

export interface CombatShellProps {
  /** Top combat bar */
  top: ReactNode;
  /** Left panel (320px) */
  left: ReactNode;
  /** Center panel (flex 1) */
  center: ReactNode;
  /** Right panel (380px) */
  right: ReactNode;
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
  center,
  right,
  bottom,
  drawer,
  modal,
}) => {
  return (
    <div className="combat-shell">
      {top}

      <div className="combat-main">
        <div className="combat-left">{left}</div>
        <div className="combat-center">{center}</div>
        <div className="combat-right">{right}</div>
      </div>

      {bottom}
      {drawer}
      {modal}
    </div>
  );
};
