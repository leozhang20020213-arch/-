import { useEffect, useId, useRef } from "react";
import * as Phaser from "phaser";
import { CombatBoardScene, type CombatBoardSnapshot } from "./combatScene";

export function PhaserCombatBoard({
  snapshot,
  onSelectUnit,
}: {
  snapshot: CombatBoardSnapshot;
  onSelectUnit: (id: string) => void;
}) {
  const id = useId().replaceAll(":", "-");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const scene = new CombatBoardScene(snapshot, onSelectUnit);
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: 760,
      height: 380,
      backgroundColor: "#f6ecdc",
      scene,
      transparent: true,
      scale: {
        mode: Phaser.Scale.RESIZE,
        parent: containerRef.current,
        width: "100%",
        height: "100%",
      },
    });
    return () => {
      game.destroy(true);
    };
  }, [id, onSelectUnit, snapshot]);

  return <div className="phaser-board" ref={containerRef} data-testid="phaser-combat-board" />;
}
