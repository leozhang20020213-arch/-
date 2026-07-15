import { useEffect, useId, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  AppSession,
  CombatState,
  InventoryCategory,
} from "../../combat/types";
import { CAMPAIGN_PACKS, getCampaignPack } from "../../data/campaign/campaignRegistry";
import { validateCampaignPack } from "../../data/campaign/campaignSchema";
import {
  loadRuleTextCatalog,
  reviewStatusDescription,
  reviewStatusLabel,
  type RuleReviewStatus,
  type RuleTextCatalog,
  type RuleTextEntry,
  type RuleTextKind,
} from "../../data/rules/ruleTextCatalog";

type LibraryCategory =
  | "all"
  | "actors"
  | "moves"
  | "innerArts"
  | "statuses"
  | "inventory"
  | "tracks";

interface LibraryEntry {
  id: string;
  category: Exclude<LibraryCategory, "all">;
  title: string;
  subtitle: string;
  detail: string;
  tags: string[];
}

const categoryLabels: Record<LibraryCategory, string> = {
  all: "全部",
  actors: "角色",
  moves: "招式",
  innerArts: "内功",
  statuses: "状态",
  inventory: "装备与物品",
  tracks: "场景轨",
};

const inventoryLabels: Record<InventoryCategory, string> = {
  weapon: "兵器",
  armor: "护具",
  accessory: "佩饰",
  tool: "器具",
  medicine: "药物",
  mount: "坐骑",
  document: "文书",
  misc: "杂物",
};

type CatalogKindFilter = "all" | RuleTextKind;
type CatalogStatusFilter = "all" | RuleReviewStatus;

const catalogKindLabels: Record<CatalogKindFilter, string> = {
  all: "全部类别",
  external_move: "外功",
  inner_art: "内功",
  scene_method: "情景法门",
  equipment: "装备",
  medicine: "药物",
  status: "状态",
  manual: "谱本",
  mount: "坐骑载具",
  document: "文书资源",
};

const catalogStatusLabels: Record<CatalogStatusFilter, string> = {
  all: "全部审校状态",
  REFERENCE: "资料可用",
  REVIEW_REQUIRED: "需要复核",
  QUARANTINED: "暂不接入",
};

export interface LibraryPageProps {
  state: CombatState;
  isDm?: boolean;
  onBack: () => void;
}

