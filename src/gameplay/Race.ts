import { config } from '../data/config';
import type { CourseDefinition, DrivingInput, GameEvent, RaceState } from '../data/types';
import { seededRandom } from '../core/random';
import { AiDriver } from '../ai/AiDriver';
import { Inventory } from '../items/Inventory';
import { ItemWorld } from '../items/ItemWorld';
import { gridPose, sampleTrack } from '../tracks/course';
import { KartController } from './KartController';
import { LapProgress } from './LapProgress';
import type { Racer, ResultRow } from './Racer';
import { rankRacers, validatedDistance } from './ranking';

const drivers = [
  ['You', '#ef6b43'], ['Moss', '#53855a'], ['Pip', '#e6b440'], ['Indigo', '#7775bb'],
  ['Coral', '#d7798a'], ['River', '#489fb1'], ['Ash', '#546273'], ['Peach', '#db9560'],
] as const;

export class Race {
  state: RaceState = 'countdown';
  countdown: number = config.race.countdown;
  time = 0;
  readonly racers: Racer[];
  readonly items: ItemWorld;
  readonly brains = new Map<string, AiDriver>();
  results: readonly ResultRow[] = [];
  private finishWait = 0;
  private finishCount = 0;
  private pausedState: RaceState = 'racing';
  readonly stats = { pickups: 0, boosts: 0, hits: 0, playerUses: 0 };
  constructor(readonly course: CourseDefinition, readonly seed = 4782) {
    this.racers = drivers.map(([name, color], index) => {
      const id = index === 0 ? 'player-1' : `ai-${index}`;
      const grid = gridPose(course, index);
      const controller = new KartController(course, grid);
      if (index > 0) this.brains.set(id, new AiDriver(seed + index * 101));
      return { id, name, color, player: index === 0, controller, progress: new LapProgress(course, id, true), inventory: new Inventory(), previous: { ...controller.state }, grid, input: { throttle: false, brake: false, steering: 0 }, coins: 0, pickupCooldown: 0, rescueRemaining: 0, rescues: 0, wrongWayTime: 0, finishTime: null, finishPlace: null, distance: -4 - Math.floor(index / 2) * 4.5 };
    });
    this.items = new ItemWorld(course, seededRandom(seed));
  }
  get player(): Racer { return this.racers[0]!; }
  get ranked(): Racer[] { return rankRacers(this.racers); }
  pause(): void {
    if (this.state === 'countdown' || this.state === 'racing' || this.state === 'finished') { this.pausedState = this.state; this.state = 'paused'; }
  }
  resume(): void { if (this.state === 'paused') this.state = this.pausedState; }
  rescue(racer: Racer): GameEvent[] {
    if (racer.finishTime !== null || racer.rescueRemaining > 0) return [];
    let pose = racer.grid;
    if (racer.progress.started) {
      const last = (racer.progress.nextCheckpoint + 11) % 12;
      const gate = this.course.checkpoints[last]!;
      pose = { x: gate.x + Math.sin(gate.heading), z: gate.z + Math.cos(gate.heading), heading: gate.heading };
    }
    racer.controller.reset(pose);
    racer.controller.state.immunity = config.race.rescueImmunity;
    racer.rescueRemaining = config.race.rescueDelay; racer.rescues++; racer.wrongWayTime = 0;
    Object.assign(racer.previous, racer.controller.state);
    racer.distance = validatedDistance(this.course, racer);
    return [{ type: 'rescue', racerId: racer.id }];
  }
  private collisions(): void {
    for (let i = 0; i < this.racers.length; i++) for (let j = i + 1; j < this.racers.length; j++) {
      const a = this.racers[i]!, b = this.racers[j]!;
      if (a.finishTime !== null || b.finishTime !== null || a.rescueRemaining > 0 || b.rescueRemaining > 0) continue;
      const x = a.controller.state.x - b.controller.state.x, z = a.controller.state.z - b.controller.state.z;
      const distance = Math.hypot(x, z);
      if (distance >= config.kart.radius * 2) continue;
      const nx = distance > 0.001 ? x / distance : 1, nz = distance > 0.001 ? z / distance : 0;
      const correction = Math.min(0.4, (config.kart.radius * 2 - distance) * 0.5);
      a.controller.state.x += nx * correction; a.controller.state.z += nz * correction;
      b.controller.state.x -= nx * correction; b.controller.state.z -= nz * correction;
      const relative = (a.controller.state.vx - b.controller.state.vx) * nx + (a.controller.state.vz - b.controller.state.vz) * nz;
      if (relative < 0) {
        const impulse = Math.min(2, -relative * 0.5);
        a.controller.state.vx += nx * impulse; a.controller.state.vz += nz * impulse;
        b.controller.state.vx -= nx * impulse; b.controller.state.vz -= nz * impulse;
      }
    }
  }
  update(input: DrivingInput, dt: number): GameEvent[] {
    const events: GameEvent[] = [];
    if (this.state === 'countdown') {
      this.countdown = Math.max(0, this.countdown - dt);
      if (this.countdown < 1e-8) { this.countdown = 0; this.state = 'racing'; events.push({ type: 'state', state: 'racing' }); }
      return events;
    }
    if (this.state !== 'racing' && this.state !== 'finished') return events;
    this.time += dt;
    for (const racer of this.racers) {
      Object.assign(racer.previous, racer.controller.state);
      if (racer.finishTime !== null) continue;
      racer.inventory.update(dt); racer.pickupCooldown = Math.max(0, racer.pickupCooldown - dt);
      if (racer.rescueRemaining > 0) { racer.rescueRemaining = Math.max(0, racer.rescueRemaining - dt); continue; }
      racer.input = racer.player ? input : this.brains.get(racer.id)!.read(this.course, racer, this.racers, dt, this.items.objects.filter((object) => object.active && object.age > config.items.armTime));
      if (racer.input.rescue) { events.push(...this.rescue(racer)); continue; }
      const state = racer.controller.state;
      if (![state.x, state.z, state.heading, state.vx, state.vz].every(Number.isFinite) || sampleTrack(this.course, state).distance > this.course.width + 10) {
        events.push(...this.rescue(racer)); continue;
      }
      const beforeBoost = state.boost;
      racer.controller.coinBonus = racer.coins * config.race.coinSpeed;
      racer.controller.update(racer.input, dt);
      if (state.boost > beforeBoost + 0.1) events.push({ type: 'boost', racerId: racer.id });
      if (racer.input.useItem) events.push(...this.items.use(racer, !!racer.input.rearward));
      const road = sampleTrack(this.course, state);
      const velocityAlong = state.vx * road.tangent.x + state.vz * road.tangent.z;
      racer.wrongWayTime = velocityAlong < -1.5 ? racer.wrongWayTime + dt : Math.max(0, racer.wrongWayTime - dt * 2);
    }
    this.collisions();
    const finishers: { racer: Racer; time: number }[] = [];
    for (const racer of this.racers) {
      if (racer.finishTime !== null || racer.rescueRemaining > 0) continue;
      events.push(...racer.progress.update(racer.previous, racer.controller.state, this.time));
      racer.distance = validatedDistance(this.course, racer);
      if (racer.progress.laps >= config.race.laps) {
        const gate = this.course.checkpoints[0]!;
        const along = (point: { x: number; z: number }) => (point.x - gate.x) * Math.sin(gate.heading) + (point.z - gate.z) * Math.cos(gate.heading);
        const before = along(racer.previous), after = along(racer.controller.state);
        const fraction = Math.max(0, Math.min(1, -before / (after - before)));
        finishers.push({ racer, time: this.time - dt + fraction * dt });
      }
    }
    finishers.sort((a, b) => a.time - b.time || a.racer.id.localeCompare(b.racer.id));
    for (const { racer, time } of finishers) {
      racer.finishTime = time; racer.finishPlace = ++this.finishCount;
      racer.controller.state.vx = 0; racer.controller.state.vz = 0; racer.controller.state.speed = 0;
      events.push({ type: 'finish', racerId: racer.id, place: racer.finishPlace, time });
      if (racer.player) { this.state = 'finished'; events.push({ type: 'state', state: 'finished' }); }
    }
    events.push(...this.items.update(dt, this.racers, this.time));
    for (const event of events) {
      if (event.type === 'pickup') this.stats.pickups++;
      if (event.type === 'hit') this.stats.hits++;
      if (event.type === 'boost') this.stats.boosts++;
      if (event.type === 'use' && event.racerId === this.player.id) this.stats.playerUses++;
    }
    if (this.state === 'finished') {
      this.finishWait += dt;
      if (this.finishCount === this.racers.length || this.finishWait >= config.race.finishTimeout) {
        this.results = Object.freeze(this.ranked.map((racer, index) => Object.freeze({ id: racer.id, name: racer.name, place: index + 1, time: racer.finishTime, coins: racer.coins, finished: racer.finishTime !== null })));
        this.state = 'results'; events.push({ type: 'state', state: 'results' });
      }
    }
    return events;
  }
}
