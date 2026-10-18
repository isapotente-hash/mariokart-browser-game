import type { CourseDefinition, GameEvent, Point } from '../data/types';

export class LapProgress {
  readonly racerId: string;
  nextCheckpoint = 1;
  laps = 0;
  lastLapTime = 0;
  private lapStarted = 0;
  started = true;
  gatesPassed = 0;
  constructor(private readonly course: CourseDefinition, racerId = 'player-1', grid = false) {
    this.racerId = racerId;
    this.started = !grid;
    if (grid) this.nextCheckpoint = 0;
  }

  update(previous: Point&{y?:number}, current: Point&{y?:number}, time: number): GameEvent[] {
    const gate = this.course.checkpoints[this.nextCheckpoint]!;
    const tx = gate.forward?.x??Math.sin(gate.heading),ty=gate.forward?.y??0;
    const tz = gate.forward?.z??Math.cos(gate.heading);
    const before = (previous.x - gate.x) * tx + (previous.z - gate.z) * tz+((previous.y??gate.y??0)-(gate.y??0))*ty;
    const after = (current.x - gate.x) * tx + (current.z - gate.z) * tz+((current.y??gate.y??0)-(gate.y??0))*ty;
    if (before >= 0 || after < 0) return [];
    // Intersect the swept movement with the expected forward-facing gate.
    const t = -before / (after - before);
    const x = previous.x + (current.x - previous.x) * t - gate.x;
    const z = previous.z + (current.z - previous.z) * t - gate.z;
    const y=(previous.y??0)+((current.y??0)-(previous.y??0))*t-(gate.y??0);
    if(gate.right&&gate.up){if(Math.abs(x*gate.right.x+y*gate.right.y+z*gate.right.z)>gate.halfWidth||Math.abs(x*gate.up.x+y*gate.up.y+z*gate.up.z)>4)return[];}else if (Math.abs(x * tz - z * tx) > gate.halfWidth) return [];
    // Reject discontinuities, including future rescue teleports across a gate.
    if (Math.hypot(current.x - previous.x, current.z - previous.z) > 3) return [];
    const events: GameEvent[] = [{ type: 'checkpoint', racerId: this.racerId, checkpoint: this.nextCheckpoint }];
    if (this.nextCheckpoint === 0 && this.started) {
      this.laps++;
      this.lastLapTime = time - this.lapStarted;
      this.lapStarted = time;
      events.push({ type: 'lap', racerId: this.racerId, lap: this.laps, time: this.lastLapTime });
    }
    if (!this.started) { this.started = true; this.lapStarted = time; }
    else this.gatesPassed++;
    this.nextCheckpoint = (this.nextCheckpoint + 1) % this.course.checkpoints.length;
    return events;
  }
}
