import { useEffect, useMemo, useState } from "react";
import { cloneCampaignPack, validateCampaignPack, type CampaignPack, type CampaignScene, type SceneElementKind } from "../../data/campaign/campaignSchema";
import { CAMPAIGN_PACKS, DEFAULT_STORY_CAMPAIGN_ID, getCampaignPack } from "../../data/campaign/campaignRegistry";
import { loadRuleTextCatalog, type RuleTextCatalog } from "../../data/rules/ruleTextCatalog";

const elementKinds: Array<{ kind: SceneElementKind; label: string }> = [
  { kind: "area", label: "区域" }, { kind: "npc", label: "NPC" }, { kind: "enemy", label: "敌人" },
  { kind: "companion", label: "队友" }, { kind: "object", label: "物件" }, { kind: "container", label: "容器" },
  { kind: "door", label: "门窗" }, { kind: "obstacle", label: "阻隔" }, { kind: "hazard", label: "危险" },
  { kind: "clue", label: "线索" }, { kind: "document", label: "文书" }, { kind: "dynamic", label: "动景" },
];

function readPack(): CampaignPack {
  const value = window.daliangDesktop?.storage.read("campaign");
  if (value && typeof value === "object") return value as CampaignPack;
  try {
    const browser = localStorage.getItem("daliang:campaign");
    if (browser) return JSON.parse(browser) as CampaignPack;
  } catch {
    // Corrupt authoring drafts fall back to the validated normal-play pack.
  }
  return cloneCampaignPack(getCampaignPack(DEFAULT_STORY_CAMPAIGN_ID));
}

function persistPack(pack: CampaignPack) {
  if (window.daliangDesktop) return window.daliangDesktop.storage.write("campaign", pack);
  localStorage.setItem("daliang:campaign", JSON.stringify(pack));
  return Promise.resolve(true);
}