/** Versioned rule-text database plus the smaller executable session catalog. */
export function LibraryPage({ state, isDm = false, onBack }: LibraryPageProps) {
  const searchId = useId();
  const categoryId = useId();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"catalog" | "session">("catalog");
  const [category, setCategory] = useState<CatalogKindFilter>("all");
  const [statusFilter, setStatusFilter] = useState<CatalogStatusFilter>("all");
  const [sessionCategory, setSessionCategory] = useState<LibraryCategory>("all");
  const [catalog, setCatalog] = useState<RuleTextCatalog>();
  const [catalogError, setCatalogError] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<RuleTextEntry>();

  useEffect(() => {
    let active = true;
    loadRuleTextCatalog()
      .then((value) => {
        if (!active) return;
        setCatalog(value);
        setSelectedEntry(value.entries[0]);
      })
      .catch((error: unknown) => {
        if (active) setCatalogError(error instanceof Error ? error.message : "规则文字库读取失败。");
      });
    return () => { active = false; };
  }, []);

  const sessionEntries = useMemo(() => collectLibraryEntries(state), [state]);
  const sessionCategoryCounts = useMemo(() => {
    const counts = Object.fromEntries(
      Object.keys(categoryLabels).map((key) => [key, 0]),
    ) as Record<LibraryCategory, number>;
    counts.all = sessionEntries.length;
    sessionEntries.forEach((entry) => {
      counts[entry.category] += 1;
    });
    return counts;
  }, [sessionEntries]);

  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
  const catalogResults = useMemo(() => (catalog?.entries ?? []).filter((entry) => {
    if (category !== "all" && entry.kind !== category) return false;
    if (statusFilter !== "all" && entry.review.status !== statusFilter) return false;
    if (!normalizedQuery) return true;
    return [entry.id, entry.name, entry.kindLabel, entry.category, entry.subCategory, entry.tier, entry.summary, entry.playerText]
      .join(" ")
      .toLocaleLowerCase("zh-CN")
      .includes(normalizedQuery);
  }), [catalog, category, normalizedQuery, statusFilter]);
  const sessionResults = sessionEntries.filter((entry) => {
    if (sessionCategory !== "all" && entry.category !== sessionCategory) return false;
    if (!normalizedQuery) return true;
    return [entry.title, entry.subtitle, entry.detail, ...entry.tags].join(" ").toLocaleLowerCase("zh-CN").includes(normalizedQuery);
  });

  function clearFilters() {
    setQuery("");
    setCategory("all");
    setStatusFilter("all");
    setSessionCategory("all");
  }

  return (
    <main className="support-page support-page--library" aria-labelledby="library-page-title">
      <header className="support-page__header panel">
        <div>
          <p className="eyebrow">权威规则文字库 · 版本化接入</p>
          <h1 id="library-page-title">大梁武侠资料库</h1>
          <p className="hint">完整资料与可执行团包分离。审校异常条目不会进入规则主持或权威结算。</p>
        </div>
        <button type="button" onClick={onBack}>返回</button>
      </header>

      <nav className="library-view-tabs panel" aria-label="资料来源">
        <button type="button" className={view === "catalog" ? "active" : ""} onClick={() => setView("catalog")}>
          完整规则文字库 <span>{catalog?.entryCount ?? "…"}</span>
        </button>
        <button type="button" className={view === "session" ? "active" : ""} onClick={() => setView("session")}>
          当前团包可执行数据 <span>{sessionEntries.length}</span>
        </button>
      </nav>

      {view === "catalog" && catalog ? (
        <section className="library-audit-strip" aria-label="数据库审校概况">
          <div><small>权威条目</small><strong>{catalog.entryCount}</strong><span>7月16日文字库</span></div>
          <div className="safe"><small>资料可用</small><strong>{catalog.countsByStatus.REFERENCE}</strong><span>可供阅读与创作引用</span></div>
          <div className="review"><small>需要复核</small><strong>{catalog.countsByStatus.REVIEW_REQUIRED}</strong><span>阻止自动执行</span></div>
          <div className="blocked"><small>暂不接入</small><strong>{catalog.countsByStatus.QUARANTINED}</strong><span>关键参数缺失</span></div>
        </section>
      ) : null}

      <section className="support-toolbar panel" aria-label="资料库筛选">
        <label htmlFor={searchId}>
          搜索
          <input
            id={searchId}
            type="search"
            value={query}
            placeholder="输入名称、来源、效果或标签"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label htmlFor={categoryId}>
          分类
          {view === "catalog" ? (
            <select id={categoryId} value={category} onChange={(event) => setCategory(event.target.value as CatalogKindFilter)}>
              {(Object.keys(catalogKindLabels) as CatalogKindFilter[]).map((key) => <option key={key} value={key}>{catalogKindLabels[key]}{key === "all" ? "" : `（${catalog?.countsByKind[key] ?? 0}）`}</option>)}
            </select>
          ) : (
            <select id={categoryId} value={sessionCategory} onChange={(event) => setSessionCategory(event.target.value as LibraryCategory)}>
              {(Object.keys(categoryLabels) as LibraryCategory[]).map((key) => <option key={key} value={key}>{categoryLabels[key]}（{sessionCategoryCounts[key]}）</option>)}
            </select>
          )}
        </label>
        {view === "catalog" ? <label>审校状态<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as CatalogStatusFilter)}>{(Object.keys(catalogStatusLabels) as CatalogStatusFilter[]).map((key) => <option key={key} value={key}>{catalogStatusLabels[key]}</option>)}</select></label> : null}
        <div className="support-toolbar__summary" aria-live="polite" aria-atomic="true">
          <span className="identity-pill">{view === "catalog" ? catalogResults.length : sessionResults.length} 条结果</span>
          {(query || category !== "all" || statusFilter !== "all" || sessionCategory !== "all") && (
            <button type="button" onClick={clearFilters}>清除筛选</button>
          )}
        </div>
      </section>

      {view === "catalog" ? (
        catalogError ? <section className="panel support-empty"><h2>数据库读取失败</h2><p>{catalogError}</p></section>
          : !catalog ? <section className="panel support-empty"><h2>正在校验规则文字库</h2><p>载入条目、索引和审校结果…</p></section>
            : catalogResults.length > 0 ? <CatalogBrowser entries={catalogResults} selected={selectedEntry} isDm={isDm} onSelect={setSelectedEntry} />
              : <section className="panel support-empty"><h2>没有匹配资料</h2><p className="empty-state">请调整类别、审校状态或搜索词。</p><button type="button" onClick={clearFilters}>查看全部资料</button></section>
      ) : sessionResults.length > 0 ? (
        <section className="support-entry-grid" aria-label="资料库结果">
          {sessionResults.map((entry) => (
            <article className="panel support-entry" key={entry.id}>
              <div className="support-entry__heading">
                <span className="support-entry__category">{categoryLabels[entry.category]}</span>
                <h2>{entry.title}</h2>
              </div>
              <p className="support-entry__subtitle">{entry.subtitle}</p>
              <p>{entry.detail}</p>
              {entry.tags.length > 0 && (
                <ul className="support-tag-list" aria-label={`${entry.title}标签`}>
                  {[...new Set(entry.tags)].map((tag) => <li key={tag}>{tag}</li>)}
                </ul>
              )}
            </article>
          ))}
        </section>
      ) : (
        <section className="panel support-empty" aria-live="polite">
          <h2>没有匹配资料</h2>
          <p className="empty-state">当前分类中没有包含“{query.trim() || "当前条件"}”的数据。</p>
          <button type="button" onClick={clearFilters}>查看全部资料</button>
        </section>
      )}
    </main>
  );
}

