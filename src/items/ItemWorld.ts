import { config } from '../data/config';
import { drawItem } from '../data/items';
import type { CourseDefinition, GameEvent, ItemKind, Point } from '../data/types';
import type { Racer } from '../gameplay/Racer';
import { poseAt, sampleTrack } from '../tracks/course';

export interface Pickup extends Point { id: string; kind: 'box' | 'coin'; cooldown: number; double: boolean }
export interface WorldItem extends Point {
  id: number; active: boolean; kind: 'banana' | 'shell'; owner: string;
  vx: number; vz: number; age: number; life: number; bounces: number;
}

export function sweptDistance(point: Point, from: Point, to: Point): number {
  const dx = to.x - from.x, dz = to.z - from.z;
  const t = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.z - from.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(point.x - from.x - t * dx, point.z - from.z - t * dz);
}

export class ItemWorld {
  readonly pickups: Pickup[] = [];
  readonly objects: WorldItem[] = Array.from({ length: config.items.poolSize }, (_, id) => ({ id, active: false, kind: 'banana', owner: '', x: 0, z: 0, vx: 0, vz: 0, age: 0, life: 0, bounces: 0 }));
  readonly usage: Record<ItemKind, number> = { banana: 0, shell: 0, mushroom: 0 };
  hits = 0;
  constructor(readonly course: CourseDefinition, private readonly random: () => number) {
    for (let group = 0; group < 5; group++) for (let lane = -1; lane <= 1; lane++) {
      const p = poseAt(course, course.length * (0.1 + group * 0.175));
      this.pickups.push({ id: `box-${group}-${lane}`, kind: 'box', x: p.x + Math.cos(p.heading) * lane * course.width * 0.25, z: p.z - Math.sin(p.heading) * lane * course.width * 0.25, cooldown: 0, double: lane === 0 });
    }
    for (let i = 0; i < 30; i++) {
      const p = poseAt(course, course.length * (i + 0.5) / 30);
      const lane = Math.sin(i * 0.7) * course.width * 0.18;
      this.pickups.push({ id: `coin-${i}`, kind: 'coin', x: p.x + Math.cos(p.heading) * lane, z: p.z - Math.sin(p.heading) * lane, cooldown: 0, double: false });
    }
  }
  use(racer: Racer, rearward: boolean): GameEvent[] {
    const item = racer.inventory.use();
    if (!item) return [];
    this.usage[item]++;
    if (item === 'mushroom') {
      racer.controller.boost(config.items.mushroomTime);
      return [{ type: 'use', racerId: racer.id, item }, { type: 'boost', racerId: racer.id }];
    }
    const object = this.objects.find((candidate) => !candidate.active) ?? this.objects.reduce((a, b) => a.life < b.life ? a : b);
    const state = racer.controller.state;
    const direction = rearward ? -1 : 1;
    const fx = Math.sin(state.heading) * direction, fz = Math.cos(state.heading) * direction;
    Object.assign(object, { active: true, kind: item, owner: racer.id, x: state.x + fx * 2.2, z: state.z + fz * 2.2, vx: item === 'shell' ? fx * config.items.shellSpeed : 0, vz: item === 'shell' ? fz * config.items.shellSpeed : 0, age: 0, life: item === 'shell' ? config.items.shellLife : config.items.trapLife, bounces: 0 });
    return [{ type: 'use', racerId: racer.id, item }];
  }
  private hit(racer: Racer, object: WorldItem): GameEvent[] {
    if (racer.finishTime !== null || racer.rescueRemaining > 0 || (object.owner === racer.id && object.age < config.items.ownerGrace)) return [];
    if (!racer.controller.hit()) return [];
    racer.coins = Math.max(0, racer.coins - 3); object.active = false; this.hits++;
    return [{ type: 'hit', racerId: racer.id, ownerId: object.owner }];
  }
  update(dt: number, racers: readonly Racer[], time: number): GameEvent[] {
    const events: GameEvent[] = [];
    for (const pickup of this.pickups) pickup.cooldown = Math.max(0, pickup.cooldown - dt);
    const leaderDistance = Math.max(...racers.map((racer) => racer.distance));
    for (const racer of racers) {
      if (racer.finishTime !== null || racer.rescueRemaining > 0) continue;
      for (const pickup of this.pickups) {
        if (pickup.cooldown > 0 || sweptDistance(pickup, racer.previous, racer.controller.state) > (pickup.kind === 'coin' ? 1.1 : 1.5)) continue;
        if (pickup.kind === 'coin') {
          if (racer.coins >= config.race.coinCap) continue;
          racer.coins++; pickup.cooldown = config.items.coinRespawn;
          events.push({ type: 'pickup', racerId: racer.id, item: 'coin' });
        } else if (racer.pickupCooldown <= 0 && !racer.inventory.full) {
          const position = 1 + racers.filter((other) => other.distance > racer.distance).length;
          for (let slot = 0; slot < (pickup.double ? 2 : 1); slot++) {
            if (racer.inventory.full) break;
            const item = drawItem(position, leaderDistance - racer.distance, time, this.random);
            racer.inventory.add(item); events.push({ type: 'pickup', racerId: racer.id, item });
          }
          pickup.cooldown = config.items.boxRespawn; racer.pickupCooldown = config.items.pickupCooldown;
        }
      }
    }
    for (const object of this.objects) {
      if (!object.active) continue;
      object.age += dt; object.life -= dt;
      if (object.life <= 0) { object.active = false; continue; }
      if (object.kind === 'banana') {
        if (object.age < config.items.armTime) continue;
        for (const racer of racers) {
          if (sweptDistance(object, racer.previous, racer.controller.state) < 1.25) events.push(...this.hit(racer, object));
          if (!object.active) break;
        }
      } else {
        const steps = Math.max(1, Math.ceil(Math.hypot(object.vx, object.vz) * dt / 0.4));
        for (let i = 0; i < steps && object.active; i++) {
          const from = { x: object.x, z: object.z };
          object.x += object.vx * dt / steps; object.z += object.vz * dt / steps;
          const road = sampleTrack(this.course, object);
          const boundary = this.course.width / 2 + 2.4 - 0.45;
          if (road.distance > boundary) {
            const sign = Math.sign(road.offset) || 1;
            const nx = road.normal.x * sign, nz = road.normal.z * sign;
            object.x = road.x + nx * boundary; object.z = road.z + nz * boundary;
            const outward = object.vx * nx + object.vz * nz;
            if (outward > 0) { object.vx -= 2 * outward * nx; object.vz -= 2 * outward * nz; object.bounces++; }
            if (object.bounces >= config.items.shellBounces) object.active = false;
          }
          for (const racer of racers) {
            if (sweptDistance(racer.controller.state, from, object) < 1.2) events.push(...this.hit(racer, object));
            if (!object.active) break;
          }
        }
      }
    }
    return events;
  }
}