export function DmStudioPage({ onBack, onPreview }: { onBack: () => void; onPreview: (pack: CampaignPack) => void }) {
  const [pack, setPack] = useState<CampaignPack>(readPack);
  const [selectedSceneId, setSelectedSceneId] = useState(pack.startSceneId);
  const [selectedElementId, setSelectedElementId] = useState<string>();
  const [status, setStatus] = useState("本地草稿");
  const [catalog, setCatalog] = useState<RuleTextCatalog>();
  const [resourceQuery, setResourceQuery] = useState("");
  const selectedScene = pack.scenes.find((scene) => scene.id === selectedSceneId) ?? pack.scenes[0];
  const selectedElement = selectedScene?.elements.find((element) => element.id === selectedElementId);
  const issues = useMemo(() => validateCampaignPack(pack), [pack]);
  const referenceEntries = useMemo(() => {
    const normalized = resourceQuery.trim().toLocaleLowerCase("zh-CN");
    return (catalog?.entries ?? [])
      .filter((entry) => entry.review.status === "REFERENCE")
      .filter((entry) => !normalized || `${entry.id} ${entry.name} ${entry.kindLabel} ${entry.category}`.toLocaleLowerCase("zh-CN").includes(normalized))
      .slice(0, 18);
  }, [catalog, resourceQuery]);

  useEffect(() => {
    let active = true;
    loadRuleTextCatalog().then((value) => { if (active) setCatalog(value); }).catch(() => { if (active) setStatus("规则文字库读取失败"); });
    return () => { active = false; };
  }, []);

  function updateScene(patch: Partial<CampaignScene>) {
    setPack((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      scenes: current.scenes.map((scene) => scene.id === selectedScene.id ? { ...scene, ...patch } : scene),
    }));
  }

  function addElement(kind: SceneElementKind) {
    const id = `${selectedScene.id}-${kind}-${selectedScene.elements.length + 1}`;
    updateScene({ elements: [...selectedScene.elements, { id, kind, name: elementKinds.find((entry) => entry.kind === kind)?.label ?? kind, description: "待填写", public: false, interactionUsageIds: [] }] });
    setSelectedElementId(id);
    setStatus("有未保存修改");
  }

  function updateElement(patch: Record<string, unknown>) {
    if (!selectedElement) return;
    updateScene({ elements: selectedScene.elements.map((element) => element.id === selectedElement.id ? { ...element, ...patch } : element) });
    setStatus("有未保存修改");
  }

  function toggleRuleReference(referenceId: string) {
    if (!selectedElement) return;
    const current = selectedElement.ruleReferenceIds ?? [];
    updateElement({ ruleReferenceIds: current.includes(referenceId) ? current.filter((id) => id !== referenceId) : [...current, referenceId] });
  }

  async function save() {
    await persistPack(pack);
    setStatus(issues.some((issue) => issue.severity === "error") ? "已保存草稿 · 尚未通过验证" : "已保存 · 可预览");
  }

  function loadTemplate(packId: string) {
    const next = cloneCampaignPack(getCampaignPack(packId));
    setPack(next);
    setSelectedSceneId(next.startSceneId);
    setSelectedElementId(undefined);
    setStatus(`已载入模板 · ${next.name}`);
  }

  if (!selectedScene) return null;
  return (
    <main className="dm-studio" aria-label="DM剧情创作工作台">
      <header className="dm-studio__topbar">
        <div><small>大梁武侠 · 真人DM</small><h1>剧情创作工作台</h1></div>
        <label>团包模板<select value={CAMPAIGN_PACKS.some((entry) => entry.pack.id === pack.id) ? pack.id : ""} onChange={(event) => loadTemplate(event.target.value)}><option value="" disabled>自定义草稿</option>{CAMPAIGN_PACKS.map((entry) => <option value={entry.pack.id} key={entry.pack.id}>{entry.pack.name}{entry.kind === "tutorial" ? " · 教学" : " · 正常故事"}</option>)}</select></label>
        <label>团包名<input value={pack.name} onChange={(event) => setPack((current) => ({ ...current, name: event.target.value }))} /></label>
        <span className="dm-studio__status">{status}</span>
        <button type="button" onClick={onBack}>返回首页</button>
      </header>

      <aside className="dm-studio__library">
        <header><small>资源库</small><strong>章节与场景</strong></header>
        {pack.chapters.map((chapter) => (
          <section key={chapter.id}>
            <h2>{chapter.name}</h2>
            {chapter.sceneIds.map((sceneId) => {
              const scene = pack.scenes.find((item) => item.id === sceneId);
              return scene ? <button className={scene.id === selectedScene.id ? "selected" : ""} type="button" key={scene.id} onClick={() => { setSelectedSceneId(scene.id); setSelectedElementId(undefined); }}><span>{scene.mode === "COMBAT" ? "战" : scene.mode === "SCENE_STRUCTURED" ? "序" : "景"}</span><b>{scene.name}</b></button> : null;
            })}
          </section>
        ))}
        <div className="dm-studio__asset-kinds">
          <small>向当前场景添加</small>
          {elementKinds.map((entry) => <button type="button" key={entry.kind} onClick={() => addElement(entry.kind)}>＋ {entry.label}</button>)}
        </div>
        <section className="dm-studio__rule-assets" aria-label="规则资料资源库">
          <header><small>7月16日规则文字库</small><strong>审校通过的资料引用</strong></header>
          <input value={resourceQuery} placeholder="搜索招式、装备、状态…" onChange={(event) => setResourceQuery(event.target.value)} />
          <p>{catalog ? `${catalog.countsByStatus.REFERENCE} 条可引用；异常条目已隔离` : "正在校验资料库…"}</p>
          <div>
            {referenceEntries.map((entry) => {
              const linked = selectedElement?.ruleReferenceIds?.includes(entry.id) ?? false;
              return <button className={linked ? "linked" : ""} disabled={!selectedElement} type="button" key={entry.id} title={selectedElement ? `关联到 ${selectedElement.name}` : "先选择场景元素"} onClick={() => toggleRuleReference(entry.id)}><span>{entry.kindLabel}</span><b>{entry.name}</b><small>{entry.id}</small></button>;
            })}
          </div>
        </section>
      </aside>

      <section className="dm-studio__canvas">
        <header>
          <div><small>{selectedScene.mode}</small><h2>{selectedScene.name}</h2><p>{selectedScene.objective}</p></div>
          <div className="dm-studio__mode-tabs"><button className="selected" type="button">场景画布</button><button type="button">剧情图</button><button type="button">交锋配置</button></div>
        </header>
        <div className="dm-studio__scene-board">
          <div className="dm-studio__scene-copy"><b>{selectedScene.weather || "无天气"} · {selectedScene.light || "无光照"}</b><p>{selectedScene.description}</p><small>{selectedScene.boundary}</small></div>
          <div className="dm-studio__elements">
            {selectedScene.elements.map((element) => (
              <button className={`dm-element kind-${element.kind}${element.id === selectedElementId ? " selected" : ""}`} type="button" key={element.id} onClick={() => setSelectedElementId(element.id)}>
                <span>{elementKinds.find((entry) => entry.kind === element.kind)?.label ?? element.kind}</span><strong>{element.name}</strong><small>{element.public ? "玩家可见" : "DM隐藏"}</small>
              </button>
            ))}
          </div>
          <div className="dm-studio__tracks">
            {selectedScene.tracks.map((track) => <span key={track.id}><b>{track.name}</b><i>{track.kind} · 0/{track.max}</i></span>)}
          </div>
        </div>
      </section>

      <aside className="dm-studio__inspector">
        <header><small>属性检查器</small><strong>{selectedElement ? selectedElement.name : selectedScene.name}</strong></header>
        {selectedElement ? <>
          <label>名称<input value={selectedElement.name} onChange={(event) => updateElement({ name: event.target.value })} /></label>
          <label>描述<textarea value={selectedElement.description} onChange={(event) => updateElement({ description: event.target.value })} /></label>
          <label className="check-row"><input type="checkbox" checked={selectedElement.public} onChange={(event) => updateElement({ public: event.target.checked })} />玩家可见</label>
          <label>DM备注<textarea value={selectedElement.hiddenNote ?? ""} onChange={(event) => updateElement({ hiddenNote: event.target.value })} /></label>
          <label>允许用法<input value={selectedElement.interactionUsageIds.join(", ")} onChange={(event) => updateElement({ interactionUsageIds: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
          <section className="dm-studio__linked-rules">
            <small>规则资料引用（不会自动执行）</small>
            {(selectedElement.ruleReferenceIds ?? []).map((id) => {
              const entry = catalog?.entries.find((item) => item.id === id);
              return <button type="button" key={id} onClick={() => toggleRuleReference(id)}><span>{entry?.name ?? id}</span><i>移除</i></button>;
            })}
            {(selectedElement.ruleReferenceIds ?? []).length === 0 ? <p>从左侧资料库选择已审校条目。结构化效果仍需绑定可执行用法。</p> : null}
          </section>
        </> : <>
          <label>场景名<input value={selectedScene.name} onChange={(event) => updateScene({ name: event.target.value })} /></label>
          <label>目标<textarea value={selectedScene.objective} onChange={(event) => updateScene({ objective: event.target.value })} /></label>
          <label>边界<textarea value={selectedScene.boundary} onChange={(event) => updateScene({ boundary: event.target.value })} /></label>
          <label>场景描述<textarea value={selectedScene.description} onChange={(event) => updateScene({ description: event.target.value })} /></label>
        </>}
      </aside>

      <footer className="dm-studio__footer">
        <div><strong>规则验证</strong><span>{issues.filter((issue) => issue.severity === "error").length} 错误 · {issues.filter((issue) => issue.severity === "warning").length} 提醒 · {catalog?.entryCount ?? "…"} 条资料</span>{issues[0] ? <small>{issues[0].path}：{issues[0].message}</small> : <small>引用、模式、目标与场景连接均通过；资料引用不绕过可执行规则。</small>}</div>
        <button type="button" onClick={() => setStatus("模拟完成 · 未修改权威存档")}>模拟一轮</button>
        <button type="button" disabled={issues.some((issue) => issue.severity === "error")} title={issues.some((issue) => issue.severity === "error") ? "先修复阻断级团包错误" : "以当前草稿启动独立预览，不覆盖已保存团档"} onClick={() => onPreview(pack)}>玩家视图预览</button>
        <button className="primary-action" type="button" onClick={save}>保存草稿</button>
      </footer>
    </main>
  );
}
