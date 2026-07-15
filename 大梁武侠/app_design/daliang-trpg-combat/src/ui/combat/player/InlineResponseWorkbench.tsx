import { useEffect, useMemo, useState } from "react";
import type { Actor, CombatState, ResponseAttachment } from "../../../combat/types";
import { canSpendResponseBudget, normalizeResponseBudget } from "../../../domain/session/runtime";
import { QiDie } from "../dice/QiDie";
import { RawQiSlotPicker } from "../dice/RawQiSlotPicker";
import { sortQiDiceForPool } from "../dice/dicePresentation";

export interface InlineResponseWorkbenchProps {
  state: CombatState;
  actor: Actor;
  readOnly?: boolean;
  onSubmit: (
    responseId: string,
    diceIds: string[],
    slots: { yinSlotDiceIds: string[]; yangSlotDiceIds: string[] },
  ) => void;
  onSkip: () => void;
}

/**
 * Response handling stays inside the normal hand-and-qi workbench. The combat
 * board never disappears and no modal/right-side response console is created.
 */
export function InlineResponseWorkbench({
  state,
  actor,
  readOnly = false,
  onSubmit,
  onSkip,
}: InlineResponseWorkbenchProps) {
  const responseType = state.phase === "intercept_window"
    ? "截击"
    : state.phase === "react_window"
      ? "应招"
      : undefined;
  const responses = useMemo(
    () => actor.responses.filter((response) => response.responseType === responseType),
    [actor.responses, responseType],
  );
  const availableDice = useMemo(
    () => sortQiDiceForPool(state.dice.filter((die) =>
      die.ownerId === actor.id && (die.zone === "QI_SEA" || die.zone === "TEMP_QI"))),
    [actor.id, state.dice],
  );
  const [selectedResponseId, setSelectedResponseId] = useState("");
  const [yinSlotDiceIds, setYinSlotDiceIds] = useState<string[]>([]);
  const [yangSlotDiceIds, setYangSlotDiceIds] = useState<string[]>([]);
  const [rawChoiceDieId, setRawChoiceDieId] = useState<string | null>(null);
  const selectedDiceIds = [...yinSlotDiceIds, ...yangSlotDiceIds];
  const budget = normalizeResponseBudget(actor.responseBudget, actor.responseQuotaUsed, actor.maxResponseQuota);

  useEffect(() => {
    setSelectedResponseId(responses[0]?.id ?? "");
    setYinSlotDiceIds([]);
    setYangSlotDiceIds([]);
    setRawChoiceDieId(null);
  }, [responseType, state.pendingAction?.actorId, state.pendingAction?.moveId, responses]);

  if (
    !responseType
    || state.pendingAction?.targetId !== actor.id
    || state.pendingAction.actorId === actor.id
  ) return null;

  const selectedResponse = responses.find((response) => response.id === selectedResponseId);
  const minimum = selectedResponse ? Math.max(0, Math.ceil(selectedResponse.minDice)) : 0;
  const canSubmit = Boolean(selectedResponse)
    && selectedDiceIds.length >= minimum
    && canSpendResponseBudget(budget, "self_defense")
    && !readOnly;

  function toggleDie(dieId: string) {
    if (readOnly) return;
    const die = availableDice.find((item) => item.id === dieId);
    if (!die) return;
    if (selectedDiceIds.includes(dieId)) {
      setYinSlotDiceIds((current) => current.filter((id) => id !== dieId));
      setYangSlotDiceIds((current) => current.filter((id) => id !== dieId));
      return;
    }
    if (die.nature === "raw") {
      setRawChoiceDieId(die.id);
      return;
    }
    if (die.nature === "yin") setYinSlotDiceIds((current) => [...current, die.id]);
    else setYangSlotDiceIds((current) => [...current, die.id]);
  }

  const rawChoiceDie = rawChoiceDieId
    ? availableDice.find((die) => die.id === rawChoiceDieId)
    : undefined;

  function assignRawDie(slot: "yin" | "yang") {
    const dieId = rawChoiceDieId;
    setRawChoiceDieId(null);
    if (!dieId) return;
    if (slot === "yin") setYinSlotDiceIds((current) => [...current, dieId]);
    else setYangSlotDiceIds((current) => [...current, dieId]);
  }

  return (
    <section className="inline-response-workbench" aria-labelledby="inline-response-title">
      <header className="inline-response-heading">
        <div>
          <p className="eyebrow">{responseType}时点 · 棋盘保持可见</p>
          <h2 id="inline-response-title">选择响应牌并双击气骰</h2>
        </div>
        <div className="response-budget-pills" aria-label="响应额度">
          <span>主动 {budget.proactiveUsed}/{budget.maxProactive}</span>
          <span>自保 {budget.selfDefenseUsed}/{budget.maxSelfDefense}</span>
        </div>
      </header>

      <div className="inline-response-body">
        <div className="inline-response-hand" role="radiogroup" aria-label={`${responseType}手牌`}>
          {responses.length ? responses.map((response) => (
            <ResponseCard
              key={response.id}
              response={response}
              selected={response.id === selectedResponseId}
              disabled={readOnly}
              onSelect={() => {
                setSelectedResponseId(response.id);
                setYinSlotDiceIds([]);
                setYangSlotDiceIds([]);
                setRawChoiceDieId(null);
              }}
            />
          )) : <p className="response-empty">没有合法{responseType}牌，可直接放弃响应。</p>}
        </div>

        <div className="inline-response-qi">
          <div className="response-dice-summary">
            <strong>气海</strong><span>已投入 {selectedDiceIds.length}/{minimum}</span>
          </div>
          <div className="response-dice-grid">
            {availableDice.map((die) => (
              <QiDie
                key={die.id}
                die={die}
                isAssigned={selectedDiceIds.includes(die.id)}
                draggable={false}
                onDragStart={() => undefined}
                onClick={toggleDie}
              />
            ))}
          </div>
          <div className="response-slot-summary">
            <span>阴槽 {yinSlotDiceIds.length}枚 · {sumDice(yinSlotDiceIds, availableDice)}点</span>
            <span>阳槽 {yangSlotDiceIds.length}枚 · {sumDice(yangSlotDiceIds, availableDice)}点</span>
          </div>
          {rawChoiceDie ? (
            <RawQiSlotPicker die={rawChoiceDie} onChoose={assignRawDie} onCancel={() => setRawChoiceDieId(null)} />
          ) : null}
        </div>
      </div>

      <footer className="inline-response-actions">
        <p>{selectedResponse?.baseEffect ?? "放弃不会消耗响应额度。"}</p>
        <button type="button" disabled={readOnly} onClick={onSkip}>放弃响应</button>
        <button
          className="primary-action"
          type="button"
          disabled={!canSubmit}
          onClick={() => selectedResponse && onSubmit(selectedResponse.id, selectedDiceIds, {
            yinSlotDiceIds,
            yangSlotDiceIds,
          })}
        >采用{responseType}</button>
      </footer>
    </section>
  );
}

function sumDice(ids: string[], dice: CombatState["dice"]) {
  return ids.reduce((sum, id) => sum + (dice.find((die) => die.id === id)?.value ?? 0), 0);
}

function ResponseCard({
  response,
  selected,
  disabled,
  onSelect,
}: {
  response: ResponseAttachment;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`action-card response-hand-card${selected ? " selected" : ""}`}
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      data-tooltip={`${response.timing}\n${response.constraints}\n${response.baseEffect}`}
      onClick={onSelect}
    >
      <span className="card-cost">{response.minDice}</span>
      <span className="card-art"><i>{response.responseType === "截击" ? "截" : "应"}</i></span>
      <span className="card-name">{response.moveName}</span>
      <span className="card-type">{response.responseType}挂载</span>
      <span className="card-effect">{response.baseEffect}</span>
      <span className="card-reqs"><b>{response.qiNatureThreshold}</b><b>{response.allowedShi.join("/") || "不限势"}</b></span>
    </button>
  );
}
