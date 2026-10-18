import { cupCourseIds } from '../data/options';
import type { RaceOptions } from '../data/options';
import type { ResultRow } from './Racer';

export const cupPoints = [15, 12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1] as const;
export interface CupStanding { id: string; name: string; points: number; wins: number; lastPlace: number }
export interface CupProgress { id: string; nextRace: number; options: RaceOptions; standings: CupStanding[]; completed: boolean }
export function createCup(options: RaceOptions): CupProgress {
  return { id: `cup-${Date.now()}`, nextRace: 0, options: structuredClone({ ...options, mode: 'grand-prix', course: cupCourseIds[0], laps: 3 }), standings: [], completed: false };
}
export function cupRanking(standings: readonly CupStanding[]): CupStanding[] {
  return [...standings].sort((a, b) => b.points - a.points || b.wins - a.wins || a.lastPlace - b.lastPlace || a.id.localeCompare(b.id));
}
export function advanceCup(cup: CupProgress, results: readonly ResultRow[], raceIndex: number): CupProgress {
  if (cup.completed || cup.nextRace !== raceIndex) return cup;
  const standings = results.map((row) => {
    const previous = cup.standings.find((entry) => entry.id === row.id);
    return { id: row.id, name: row.name, points: (previous?.points ?? 0) + (cupPoints[row.place - 1] ?? 0), wins: (previous?.wins ?? 0) + Number(row.place === 1), lastPlace: row.place };
  });
  const nextRace = cup.nextRace + 1;
  return { ...cup, standings: cupRanking(standings), nextRace, completed: nextRace >= cupCourseIds.length };
}
