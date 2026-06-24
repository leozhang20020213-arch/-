import type { FC, ReactNode } from "react";

export interface RightActionPanelProps {
  /** Move/action cards section */
  actions: ReactNode;
  /** Enemy public cards section */
  enemies: ReactNode;
  /** Flow / operation buttons */
  flowButtons: ReactNode;
  /** Bottom hint / tips */
  hint?: ReactNode;
}

/**
 * Right action panel (24% of workspace width).
 * Player view: 行动卡 (45%) | 敌方公开卡 (30%) | 操作按钮 (15%) | 提示 (10%)
 * DM view: 裁定面板 (35%) | 敌人当前操作 (25%) | 广播/控制 (20%) | 结算广播 (20%)
 */
export const RightActionPanel: FC<RightActionPanelProps> = ({
  actions,
  enemies,
  flowButtons,
  hint,
}) => {
  return (
    <>
      {actions}
      {enemies}
      {flowButtons}
      {hint && (
        <div style={{ fontSize: "var(--fs-helper)", color: "var(--ink-subtle)", padding: "8px 0" }}>
          {hint}
        </div>
      )}
    </>
  );
};
