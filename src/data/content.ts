import type { VehicleBuild } from './options';

export interface VehicleStats { speed: number; acceleration: number; handling: number; grip: number; drift: number }
type Modifiers = Partial<VehicleStats>;
export const drivers: { id: string; name: string; weight: 'light' | 'medium' | 'heavy'; color: string; detail: string; modifiers: Modifiers }[] = [
  { id: 'nova', name: 'Nova', weight: 'medium', color: '#ef6b43', detail: 'crest', modifiers: {} },
  { id: 'moss', name: 'Moss', weight: 'heavy', color: '#53855a', detail: 'ears', modifiers: { speed: 0.08, acceleration: -0.08, handling: -0.06, grip: 0.05, drift: -0.03 } },
  { id: 'pip', name: 'Pip', weight: 'light', color: '#e6b440', detail: 'antenna', modifiers: { speed: -0.05, acceleration: 0.1, handling: 0.08, grip: -0.02, drift: 0.05 } },
  { id: 'indigo', name: 'Indigo', weight: 'medium', color: '#7775bb', detail: 'fin', modifiers: { speed: -0.02, handling: 0.03, drift: 0.05 } },
  { id: 'coral', name: 'Coral', weight: 'light', color: '#d7798a', detail: 'bow', modifiers: { speed: -0.04, acceleration: 0.08, handling: 0.07, grip: 0.02, drift: 0.04 } },
  { id: 'river', name: 'River', weight: 'medium', color: '#489fb1', detail: 'goggles', modifiers: { speed: 0.02, acceleration: -0.02, handling: 0.02, grip: 0.05 } },
  { id: 'ash', name: 'Ash', weight: 'heavy', color: '#546273', detail: 'horns', modifiers: { speed: 0.1, acceleration: -0.09, handling: -0.08, grip: 0.06, drift: -0.04 } },
  { id: 'peach', name: 'Peach', weight: 'light', color: '#db9560', detail: 'flower', modifiers: { speed: -0.03, acceleration: 0.07, handling: 0.06, grip: 0.04, drift: 0.06 } },
];
export const chassis = [
  { id: 'swift', name: 'Swift', modifiers: { acceleration: 0.04, handling: 0.03, speed: -0.02 } },
  { id: 'rover', name: 'Rover', modifiers: { grip: 0.09, speed: -0.04, acceleration: -0.02 } },
  { id: 'comet', name: 'Comet', modifiers: { speed: 0.07, acceleration: -0.04, handling: -0.04, drift: 0.04 } },
] satisfies { id: string; name: string; modifiers: Modifiers }[];
export const tyres = [
  { id: 'standard', name: 'Road', modifiers: {} },
  { id: 'grip', name: 'Trail', modifiers: { grip: 0.1, handling: 0.03, speed: -0.04, drift: -0.02 } },
  { id: 'slick', name: 'Slick', modifiers: { speed: 0.05, drift: 0.08, grip: -0.08, acceleration: -0.02 } },
] satisfies { id: string; name: string; modifiers: Modifiers }[];
export const gliders = [
  { id: 'cloth', name: 'Sail', lift: 1.1, modifiers: { handling: 0.02, speed: -0.01 } },
  { id: 'wing', name: 'Delta', lift: 0.9, modifiers: { speed: 0.02, handling: -0.02, drift: 0.02 } },
] satisfies { id: string; name: string; lift: number; modifiers: Modifiers }[];
export function validateBuild(value: unknown, fallback: VehicleBuild): VehicleBuild {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const choose = (key: keyof VehicleBuild, options: { id: string }[]) => options.some((entry) => entry.id === source[key]) ? String(source[key]) : fallback[key];
  return { driver: choose('driver', drivers), chassis: choose('chassis', chassis), tyres: choose('tyres', tyres), glider: choose('glider', gliders) };
}
export function calculateStats(build: VehicleBuild): VehicleStats {
  const parts: Modifiers[] = [drivers.find((part) => part.id === build.driver)?.modifiers ?? {}, chassis.find((part) => part.id === build.chassis)?.modifiers ?? {}, tyres.find((part) => part.id === build.tyres)?.modifiers ?? {}, gliders.find((part) => part.id === build.glider)?.modifiers ?? {}];
  const stat = (key: keyof VehicleStats) => Math.max(0.75, Math.min(1.3, 1 + parts.reduce((sum, part) => sum + (part[key] ?? 0), 0)));
  return { speed: stat('speed'), acceleration: stat('acceleration'), handling: stat('handling'), grip: stat('grip'), drift: stat('drift') };
}
