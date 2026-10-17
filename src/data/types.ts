export interface Point { x: number; z: number }
export interface Pose extends Point { heading: number }
export interface CourseSample extends Point {
  tangent: Point;
  distance: number;
}
export interface Checkpoint extends Pose { halfWidth: number }
export interface CourseDefinition {
  id: string;
  name: string;
  description: string;
  width: number;
  length: number;
  samples: CourseSample[];
  checkpoints: Checkpoint[];
  spawn: Pose;
}
export interface DrivingInput { throttle: boolean; brake: boolean; steering: number; drift?: boolean; useItem?: boolean; rearward?: boolean; rescue?: boolean }
export interface KartState extends Pose {
  vx: number; vz: number; speed: number; surface: 'road' | 'grass';
  boost: number; spin: number; immunity: number; hop: number;
  driftCharge: number; driftSide: number; driftStage: number;
}
export type ItemKind = 'banana' | 'shell' | 'mushroom';
export type RaceState = 'boot' | 'loading' | 'menu' | 'countdown' | 'racing' | 'paused' | 'finished' | 'results';
export type GameEvent =
  | { type: 'checkpoint'; racerId: string; checkpoint: number }
  | { type: 'lap'; racerId: string; lap: number; time: number }
  | { type: 'state'; state: RaceState }
  | { type: 'pickup'; racerId: string; item: ItemKind | 'coin' }
  | { type: 'use'; racerId: string; item: ItemKind }
  | { type: 'hit'; racerId: string; ownerId: string }
  | { type: 'boost'; racerId: string }
  | { type: 'rescue'; racerId: string }
  | { type: 'finish'; racerId: string; place: number; time: number };
