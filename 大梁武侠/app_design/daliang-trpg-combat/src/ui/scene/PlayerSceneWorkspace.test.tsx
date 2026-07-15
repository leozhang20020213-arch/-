import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createDefaultSession } from "../../combat/storage";
import { changeSceneMode } from "../../controllers/scene/sceneController";
import { createSeedState } from "../../data/seed";
import { findSceneUsage } from "../../data/scene/sceneBehaviorCatalog";
import { PlayerSceneWorkspace, type PlayerSceneWorkspaceProps } from "./PlayerSceneWorkspace";

function propsFor(state = createSeedState()): PlayerSceneWorkspaceProps {
  return {
    state,
    session: { ...createDefaultSession(), route: "playerScene", identity: "player", autoDmEnabled: true },
    actorId: "pc-shen-qing",
    selectedCategory: "investigate",
    selectedUsageId: "scene.observe.careful",
    selectedTargetId: "warehouse-door",
    draft: "我贴着檐下看水痕从哪里来。",
    audience: "all",
    status: "",
    pending: false,
    readOnly: false,
    activeDrawer: null,
    onSelectCategory: () => undefined,
    onSelectUsage: () => undefined,
    onSelectTarget: () => undefined,
    onChangeDraft: () => undefined,
    onChangeAudience: () => undefined,
    onSubmit: () => undefined,
    onOpenDrawer: () => undefined,
    onHome: () => undefined,
  };
}

describe("PlayerSceneWorkspace", () => {
  it("renders a free scene without combat enemy arrays or a forced queue", () => {
    const html = renderToStaticMarkup(<PlayerSceneWorkspace {...propsFor()} />);
    for (const label of ["查探", "交涉", "潜入", "追逐", "整备", "江湖事务"]) assert.match(html, new RegExp(label));
    assert.match(html, /自由情景/);
    assert.doesNotMatch(html, /scene-sequence-strip/);
    assert.doesNotMatch(html, /短兵客/);
    assert.doesNotMatch(html, /响应额度/);
  });

  it("shows only a lightweight sequence in structured scene mode", () => {
    const structured = changeSceneMode(createSeedState(), "SCENE_STRUCTURED", ["pc-shen-qing", "pc-wei"]);
    const html = renderToStaticMarkup(<PlayerSceneWorkspace {...propsFor(structured)} />);
    assert.match(html, /结构化情景/);
    assert.match(html, /scene-sequence-strip/);
    assert.match(html, /沈青/);
    assert.match(html, /魏长兴/);
    assert.doesNotMatch(html, /短兵客/);
  });

  it("keeps the selected card linked to the authoritative legacy action type", () => {
    const usage = findSceneUsage("scene.investigate.trace");
    assert.equal(usage?.sceneActionType, "investigate");
    assert.equal(usage?.modes.includes("COMBAT"), false);
  });
});
