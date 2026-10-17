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
export interface DrivingInput { throttle: boolean; brake: boolean; steering: number }
export interface KartState extends Pose { vx: number; vz: number; speed: number; surface: 'road' | 'grass' }
export type RaceState = 'boot' | 'loading' | 'menu' | 'countdown' | 'racing' | 'paused' | 'finished' | 'results';
export type GameEvent =
  | { type: 'checkpoint'; racerId: string; checkpoint: number }
  | { type: 'lap'; racerId: string; lap: number; time: number }
  | { type: 'state'; state: RaceState };
