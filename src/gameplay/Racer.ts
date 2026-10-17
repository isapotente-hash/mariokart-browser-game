import type { DrivingInput, KartState, Pose } from '../data/types';
import type { KartController } from './KartController';
import type { LapProgress } from './LapProgress';
import type { Inventory } from '../items/Inventory';

export interface Racer {
  id: string; name: string; color: string; player: boolean;
  controller: KartController; progress: LapProgress; inventory: Inventory;
  previous: KartState; grid: Pose; input: DrivingInput;
  coins: number; pickupCooldown: number; rescueRemaining: number; rescues: number;
  wrongWayTime: number; finishTime: number | null; finishPlace: number | null; distance: number;
}
export interface ResultRow { id: string; name: string; place: number; time: number | null; coins: number; finished: boolean }
