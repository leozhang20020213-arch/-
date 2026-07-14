import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import type { QiDie as QiDieType } from "../../../combat/types";
import { createSeedState } from "../../../data/seed";
import { QiDiceDock } from "./QiDiceDock";
import { QiDie } from "./QiDie";
import { QiPool } from "./QiPool";
import { RawQiSlotPicker } from "./RawQiSlotPicker";

function makeDie(overrides: Partial<QiDieType> = {}): QiDieType {
  return {
    id: "die-default",
    label: "d6",
    sourceId: "source-default",
    sourceName: "沈青·小周天养息功·顶门",
    nature: "raw",
    sides: 6,
    value: 3,
    zone: "QI_SEA",
    ownerId: "pc-shen-qing",
    ...overrides,
  };
}

type InspectableProps = {
  children?: ReactNode;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onKeyDown?: (event: { key: string; preventDefault: () => void }) => void;
  autoFocus?: boolean;
};

function findElements(node: ReactNode, type: string): Array<ReactElement<InspectableProps>> {
  if (!isValidElement<InspectableProps>(node)) return [];
  const current = node.type === type ? [node] : [];
  return [
    ...current,
    ...Children.toArray(node.props.children).flatMap((child) => findElements(child, type)),
  ];
}

describe("QiDie", () => {
  it("shows a permanent short source and keeps the full source in aria-label", () => {
    const sourceName = "沈青·一段非常完整且不可截断的来源名称·目窍";
    const html = renderToStaticMarkup(
      <QiDie
        die={makeDie({ sourceName, nature: "yin", sides: 8, value: 7 })}
        isAssigned={false}
        draggable
        onDragStart={() => {}}
        onClick={() => {}}
      />,
    );

    assert.match(html, /class="qi-die-source"/);
    assert.match(html, /一段非常完整…·目窍/);
    assert.match(html, new RegExp(`aria-label="[^"]*${sourceName}[^"]*"`));
  });

  it("uses double-click and Enter for the same reversible assignment", () => {
    const events: string[] = [];
    const tree = QiDie({
      die: makeDie({ id: "activation-die", nature: "yang" }),
      isAssigned: false,
      draggable: false,
      onDragStart: () => {},
      onClick: (id) => events.push(id),
    }) as ReactElement<InspectableProps>;

    tree.props.onDoubleClick?.();
    let prevented = false;
    tree.props.onKeyDown?.({
      key: "Enter",
      preventDefault: () => { prevented = true; },
    });
    assert.deepEqual(events, ["activation-die", "activation-die"]);
    assert.equal(prevented, true);
    assert.equal(tree.props.onClick, undefined);
  });
});

describe("QiPool", () => {
  it("renders cards in the stable presentation order", () => {
    const dice = [
      makeDie({ id: "raw-d4", sides: 4, nature: "raw", value: 4 }),
      makeDie({ id: "yin-d6", sides: 6, nature: "yin", value: 6 }),
      makeDie({ id: "yang-d4", sides: 4, nature: "yang", value: 4 }),
      makeDie({ id: "yin-d4", sides: 4, nature: "yin", value: 2 }),
    ];
    const html = renderToStaticMarkup(
      <QiPool
        dice={dice}
        assignedIds={new Set()}
        canDrag
        onDragStart={() => {}}
        onClickDie={() => {}}
      />,
    );
    const positions = ["yin-d4", "yang-d4", "raw-d4", "yin-d6"]
      .map((id) => html.indexOf(`data-qi-die-id="${id}"`));

    assert.ok(positions.every((position) => position >= 0));
    assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  });
});

describe("RawQiSlotPicker", () => {
  it("exposes focusable yin, yang, and cancel choices and dispatches each choice", () => {
    const events: string[] = [];
    const tree = RawQiSlotPicker({
      die: makeDie({ nature: "raw" }),
      onChoose: (slot) => events.push(slot),
      onCancel: () => events.push("cancel"),
    }) as ReactElement<InspectableProps>;
    const buttons = findElements(tree, "button");

    assert.equal(buttons.length, 3);
    assert.equal(buttons[0].props.autoFocus, true);
    buttons[0].props.onClick?.();
    buttons[1].props.onClick?.();
    buttons[2].props.onClick?.();
    assert.deepEqual(events, ["yin", "yang", "cancel"]);

    let prevented = false;
    tree.props.onKeyDown?.({
      key: "Escape",
      preventDefault: () => { prevented = true; },
    });
    assert.equal(prevented, true);
    assert.equal(events.at(-1), "cancel");

    const html = renderToStaticMarkup(tree);
    assert.match(html, /role="dialog"/);
    assert.match(html, /投入阴槽/);
    assert.match(html, /投入阳槽/);
    assert.match(html, />取消</);
  });
});

describe("QiDiceDock read-only declaration mode", () => {
  it("does not render the raw slot picker when declarationEnabled is false", () => {
    const state = { ...createSeedState(), phase: "scene" as const };
    const rawDie = makeDie({ ownerId: state.activeActorId, nature: "raw" });
    const html = renderToStaticMarkup(
      <QiDiceDock
        state={state}
        actorDice={[rawDie]}
        selectedMove={undefined}
        hasSelectedTarget={false}
        yinSlotIds={[]}
        yangSlotIds={[]}
        onAssignDie={() => true}
        onRemoveDie={() => {}}
        onConfirm={() => {}}
        declarationEnabled={false}
      />,
    );

    assert.match(html, /qi-basic-action-mode/);
    assert.doesNotMatch(html, /raw-qi-slot-picker/);
    assert.doesNotMatch(html, /确认宣言并锁气/);
  });
});
