import type { DistanceRelation, Move, QiDie, QiNature, ResponseAttachment, SixRoots } from "../../combat/types";

export const CHARACTER_CREATION_LIMITS = {
  rootTotal: 24,
  rootMinimum: 1,
  rootMaximum: 6,
  minimumMoves: 3,
  maximumMoves: 5,
  minimumStarterDice: 5,
  maximumStarterDice: 8,
} as const;

export interface StarterQiSource {
  label: string;
  nature: QiNature;
  sides: number;
  count: number;
}

export interface CharacterCreationIssue {
  code: "ROOT_TOTAL" | "ROOT_RANGE" | "MOVE_COUNT" | "MISSING_EXTERNAL" | "MISSING_SCENE" | "MISSING_RESPONSE" | "QI_COUNT";
  message: string;
}

export function countStarterDice(sources: StarterQiSource[]): number {
  return sources.reduce((total, source) => total + Math.max(0, Math.floor(source.count)), 0);
}

export function responsesForMoveIds(
  moveIds: string[],
  responseCatalog: ResponseAttachment[],
): ResponseAttachment[] {
  const selected = new Set(moveIds);
  return responseCatalog.filter((response) => selected.has(response.moveId)).map((response) => structuredClone(response));
}

export function validateCharacterCreation(input: {
  roots: SixRoots;
  moves: Move[];
  responses: ResponseAttachment[];
  starterQi: StarterQiSource[];
}): CharacterCreationIssue[] {
  const issues: CharacterCreationIssue[] = [];
  const rootValues = Object.values(input.roots);
  const total = rootValues.reduce((sum, value) => sum + value, 0);
  if (total !== CHARACTER_CREATION_LIMITS.rootTotal) {
    issues.push({ code: "ROOT_TOTAL", message: `六根合计必须为${CHARACTER_CREATION_LIMITS.rootTotal}点。` });
  }
  if (rootValues.some((value) => !Number.isInteger(value) || value < CHARACTER_CREATION_LIMITS.rootMinimum || value > CHARACTER_CREATION_LIMITS.rootMaximum)) {
    issues.push({ code: "ROOT_RANGE", message: `每根开局必须为${CHARACTER_CREATION_LIMITS.rootMinimum}至${CHARACTER_CREATION_LIMITS.rootMaximum}的整数。` });
  }
  if (input.moves.length < CHARACTER_CREATION_LIMITS.minimumMoves || input.moves.length > CHARACTER_CREATION_LIMITS.maximumMoves) {
    issues.push({ code: "MOVE_COUNT", message: `初始武艺应选择${CHARACTER_CREATION_LIMITS.minimumMoves}至${CHARACTER_CREATION_LIMITS.maximumMoves}条。` });
  }
  if (!input.moves.some((move) => move.category === "外功")) {
    issues.push({ code: "MISSING_EXTERNAL", message: "至少选择一条可自保的外功。" });
  }
  if (!input.moves.some((move) => move.category === "法门")) {
    issues.push({ code: "MISSING_SCENE", message: "至少选择一条能处理情景的法门。" });
  }
  if (input.responses.length === 0) {
    issues.push({ code: "MISSING_RESPONSE", message: "至少选择一条带明确截击或应招挂载的武艺。" });
  }
  const starterDice = countStarterDice(input.starterQi);
  if (starterDice < CHARACTER_CREATION_LIMITS.minimumStarterDice || starterDice > CHARACTER_CREATION_LIMITS.maximumStarterDice) {
    issues.push({ code: "QI_COUNT", message: `新手常规气骰应为${CHARACTER_CREATION_LIMITS.minimumStarterDice}至${CHARACTER_CREATION_LIMITS.maximumStarterDice}枚，当前为${starterDice}枚。` });
  }
  return issues;
}

export function createStarterQiDice(
  actorId: string,
  actorName: string,
  sources: StarterQiSource[],
): QiDie[] {
  const dice: QiDie[] = [];
  sources.forEach((source, sourceIndex) => {
    const count = Math.max(0, Math.floor(source.count));
    for (let index = 0; index < count; index += 1) {
      dice.push({
        id: `${actorId}-starter-${sourceIndex + 1}-${index + 1}`,
        label: `d${source.sides}`,
        sourceId: `${actorId}:${source.label}`,
        sourceName: `${actorName}·${source.label}`,
        nature: source.nature,
        sides: source.sides,
        value: null,
        zone: "QI_POOL",
        ownerId: actorId,
      });
    }
  });
  return dice;
}

/**
 * A new player takes the authored protagonist's place on the current abstract
 * distance graph. This is a runtime adapter, not a new distance rule.
 */
export function cloneDistanceRelationsForActor(
  actorId: string,
  templateActorId: string,
  relations: DistanceRelation[],
): DistanceRelation[] {
  return relations
    .filter((relation) => relation.fromActorId === templateActorId || relation.toActorId === templateActorId)
    .map((relation) => {
      const fromActorId = relation.fromActorId === templateActorId ? actorId : relation.fromActorId;
      const toActorId = relation.toActorId === templateActorId ? actorId : relation.toActorId;
      return {
        ...structuredClone(relation),
        id: `dist-${actorId}-${fromActorId === actorId ? toActorId : fromActorId}`,
        fromActorId,
        toActorId,
      };
    })
    .filter((relation) => relation.fromActorId !== relation.toActorId);
}