function CatalogBrowser({ entries, selected, isDm, onSelect }: { entries: RuleTextEntry[]; selected?: RuleTextEntry; isDm: boolean; onSelect: (entry: RuleTextEntry) => void }) {
  const visible = entries.slice(0, 160);
  const current = selected && entries.some((entry) => entry.id === selected.id) ? selected : entries[0];
  return (
    <section className="catalog-browser" aria-label="规则文字条目">
      <div className="catalog-browser__list" role="listbox" aria-label="条目列表">
        {visible.map((entry) => (
          <button key={entry.id} type="button" role="option" aria-selected={current?.id === entry.id} className={`catalog-row status-${entry.review.status.toLowerCase()}${current?.id === entry.id ? " selected" : ""}`} onClick={() => onSelect(entry)}>
            <span className="catalog-row__sigil">{entry.kindLabel.slice(0, 1)}</span>
            <span><b>{entry.name}</b><small>{entry.id} · {entry.category}{entry.subCategory ? ` / ${entry.subCategory}` : ""}</small></span>
            <i title={reviewStatusDescription(entry.review.status)}>{reviewStatusLabel(entry.review.status)}</i>
          </button>
        ))}
        {entries.length > visible.length ? <p className="catalog-browser__limit">已显示前 {visible.length} 条，请继续缩小筛选范围。</p> : null}
      </div>
      {current ? <CatalogInspector entry={current} isDm={isDm} /> : null}
    </section>
  );
}

function CatalogInspector({ entry, isDm }: { entry: RuleTextEntry; isDm: boolean }) {
  const sections = entry.sections.filter((section) => section.scope === "player" || isDm);
  return (
    <article className={`catalog-inspector status-${entry.review.status.toLowerCase()}`}>
      <header>
        <div><span>{entry.kindLabel} · {entry.category}{entry.tier ? ` · ${entry.tier}` : ""}</span><h2>{entry.name}</h2><small>{entry.id} · {entry.source.sheet} 第{entry.source.row}行</small></div>
        <strong>{reviewStatusLabel(entry.review.status)}</strong>
      </header>
      <p className="catalog-inspector__summary">{entry.summary || entry.playerText}</p>
      {entry.review.issues.length > 0 ? <section className="catalog-inspector__issues" aria-label="审校问题"><h3>接入限制</h3>{entry.review.issues.map((issue) => <p key={issue.code}><b>{issue.severity === "error" ? "阻断" : "提醒"}</b>{issue.message}</p>)}</section> : <p className="catalog-inspector__safe">文字资料通过自动审计；正式进入角色、敌人或规则主持前仍需制作可执行用法。</p>}
      <section className="catalog-inspector__text"><h3>玩家说明</h3><p>{entry.playerText || "该条目尚无独立玩家说明。"}</p></section>
      <dl className="catalog-inspector__sections">{sections.map((section) => <div key={`${section.label}:${section.value}`}><dt>{section.label}</dt><dd>{section.value}</dd></div>)}</dl>
      {isDm && entry.dmText ? <section className="catalog-inspector__dm"><h3>DM裁定</h3><p>{entry.dmText}</p></section> : null}
      <footer><span>运行支持：仅资料库</span><span>规则口径：2026-07-15 + 文字库 2026-07-16</span></footer>
    </article>
  );
}

