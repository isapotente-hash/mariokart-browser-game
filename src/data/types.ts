export interface Point { x: number; z: number }
export interface Vec3 extends Point { y: number }
export type Traversal = 'grounded' | 'underwater' | 'anti-gravity' | 'gliding' | 'jumping' | 'falling';
export interface Pose extends Point { heading: number; y?: number }
export interface CourseSample extends Point {
  tangent: Point;
  distance: number;
  y: number; bank: number; slope: number; traversal: 'grounded' | 'underwater' | 'anti-gravity'; gap: boolean;
}
export interface Checkpoint extends Pose { halfWidth: number }
export interface ArenaDefinition {
  halfSize: number;
  obstacles: { x:number; z:number; halfWidth:number; halfDepth:number; height:number }[];
  spawns: Pose[];
  supplies: (Point & { double:boolean })[];
}
export interface CourseDefinition {
  id: string;
  name: string;
  description: string;
  width: number;
  length: number;
  samples: CourseSample[];
  checkpoints: Checkpoint[];
  spawn: Pose;
  theme: 'garden' | 'harbour' | 'foundry' | 'starlight'; compact: boolean; mirrored: boolean; version: string;
  branches: { id: string; samples: CourseSample[]; width: number; surface: 'road' | 'grass' | 'boost' }[];
  hazards: { id: string; progress: number; amplitude: number; period: number; radius: number }[];
  launches: { from: number; to: number; landing: number; glider: boolean }[];
  exposed: boolean;
  arena?: ArenaDefinition;
}
export interface DrivingInput { throttle: boolean; brake: boolean; steering: number; drift?: boolean; useItem?: boolean; rearward?: boolean; rescue?: boolean; pitch?: number; rearView?: boolean }
export interface KartState extends Pose {
  vx: number; vz: number; speed: number; surface: 'road' | 'grass' | 'underwater' | 'anti-gravity' | 'boost';
  boost: number; spin: number; immunity: number; hop: number;
  driftCharge: number; driftSide: number; driftStage: number;
  y: number; vy: number; up: Vec3; gravity: Vec3; traversal: Traversal; pitch: number;
  shield: number; invincible: number; trickReady: number;
}
export type ItemKind = 'banana' | 'shell' | 'mushroom' | 'homing' | 'explosive' | 'shield' | 'invincibility' | 'leader';
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
