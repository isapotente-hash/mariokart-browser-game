export const courseIds = ['garden-circuit', 'harbour-run', 'sky-foundry', 'starlight-causeway'] as const;
export type CourseId = typeof courseIds[number];
export type GameMode = 'versus' | 'grand-prix' | 'time-trial';
export type Quality = 'low' | 'medium' | 'high';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type SpeedClass = '50cc' | '100cc' | '150cc' | '200cc';
export type ItemSetting = 'all' | 'basic' | 'none';
export interface VehicleBuild { driver: string; chassis: string; tyres: string; glider: string }
export interface RaceOptions {
  mode: GameMode; course: CourseId; players: 1 | 2; difficulty: Difficulty;
  speed: SpeedClass; laps: number; items: ItemSetting; mirrored: boolean; builds: [VehicleBuild, VehicleBuild];
  autoAccelerate: boolean; steeringAssist: boolean;
}
export interface ControlBindings { throttle: string; brake: string; left: string; right: string; drift: string; item: string; rear: string; rescue: string; pitchUp: string; pitchDown: string }
export interface Settings extends RaceOptions {
  quality: Quality; split: 'auto' | 'side' | 'stacked'; ghost: boolean; reducedMotion: boolean; hudScale: number;
  masterVolume: number; musicVolume: number; effectsVolume: number;
  muted: boolean; touchControls: 'auto' | 'on' | 'off';
  controls: [ControlBindings, ControlBindings]; devices: ['keyboard' | 'gamepad', 'keyboard' | 'gamepad'];
}
export const defaultBindings = (): [ControlBindings, ControlBindings] => [
  { throttle: 'KeyW', brake: 'KeyS', left: 'KeyA', right: 'KeyD', drift: 'Space', item: 'KeyE', rear: 'KeyQ', rescue: 'KeyF', pitchUp: 'ArrowUp', pitchDown: 'ArrowDown' },
  { throttle: 'KeyI', brake: 'KeyK', left: 'KeyJ', right: 'KeyL', drift: 'KeyU', item: 'KeyY', rear: 'KeyO', rescue: 'KeyH', pitchUp: 'KeyN', pitchDown: 'KeyM' },
];
export function defaultSettings(): Settings {
  return {
    mode: 'versus', course: 'garden-circuit', players: 1, difficulty: 'normal', speed: '150cc', laps: 3, items: 'all', mirrored: false,
    builds: [{ driver: 'nova', chassis: 'swift', tyres: 'standard', glider: 'cloth' }, { driver: 'moss', chassis: 'rover', tyres: 'grip', glider: 'wing' }],
    autoAccelerate: false, steeringAssist: false, quality: 'medium', split: 'auto', ghost: true, reducedMotion: false, hudScale: 1,
    masterVolume: 0.65, musicVolume: 0.22, effectsVolume: 0.65, muted: false, touchControls: 'auto', controls: defaultBindings(), devices: ['keyboard', 'keyboard'],
  };
}
export const speedProfiles: Record<SpeedClass, { speed: number; acceleration: number }> = {
  '50cc': { speed: 0.65, acceleration: 0.8 }, '100cc': { speed: 0.82, acceleration: 0.9 },
  '150cc': { speed: 1, acceleration: 1 }, '200cc': { speed: 1.18, acceleration: 1.12 },
};
export const qualityProfiles = {
  low: { pixelRatio: 1, shadowSize: 0, particles: 0, drawDistance: 220, decoration: 0.35 },
  medium: { pixelRatio: 1.5, shadowSize: 1024, particles: 1, drawDistance: 340, decoration: 0.7 },
  high: { pixelRatio: 2, shadowSize: 2048, particles: 2, drawDistance: 480, decoration: 1 },
} as const;
export function raceOptions(settings:RaceOptions):RaceOptions {
  return {mode:settings.mode,course:settings.course,players:settings.mode==='time-trial'?1:settings.players,difficulty:settings.difficulty,speed:settings.speed,laps:settings.mode==='versus'?settings.laps:3,items:settings.mode==='time-trial'?'none':settings.items,mirrored:settings.mirrored,builds:structuredClone(settings.builds),autoAccelerate:settings.autoAccelerate,steeringAssist:settings.steeringAssist};
}
