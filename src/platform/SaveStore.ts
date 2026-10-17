import { courseIds, defaultSettings, raceOptions } from '../data/options';
import type { Settings, ControlBindings } from '../data/options';
import { validateBuild } from '../data/content';
import type { CupProgress, CupStanding } from '../gameplay/Cup';
import { cupPoints } from '../gameplay/Cup';

export const saveKey = 'pocket-circuit-save';
export interface BestRecord { time: number; course: string; physicsVersion: string; trackVersion: string }
export interface SaveData { version: 3; settings: Settings; coins: number; unlocks: string[]; cup: CupProgress | null; bests: Record<string, BestRecord> }
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const number = (value: unknown, fallback: number, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
const bool = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback;
const member = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => allowed.includes(value as T) ? value as T : fallback;
function bindings(value: unknown, fallback: ControlBindings): ControlBindings {
  const source = record(value), result = { ...fallback };
  for (const key of Object.keys(result) as (keyof ControlBindings)[]) {
    const code = source[key];
    if (typeof code === 'string' && code !== 'KeyR' && /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Shift(Left|Right)|Control(Left|Right))$/.test(code)) result[key] = code;
  }
  return new Set(Object.values(result)).size === Object.keys(result).length ? result : fallback;
}
export function validateSettings(value: unknown): Settings {
  const source = record(value), defaults = defaultSettings();
  const builds = Array.isArray(source.builds) ? source.builds : [];
  const controls = Array.isArray(source.controls) ? source.controls : [];
  const devices = Array.isArray(source.devices) ? source.devices : [];
  const result: Settings = {
    mode: member(source.mode, ['versus', 'grand-prix', 'time-trial'], defaults.mode),
    course: member(source.course, courseIds, defaults.course), players: source.players === 2 ? 2 : 1,
    difficulty: member(source.difficulty, ['easy', 'normal', 'hard'], defaults.difficulty), speed: member(source.speed, ['50cc', '100cc', '150cc', '200cc'], defaults.speed),
    laps: Math.round(number(source.laps, 3, 1, 5)), items: member(source.items, ['all', 'basic', 'none'], defaults.items), mirrored: bool(source.mirrored, false),
    builds: [validateBuild(builds[0], defaults.builds[0]), validateBuild(builds[1], defaults.builds[1])],
    quality: member(source.quality, ['low', 'medium', 'high'], 'medium'), split: member(source.split, ['auto', 'side', 'stacked'], 'auto'),
    ghost: bool(source.ghost, true), reducedMotion: bool(source.reducedMotion, false), hudScale: number(source.hudScale, 1, 0.8, 1.3),
    autoAccelerate: bool(source.autoAccelerate, false), steeringAssist: bool(source.steeringAssist, false),
    masterVolume: number(source.masterVolume, 0.65, 0, 1), musicVolume: number(source.musicVolume, 0.22, 0, 1), effectsVolume: number(source.effectsVolume, 0.65, 0, 1),
    muted: bool(source.muted, false), touchControls: member(source.touchControls, ['auto', 'on', 'off'], 'auto'),
    controls: [bindings(controls[0], defaults.controls[0]), bindings(controls[1], defaults.controls[1])], devices: [member(devices[0], ['keyboard', 'gamepad'], 'keyboard'), member(devices[1], ['keyboard', 'gamepad'], 'keyboard')],
  };
  if (Object.values(result.controls[0]).some((code) => Object.values(result.controls[1]).includes(code))) result.controls = structuredClone(defaults.controls);
  if (result.mode === 'time-trial') { result.players = 1; result.laps = 3; result.items = 'none'; }
  if (result.mode === 'grand-prix') { result.laps = 3; result.items = 'all'; }
  return result;
}
function validateCup(value: unknown): CupProgress | null {
  const cup = record(value);
  if (typeof cup.id !== 'string' || cup.id.length > 80 || !Number.isInteger(cup.nextRace) || Number(cup.nextRace) < 0 || Number(cup.nextRace) > courseIds.length || !Array.isArray(cup.standings) || cup.standings.length > 12) return null;
  const standings: CupStanding[] = [];
  for (const input of cup.standings) {
    const row = record(input);
    if (typeof row.id !== 'string' || !/^(player-[12]|ai-\d{1,2})$/.test(row.id) || typeof row.name !== 'string' || row.name.length > 35) return null;
    standings.push({ id: row.id, name: row.name, points: Math.round(number(row.points, 0, 0, Math.max(...cupPoints) * courseIds.length)), wins: Math.round(number(row.wins, 0, 0, courseIds.length)), lastPlace: Math.round(number(row.lastPlace, 12, 1, 12)) });
  }
  if (new Set(standings.map((row) => row.id)).size !== standings.length || (Number(cup.nextRace) > 0 && standings.length !== 12)) return null;
  const options = validateSettings(cup.options);
  const expected = new Set(Array.from({ length: 12 }, (_, index) => index < options.players ? `player-${index + 1}` : `ai-${index - options.players + 1}`));
  const races = Number(cup.nextRace);
  if (standings.some((row) => !expected.has(row.id) || row.wins > races || row.points > Math.max(...cupPoints) * races)) return null;
  if (races === 0 && standings.length !== 0) return null;
  if (races > 0 && (new Set(standings.map((row) => row.lastPlace)).size !== 12 || standings.reduce((sum, row) => sum + row.wins, 0) !== races || standings.reduce((sum, row) => sum + row.points, 0) !== cupPoints.reduce<number>((sum, points) => sum + points, 0) * races)) return null;
  return { id: cup.id, nextRace: Number(cup.nextRace), options: raceOptions({ ...options, mode: 'grand-prix', laps: 3 }), standings, completed: cup.nextRace === courseIds.length };
}
export function validateSave(value: unknown): SaveData {
  const input = record(value);
  if (![1, 2, 3].includes(Number(input.version))) return { version: 3, settings: defaultSettings(), coins: 0, unlocks: [], cup: null, bests: {} };
  const bests: Record<string, BestRecord> = {};
  for (const [key, value] of Object.entries(record(input.bests)).slice(0, 200)) {
    const best = record(value);
    if (['__proto__', 'constructor', 'prototype'].includes(key) || !/^[a-zA-Z0-9_.:|-]{1,180}$/.test(key) || typeof best.time !== 'number' || !Number.isFinite(best.time) || best.time < 1 || best.time > 3600 || typeof best.course !== 'string' || typeof best.physicsVersion !== 'string' || typeof best.trackVersion !== 'string') continue;
    bests[key] = { time: best.time, course: best.course.slice(0, 60), physicsVersion: best.physicsVersion.slice(0, 40), trackVersion: best.trackVersion.slice(0, 40) };
  }
  return { version: 3, settings: validateSettings(input.settings), coins: Math.round(number(input.coins, 0, 0, 999999)), unlocks: Array.isArray(input.unlocks) ? [...new Set(input.unlocks.filter((value): value is string => ['first-finish', 'coin-collector', 'cup-winner'].includes(String(value))))] : [], cup: validateCup(input.cup), bests };
}
export class SaveStore {
  data: SaveData;
  available = true;
  status = 'Saved locally to this browser and device.';
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  constructor(storage?: Pick<Storage, 'getItem' | 'setItem'> | null) {
    this.data = validateSave({ version: 3 });
    this.storage = null;
    try {
      if (storage === undefined) storage = globalThis.localStorage ?? null;
      this.storage = storage;
      if (!storage) throw new Error('Storage unavailable');
      const raw = storage.getItem(saveKey);
      if (raw) this.data = validateSave(JSON.parse(raw));
    } catch { this.available = false; this.status = 'Local storage is unavailable or damaged. Changes remain in memory for this session.'; }
  }
  save(): void {
    try { if (!this.storage) throw new Error('Storage unavailable'); this.storage.setItem(saveKey, JSON.stringify(this.data)); this.available = true; this.status = 'Saved locally to this browser and device.'; }
    catch { this.available = false; this.status = 'Saving was denied. Changes remain in memory for this session.'; }
  }
  import(json: string): boolean {
    try {
      const value = JSON.parse(json) as unknown;
      if (![1, 2, 3].includes(Number(record(value).version))) return false;
      this.data = validateSave(value); this.save(); return true;
    } catch { return false; }
  }
  export(): string { return JSON.stringify(this.data, null, 2); }
  resetProgress(): void { this.data = { ...this.data, coins: 0, unlocks: [], cup: null, bests: {} }; this.save(); }
}
