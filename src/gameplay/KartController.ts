import { config } from '../data/config';
import type { CourseDefinition, DrivingInput, KartState, Pose } from '../data/types';
import { sampleTrack } from '../tracks/course';

export class KartController {
  readonly state: KartState;
  private reverseWait = 0;
  private driftHeld = false;
  private hopRemaining = 0;
  coinBonus = 0;
  constructor(private readonly course: CourseDefinition, pose: Pose = course.spawn) {
    this.state = { ...pose, vx: 0, vz: 0, speed: 0, surface: 'road', boost: 0, spin: 0, immunity: 0, hop: 0, driftCharge: 0, driftSide: 0, driftStage: 0 };
  }
  reset(pose: Pose = this.course.spawn): void {
    Object.assign(this.state, pose, { vx: 0, vz: 0, speed: 0, surface: 'road', boost: 0, spin: 0, immunity: 0, hop: 0 });
    this.cancelDrift(); this.reverseWait = 0; this.driftHeld = false; this.hopRemaining = 0;
  }
  cancelDrift(): void { this.state.driftCharge = 0; this.state.driftSide = 0; this.state.driftStage = 0; }
  boost(duration: number): void { this.state.boost = Math.min(3, Math.max(this.state.boost, duration)); }
  hit(): boolean {
    if (this.state.immunity > 0) return false;
    this.state.spin = config.race.hitSpin; this.state.immunity = config.race.hitImmunity;
    this.state.vx *= 0.28; this.state.vz *= 0.28; this.state.boost = 0; this.cancelDrift(); return true;
  }
  update(input: DrivingInput, dt: number): void {
    const s = this.state, k = config.kart;
    s.immunity = Math.max(0, s.immunity - dt); s.boost = Math.max(0, s.boost - dt); s.spin = Math.max(0, s.spin - dt);
    const road = sampleTrack(this.course, s);
    s.surface = road.distance > this.course.width / 2 ? 'grass' : 'road';
    let speed = s.vx * Math.sin(s.heading) + s.vz * Math.cos(s.heading);
    const held = !!input.drift;
    if (held && !this.driftHeld && s.spin === 0) {
      this.hopRemaining = config.drift.hopTime;
      if (speed >= config.drift.minimumSpeed && Math.abs(input.steering) > 0.1) s.driftSide = Math.sign(input.steering);
    }
    if (s.driftSide && held && speed >= config.drift.minimumSpeed && s.surface === 'road' && s.spin === 0) {
      s.driftCharge += dt;
      s.driftStage = config.drift.thresholds.filter((threshold) => s.driftCharge >= threshold).length;
    } else if (s.driftSide) {
      if (!held && s.driftStage > 0) this.boost(config.drift.durations[s.driftStage - 1]!);
      this.cancelDrift();
    }
    this.driftHeld = held;
    this.hopRemaining = Math.max(0, this.hopRemaining - dt);
    s.hop = Math.sin(this.hopRemaining / config.drift.hopTime * Math.PI) * 0.6;
    const boosted = s.boost > 0;
    const cap = ((s.surface === 'grass' && !boosted) ? k.offRoadSpeed : k.maxSpeed) * (1 + this.coinBonus) + (boosted ? 8 : 0);
    let force = 0;
    if (s.spin > 0) { this.cancelDrift(); speed *= Math.exp(-4 * dt); }
    else if (input.brake) {
      if (speed > 0.2) { force = -k.braking; this.reverseWait = 0; }
      else { this.reverseWait += dt; if (this.reverseWait >= k.reverseDelay) force = -k.acceleration * 0.7; }
    } else {
      this.reverseWait = 0;
      if (input.throttle) force = speed < -0.2 ? k.braking : k.acceleration * (1 - 0.2 * Math.max(0, speed) / k.maxSpeed);
    }
    if (boosted && s.spin === 0) force += 18;
    speed += (force - speed * k.drag) * dt;
    if (input.brake && force === -k.braking && speed < 0) speed = 0;
    speed = Math.max(-k.reverseSpeed, Math.min(cap, speed));
    if (!input.throttle && !input.brake && !boosted && Math.abs(speed) < 0.08) speed = 0;
    const moving = Math.min(1, Math.abs(speed) / 4);
    const steering = k.steering * (1 - 0.35 * Math.min(1, Math.abs(speed) / k.maxSpeed));
    const turn = s.driftSide ? s.driftSide * 0.18 + input.steering * 0.82 : input.steering;
    if (s.spin === 0) s.heading += turn * steering * moving * Math.sign(speed) * dt;
    const fx = Math.sin(s.heading), fz = Math.cos(s.heading);
    const lateral = (s.vx * fz - s.vz * fx) * Math.exp(-(s.driftSide ? 6 : k.grip) * dt);
    s.vx = fx * speed + fz * lateral; s.vz = fz * speed - fx * lateral;
    s.x += s.vx * dt; s.z += s.vz * dt;
    const contact = sampleTrack(this.course, s);
    const boundary = this.course.width / 2 + 2.4 - k.radius;
    if (contact.distance > boundary) {
      const sign = Math.sign(contact.offset) || 1;
      const nx = contact.normal.x * sign, nz = contact.normal.z * sign;
      s.x = contact.x + nx * boundary; s.z = contact.z + nz * boundary;
      const outward = Math.max(0, s.vx * nx + s.vz * nz);
      s.vx = (s.vx - nx * outward) * 0.94; s.vz = (s.vz - nz * outward) * 0.94;
      if (outward > 8) this.cancelDrift();
    }
    s.speed = s.vx * fx + s.vz * fz;
    if (![s.x, s.z, s.vx, s.vz, s.heading].every(Number.isFinite)) this.reset();
  }
}
