import type { FC } from "react";
import type { Actor } from "../../combat/types";

export interface SixRootsSummaryProps {
  actor: Actor;
}

/**
 * Compact Six Roots display with current inner art info.
 * Shows: 顶门 目窍 心口 丹田 命门 步根 values.
 */
export const SixRootsSummary: FC<SixRootsSummaryProps> = ({ actor }) => {
  const neigong = actor.innerArts[0];
  return (
    <div className="six-roots-summary">
      <div className="six-roots-grid">
        <span>顶门 {actor.sixRoots.顶门}</span>
        <span>目窍 {actor.sixRoots.目窍}</span>
        <span>心口 {actor.sixRoots.心口}</span>
        <span>丹田 {actor.sixRoots.丹田}</span>
        <span>命门 {actor.sixRoots.命门}</span>
        <span>步根 {actor.sixRoots.步根}</span>
      </div>
      <p className="hint">
        当前内功：{neigong?.name ?? "未运转内功"}；运行窍位：
        {neigong?.occupiedAcupoints?.join("、") || "无"}；被动：
        {neigong?.passive ?? "无"}
      </p>
    </div>
  );
};
