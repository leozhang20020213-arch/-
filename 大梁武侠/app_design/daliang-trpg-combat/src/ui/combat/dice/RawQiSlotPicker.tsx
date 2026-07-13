import type { FC, KeyboardEvent } from "react";
import type { QiDie } from "../../../combat/types";
import { shortQiSourceName } from "./dicePresentation";

export interface RawQiSlotPickerProps {
  die: QiDie;
  onChoose: (slot: "yin" | "yang") => void;
  onCancel: () => void;
}

/** Explicit slot decision required when a raw die is activated without dragging. */
export const RawQiSlotPicker: FC<RawQiSlotPickerProps> = ({
  die,
  onChoose,
  onCancel,
}) => {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  }

  const dieLabel = `原始骰 D${die.sides}，点数${die.value ?? "未投"}`;

  return (
    <div
      className="raw-qi-slot-picker"
      role="dialog"
      aria-modal="false"
      aria-label={`为${dieLabel}选择投入槽位`}
      onKeyDown={handleKeyDown}
    >
      <div className="raw-qi-slot-picker-summary">
        <strong>{dieLabel}</strong>
        <span className="raw-qi-slot-picker-source">来源：{shortQiSourceName(die.sourceName)}</span>
      </div>
      <div className="raw-qi-slot-picker-actions">
        <button
          className="raw-qi-slot-choice yin-choice"
          type="button"
          autoFocus
          onClick={() => onChoose("yin")}
        >
          投入阴槽
        </button>
        <button
          className="raw-qi-slot-choice yang-choice"
          type="button"
          onClick={() => onChoose("yang")}
        >
          投入阳槽
        </button>
        <button
          className="raw-qi-slot-cancel"
          type="button"
          onClick={onCancel}
        >
          取消
        </button>
      </div>
    </div>
  );
};
