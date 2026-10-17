import type { ItemKind } from './types';

export const itemDefinitions: Record<ItemKind, { name: string; icon: string; description: string }> = {
  banana: { name: 'Banana', icon: '⌁', description: 'Drop an armed trap. Down + E throws behind.' },
  shell: { name: 'Shell', icon: '◉', description: 'Fire a bouncing shell. Down + E fires behind.' },
  mushroom: { name: 'Mushroom', icon: '↗', description: 'A two-second speed boost, including on grass.' },
};

export function drawItem(position: number, gap: number, time: number, random: () => number): ItemKind {
  const weights: [ItemKind, number][] = [['banana', position <= 3 ? 5 : 2], ['shell', time < 3 ? 0 : 3], ['mushroom', position >= 5 || gap > 30 ? 6 : 3]];
  let draw = random() * weights.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [kind, weight] of weights) { draw -= weight; if (draw < 0) return kind; }
  return 'mushroom';
}
