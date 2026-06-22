import * as Phaser from "phaser";

export interface CombatBoardUnit {
  id: string;
  name: string;
  side: "player" | "enemy" | "pressure";
  hp: number;
  maxHp: number;
  momentum: string;
  statuses: string[];
}

export interface CombatBoardDistance {
  id: string;
  fromActorId: string;
  toActorId: string;
  band: string;
  entangled?: boolean;
}

export interface CombatBoardSnapshot {
  sceneName: string;
  units: CombatBoardUnit[];
  distances: CombatBoardDistance[];
  pendingLabel?: string;
}

export class CombatBoardScene extends Phaser.Scene {
  private snapshot: CombatBoardSnapshot;
  private onSelectUnit: (id: string) => void;

  constructor(snapshot: CombatBoardSnapshot, onSelectUnit: (id: string) => void) {
    super("CombatBoardScene");
    this.snapshot = snapshot;
    this.onSelectUnit = onSelectUnit;
  }

  create(): void {
    this.renderBoard();
  }

  private renderBoard(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const players = this.snapshot.units.filter((unit) => unit.side === "player");
    const enemies = this.snapshot.units.filter((unit) => unit.side !== "player");
    const positions = new Map<string, Phaser.Math.Vector2>();

    this.add.rectangle(centerX, centerY, width - 18, height - 18, 0xf7eddb, 0.86).setStrokeStyle(2, 0x8c6a41, 0.75);
    this.add.circle(centerX, centerY, Math.min(width, height) * 0.22, 0x3c2a1c, 0.08).setStrokeStyle(3, 0x3c2a1c, 0.2);
    this.add.text(centerX, 26, this.snapshot.sceneName, { color: "#2b2118", fontFamily: "Microsoft YaHei", fontSize: "18px", fontStyle: "bold" }).setOrigin(0.5, 0);

    players.forEach((unit, index) => {
      const point = new Phaser.Math.Vector2(width * 0.24, 118 + index * 108);
      positions.set(unit.id, point);
      this.drawUnit(unit, point, 0x245c3a);
    });

    enemies.forEach((unit, index) => {
      const point = new Phaser.Math.Vector2(width * 0.76, 118 + index * 108);
      positions.set(unit.id, point);
      this.drawUnit(unit, point, 0x6b2d24);
    });

    for (const distance of this.snapshot.distances) {
      const from = positions.get(distance.fromActorId);
      const to = positions.get(distance.toActorId);
      if (!from || !to) continue;
      const color = distance.entangled ? 0x7c2d1f : 0x5c452c;
      this.add.line(0, 0, from.x + 72, from.y, to.x - 72, to.y, color, 0.72).setOrigin(0, 0).setLineWidth(distance.entangled ? 5 : 3);
      this.add.text((from.x + to.x) / 2, (from.y + to.y) / 2 - 16, `${distance.band}${distance.entangled ? " · 纠缠" : ""}`, {
        color: "#fff6e8",
        backgroundColor: "#3b2b1e",
        fontFamily: "Microsoft YaHei",
        fontSize: "13px",
        padding: { x: 8, y: 4 },
      }).setOrigin(0.5);
    }

    if (this.snapshot.pendingLabel) {
      this.add.text(centerX, height - 44, this.snapshot.pendingLabel, {
        color: "#2b2118",
        backgroundColor: "#fff6e8",
        fontFamily: "Microsoft YaHei",
        fontSize: "14px",
        padding: { x: 12, y: 6 },
      }).setOrigin(0.5);
    }
  }

  private drawUnit(unit: CombatBoardUnit, point: Phaser.Math.Vector2, color: number): void {
    const card = this.add.rectangle(point.x, point.y, 150, 74, 0xfff8ec, 0.95).setStrokeStyle(2, color, 0.75);
    card.setInteractive({ useHandCursor: true });
    card.on("pointerdown", () => this.onSelectUnit(unit.id));
    this.add.text(point.x - 62, point.y - 25, unit.name, { color: "#201812", fontFamily: "Microsoft YaHei", fontSize: "16px", fontStyle: "bold" });
    this.add.text(point.x + 62, point.y - 24, unit.momentum, { color: "#201812", fontFamily: "Microsoft YaHei", fontSize: "12px" }).setOrigin(1, 0);
    this.add.text(point.x - 62, point.y + 2, `气血 ${unit.hp}/${unit.maxHp}`, { color: "#5b4b3d", fontFamily: "Microsoft YaHei", fontSize: "13px" });
    this.add.text(point.x - 62, point.y + 22, unit.statuses.slice(0, 3).join("、") || "无状态", { color: "#5b4b3d", fontFamily: "Microsoft YaHei", fontSize: "12px" });
  }
}
