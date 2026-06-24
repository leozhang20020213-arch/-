import type { FC, ReactNode } from "react";

export interface MainWorkspaceProps {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}

/**
 * Three-column main workspace grid.
 * Left 18% | Center 58% | Right 24%
 * No page-level scrolling — each column scrolls independently.
 */
export const MainWorkspace: FC<MainWorkspaceProps> = ({ left, center, right }) => {
  return (
    <div className="main-workspace">
      <aside className="left-panel">{left}</aside>
      <main className="center-panel">{center}</main>
      <aside className="right-panel">{right}</aside>
    </div>
  );
};
