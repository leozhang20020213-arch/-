import type { FC } from "react";

export interface EnemyWeaknessListProps {
  weaknesses: string[];
}

/**
 * Compact weakness bullet list.
 * Each weakness is a single line with a red accent marker.
 * Empty state shows "无已知弱点".
 */
export const EnemyWeaknessList: FC<EnemyWeaknessListProps> = ({ weaknesses }) => {
  if (weaknesses.length === 0) {
    return <p className="empty-state">无已知弱点</p>;
  }

  return (
    <ul className="weakness-list">
      {weaknesses.map((w, i) => (
        <li key={i} className="weakness-item">
          <span className="weakness-marker">▸</span>
          <span>{w}</span>
        </li>
      ))}
    </ul>
  );
};