export interface PacksPageProps {
  state: CombatState;
  session: AppSession;
  onBack: () => void;
}

/** Installed campaign status and runtime progress. Import is deliberately not advertised until it is executable. */
export function PacksPage({ state, session, onBack }: PacksPageProps) {
  const activePack = getCampaignPack(state.campaign.packId);
  const activeIssues = validateCampaignPack(activePack);
  const counts = useMemo(() => ({
    actors: state.actors.length,
    moves: state.actors.reduce((sum, actor) => sum + actor.moves.length + actor.responses.length, 0),
    innerArts: state.actors.reduce((sum, actor) => sum + actor.innerArts.length, 0),
    statuses: state.actors.reduce(
      (sum, actor) => sum + actor.statuses.length + (actor.hiddenStatuses?.length ?? 0),
      0,
    ),
    inventory: state.actors.reduce((sum, actor) => sum + actor.inventory.length, 0),
    tracks: state.tracks.length,
    dice: state.dice.length,
  }), [state]);

  const savedAt = state.lastSavedAt
    ? new Date(state.lastSavedAt).toLocaleString("zh-CN")
    : "尚无可显示的保存时间";

  return (
    <main className="support-page" aria-labelledby="packs-page-title">
      <header className="support-page__header panel">
        <div>
          <p className="eyebrow">团包与本地数据状态</p>
          <h1 id="packs-page-title">团包管理</h1>
          <p className="hint">当前版本仅展示实际载入的团包状态，不提供尚未落地的导入操作。</p>
        </div>
        <button type="button" onClick={onBack}>返回</button>
      </header>

      <section className="panel support-pack-card" aria-labelledby="active-pack-title">
        <div className="support-pack-card__title">
          <div>
            <span className="support-entry__category">当前团包</span>
            <h2 id="active-pack-title">{state.campaignName || session.room.roomName}</h2>
          </div>
          <strong className="support-active-badge">当前启用</strong>
        </div>
        <p>{state.sceneGoal}</p>
        <dl className="support-detail-list">
          <div><dt>团包标识</dt><dd>{activePack.id}</dd></div>
          <div><dt>版本</dt><dd>{activePack.version} · 规则 {activePack.rulesVersion}{activePack.catalogVersion ? ` · 文字库 ${activePack.catalogVersion}` : ""}</dd></div>
          <div><dt>当前场景</dt><dd>{state.sceneName}</dd></div>
          <div><dt>场景数量</dt><dd>{activePack.scenes.length} 个场景 · {activePack.chapters.length} 个章节</dd></div>
          <div><dt>团档进度</dt><dd>{state.campaign.completedSceneIds.length}/{activePack.scenes.length} 场景 · {state.campaign.completedEventIds.length} 事件 · {state.campaign.earnedRewardIds.length} 奖励</dd></div>
          <div><dt>规则文字库</dt><dd>1004 条版本化资料；异常条目与可执行规则隔离</dd></div>
          <div><dt>数据完整性</dt><dd>{activeIssues.some((issue) => issue.severity === "error") ? `${activeIssues.filter((issue) => issue.severity === "error").length} 项阻断错误` : "结构校验通过"}</dd></div>
          <div><dt>兼容状态</dt><dd>Windows x64 · 当前规则引擎兼容</dd></div>
          <div><dt>房间</dt><dd>{session.room.roomName} · {session.roomCode}</dd></div>
          <div><dt>运行方式</dt><dd>{session.room.mode === "local" ? "本地模式" : session.room.mode}</dd></div>
          <div><dt>保存策略</dt><dd>本地自动保存 · {savedAt}</dd></div>
        </dl>
      </section>

      <section className="panel" aria-labelledby="installed-packs-title">
        <div className="panel-title"><div><p className="eyebrow">正常故事与教学相互隔离</p><h2 id="installed-packs-title">已安装团包</h2></div></div>
        <div className="support-pack-list">
          {CAMPAIGN_PACKS.map(({ pack, kind }) => {
            const issues = validateCampaignPack(pack);
            const errorCount = issues.filter((issue) => issue.severity === "error").length;
            const current = pack.id === state.campaign.packId;
            return (
              <article className={`support-pack-entry${current ? " is-current" : ""}`} key={pack.id}>
                <header><span>{kind === "tutorial" ? "新手教学" : "正常故事"}</span><strong>{pack.name}</strong>{current ? <b>当前团档</b> : null}</header>
                <p>{pack.description}</p>
                <dl><div><dt>章节 / 场景</dt><dd>{pack.chapters.length} / {pack.scenes.length}</dd></div><div><dt>结局</dt><dd>{pack.endings?.length ?? 0}</dd></div><div><dt>校验</dt><dd>{errorCount ? `${errorCount} 项错误` : "通过"}</dd></div></dl>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel" aria-labelledby="pack-data-title">
        <div className="panel-title">
          <h2 id="pack-data-title">已载入数据</h2>
        </div>
        <dl className="support-count-grid">
          <div><dt>角色</dt><dd>{counts.actors}</dd></div>
          <div><dt>招式与响应</dt><dd>{counts.moves}</dd></div>
          <div><dt>内功</dt><dd>{counts.innerArts}</dd></div>
          <div><dt>状态</dt><dd>{counts.statuses}</dd></div>
          <div><dt>装备与物品</dt><dd>{counts.inventory}</dd></div>
          <div><dt>场景轨</dt><dd>{counts.tracks}</dd></div>
          <div><dt>气骰</dt><dd>{counts.dice}</dd></div>
          <div><dt>座位</dt><dd>{session.seats.length}</dd></div>
        </dl>
      </section>
    </main>
  );
}

export interface SettingsPageProps {
  session: AppSession;
  setSession: Dispatch<SetStateAction<AppSession>>;
  onBack: () => void;
  onReset: () => void;
}

/** Session settings backed by the existing AppSession persistence model. */
export function SettingsPage({ session, setSession, onBack, onReset }: SettingsPageProps) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const isDM = session.identity === "dm";

  function setPreference<K extends keyof AppSession["preferences"]>(
    key: K,
    value: AppSession["preferences"][K],
  ) {
    setSession((current) => ({
      ...current,
      preferences: { ...current.preferences, [key]: value },
    }));
  }

  function setAllowSpectators(enabled: boolean) {
    if (!isDM) return;
    setSession((current) => ({
      ...current,
      room: { ...current.room, allowSpectators: enabled },
    }));
  }

  function confirmReset() {
    setConfirmingReset(false);
    onReset();
  }

  return (
    <main className="support-page support-page--settings" aria-labelledby="settings-page-title">
      <header className="support-page__header panel">
        <div>
          <p className="eyebrow">Windows 本机设置</p>
          <h1 id="settings-page-title">设置</h1>
          <p className="hint">当前身份：{identityLabel(session.identity)}。设置保存在本机，不进行云端同步。</p>
        </div>
        <button type="button" onClick={onBack}>返回</button>
      </header>

      <section className="panel support-settings-section" aria-labelledby="player-settings-title">
        <div>
          <h2 id="player-settings-title">玩家</h2>
          <p className="hint">这里仅保存本机公开席位信息，不会显示或修改 DM 隐藏内容。</p>
        </div>
        <label className="support-setting-row">
          <span><strong>本机玩家名称</strong><small>用于单人存档与局域网席位显示。</small></span>
          <input
            value={session.playerName}
            placeholder="输入玩家名称"
            onChange={(event) => setSession((current) => ({ ...current, playerName: event.target.value }))}
          />
        </label>
      </section>

      <section className="panel support-settings-section" aria-labelledby="rule-settings-title">
        <div>
          <h2 id="rule-settings-title">规则处理</h2>
          <p className="hint">决定本机提示与自动结算程度；玩家自己的招式、配骰和响应始终由玩家确认。</p>
        </div>
        <label className="support-setting-row">
          <span><strong>处理程度</strong><small>引导只提示；标准自动处理非玩家角色；完整还会自动推进无争议时点。</small></span>
          <select value={session.preferences.autoRuleLevel} onChange={(event) => setPreference("autoRuleLevel", event.target.value as AppSession["preferences"]["autoRuleLevel"])}>
            <option value="guided">引导</option><option value="standard">标准</option><option value="full">完整</option>
          </select>
        </label>
      </section>

      <section className="panel support-settings-section" aria-labelledby="network-settings-title">
        <div>
          <h2 id="network-settings-title">房间与网络</h2>
          {!isDM && <p className="hint">当前为只读状态；请由房间 DM 调整。</p>}
        </div>
        <label className="check-row support-setting-row">
          <input
            type="checkbox"
            checked={session.room.allowSpectators}
            disabled={!isDM}
            onChange={(event) => setAllowSpectators(event.target.checked)}
          />
          <span><strong>允许旁观</strong><small>控制房间是否接受只读旁观身份；仅 DM 可修改。</small></span>
        </label>
      </section>

      <section className="panel support-settings-section" aria-labelledby="display-settings-title">
        <div><h2 id="display-settings-title">显示</h2><p className="hint">界面缩放独立于Windows显示缩放；F11切换全屏。</p></div>
        <label className="support-setting-row"><span><strong>界面大小</strong><small>适配1366×768至1920×1080。</small></span><select value={session.preferences.uiScale} onChange={(event) => setPreference("uiScale", Number(event.target.value) as AppSession["preferences"]["uiScale"])}><option value="0.9">90%</option><option value="1">100%</option><option value="1.1">110%</option><option value="1.2">120%</option></select></label>
        <button type="button" onClick={() => window.daliangDesktop?.toggleFullScreen()}>切换窗口 / 全屏</button>
      </section>

      <section className="panel support-settings-section" aria-labelledby="motion-settings-title">
        <div><h2 id="motion-settings-title">动画与文字</h2><p className="hint">速度只改变表现，不改变骰面、时点、日志或网络结果。</p></div>
        <label className="support-setting-row"><span><strong>动画速度</strong><small>包括卡牌、目标线、受击和骰子整理。</small></span><select value={session.preferences.animationSpeed} onChange={(event) => setPreference("animationSpeed", Number(event.target.value) as AppSession["preferences"]["animationSpeed"])}><option value="0.5">0.5×</option><option value="1">1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label>
        <label className="support-setting-row"><span><strong>骰子表现</strong><small>2D模式保留相同权威结果。</small></span><select value={session.preferences.dicePresentation} onChange={(event) => setPreference("dicePresentation", event.target.value as AppSession["preferences"]["dicePresentation"])}><option value="full">完整3D</option><option value="fast">快速3D</option><option value="2d">稳定2D</option></select></label>
        <label className="support-setting-row"><span><strong>文本速度</strong><small>控制场景叙述展开速度。</small></span><select value={session.preferences.textSpeed} onChange={(event) => setPreference("textSpeed", event.target.value as AppSession["preferences"]["textSpeed"])}><option value="slow">慢</option><option value="normal">标准</option><option value="fast">快</option></select></label>
      </section>

      <section className="panel support-settings-section" aria-labelledby="sound-settings-title">
        <div><h2 id="sound-settings-title">声音</h2><p className="hint">控制游戏音效、背景音乐与环境音。</p></div>
        <label className="support-setting-row"><span><strong>主音量</strong><small>{Math.round(session.preferences.masterVolume * 100)}%</small></span><input type="range" min="0" max="1" step="0.05" value={session.preferences.masterVolume} onChange={(event) => setPreference("masterVolume", Number(event.target.value))} /></label>
      </section>

      <section className="panel support-settings-section" aria-labelledby="local-settings-title">
        <div>
          <h2 id="local-settings-title">保存</h2>
          <p className="hint">状态变更后自动写入Windows应用数据目录，渲染界面没有任意文件系统权限。</p>
        </div>
        <label className="check-row support-setting-row">
          <input type="checkbox" checked disabled title="Windows 桌面版固定启用" />
          <span><strong>自动保存已启用</strong><small>Windows 桌面版固定启用；当前版本不进行云端同步。</small></span>
        </label>
      </section>

      <section className="panel support-danger-zone" aria-labelledby="reset-title">
        <div>
          <h2 id="reset-title">清除本地存档</h2>
          <p className="hint">将重置本机保存的战斗状态、房间和身份设置。此操作不可撤销。</p>
        </div>
        {!confirmingReset ? (
          <button className="support-danger-button" type="button" onClick={() => setConfirmingReset(true)}>
            清除本地存档…
          </button>
        ) : (
          <div className="support-reset-confirm" role="alertdialog" aria-labelledby="reset-confirm-title" aria-describedby="reset-confirm-detail">
            <strong id="reset-confirm-title">确认清除？</strong>
            <p id="reset-confirm-detail">当前本地进度将立即重置。</p>
            <div className="split-actions">
              <button type="button" autoFocus onClick={() => setConfirmingReset(false)}>取消</button>
              <button className="support-danger-button" type="button" onClick={confirmReset}>确认清除</button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function collectLibraryEntries(state: CombatState): LibraryEntry[] {
  const entries: LibraryEntry[] = [];

  state.actors.forEach((actor) => {
    entries.push({
      id: `actor:${actor.id}`,
      category: "actors",
      title: actor.name,
      subtitle: `${sideLabel(actor.side)} · 气血 ${actor.hp}/${actor.maxHp} · 势 ${actor.momentum}`,
      detail: actor.publicNote || "当前角色没有公开说明。",
      tags: [actor.side, actor.momentum, ...actor.statuses.map((status) => status.name)],
    });

    actor.moves.forEach((move) => {
      entries.push({
        id: `move:${actor.id}:${move.id}`,
        category: "moves",
        title: move.name,
        subtitle: `${actor.name} · ${move.category}/${move.subCategory || "通用"} · ${move.timing}`,
        detail: move.baseEffect || "当前招式没有基础效果说明。",
        tags: [move.tier, move.formPosition, move.yinYangLabel, move.targetRange, move.qiNatureThreshold],
      });
    });

    actor.responses.forEach((response) => {
      entries.push({
        id: `response:${actor.id}:${response.id}`,
        category: "moves",
        title: response.moveName,
        subtitle: `${actor.name} · ${response.responseType} · ${response.timing}`,
        detail: response.baseEffect || response.constraints || "当前响应没有效果说明。",
        tags: ["响应", response.responseType, response.qiNatureThreshold, response.equipPermission],
      });
    });

    actor.innerArts.forEach((innerArt) => {
      entries.push({
        id: `inner-art:${actor.id}:${innerArt.id}`,
        category: "innerArts",
        title: innerArt.name,
        subtitle: `${actor.name} · ${innerArt.tier} · ${innerArt.currentLevel}/${innerArt.maxLevel}重`,
        detail: innerArt.passive || "当前内功没有被动说明。",
        tags: [...innerArt.occupiedAcupoints, ...innerArt.readRoots],
      });
    });

    [...actor.statuses, ...(actor.hiddenStatuses ?? [])].forEach((status) => {
      entries.push({
        id: `status:${actor.id}:${status.public ? "public" : "hidden"}:${status.id}`,
        category: "statuses",
        title: status.name,
        subtitle: `${actor.name} · ${status.layers}层 · 来源：${status.source}`,
        detail: status.effects.join("；") || status.decayRule || "当前状态没有效果说明。",
        tags: [status.public ? "公开" : "隐藏", ...(status.removalEntries ?? [])],
      });
    });

    actor.inventory.forEach((item) => {
      entries.push({
        id: `inventory:${actor.id}:${item.id}`,
        category: "inventory",
        title: item.name,
        subtitle: `${actor.name} · ${inventoryLabels[item.category]} · 数量 ${item.quantity}${item.equipped ? " · 已装备" : ""}`,
        detail: item.publicNote || "当前物品没有公开说明。",
        tags: [inventoryLabels[item.category], item.equipped ? "已装备" : "未装备", item.grantsPermission ?? ""].filter(Boolean),
      });
    });
  });

  state.tracks.forEach((track) => {
    entries.push({
      id: `track:${track.id}`,
      category: "tracks",
      title: track.name,
      subtitle: `${track.value}/${track.max}${track.hidden ? " · 隐藏轨" : " · 公开轨"}`,
      detail: track.description || "当前场景轨没有说明。",
      tags: [state.sceneName, track.hidden ? "隐藏" : "公开"],
    });
  });

  return entries;
}

function sideLabel(side: CombatState["actors"][number]["side"]): string {
  if (side === "player") return "玩家角色";
  if (side === "pressure") return "场景压力";
  return "敌方角色";
}

function identityLabel(identity: AppSession["identity"]): string {
  if (identity === "dm") return "DM";
  if (identity === "player") return "玩家";
  if (identity === "spectator") return "旁观者";
  return "未入席";
}
