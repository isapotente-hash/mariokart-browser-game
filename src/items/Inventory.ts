import type { ItemKind } from '../data/types';

export class Inventory {
  private slots: ItemKind[] = [];
  drawRemaining = 0;
  get active(): ItemKind | null { return this.slots[0] ?? null; }
  get reserve(): ItemKind | null { return this.slots[1] ?? null; }
  get full(): boolean { return this.slots.length === 2; }
  add(item: ItemKind): boolean {
    if (this.full) return false;
    this.slots.push(item); this.drawRemaining = 0.45; return true;
  }
  use(): ItemKind | null {
    if (this.drawRemaining > 0) return null;
    return this.slots.shift() ?? null;
  }
  update(dt: number): void { this.drawRemaining = Math.max(0, this.drawRemaining - dt); }
  clear(): void { this.slots = []; this.drawRemaining = 0; }
}
