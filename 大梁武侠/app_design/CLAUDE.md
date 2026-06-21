# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: 大梁江湖TRPG — App & Game Development

Three interconnected projects under `app_design/`:

### 1. daliang-trpg-combat (Active — primary work target)
React 19 + TypeScript + Vite 7 + Three.js + Phaser 4 + WebSocket LAN multiplayer TRPG combat app.

**Commands:**
- `npm run dev:legacy` — Start dev server (React UI, the `dev` script is intentionally disabled)
- `npm run dev:lan` — Start WebSocket LAN host server on port 8787
- `npm run dev:lan:ui` — Start dev server bound to 0.0.0.0 for LAN access
- `npm test` — Run combat engine tests (16 test cases, uses `tsx --test`)
- `npm run build` — TypeScript check + Vite production build

**Architecture (layered, dependency order):**
1. `src/combat/types.ts` — All TypeScript types: QiZone (5 zones), QiNature, CombatPhase (8 phases), Actor, QiDie, CombatState, PendingAction, Momentum (6 states), etc.
2. `src/combat/combatEngine.ts` — Pure-function rule engine implementing the full TRPG qi-die system: `enterScene()`, `declareAction()`, `resolveInterceptSuccess()`, `formMove()`, `resolveReact()`, `applyOutcome()`, `regulateBreath()`, `useReflection()`, `expireSource()`, `commitDiceRollResults()`
3. `src/combat/combatEngine.test.ts` — 16 test cases using `node:test`
4. `src/data/seed.ts` — Scenario data: 桥陵镇雨夜失镖, 3 actors with full stats
5. `src/rules/ruleCatalog.ts` — Hardcoded move catalog (4 moves, 4 responses, 4 quick actions)
6. `src/rules/schema.ts` — Runtime validation for all combat events, LAN messages, statuses
7. `src/net/lanClient.ts` — WebSocket client with state machine (idle→connecting→connected→closed)
8. `server/lanHost.ts` — WebSocket server, room-based, state sync/broadcast
9. `src/dice3d/QiDiceRollOverlay.tsx` — 3D dice rolling modal (Three.js, animated, no physics)
10. `src/game/combatScene.ts` + `PhaserCombatBoard.tsx` — Phaser 4 2D tactical overlay
11. `src/ui/App.tsx` — ~2000-line main UI: routes, DM/Player views, Qi Zone Board (5 zones with drag-drop), combat flow, drawers (15 types), LAN integration
12. `src/styles.css` — 1138 lines, warm earth-tone theme, responsive layout

**Critical design decisions:**
- Qi zones are 5 (QI_POOL/QI_SEA/QI_LOCK/QI_REST/TEMP_QI), matching the "核心五区" convention
- `regulateBreath()` moves QI_REST→QI_SEA WITHOUT reroll (passive circulation)
- `useReflection()` retrieves lowest-value die from QI_REST→QI_SEA WITHOUT reroll
- The `npm run dev` script is intentionally blocked (exits with error pointing to Godot). Use `dev:legacy` instead.
- DM sees full state; players get filtered state via `visibleForPlayer()`; LAN clients get `visibleForLanPublic()`

### 2. dice-lab (Reference — do not modify core logic)
Standalone 3D dice physics sandbox. React 19 + Three.js 0.181 + cannon-es physics.
- `src/dice3d/` — Full 3D dice system: geometry (D4-D20), materials (yin onyx/yang marble/neutral blue-gold), physics (cannon-es with tray walls), animation, drag-to-reposition
- The 3D dice assets and face texture generation from this project are the canonical reference for dice rendering
- Use `npm run dev` to run

### 3. daliang-trpg-godot-r6 (Parked — UI prototype only)
Godot 4.7 project. All data is placeholder strings `【占位：字段名】`. No rules integration, no networking, no dice. Three phases of UI scaffolding complete (card selection, target lines, drawers, state machine). Not currently connected to the combat engine.

## Rulebook Reference
Fixed/authoritative rulebook is at `D:\trpg\大梁武侠\规则书库_内测.01\`:
- `01_玩家规则书_内测第一版_修复版.md` — Player rulebook (all contradictions fixed)
- `02_DM规则书_内测第一版_修复版.md` — DM rulebook (gaps filled)
- `04_招式库_统一版_修复版.md` — Authoritative move database (23 moves, 15 response attachments)
- `05_术语表_完整版.md` — 86-term glossary

## Key Rulebook→Code Mappings
- 气池 → QI_POOL, 气海 → QI_SEA, 锁气 → QI_LOCK, 息库 → QI_REST, 临气区 → TEMP_QI
- 阴盛/阳盛/合势/圆融/崩势/失势 → Momentum enum (note: 崩势 = "崩溃" in code, 失势 = "失势")
- 六面势 states: "阴盛"/"阳盛"/"合势"/"圆融"/"崩溃"/"失势"
- 正式出手 requires both yin AND yang slot dice (checked in `canDeclareAction()`)
