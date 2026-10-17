import type { CourseDefinition, DrivingInput, KartState, Vec3 } from '../data/types';
import { sampleTrack } from '../tracks/course';
import type { TrackQuery } from '../tracks/course';
import { normalize } from '../tracks/frames';

export function surfaceForward(heading: number, up: Vec3): Vec3 {
  const x = Math.sin(heading), z = Math.cos(heading);
  return normalize({ x, y: -(up.x * x + up.z * z) / Math.max(0.2, up.y), z });
}
export class TraversalSystem {
  private cooldown = 0;
  private flightTime = 0;
  private trick = false;
  private held = false;
  get airborne(): boolean { return this.flightTime > 0; }
  reset(): void { this.cooldown = 0; this.flightTime = 0; this.trick = false; this.held = false; }
  align(state: KartState, road: TrackQuery, dt: number): void {
    const blend = 1 - Math.exp(-7 * dt);
    state.up = normalize({ x: state.up.x + (road.up.x - state.up.x) * blend, y: state.up.y + (road.up.y - state.up.y) * blend, z: state.up.z + (road.up.z - state.up.z) * blend });
    state.gravity = { x: -9.8 * state.up.x, y: -9.8 * state.up.y, z: -9.8 * state.up.z };
    state.traversal = road.traversal;
  }
  update(course: CourseDefinition, state: KartState, input: DrivingInput, dt: number, lift = 1, maxSpeed = 35): boolean {
    this.cooldown = Math.max(0, this.cooldown - dt);
    const road = sampleTrack(course, state);
    const pressed = !!input.drift && !this.held; this.held = !!input.drift;
    if (this.airborne) {
      this.flightTime += dt;
      if (pressed && this.flightTime < 0.25 && state.traversal !== 'falling') this.trick = true;
      state.trickReady = Math.max(0, 0.25 - this.flightTime);
      if (state.traversal === 'gliding') {
        state.heading += input.steering * 0.95 * dt;
        state.pitch = Math.max(-0.55, Math.min(0.4, state.pitch + (input.pitch ?? 0) * dt * 0.8 - state.pitch * dt * 0.6));
        const horizontal = Math.max(4, Math.min(maxSpeed, Math.hypot(state.vx, state.vz) + (input.throttle ? 1.5 : -0.3) * dt));
        state.vx += (Math.sin(state.heading) * horizontal - state.vx) * Math.min(1, dt * 6);
        state.vz += (Math.cos(state.heading) * horizontal - state.vz) * Math.min(1, dt * 6);
        state.vy = Math.max(-12, Math.min(5, state.vy + (-7 + 4.2 * lift + state.pitch * 6) * dt));
      } else {
        state.vy -= 10 * dt;
        state.heading += input.steering * dt * 0.35;
      }
      state.x += state.vx * dt; state.z += state.vz * dt; state.y += state.vy * dt;
      state.speed = Math.hypot(state.vx, state.vz);
      const blend = Math.min(1, dt * 4);
      state.up = normalize({ x: state.up.x * (1 - blend), y: state.up.y + (1 - state.up.y) * blend, z: state.up.z * (1 - blend) });
      state.gravity = { x: 0, y: -9.8, z: 0 };
      const landing = sampleTrack(course, state);
      if (this.flightTime > 0.2 && state.vy <= 0 && !landing.gap && landing.distance < landing.width / 2 + 1 && state.y <= landing.height + 0.15 && state.y > landing.height - 5) {
        state.y = landing.height; state.vy = 0; state.pitch = 0; state.traversal = landing.traversal;
        this.flightTime = 0; state.trickReady = 0; const earned = this.trick; this.trick = false; return earned;
      }
      if (this.flightTime > 9 || state.y < landing.height - 8) state.traversal = 'falling';
      return false;
    }
    state.y = road.height;
    this.align(state, road, dt);
    if (road.surface === 'boost') state.boost = Math.max(state.boost, 0.3);
    if (road.gap) {
      state.traversal = 'falling'; this.flightTime = 0.001; state.vy = 0;
    } else if (course.exposed && road.distance > road.width / 2 + 1) {
      state.traversal = 'falling'; this.flightTime = 0.001; state.vy = 0;
    } else if (state.speed > 5 && this.cooldown === 0 && road.route === 'main') {
      const launch = course.launches.find((zone) => road.progress >= zone.from && road.progress <= zone.to);
      if (launch) {
        state.traversal = launch.glider ? 'gliding' : 'jumping'; this.flightTime = 0.001; this.cooldown = 3;
        state.y += 0.2; state.vy = (launch.glider ? 3 : 5) * (course.compact ? 0.45 : 1); state.trickReady = 0.25;
      }
    }
    return false;
  }
}
