import type { FC, ReactNode } from "react";

export interface GamePanelProps {
  title?: string;
  icon?: string;
  children: ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  actions?: ReactNode;
  variant?: "parchment" | "dark" | "subtle";
}

/**
 * Unified game panel container.
 * Variants:
 * - parchment: light paper background (default, for character cards, info panels)
 * - dark: dark wood background (for DM panels, dice zones)
 * - subtle: minimal border, transparent bg (for nested panels)
 */
export const GamePanel: FC<GamePanelProps> = ({
  title,
  icon,
  children,
  className = "",
  actions,
  variant = "parchment",
}) => {
  const cls = ["game-panel", `game-panel--${variant}`, className].filter(Boolean).join(" ");

  return (
    <div className={cls}>
      {(title || actions) && (
        <div className="game-panel__header">
          {title && (
            <h3>
              {icon && <img className="panel-icon" src={icon} alt="" aria-hidden="true" />}
              {title}
            </h3>
          )}
          {actions && <div className="game-panel__actions">{actions}</div>}
        </div>
      )}
      <div className="game-panel__body">{children}</div>
    </div>
  );
};
