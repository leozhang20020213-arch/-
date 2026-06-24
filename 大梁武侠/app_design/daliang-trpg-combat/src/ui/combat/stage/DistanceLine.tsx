import type { FC } from "react";
import type { Combatant, DistanceEdge } from "../../../types/combat";

export interface DistanceLineProps {
  edge: DistanceEdge;
  combatants: Combatant[];
}

/**
 * SVG distance line between two combatant nodes.
 * Draws a colored line with the distance-band label in the middle.
 */
export const DistanceLine: FC<DistanceLineProps> = ({ edge, combatants }) => {
  const fromNode = combatants.find((c) => c.id === edge.from);
  const toNode = combatants.find((c) => c.id === edge.to);
  if (!fromNode || !toNode) return null;

  // Coordinates are in percentage — we use SVG viewBox 0 0 100 100
  const x1 = fromNode.x;
  const y1 = fromNode.y;
  const x2 = toNode.x;
  const y2 = toNode.y;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;

  const bandColors: Record<string, string> = {
    "贴身": "rgba(194,58,46,0.7)",
    "近身": "rgba(212,132,58,0.7)",
    "短距": "rgba(194,168,78,0.6)",
    "中距": "rgba(107,138,92,0.6)",
    "远距": "rgba(58,92,122,0.5)",
    "离场": "rgba(107,107,107,0.4)",
  };
  const stroke = bandColors[edge.band] ?? "rgba(212,200,184,0.4)";

  return (
    <g className="distance-line-group">
      {/* Glow under-line */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={stroke}
        strokeWidth="0.6"
        strokeDasharray={edge.band === "远距" || edge.band === "离场" ? "3 3" : "none"}
        opacity="0.5"
      />
      {/* Main line */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={stroke}
        strokeWidth="1.2"
        strokeDasharray={edge.band === "远距" || edge.band === "离场" ? "3 3" : "none"}
      />
      {/* Midpoint label */}
      <rect
        x={mx - 14}
        y={my - 8}
        width="28"
        height="16"
        rx="4"
        fill="rgba(20,16,10,0.85)"
        stroke={stroke}
        strokeWidth="0.8"
      />
      <text
        x={mx}
        y={my + 4}
        textAnchor="middle"
        fill="rgba(247,231,187,0.9)"
        fontSize="6"
        fontWeight="700"
      >
        {edge.band}
      </text>
    </g>
  );
};
