import { config } from '../data/config';
import type { CourseDefinition, DrivingInput, KartState } from '../data/types';
import { sampleTrack } from '../tracks/course';

export class KartController {
  readonly state: KartState;
  private reverseWait = 0;
  constructor(private readonly course: CourseDefinition) {
    this.state = { ...course.spawn, vx: 0, vz: 0, speed: 0, surface: 'road' };
  }
  reset(): void {
    Object.assign(this.state, this.course.spawn, { vx: 0, vz: 0, speed: 0, surface: 'road' });
    this.reverseWait = 0;
  }
  update(input: DrivingInput, dt: number): void {
    const s = this.state;
    const k = config.kart;
    const road = sampleTrack(this.course, s);
    s.surface = road.distance > this.course.width / 2 ? 'grass' : 'road';
    const cap = s.surface === 'grass' ? k.offRoadSpeed : k.maxSpeed;
    let speed = s.vx * Math.sin(s.heading) + s.vz * Math.cos(s.heading);
    let force = 0;
    if (input.brake) {
      if (speed > 0.2) { force = -k.braking; this.reverseWait = 0; }
      else {
        this.reverseWait += dt;
        if (this.reverseWait >= k.reverseDelay) force = -k.acceleration * 0.7;
      }
    } else {
      this.reverseWait = 0;
      if (input.throttle) force = speed < -0.2 ? k.braking : k.acceleration * (1 - 0.2 * Math.max(0, speed) / k.maxSpeed);
    }
    speed += (force - speed * k.drag) * dt;
    if (input.brake && force === -k.braking && speed < 0) speed = 0;
    speed = Math.max(-k.reverseSpeed, Math.min(cap, speed));
    if (!input.throttle && !input.brake && Math.abs(speed) < 0.08) speed = 0;
    const moving = Math.min(1, Math.abs(speed) / 4);
    const steering = k.steering * (1 - 0.35 * Math.min(1, Math.abs(speed) / k.maxSpeed));
    s.heading += input.steering * steering * moving * Math.sign(speed) * dt;
    const fx = Math.sin(s.heading);
    const fz = Math.cos(s.heading);
    const lateral = (s.vx * fz - s.vz * fx) * Math.exp(-k.grip * dt);
    s.vx = fx * speed + fz * lateral;
    s.vz = fz * speed - fx * lateral;
    s.x += s.vx * dt;
    s.z += s.vz * dt;
    const contact = sampleTrack(this.course, s);
    const boundary = this.course.width / 2 + 2.4 - k.radius;
    if (contact.distance > boundary) {
      const sign = Math.sign(contact.offset);
      const nx = contact.normal.x * sign;
      const nz = contact.normal.z * sign;
      s.x = contact.x + nx * boundary;
      s.z = contact.z + nz * boundary;
      const outward = Math.max(0, s.vx * nx + s.vz * nz);
      s.vx = (s.vx - nx * outward) * 0.94;
      s.vz = (s.vz - nz * outward) * 0.94;
    }
    s.speed = s.vx * fx + s.vz * fz;
    if (![s.x, s.z, s.vx, s.vz, s.heading].every(Number.isFinite)) this.reset();
  }
}
