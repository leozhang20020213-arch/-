import { type FC } from "react";
import type { DistanceBand } from "../../../combat/types";

export interface TargetLineProps {
  /** Start position (acting actor) */
  x1: number;
  y1: number;
  /** End position (target actor) */
  x2: number;
  y2: number;
  /** Distance band between them */
  band?: DistanceBand;
  /** Whether the distance is valid for the selected move */
  isValid: boolean;
  /** Invalid reason for tooltip */
  invalidReason?: string;
  /** Tooltip text */
  tooltip: string;
}

const BAND_COLORS: Record<string, string> = {
  "贴身": "rgba(194,58,46,0.8)",
  "近身": "rgba(212,132,58,0.8)",
  "短距": "rgba(194,168,78,0.7)",
  "中距": "rgba(107,138,92,0.7)",
  "远距": "rgba(58,92,122,0.6)",
  "离场": "rgba(107,107,107,0.5)",
};

/**
 * SVG target line — draws from the acting actor to the selected target.
 *
 * - Valid distance: gold/amber glow with band label
 * - Invalid distance: red dashed line with warning
 * - Hover: tooltip with actor names, distance, move availability
 */
export const TargetLine: FC<TargetLineProps> = ({
  x1,
  y1,
  x2,
  y2,
  band,
  isValid,
  invalidReason,
  tooltip,
}) => {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;

  const strokeColor = isValid
    ? "rgba(212,180,100,0.9)"
    : "rgba(194,58,46,0.85)";

  const bandColor = band ? BAND_COLORS[band] ?? "rgba(212,180,100,0.9)" : strokeColor;

  return (
    <g className="target-line-group" role="img" aria-label={tooltip}>
      <title>{tooltip}{invalidReason ? ` — ${invalidReason}` : ""}</title>

      {/* Outer glow */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={isValid ? "rgba(212,180,100,0.25)" : "rgba(194,58,46,0.2)"}
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Main target line */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={strokeColor}
        strokeWidth={isValid ? "1.8" : "2"}
        strokeDasharray={isValid ? "none" : "6 3"}
        strokeLinecap="round"
      />

      {/* Arrowhead at target end */}
      <polygon
        points={computeArrowhead(x1, y1, x2, y2, 3)}
        fill={strokeColor}
        opacity="0.9"
      />

      {/* Distance label at midpoint */}
      {band && (
        <>
          <rect
            x={mx - 18}
            y={my - 9}
            width="36"
            height="18"
            rx="5"
            fill={isValid ? "rgba(20,16,10,0.9)" : "rgba(40,10,10,0.9)"}
            stroke={isValid ? bandColor : "rgba(194,58,46,0.7)"}
            strokeWidth="1"
          />
          <text
            x={mx}
            y={my + 5}
            textAnchor="middle"
            fill={isValid ? "rgba(247,231,187,0.95)" : "rgba(255,150,150,0.95)"}
            fontSize="7"
            fontWeight="800"
          >
            {band}
          </text>
        </>
      )}

      {/* Warning icon for invalid */}
      {!isValid && (
        <text
          x={mx}
          y={my - 12}
          textAnchor="middle"
          fill="rgba(255,100,100,0.9)"
          fontSize="8"
          fontWeight="900"
        >
          ⚠
        </text>
      )}
    </g>
  );
};

/** Compute arrowhead polygon points pointing toward the target */
function computeArrowhead(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  size: number,
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return "";

  const ux = dx / len;
  const uy = dy / len;
  const px = -uy * size;
  const py = ux * size;

  // Arrowhead tip at (x2, y2), base points offset back
  const tipX = x2;
  const tipY = y2;
  const baseX = x2 - ux * size * 1.8;
  const baseY = y2 - uy * size * 1.8;

  return `${tipX},${tipY} ${baseX + px},${baseY + py} ${baseX - px},${baseY - py}`;
}
