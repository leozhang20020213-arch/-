import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createSeedState } from "../../../data/seed";
import { buildStageData } from "../../../data/mockCombatData";
import { CombatStage } from "./CombatStage";

function openingButtonTag(html: string, actorName: string): string {
  const ariaPosition = html.indexOf(`aria-label="${actorName}，`);
  assert.notEqual(ariaPosition, -1, `missing combatant button for ${actorName}`);
  const start = html.lastIndexOf("<button", ariaPosition);
  const end = html.indexOf(">", ariaPosition);
  assert.ok(start >= 0 && end > start);
  return html.slice(start, end + 1);
}

describe("CombatStage target controls", () => {
  it("uses caller-provided targetableActorIds instead of assuming enemy targets", () => {
    const state = createSeedState();
    const data = buildStageData(state);
    const friendlyTarget = state.actors.find(
      (actor) => actor.side === "player" && actor.id !== state.activeActorId,
    )!;
    const enemy = state.actors.find((actor) => actor.side !== "player")!;

    const html = renderToStaticMarkup(
      <CombatStage
        data={data}
        state={state}
        selectedMove={state.actors.find((actor) => actor.id === state.activeActorId)!.moves[0]}
        targetableActorIds={[friendlyTarget.id]}
      />,
    );

    assert.doesNotMatch(openingButtonTag(html, friendlyTarget.name), /\sdisabled(?:=|\s|>)/);
    assert.match(openingButtonTag(html, enemy.name), /untargetable/);
    assert.doesNotMatch(openingButtonTag(html, enemy.name), /\sdisabled(?:=|\s|>)/);
  });

  it("renders multiple action-to-target lines with complete visible HTML labels", () => {
    const state = createSeedState();
    const data = buildStageData(state);
    const source = state.actors.find((actor) => actor.id === state.activeActorId)!;
    const alternateSource = state.actors.find(
      (actor) => actor.side === "player" && actor.id !== source.id,
    )!;
    const targets = state.actors.filter((actor) => actor.side !== "player").slice(0, 2);
    const move = source.moves[0];

    const html = renderToStaticMarkup(
      <CombatStage
        data={data}
        state={state}
        selectedMove={move}
        targetLines={[
          { targetActorId: targets[0].id },
          { sourceActorId: alternateSource.id, targetActorId: targets[1].id },
        ]}
      />,
    );

    assert.equal(html.match(/data-target-line-label="true"/g)?.length, 2);
    assert.match(html, new RegExp(`${source.name} → ${targets[0].name}`));
    assert.match(html, new RegExp(`${alternateSource.name} → ${targets[1].name}`));
    assert.match(html, new RegExp(move.name));
    assert.match(html, /(?:贴身|近身|中距|远距|超距|距离未知)/);
    assert.match(html, /(?:合法|不合法)/);

    const svgStart = html.indexOf('<svg class="distance-svg-layer"');
    const svgEnd = html.indexOf("</svg>", svgStart);
    assert.ok(svgStart >= 0 && svgEnd > svgStart);
    assert.doesNotMatch(html.slice(svgStart, svgEnd), /<text(?:\s|>)/);
  });

  it("keeps selectedTargetId as a backward-compatible single target line", () => {
    const state = createSeedState();
    const data = buildStageData(state);
    const target = state.actors.find((actor) => actor.side !== "player")!;

    const html = renderToStaticMarkup(
      <CombatStage
        data={data}
        state={state}
        selectedTargetId={target.id}
        selectedMove={state.actors[0].moves[0]}
      />,
    );

    assert.equal(html.match(/data-target-line-label="true"/g)?.length, 1);
    assert.match(html, new RegExp(target.name));
  });
});
