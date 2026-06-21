# Codex Prompt — Daliang TRPG UI Overhaul

You are modifying a React + TypeScript + Three.js TRPG combat app at `daliang-trpg-combat/`. Read `src/ui/App.tsx`, `src/styles.css`, and `src/dice3d/QiDiceTray.tsx` fully before starting.

---

## 1. TARGET LINES REPLACE DISTANCE ON CARDS

**Remove** distance band text (贴身/近身/短距 etc.) from both player and enemy character cards in the left/right columns.

**Add** a HEIGHT dimension to the distance system. Each actor-actor relation now has: `distance` (horizontal band) AND `height` (vertical offset: 同层/高处/低处). 

**Target lines**: After a declaration is made (pendingAction exists), draw a visible target line (colored line/arrow) from the declarer to the target(s) in the center stage area. The opponent can see who is being targeted. When the opponent declares, the player sees the opponent's target lines appear.

**Multi-target support**: A single move declaration can target multiple enemies. The target line system must support 1-to-many connections. Reserve this capability in the data model even if current moves only target one enemy.

**Response window triggers on target line appearance**: When opponent's target lines appear, the intercept/react window opens automatically.

---

## 2. LOCK LAYOUT + EXTEND QI ZONES + SIDE STRIPS

**Lock current positions**: The main layout (left column 200px, center flex, right column 200px, qi zone 170px, action hand 96px) is now FROZEN. Do not rearrange major sections.

**Extend 临气区 (TEMP_QI)**: The temporary qi zone should stretch horizontally until it nearly reaches the 息库 (QI_REST) zone. Maximize the use of space in the dice zone row.

**Side strips**: On the far-left edge (left of character cards) and far-right edge (right of enemy cards), reserve two vertical strips — each ~48px wide — for future drawer trigger buttons. These strips are currently empty but must be present in the layout as reserved space.

---

## 3. DECLARATION VIA DOUBLE-CLICK — NO DECLARE BUTTON

**Delete** the "宣言" (Declare) button entirely.

**Double-click to declare**: Double-clicking a move card or quick-action card initiates declaration. This replaces the button.

**Parabola/trajectory animation**: After double-click, an arc/parabola line animates from the card to valid target(s) — similar to card game attack animations (think Hearthstone or Slay the Spire). The player then clicks target(s) to confirm.

**Multi-target**: If a move can target multiple enemies, the parabola branches to each valid target. Reserve this in the code even for single-target moves.

**Move card display**:
- Show base effect text below the card name (always visible).
- Do NOT show threshold requirements (气性/势/装备) on the card face. Instead: if thresholds are met → card is lit and clickable. If thresholds are NOT met → card is dimmed and shows the reason on hover only.
- **Long-press** (or right-click) a move card → opens a detail drawer showing: full move fields (式位, 气性门槛, 势条件, 装备许可, all triggers with conditions and effects, risk, post-shi, yin/yang slot structure, expected outcomes).

---

## 4. STATUS BARS REPLACE EQUIPMENT ON CHARACTER CARDS

**Remove** the equipment text/summary from below the character card.

**Replace with** a status effect bar: horizontally arranged status badges showing name + layer count (e.g. "流血×2", "破口×1"). Each badge is color-coded by status type. Maximum 4-5 badges visible; overflow shows "+N more" that expands on hover.

Status types and colors:
- 迟滞: brown, 破口: dark red, 失衡: orange, 流血: red, 中毒: purple, 燃烧: orange-red, 冻结: blue, 眩晕: yellow, 封穴: dark purple

---

## 5. DRAWER SIZING

All drawers open at **exactly 2 character-card widths** (~400px). Content must fit on one drawer page without scrolling. Only if content genuinely overflows (e.g., long move list) should the drawer become scrollable.

The drawer opens in the center area. Multiple drawers stack horizontally. Right edge is draggable to resize.

---

## 6. GAME-STYLE BACKPACK INVENTORY

Redesign the inventory drawer as a **game backpack grid**: a grid of square slots (like Diablo/Path of Exile inventory). Each slot is 48×48px with a subtle border. Items occupy 1 or more slots based on size.

**Item display per slot**: icon placeholder + quantity number in corner. Hover shows item name + description tooltip.

**Art slots**: Every drawer page must have clearly marked areas for future art assets:
```
{/* ART SLOT: drawer-bg-{name} — decorative panel background */}
{/* ART SLOT: item-icon-{itemId} — 40×40 item icon */}
{/* ART SLOT: drawer-header-ornament — header decorative element */}
```

Every drawer (character, inventory, moves, logs, DM, settings) must be individually designed with game-like layout, not just a plain text list.

---

## 7. AUDIT ALL ART PLACEHOLDERS

Scan every visible UI surface and mark all locations where art assets will be placed. Use the exact comment format:
```
{/* ART SLOT: <category>-<name> — <dimensions> <description> */}
```

Categories: portrait, icon, bg, panel, ornament, texture, fx

This includes: character portraits, move card backgrounds, zone marker textures, button decorations, divider ornaments, status effect icons, momentum pill backgrounds, dice tray textures, drawer headers, scene illustration areas.

---

## 8. CRITICAL — 3D DICE ORIENTATION + SORTED ROLL ANIMATION

**Problem**: Currently dice in the 3D tray do NOT face the player with their value visible. Numbers are unclear or sideways.

**Fix**: Every die in 气海 must face the camera with its **rolled value face pointing directly at the player** (i.e., the face with the number should be the one facing the orthographic top-down camera — rotate so the value face points UP toward the camera).

**Number clarity**: Increase face label sprite size. Use high-contrast colors: white numbers on dark yin dice, dark numbers on light yang dice, gold numbers on blue raw dice. The number must be clearly readable at the current scale.

**Sorted roll animation**: When "投掷" (Roll) is triggered:
1. All dice in 气海 launch upward simultaneously with physics-style spin
2. Dice bounce/settle showing their rolled values
3. After settling, dice **auto-arrange** into organized rows sorted by:
   - **First by size** (dice sides): D4 → D6 → D8 → D10 → D12 → D20
   - **Then by nature** (qi attribute): Yin → Yang → Raw within each size group
   - **Then by value**: highest to lowest within each nature group
4. The arrangement animation is smooth (lerp to target positions over 500ms)
5. This should look like a formal dice throw settling into an organized display

**Implementation notes**:
- Modify `QiDiceTray.tsx` roll completion handler to compute sorted grid positions
- After roll results are determined, calculate target positions in a grid layout
- Grid: 6 columns max per row, left-to-right, top-to-bottom
- Row sorting: D4s first (leftmost), then D6s, D8s, D10s, D12s, D20s (rightmost)
- Within same size: yin first, then yang, then raw
- Within same size+nature: highest value first
- Animate dice from their post-roll positions to sorted positions using requestAnimationFrame lerp
