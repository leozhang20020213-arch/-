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

export interface TargetLineLabelProps {
  /** Line positions in stage percentages, used to anchor the HTML label. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  band?: TargetDistanceKey;
  distanceLabel?: string;
  isValid: boolean;
  invalidReason?: string;
  tooltip: string;
  fromName: string;
  toName: string;
  moveName?: string;
}

const BAND_COLORS: Record<TargetDistanceKey, string> = {
  touch:   "rgba(220,80,60,0.9)",
  close:   "rgba(230,150,70,0.9)",
  mid:     "rgba(200,175,85,0.85)",
  far:     "rgba(80,120,160,0.75)",
  extreme: "rgba(130,130,130,0.6)",
};

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
 * SIZED FOR viewBox="0 0 100 100" — all values are in viewBox units.
 * Visual variants:
 *   - Valid distance: colored solid line with arrowhead
 *   - Invalid distance: red dashed line
 *   - Text/legality details are rendered by TargetLineLabel in HTML space
 *   - Hover: SVG `<title>` tooltip
 *   - `pointer-events: none` so it never blocks clicks on combatant nodes
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
  // Colors
  const strokeColor = isValid
    ? (band ? BAND_COLORS[band] : "rgba(212,180,100,0.9)")
    : "rgba(220,60,50,0.9)";

  const glowColor = isValid
    ? (band ? BAND_GLOW[band] : "rgba(212,180,100,0.25)")
    : "rgba(220,60,50,0.2)";

  const bandLabel = band ? keyToDisplay(band) : "";

  const hoverText = [
    tooltip,
    fromName && toName ? `${fromName} → ${toName}` : "",
    bandLabel ? `距离：${bandLabel}` : "",
    !isValid ? `⚠ ${invalidReason ?? "距离不合法"}` : "",
  ].filter(Boolean).join("｜");

  // Arrowhead size scaled for viewBox 0–100
  const arrowSize = isValid ? 1.6 : 1.3;

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
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
        vectorEffect="non-scaling-stroke"
      />

      {/* Mid glow */}
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={glowColor}
        strokeWidth="1"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* Main target line */}
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={strokeColor}
        strokeWidth={isValid ? "0.7" : "0.8"}
        strokeDasharray={isValid ? "none" : "3 1.5"}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* Arrowhead at target end */}
      <polygon
        points={computeArrowhead(x1, y1, x2, y2, arrowSize)}
        fill={strokeColor}
        opacity="0.95"
      />
    </g>
  );
};

/**
 * Non-SVG target label. Keeping text in an HTML overlay prevents
 * preserveAspectRatio="none" from stretching glyphs with the battlefield.
 */
export const TargetLineLabel: FC<TargetLineLabelProps> = ({
  x1,
  y1,
  x2,
  y2,
  band,
  distanceLabel,
  isValid,
  invalidReason,
  tooltip,
  fromName,
  toName,
  moveName,
}) => {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const bandLabel = distanceLabel ?? (band ? keyToDisplay(band) : "距离未知");
  const legalityLabel = isValid ? "合法" : "不合法";
  const strokeColor = isValid
    ? (band ? BAND_COLORS[band] : "rgba(212,180,100,0.9)")
    : "rgba(220,60,50,0.9)";
  const accessibleLabel = `${fromName} → ${toName}；招式：${moveName ?? "未选招式"}；距离：${bandLabel}；${legalityLabel}${invalidReason ? `：${invalidReason}` : ""}`;

  return (
    <div
      data-target-line-label="true"
      role="status"
      aria-label={accessibleLabel}
      title={tooltip}
      style={{
        position: "absolute",
        left: `${mx}%`,
        top: `${my}%`,
        transform: "translate(-50%, -50%)",
        maxWidth: "min(320px, 42%)",
        padding: "5px 8px",
        border: `1px solid ${strokeColor}`,
        borderRadius: "6px",
        background: isValid ? "rgba(18,14,8,0.94)" : "rgba(40,10,10,0.94)",
        boxShadow: `0 2px 12px ${isValid ? "rgba(0,0,0,0.45)" : "rgba(220,60,50,0.18)"}`,
        color: isValid ? "rgba(250,240,200,0.98)" : "rgba(255,174,166,0.98)",
        fontFamily: "'Noto Serif SC', 'Microsoft YaHei', serif",
        lineHeight: 1.3,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "11px", fontWeight: 800, whiteSpace: "nowrap" }}>
        {fromName} → {toName}
      </div>
      <div style={{ marginTop: "2px", fontSize: "10px", whiteSpace: "nowrap" }}>
        {moveName ?? "未选招式"} · {bandLabel} · <strong>{legalityLabel}</strong>
      </div>
      {!isValid && invalidReason && (
        <div style={{ marginTop: "2px", fontSize: "9px" }}>{invalidReason}</div>
      )}
    </div>
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

  const wing1X = baseX + px * 1.3;
  const wing1Y = baseY + py * 1.3;
  const wing2X = baseX - px * 1.3;
  const wing2Y = baseY - py * 1.3;

  return `${tipX},${tipY} ${wing1X},${wing1Y} ${wing2X},${wing2Y}`;
}
