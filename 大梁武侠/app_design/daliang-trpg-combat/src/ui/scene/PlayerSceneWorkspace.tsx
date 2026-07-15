import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { AppSession, CombatState } from "../../combat/types";
import {
  SCENE_BEHAVIOR_CATEGORIES,
  findSceneUsage,
  usagesForSceneCategory,
  visibleTargetsForUsage,
  type SceneBehaviorCategory,
  type SceneBehaviorUsage,
} from "../../data/scene/sceneBehaviorCatalog";
import { WindowControls } from "../components/WindowControls";

export type ScenePlayerDrawerId =
  | "character"
  | "inventory"
  | "moves"
  | "statuses"
  | "logs"
  | "library"
  | "settings";

export type SceneAudience = "all" | "dm";

export interface PlayerSceneWorkspaceProps {
  state: CombatState;
  session: AppSession;
  actorId: string;
  selectedCategory: SceneBehaviorCategory;
  selectedUsageId: string;
  selectedTargetId: string;
  draft: string;
  audience: SceneAudience;
  status: string;
  pending: boolean;
  readOnly: boolean;
  activeDrawer: string | null;
  onSelectCategory: (category: SceneBehaviorCategory) => void;
  onSelectUsage: (usage: SceneBehaviorUsage) => void;
  onSelectTarget: (targetId: string) => void;
  onChangeDraft: (value: string) => void;
  onChangeAudience: (value: SceneAudience) => void;
  onSubmit: () => void | Promise<void>;
  onOpenDrawer: (drawer: ScenePlayerDrawerId | null) => void;
  onHome: () => void;
  drawer?: ReactNode;
}

const drawerItems: Array<{ id: ScenePlayerDrawerId; label: string; seal: string }> = [
  { id: "character", label: "人物", seal: "侠" },
  { id: "inventory", label: "背包", seal: "囊" },
  { id: "moves", label: "招式", seal: "式" },
  { id: "logs", label: "日志", seal: "录" },
  { id: "library", label: "资料", seal: "典" },
  { id: "settings", label: "设置", seal: "设" },
];

function kindSeal(kind: "environment" | "person" | "object"): string {
  if (kind === "person") return "人";
  if (kind === "object") return "物";
  return "景";
}

function natureSeal(nature: string): string {
  if (nature === "yin") return "阴";
  if (nature === "yang") return "阳";
  return "元";
}

