import { useState, type FC } from "react";
import type { StageData } from "../../../types/combat";
import { CombatantNode } from "./CombatantNode";
import { DistanceLine } from "./DistanceLine";
import { SceneObjectiveMini } from "./SceneObjectiveMini";

export interface CombatStageProps {
  data: StageData;
  /** External selected ID (optional — component also tracks internally) */
  selectedId?: string;
  /** Called when a combatant node is clicked */
  onSelectCombatant?: (id: string) => void;
}

/**
 * Tactical Combat Stage — replaces the old "cropped image" stage
 * with HTML-positioned combatant nodes and SVG distance lines.
 *
 * Layout:
 *   ┌─ Scene header (name + tags) ─┐
 *   │   SVG overlay (distance lines)│
 *   │   Combatant nodes (absolute)  │
 *   └─ Scene objectives (progress) ─┘
 */
export const CombatStage: FC<CombatStageProps> = ({
  data,
  selectedId,
  onSelectCombatant,
}) => {
  const [internalSelected, setInternalSelected] = useState<string | undefined>(
    selectedId ?? data.selectedCombatantId,
  );

  const activeSelected = selectedId ?? internalSelected;

  function handleSelect(id: string) {
    if (onSelectCombatant) {
      onSelectCombatant(id);
    } else {
      setInternalSelected(id === activeSelected ? undefined : id);
    }
  }

  return (
    <div className="tactical-stage">
      {/* ---- Scene header ---- */}
      <div className="tactical-stage-header">
        <span className="stage-scene-name">{data.sceneName}</span>
        <div className="stage-scene-tags">
          {data.sceneTags.map((tag) => (
            <span key={tag} className="stage-tag">{tag}</span>
          ))}
        </div>
      </div>

      {/* ---- Battlefield area (nodes + SVG lines) ---- */}
      <div className="tactical-battlefield">
        {/* Atmospheric background */}
        <div className="battlefield-bg">
          {/* Rain effect overlay */}
          <div className="rain-overlay" />
          {/* Ground texture */}
          <div className="ground-texture" />
        </div>

        {/* SVG distance lines layer */}
        <svg
          className="distance-svg-layer"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
        >
          {data.distances.map((edge) => (
            <DistanceLine
              key={`${edge.from}-${edge.to}`}
              edge={edge}
              combatants={data.combatants}
            />
          ))}
        </svg>

        {/* Combatant nodes layer */}
        <div className="combatant-layer">
          {data.combatants.map((c) => (
            <CombatantNode
              key={c.id}
              combatant={c}
              isSelected={activeSelected === c.id}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </div>

      {/* ---- Scene objectives ---- */}
      <SceneObjectiveMini objectives={data.objectives} />
    </div>
  );
};
