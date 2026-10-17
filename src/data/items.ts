import type { ItemKind } from './types';
import type { ItemSetting } from './options';

export const itemKinds: ItemKind[] = ['banana', 'shell', 'mushroom', 'homing', 'explosive', 'shield', 'invincibility', 'leader'];

export const itemDefinitions: Record<ItemKind, { name: string; icon: string; description: string }> = {
  banana: { name: 'Banana', icon: '⌁', description: 'Drop an armed trap. Brake + Item throws behind.' },
  shell: { name: 'Shell', icon: '◉', description: 'Fire a bouncing shell. Brake + Item fires behind.' },
  mushroom: { name: 'Mushroom', icon: '↗', description: 'A two-second speed boost, including on grass.' },
  homing: { name: 'Seeker', icon: '◎', description: 'A turn-limited projectile follows the course toward the next opponent.' },
  explosive: { name: 'Timed explosive', icon: '✹', description: 'Throw a visible ticking explosive; the blast hits once per racer.' },
  shield: { name: 'Shield burst', icon: '◇', description: 'Clear nearby threats and block incoming attacks for three seconds.' },
  invincibility: { name: 'Invincibility', icon: '☆', description: 'Seven seconds of hit immunity and a moderate speed increase.' },
  leader: { name: 'Leader strike', icon: '⇡', description: 'A course-guided strike warns the leader; a shield can counter it.' },
};

export function drawItem(position: number, gap: number, time: number, random: () => number, setting: ItemSetting = 'all', eligibleOpponents = true): ItemKind {
  const expanded = setting === 'all';
  const weights: [ItemKind, number][] = [
    ['banana', position <= 3 ? 5 : 2], ['shell', time < 3 ? 0 : 3], ['mushroom', position >= 5 || gap > 30 ? 6 : 3],
    ['homing', expanded && eligibleOpponents && time >= 5 ? 2 : 0], ['explosive', expanded && time >= 5 ? 1.5 : 0],
    ['shield', expanded ? 2 : 0], ['invincibility', expanded && position > 3 && time >= 8 ? 0.7 : 0],
    ['leader', expanded && eligibleOpponents && position > 1 && gap > 0 && time >= 10 ? 0.4 : 0],
  ];
  let draw = random() * weights.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [kind, weight] of weights) { draw -= weight; if (draw < 0) return kind; }
  return 'mushroom';
}
