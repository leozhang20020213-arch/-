import { useId, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  AppSession,
  CombatState,
  InventoryCategory,
} from "../../combat/types";

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

export interface LibraryPageProps {
  state: CombatState;
  onBack: () => void;
}

/** Searchable view over the rule data already loaded into CombatState. */
export function LibraryPage({ state, onBack }: LibraryPageProps) {
  const searchId = useId();
  const categoryId = useId();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<LibraryCategory>("all");

  const entries = useMemo(() => collectLibraryEntries(state), [state]);
  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(
      Object.keys(categoryLabels).map((key) => [key, 0]),
    ) as Record<LibraryCategory, number>;
    counts.all = entries.length;
    entries.forEach((entry) => {
      counts[entry.category] += 1;
    });
    return counts;
  }, [entries]);

  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
  const results = entries.filter((entry) => {
    if (category !== "all" && entry.category !== category) return false;
    if (!normalizedQuery) return true;
    return [entry.title, entry.subtitle, entry.detail, ...entry.tags]
      .join(" ")
      .toLocaleLowerCase("zh-CN")
      .includes(normalizedQuery);
  });

  function clearFilters() {
    setQuery("");
    setCategory("all");
  }

  return (
    <main className="support-page" aria-labelledby="library-page-title">
      <header className="support-page__header panel">
        <div>
          <p className="eyebrow">当前团包 · 已载入规则数据</p>
          <h1 id="library-page-title">资料库</h1>
          <p className="hint">检索当前会话实际载入的角色、招式、内功、状态、物品与场景轨。</p>
        </div>
        <button type="button" onClick={onBack}>返回</button>
      </header>

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
          <select
            id={categoryId}
            value={category}
            onChange={(event) => setCategory(event.target.value as LibraryCategory)}
          >
            {(Object.keys(categoryLabels) as LibraryCategory[]).map((key) => (
              <option key={key} value={key}>
                {categoryLabels[key]}（{categoryCounts[key]}）
              </option>
            ))}
          </select>
        </label>
        <div className="support-toolbar__summary" aria-live="polite" aria-atomic="true">
          <span className="identity-pill">{results.length} 条结果</span>
          {(query || category !== "all") && (
            <button type="button" onClick={clearFilters}>清除筛选</button>
          )}
        </div>
      </section>

      {results.length > 0 ? (
        <section className="support-entry-grid" aria-label="资料库结果">
          {results.map((entry) => (
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

export interface PacksPageProps {
  state: CombatState;
  session: AppSession;
  onBack: () => void;
}

/** Read-only campaign pack status. It intentionally does not advertise import support. */
export function PacksPage({ state, session, onBack }: PacksPageProps) {
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
          <div><dt>团包标识</dt><dd>{session.room.campaignId || "未声明"}</dd></div>
          <div><dt>版本</dt><dd>未声明（当前数据未提供版本元数据）</dd></div>
          <div><dt>当前场景</dt><dd>{state.sceneName}</dd></div>
          <div><dt>房间</dt><dd>{session.room.roomName} · {session.roomCode}</dd></div>
          <div><dt>运行方式</dt><dd>{session.room.mode === "local" ? "本地模式" : session.room.mode}</dd></div>
          <div><dt>保存策略</dt><dd>本地自动保存 · {savedAt}</dd></div>
        </dl>
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
  const canUseAutoDm = session.room.mode === "local" && (session.identity === "dm" || session.identity === "player");

  function setDeveloperMode(enabled: boolean) {
    if (!isDM) return;
    setSession((current) => ({ ...current, developerMode: enabled }));
  }

  function setAllowSpectators(enabled: boolean) {
    if (!isDM) return;
    setSession((current) => ({
      ...current,
      room: { ...current.room, allowSpectators: enabled },
    }));
  }

  function setAutoDm(enabled: boolean) {
    if (!canUseAutoDm) return;
    setSession((current) => ({ ...current, autoDmEnabled: enabled }));
  }

  function confirmReset() {
    setConfirmingReset(false);
    onReset();
  }

  return (
    <main className="support-page" aria-labelledby="settings-page-title">
      <header className="support-page__header panel">
        <div>
          <p className="eyebrow">本地会话与主持权限</p>
          <h1 id="settings-page-title">设置</h1>
          <p className="hint">当前身份：{identityLabel(session.identity)}。主持设置只允许 DM 修改。</p>
        </div>
        <button type="button" onClick={onBack}>返回</button>
      </header>

      <section className="panel support-settings-section" aria-labelledby="host-settings-title">
        <div>
          <h2 id="host-settings-title">主持设置</h2>
          {!isDM && <p className="hint">当前为只读状态；请由房间 DM 调整。</p>}
        </div>
        <label className="check-row support-setting-row">
          <input
            type="checkbox"
            checked={session.developerMode}
            disabled={!isDM}
            onChange={(event) => setDeveloperMode(event.target.checked)}
          />
          <span><strong>开发模式</strong><small>显示本地调试入口；仅 DM 可修改。</small></span>
        </label>
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

      <section className="panel support-settings-section" aria-labelledby="test-settings-title">
        <div>
          <h2 id="test-settings-title">单人流程测试</h2>
          <p className="hint">自动 DM 只处理敌方响应、落果和轮末推进；不会替玩家选招、配骰，也不会公开隐藏资料。</p>
        </div>
        <label className="check-row support-setting-row">
          <input
            type="checkbox"
            checked={session.autoDmEnabled}
            disabled={!canUseAutoDm}
            onChange={(event) => setAutoDm(event.target.checked)}
          />
          <span><strong>测试自动 DM</strong><small>仅限本地房间。玩家仍完整操作自己的宣言、截击与应招。</small></span>
        </label>
      </section>

      <section className="panel support-settings-section" aria-labelledby="local-settings-title">
        <div>
          <h2 id="local-settings-title">本地保存</h2>
          <p className="hint">战斗状态与会话设置变更后会自动写入本地浏览器存储。</p>
        </div>
        <label className="check-row support-setting-row">
          <input type="checkbox" checked readOnly aria-readonly="true" />
          <span><strong>自动保存已启用</strong><small>当前版本固定启用，暂无云端同步。</small></span>
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