export function PlayerSceneWorkspace(props: PlayerSceneWorkspaceProps) {
  const [infoCollapsed, setInfoCollapsed] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const sceneMode = props.state.runtime.mode === "SCENE_STRUCTURED" ? "SCENE_STRUCTURED" : "SCENE_FREE";
  const selectedUsage = findSceneUsage(props.selectedUsageId);
  const usages = usagesForSceneCategory(props.state, props.selectedCategory);
  const legalCategories = useMemo(
    () => SCENE_BEHAVIOR_CATEGORIES.filter((category) => usagesForSceneCategory(props.state, category.id).length > 0),
    [props.state],
  );
  const visibleCategories = showAllCategories ? SCENE_BEHAVIOR_CATEGORIES : legalCategories;
  const targets = selectedUsage ? visibleTargetsForUsage(props.state, selectedUsage) : [];
  const selectedTarget = props.state.scene.elements.find((element) => element.id === props.selectedTargetId && element.public);
  const actor = props.state.actors.find((entry) => entry.id === props.actorId) ?? props.state.actors[0];
  const sceneDice = props.state.dice.filter((die) => die.ownerId === actor.id && die.zone === "QI_SEA");
  const activeFacts = [...props.state.scene.permissions, ...props.state.scene.resources].filter((fact) => !fact.consumed);
  const sequence = sceneMode === "SCENE_STRUCTURED" ? props.state.runtime.scene.sequence : undefined;
  const canSubmit = !props.readOnly
    && !props.pending
    && Boolean(selectedUsage)
    && Boolean(selectedTarget);
  const privateDmAllowed = props.session.playMode !== "room" || props.session.room.allowPrivateDmMessages !== false;

  function chooseCategory(category: SceneBehaviorCategory) {
    props.onSelectCategory(category);
    const first = usagesForSceneCategory(props.state, category)[0];
    if (first) props.onSelectUsage(first);
  }

  function chooseUsage(usage: SceneBehaviorUsage) {
    props.onSelectUsage(usage);
    const legalTargets = visibleTargetsForUsage(props.state, usage);
    if (!legalTargets.some((target) => target.id === props.selectedTargetId)) {
      props.onSelectTarget(legalTargets[0]?.id ?? "");
    }
  }

  return (
    <div className={`scene-workspace ${infoCollapsed ? "scene-workspace--info-collapsed" : ""}`} data-scene-mode={sceneMode}>
      <header className="scene-workspace__topbar">
        <div className="scene-brand"><b>大梁武侠</b><span>玩家情景桌面</span></div>
        <div className="scene-heading">
          <small>第{props.state.scene.act}幕 · {props.state.scene.timeWindow}</small>
          <strong>{props.state.scene.location}</strong>
          <span className={`scene-mode-badge scene-mode-badge--${sceneMode === "SCENE_FREE" ? "free" : "structured"}`}>
            {sceneMode === "SCENE_FREE" ? "自由情景" : "结构化情景"}
          </span>
        </div>
        <nav className="scene-drawer-nav" aria-label="玩家资料抽屉">
          {drawerItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={props.activeDrawer === item.id ? "active" : ""}
              title={item.label}
              aria-label={item.label}
              onClick={() => props.onOpenDrawer(props.activeDrawer === item.id ? null : item.id)}
            >
              <i>{item.seal}</i><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="scene-window-tools">
          <span className="scene-identity">{actor.name}</span>
          {props.session.autoDmEnabled ? <span className="scene-auto-dm">规则主持</span> : null}
          <button type="button" title="返回首页" aria-label="返回首页" onClick={props.onHome}>↩</button>
          <WindowControls />
        </div>
      </header>

      <main className="scene-workspace__main">
        <section className="scene-canvas" aria-label="情景场景画布">
          <div className="scene-canvas__wash" aria-hidden="true" />
          <div className="scene-canvas__story">
            <span>当前目标</span>
            <strong>{props.state.sceneGoal}</strong>
            <p>{props.state.scene.narration}</p>
          </div>

          {sequence ? (
            <div className="scene-sequence-strip" aria-label="结构化情景行动序列">
              <span>第{sequence.round}轮</span>
              {sequence.initiativeOrder.map((actorId) => {
                const entry = props.state.actors.find((candidate) => candidate.id === actorId);
                return entry ? (
                  <i key={actorId} className={`${actorId === sequence.activeActorId ? "current" : ""} ${sequence.actedActorIds.includes(actorId) ? "acted" : ""}`} title={sequence.actedActorIds.includes(actorId) ? "已行动" : "待行动"}>
                    {entry.name}
                  </i>
                ) : null;
              })}
            </div>
          ) : null}

          <div className="scene-object-field">
            {props.state.scene.elements.filter((element) => element.public).map((element, index) => {
              const legal = targets.some((target) => target.id === element.id);
              const selected = props.selectedTargetId === element.id;
              return (
                <button
                  key={element.id}
                  type="button"
                  className={`scene-object scene-object--${element.kind}${legal ? " legal" : ""}${selected ? " selected" : ""}`}
                  style={{ "--scene-object-index": index } as CSSProperties}
                  onClick={() => legal && props.onSelectTarget(element.id)}
                  onDoubleClick={() => legal && props.onSelectTarget(element.id)}
                  aria-pressed={selected}
                  aria-label={`${element.name}${legal ? "，可作为当前目标" : ""}`}
                >
                  <span className="scene-object__standee"><i>{kindSeal(element.kind)}</i></span>
                  <strong>{element.name}</strong>
                  <span className="scene-object__tooltip">{element.description}</span>
                </button>
              );
            })}
          </div>

          <div className="scene-token-rack" aria-label="公开场景轨与事实">
            {props.state.tracks.filter((track) => !track.hidden).map((track) => (
              <button type="button" key={track.id} title={`${track.description}${track.triggerOutcome ? `\n阈值：${track.triggerOutcome}` : ""}`}>
                <span>{track.kind === "crisis" ? "危" : "解"}</span><b>{track.name}</b><i>{track.value}/{track.max}</i>
              </button>
            ))}
            {activeFacts.slice(0, 3).map((fact) => (
              <button type="button" key={fact.id} title={fact.description}><span>凭</span><b>{fact.name}</b></button>
            ))}
          </div>

          <button className="scene-info-toggle" type="button" onClick={() => setInfoCollapsed((value) => !value)}>
            {infoCollapsed ? "展开情报" : "收起情报"}
          </button>
        </section>

        <aside className="scene-info-rail" aria-label="情景情报">
          <header><span>公开卷宗</span><strong>{selectedTarget?.name ?? "场景概览"}</strong></header>
          {selectedTarget ? (
            <article className="scene-inspection-card">
              <i>{kindSeal(selectedTarget.kind)}</i>
              <p>{selectedTarget.description}</p>
              <small>{targets.some((target) => target.id === selectedTarget.id) ? "可用于当前行为" : "请改选行为用法"}</small>
            </article>
          ) : (
            <article className="scene-inspection-card"><p>{props.state.scene.boundary}</p><small>点击画布上的人物、物件或地点查看公开信息。</small></article>
          )}
          <section className="scene-fact-list">
            <h3>许可与资源</h3>
            {activeFacts.length ? activeFacts.map((fact) => <span key={fact.id} title={fact.description}>{fact.name}</span>) : <p>尚未取得公开许可或资源。</p>}
          </section>
          {props.state.scene.lastResolution ? (
            <section className="scene-last-ruling">
              <h3>最近裁定</h3>
              <p>{props.state.scene.lastResolution.narration}</p>
              <ul>{props.state.scene.lastResolution.changes.map((change) => <li key={change}>{change}</li>)}</ul>
            </section>
          ) : null}
          {props.state.scene.combatUnlocked ? (
            <div className="scene-enter-combat" role="status">
              {props.session.playMode === "solo" ? "规则主持正在转入战斗" : "交锋条件已具备 · 等待主持揭卷"}
            </div>
          ) : null}
        </aside>
      </main>

      <footer className="scene-behavior-dock">
        <nav className="scene-category-tabs" aria-label="情景行为分类">
          {visibleCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={props.selectedCategory === category.id ? "active" : ""}
              onClick={() => chooseCategory(category.id)}
              title={category.hint}
            ><i>{category.seal}</i><span>{category.name}</span></button>
          ))}
          {legalCategories.length < SCENE_BEHAVIOR_CATEGORIES.length ? (
            <button
              type="button"
              className="scene-category-more"
              onClick={() => setShowAllCategories((value) => !value)}
              title={showAllCategories ? "只显示当前可用分类" : "查看当前不可用的行为分类"}
            ><i>览</i><span>{showAllCategories ? "收起" : "全部"}</span></button>
          ) : null}
        </nav>

        <div className="scene-behavior-body">
          <section className="scene-usage-hand" aria-label="当前可用情景招式">
            <header><span>{SCENE_BEHAVIOR_CATEGORIES.find((entry) => entry.id === props.selectedCategory)?.hint}</span><small>{usages.length}项可用</small></header>
            <div>
              {usages.map((entry) => (
                <button
                  type="button"
                  key={entry.id}
                  className={`scene-usage-card${props.selectedUsageId === entry.id ? " selected" : ""}`}
                  onClick={() => chooseUsage(entry)}
                  onDoubleClick={() => chooseUsage(entry)}
                  title={`${entry.targetRule}｜风险${entry.riskLabel}｜${entry.summary}`}
                >
                  <small>{entry.actionKind === "formal" ? "情景招式" : "便行"}</small>
                  <strong>{entry.name}</strong>
                  <span>{entry.summary}</span>
                  <footer><i>{entry.minimumQi ? `至少${entry.minimumQi}气` : "无须投气"}</i><b>险·{entry.riskLabel}</b></footer>
                </button>
              ))}
            </div>
          </section>

          <section className="scene-intent-editor" aria-label="玩家述意编辑器">
            <div className="scene-intent-editor__header">
              <span>{selectedUsage?.name ?? "先选行为"} · {selectedTarget?.name ?? "待选目标"}</span>
              <button type="button" onClick={() => props.onChangeDraft("")} disabled={!props.draft}>撤回草稿</button>
            </div>
            <textarea
              value={props.draft}
              onChange={(event) => props.onChangeDraft(event.target.value)}
              placeholder="可选：补充你准备怎么做。已选招式与目标时可直接提交。"
              maxLength={240}
              disabled={props.readOnly}
            />
            <div className="scene-intent-editor__tools">
              <div className="scene-audience-switch" role="group" aria-label="发送范围">
                <button type="button" className={props.audience === "all" ? "active" : ""} onClick={() => props.onChangeAudience("all")}>全员广播</button>
                <button type="button" className={props.audience === "dm" ? "active" : ""} onClick={() => props.onChangeAudience("dm")} disabled={!privateDmAllowed} title={privateDmAllowed ? "只发送给主持" : "房主未开放私密述意"}>仅DM</button>
              </div>
              <button className="scene-submit-intent" type="button" onClick={props.onSubmit} disabled={!canSubmit} title={!selectedTarget ? "请选择高亮目标" : props.pending ? "上一项请求等待裁定" : "发送行动述意"}>
                {props.pending ? "等待裁定" : "发送述意"}
              </button>
            </div>
            <div className="scene-draft-status" aria-live="polite">
              <span>{props.status || "补充说明为可选；仅DM选项只在房间许可时生效。"}</span>
              <small>{props.draft.length}/240</small>
            </div>
          </section>

          <section className="scene-qi-glance" aria-label="角色气海摘要">
            <header><span>气海</span><b>{sceneDice.length}枚</b></header>
            <div>{sceneDice.map((die) => <i key={die.id} className={`nature-${die.nature}`} title={`${die.sourceName} · d${die.sides}`}>{natureSeal(die.nature)}<b>{die.value ?? "·"}</b></i>)}</div>
            <small>结构化对抗时才展开配气；自由述意不预先消耗。</small>
          </section>
        </div>
      </footer>
      {props.drawer}
    </div>
  );
}
