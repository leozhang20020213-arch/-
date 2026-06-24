import { type FC } from "react";
import type { TargetDistanceKey } from "../../../lib/combat/targetValidation";
import { keyToDisplay } from "../../../lib/combat/targetValidation";

export interface TargetLineProps {
  /** Start position (acting actor) — percentage 0–100 */
  x1: number;
  y1: number;
  /** End position (target actor) — percentage 0–100 */
  x2: number;
  y2: number;
  /** Distance key between them */
  band?: TargetDistanceKey;
  /** Whether the distance is valid for the selected move */
  isValid: boolean;
  /** Invalid reason for tooltip */
  invalidReason?: string;
  /** Tooltip text (from targetLineTooltip) */
  tooltip: string;
  /** Name of the acting actor (for display) */
  fromName?: string;
  /** Name of the target actor (for display) */
  toName?: string;
}

const BAND_COLORS: Record<TargetDistanceKey, string> = {
  touch:   "rgba(220,80,60,0.9)",
  close:   "rgba(230,150,70,0.9)",
  mid:     "rgba(200,175,85,0.85)",
  far:     "rgba(80,120,160,0.75)",
  extreme: "rgba(130,130,130,0.6)",
};

/** Band → CSS-friendly gradient colors for the line */
const BAND_GLOW: Record<TargetDistanceKey, string> = {
  touch:   "rgba(220,80,60,0.35)",
  close:   "rgba(230,150,70,0.3)",
  mid:     "rgba(200,175,85,0.25)",
  far:     "rgba(80,120,160,0.2)",
  extreme: "rgba(130,130,130,0.15)",
};

/**
 * SVG target line — draws from the acting actor to the selected target.
 *
 * Visual variants:
 *   - Valid distance: colored solid line with arrowhead, band-colored label pill
 *   - Invalid distance: red dashed line with ⚠ warning pill and reason
 *   - Hover: SVG `<title>` tooltip
 *   - `pointer-events: none` so it never blocks clicks on combatant nodes
 *
 * The line has clear directionality:
 *   - Glow under-line for depth
 *   - Solid main line
 *   - Arrowhead at the target end
 *   - Large distance label pill at midpoint
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
  fromName,
  toName,
}) => {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;

  // Colors
  const strokeColor = isValid
    ? (band ? BAND_COLORS[band] : "rgba(212,180,100,0.9)")
    : "rgba(220,60,50,0.9)";

  const glowColor = isValid
    ? (band ? BAND_GLOW[band] : "rgba(212,180,100,0.25)")
    : "rgba(220,60,50,0.2)";

  const bandLabel = band ? keyToDisplay(band) : "";
  const labelBg = isValid
    ? "rgba(18,14,8,0.92)"
    : "rgba(40,10,10,0.92)";
  const labelBorder = isValid
    ? strokeColor
    : "rgba(220,60,50,0.8)";
  const labelTextColor = isValid
    ? "rgba(250,240,200,0.95)"
    : "rgba(255,160,160,0.95)";

  // Build hover tooltip text
  const hoverText = [
    tooltip,
    fromName && toName ? `${fromName} → ${toName}` : "",
    bandLabel ? `距离：${bandLabel}` : "",
    !isValid ? `⚠ ${invalidReason ?? "距离不合法"}` : "",
  ].filter(Boolean).join("｜");

  // Arrowhead size scales with validity
  const arrowSize = isValid ? 3.5 : 3;

  return (
    <g
      className={`target-line-group${isValid ? "" : " invalid"}`}
      role="img"
      aria-label={hoverText}
      style={{ pointerEvents: "none" }}
    >
      <title>{hoverText}</title>

      {/* Outer glow (wider, translucent) */}
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={glowColor}
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.6"
      />

      {/* Mid glow */}
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={glowColor}
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Main target line */}
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={strokeColor}
        strokeWidth={isValid ? "2" : "2.2"}
        strokeDasharray={isValid ? "none" : "8 4"}
        strokeLinecap="round"
      />

      {/* Directional dots along the line (every ~20% of length) */}
      {isValid && (
        <>
          {[0.25, 0.5, 0.75].map((t) => {
            const dx = x1 + (x2 - x1) * t;
            const dy = y1 + (y2 - y1) * t;
            return (
              <circle
                key={t}
                cx={dx}
                cy={dy}
                r="0.8"
                fill={strokeColor}
                opacity="0.5"
              />
            );
          })}
        </>
      )}

      {/* Arrowhead at target end */}
      <polygon
        points={computeArrowhead(x1, y1, x2, y2, arrowSize)}
        fill={strokeColor}
        opacity="0.95"
      />

      {/* Distance label pill at midpoint */}
      {bandLabel && (
        <>
          {/* Pill background */}
          <rect
            x={mx - 26}
            y={my - 12}
            width="52"
            height="24"
            rx="7"
            fill={labelBg}
            stroke={labelBorder}
            strokeWidth="1.2"
          />
          {/* Pill glow */}
          <rect
            x={mx - 26}
            y={my - 12}
            width="52"
            height="24"
            rx="7"
            fill="none"
            stroke={glowColor}
            strokeWidth="3"
            opacity="0.5"
          />
          {/* Label text */}
          <text
            x={mx}
            y={my + 6}
            textAnchor="middle"
            fill={labelTextColor}
            fontSize="10"
            fontWeight="900"
            fontFamily="'Cinzel', 'EB Garamond', 'Noto Serif SC', 'Microsoft YaHei', serif"
          >
            {bandLabel}
          </text>
        </>
      )}

      {/* Warning indicator for invalid distance */}
      {!isValid && (
        <>
          {/* Warning pill above the line */}
          <rect
            x={mx - 32}
            y={my - 30}
            width="64"
            height="18"
            rx="5"
            fill="rgba(40,10,10,0.92)"
            stroke="rgba(220,60,50,0.7)"
            strokeWidth="1"
          />
          <text
            x={mx}
            y={my - 17}
            textAnchor="middle"
            fill="rgba(255,140,140,0.95)"
            fontSize="9"
            fontWeight="800"
          >
            ⚠ 距离不符
          </text>
        </>
      )}
    </g>
  );
};

/** Compute arrowhead polygon points pointing toward the target */
function computeArrowhead(
  x1: number, y1: number,
  x2: number, y2: number,
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

  const tipX = x2;
  const tipY = y2;
  const baseX = x2 - ux * size * 2;
  const baseY = y2 - uy * size * 2;

  // Wider arrowhead for more visibility
  const wing1X = baseX + px * 1.3;
  const wing1Y = baseY + py * 1.3;
  const wing2X = baseX - px * 1.3;
  const wing2Y = baseY - py * 1.3;

  return `${tipX},${tipY} ${wing1X},${wing1Y} ${wing2X},${wing2Y}`;
}
