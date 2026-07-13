import { useEffect, useMemo, useState } from "react";
import type { Actor, CombatState, ResponseAttachment } from "../../../combat/types";
import { QiDie } from "../dice/QiDie";
import { RawQiSlotPicker } from "../dice/RawQiSlotPicker";
import { sortQiDiceForPool } from "../dice/dicePresentation";

export interface PlayerResponseWorkbenchProps {
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

export function PlayerResponseWorkbench({
  state,
  actor,
  readOnly = false,
  onSubmit,
  onSkip,
}: PlayerResponseWorkbenchProps) {
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

  useEffect(() => {
    setSelectedResponseId(responses[0]?.id ?? "");
    setYinSlotDiceIds([]);
    setYangSlotDiceIds([]);
    setRawChoiceDieId(null);
  }, [responseType, state.pendingAction?.actorId, state.pendingAction?.moveId, responses]);

  if (!responseType || state.pendingAction?.targetId !== actor.id) return null;

  const selectedResponse = responses.find((response) => response.id === selectedResponseId);
  const minimum = selectedResponse ? Math.max(0, Math.ceil(selectedResponse.minDice)) : 0;
  const canSubmit = Boolean(selectedResponse)
    && selectedDiceIds.length >= minimum
    && actor.responseQuotaUsed < actor.maxResponseQuota
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
    <section className="panel player-response-workbench" aria-labelledby="player-response-title">
      <div className="response-workbench__heading">
        <div>
          <p className="eyebrow">受招决策 · {responseType}窗口</p>
          <h2 id="player-response-title">由你决定如何响应</h2>
        </div>
        <span className="response-quota">
          额度 {actor.responseQuotaUsed}/{actor.maxResponseQuota}
        </span>
      </div>

      {responses.length > 0 ? (
        <div className="response-option-list" role="radiogroup" aria-label={`${responseType}招式`}>
          {responses.map((response) => (
            <ResponseOption
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
          ))}
        </div>
      ) : (
        <p className="response-empty">当前角色没有可用的{responseType}挂载，可以直接放弃。</p>
      )}

      <div className="response-dice-section">
        <div className="response-dice-summary">
          <strong>投入气骰</strong>
          <span>{selectedDiceIds.length}/{minimum} 枚</span>
        </div>
        {availableDice.length > 0 ? (
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
        ) : (
          <p className="response-empty">气海与临气区没有可投入的气骰。</p>
        )}
        <div className="response-slot-summary" aria-label="响应阴阳槽配置">
          <span>阴槽 {yinSlotDiceIds.length}枚 · {yinSlotDiceIds.reduce((sum, id) => sum + (availableDice.find((die) => die.id === id)?.value ?? 0), 0)}点</span>
          <span>阳槽 {yangSlotDiceIds.length}枚 · {yangSlotDiceIds.reduce((sum, id) => sum + (availableDice.find((die) => die.id === id)?.value ?? 0), 0)}点</span>
        </div>
        {rawChoiceDie ? (
          <RawQiSlotPicker
            die={rawChoiceDie}
            onChoose={assignRawDie}
            onCancel={() => setRawChoiceDieId(null)}
          />
        ) : null}
      </div>

      {selectedResponse ? (
        <div className="response-rule-summary">
          <span>气性：{selectedResponse.qiNatureThreshold}</span>
          <span>势：{selectedResponse.allowedShi.join("、") || "不限"}</span>
          <span>效果：{selectedResponse.baseEffect}</span>
        </div>
      ) : null}

      <div className="response-workbench__actions">
        <button type="button" disabled={readOnly} onClick={onSkip}>放弃{responseType}</button>
        <button
          className="primary-action"
          type="button"
          disabled={!canSubmit}
          onClick={() => selectedResponse && onSubmit(selectedResponse.id, selectedDiceIds, {
            yinSlotDiceIds,
            yangSlotDiceIds,
          })}
        >
          确认{responseType}
        </button>
      </div>
    </section>
  );
}

function ResponseOption({
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
      className={`response-option${selected ? " is-selected" : ""}`}
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
    >
      <span className="response-option__topline">
        <strong>{response.moveName}</strong>
        <span>至少 {response.minDice} 枚</span>
      </span>
      <span>{response.constraints || response.timing}</span>
    </button>
  );
}
