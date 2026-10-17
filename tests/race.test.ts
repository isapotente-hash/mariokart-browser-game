import assert from 'node:assert/strict';
import test from 'node:test';
import { AiDriver } from '../src/ai/AiDriver';
import { config } from '../src/data/config';
import { Race } from '../src/gameplay/Race';
import { KartController } from '../src/gameplay/KartController';
import { rankRacers, validatedDistance } from '../src/gameplay/ranking';
import { Inventory } from '../src/items/Inventory';
import { drawItem } from '../src/data/items';
import { createCourse, sampleTrack } from '../src/tracks/course';
import type { DrivingInput } from '../src/data/types';

const idle: DrivingInput = { throttle: false, brake: false, steering: 0 };
const dt = 1 / 60;
function step(race: Race, seconds: number, input = idle): void { for (let i = 0; i < Math.round(seconds * 60); i++) race.update(input, dt); }

test('grid has eight unique safe poses; three second countdown locks all movement and pauses', () => {
  const race = new Race(createCourse(true));
  assert.equal(race.racers.length, 8); assert.equal(race.brains.size, 7);
  for (const racer of race.racers) assert.ok(sampleTrack(race.course, racer.grid).distance < race.course.width / 2);
  const poses = race.racers.map((racer) => [racer.controller.state.x, racer.controller.state.z]);
  step(race, 2, { ...idle, throttle: true });
  assert.equal(race.state, 'countdown'); assert.equal(race.time, 0);
  assert.deepEqual(race.racers.map((racer) => [racer.controller.state.x, racer.controller.state.z]), poses);
  race.pause(); step(race, 3); assert.ok(Math.abs(race.countdown - 1) < 1e-8);
  race.resume(); step(race, 1); assert.equal(race.state, 'racing'); assert.equal(race.time, 0);
});

test('two slots enforce capacity, draw delay and automatic reserve promotion', () => {
  const inventory = new Inventory();
  assert.ok(inventory.add('banana')); assert.ok(inventory.add('shell')); assert.equal(inventory.add('mushroom'), false);
  assert.equal(inventory.use(), null); inventory.update(0.5);
  assert.equal(inventory.use(), 'banana'); assert.equal(inventory.active, 'shell'); assert.equal(inventory.reserve, null);
  assert.equal(inventory.use(), 'shell'); assert.equal(inventory.use(), null);
});

test('opening draw excludes shell; trailing draws favor recovery without invalid results', () => {
  for (let i = 0; i < 100; i++) assert.notEqual(drawItem(8, 100, 1, () => i / 100), 'shell');
  const kinds = Array.from({ length: 100 }, (_, i) => drawItem(8, 100, 10, () => i / 100));
  assert.ok(kinds.filter((kind) => kind === 'mushroom').length > 50);
});

test('banana arms, causes one hit, coin loss and immunity; owners have launch grace', () => {
  const race = new Race(createCourse()); race.state = 'racing';
  const owner = race.player, victim = race.racers[1]!;
  owner.inventory.add('banana'); owner.inventory.update(1);
  race.items.use(owner, true);
  const banana = race.items.objects.find((object) => object.active)!;
  victim.coins = 8; victim.controller.state.x = banana.x; victim.controller.state.z = banana.z;
  Object.assign(victim.previous, victim.controller.state);
  race.items.update(0.2, [victim], 5); assert.equal(race.items.hits, 0);
  race.items.update(0.5, [victim], 5.5); assert.equal(race.items.hits, 1);
  assert.equal(victim.coins, 5); assert.ok(victim.controller.state.spin > 0); assert.ok(victim.controller.state.immunity > 0);
  assert.equal(victim.controller.hit(), false); assert.equal(banana.active, false);
  owner.inventory.add('banana'); owner.inventory.update(1); race.items.use(owner, false);
  const other = race.items.objects.find((object) => object.active)!;
  other.age = 0.6; owner.controller.state.x = other.x; owner.controller.state.z = other.z; Object.assign(owner.previous, owner.controller.state);
  race.items.update(0.05, [owner], 7); assert.equal(owner.controller.state.spin, 0);
});

test('shell reflects at a barrier, sweeps a victim and expires; boost affects the controller', () => {
  const race = new Race(createCourse()); const owner = race.player;
  owner.inventory.add('shell'); owner.inventory.update(1); race.items.use(owner, false);
  const shell = race.items.objects.find((object) => object.active)!;
  const road = sampleTrack(race.course, shell);
  shell.x = road.x + road.normal.x * (race.course.width / 2 + 1.8); shell.z = road.z + road.normal.z * (race.course.width / 2 + 1.8);
  shell.vx = road.normal.x * 34; shell.vz = road.normal.z * 34;
  race.items.update(dt, [], 5); assert.ok(shell.bounces >= 1);
  assert.ok(shell.vx * road.normal.x + shell.vz * road.normal.z < 0);
  const victim = race.racers[1]!;
  victim.controller.state.x = shell.x + shell.vx * 0.03; victim.controller.state.z = shell.z + shell.vz * 0.03;
  race.items.update(0.05, [victim], 5.1); assert.equal(race.items.hits, 1); assert.equal(shell.active, false);
  owner.inventory.add('mushroom'); owner.inventory.update(1); race.items.use(owner, false);
  assert.equal(owner.controller.state.boost, 2);
  owner.controller.update({ ...idle, throttle: true }, dt); assert.ok(owner.controller.state.speed > 0.4);
  owner.controller.state.boost = 0; owner.inventory.add('shell'); owner.inventory.update(1); race.items.use(owner, false);
  race.items.update(9, [], 20); assert.equal(race.items.objects.some((object) => object.active), false);
});

test('pickup IDs and cooldowns prevent duplicate awards; coins cap at ten', () => {
  const race = new Race(createCourse()); const player = race.player;
  const box = race.items.pickups.find((pickup) => pickup.kind === 'box' && pickup.double)!;
  Object.assign(player.controller.state, { x: box.x, z: box.z }); Object.assign(player.previous, player.controller.state);
  race.items.update(dt, [player], 5); assert.ok(player.inventory.full);
  player.inventory.update(1); player.inventory.use(); player.inventory.use();
  race.items.update(dt, [player], 5.1); assert.equal(player.inventory.active, null);
  const coin = race.items.pickups.find((pickup) => pickup.kind === 'coin')!;
  Object.assign(player.controller.state, { x: coin.x, z: coin.z }); Object.assign(player.previous, player.controller.state); player.coins = 9;
  race.items.update(dt, [player], 6); assert.equal(player.coins, 10);
  coin.cooldown = 0; race.items.update(dt, [player], 7); assert.equal(player.coins, 10);
});

test('rescue preserves required gate and laps, returns to a valid forward pose and penalizes time', () => {
  const race = new Race(createCourse()); race.state = 'racing';
  const racer = race.player; racer.progress.started = true; racer.progress.nextCheckpoint = 7; racer.progress.laps = 2;
  racer.inventory.add('shell');
  race.rescue(racer);
  assert.equal(racer.progress.nextCheckpoint, 7); assert.equal(racer.progress.laps, 2);
  assert.ok(sampleTrack(race.course, racer.controller.state).distance < 0.1);
  assert.equal(racer.rescueRemaining, 2); assert.equal(racer.controller.state.immunity, 3);
  const saved = { ...racer.controller.state };
  step(race, 1, { ...idle, throttle: true });
  assert.equal(racer.controller.state.x, saved.x); assert.equal(racer.controller.state.z, saved.z); assert.ok(race.time > 0.99);
  assert.equal(racer.inventory.active, 'shell');
  assert.equal(racer.progress.laps, 2); assert.equal(racer.progress.nextCheckpoint, 7);
});

test('ranking uses validated gates; accepted finish order wins over physical position', () => {
  const race = new Race(createCourse()); const [a, b] = race.racers;
  a!.progress.started = true; a!.progress.nextCheckpoint = 1;
  const skip = race.course.samples[240]!; a!.controller.state.x = skip.x; a!.controller.state.z = skip.z;
  assert.ok(validatedDistance(race.course, a!) <= race.course.samples[30]!.distance);
  a!.distance = 9999; b!.distance = 0; b!.finishPlace = 1; b!.finishTime = 10;
  assert.equal(rankRacers([a!, b!])[0]!.id, b!.id);
});

test('same-step finish crossings are ordered by crossing time and stay locked', () => {
  const race = new Race(createCourse()); race.state = 'racing'; race.time = 50;
  for (let i = 0; i < 2; i++) {
    const racer = race.racers[i]!, gate = race.course.checkpoints[0]!;
    racer.player = true; racer.progress.started = true; racer.progress.laps = 2; racer.progress.nextCheckpoint = 0;
    const before = i === 0 ? 0.2 : 0.08, side = i === 0 ? -1.5 : 1.5;
    Object.assign(racer.controller.state, { x: gate.x - Math.sin(gate.heading) * before + Math.cos(gate.heading) * side, z: gate.z - Math.cos(gate.heading) * before - Math.sin(gate.heading) * side, heading: gate.heading, vx: Math.sin(gate.heading) * 20, vz: Math.cos(gate.heading) * 20 });
  }
  race.update(idle, dt);
  assert.equal(race.racers[1]!.finishPlace, 1); assert.equal(race.player.finishPlace, 2);
  const locked = race.player.finishTime;
  Object.assign(race.player.controller.state, race.course.spawn);
  step(race, 2); assert.equal(race.player.finishTime, locked); assert.equal(race.player.finishPlace, 2);
});

test('results timeout clearly marks unfinished racers and freezes the accepted snapshot', () => {
  const race = new Race(createCourse()); race.state = 'finished';
  race.player.finishTime = 10; race.player.finishPlace = 1;
  step(race, 15.1);
  assert.equal(race.state, 'results'); assert.equal(race.results.length, 8);
  assert.equal(race.results[0]!.id, 'player-1');
  assert.ok(race.results.slice(1).some((row) => !row.finished && row.time === null));
  const snapshot = JSON.stringify(race.results); step(race, 20); assert.equal(JSON.stringify(race.results), snapshot);
});

test('all three drift stages charge in simulation time, release boosts and hits cancel charge', () => {
  for (const [index, seconds] of [0.8, 1.6, 2.6].entries()) {
    const controller = new KartController(createCourse());
    // Keep the kart in a known valid road frame while testing charge timing independently of steering.
    for (let i = 0; i < seconds * 60; i++) {
      const s = controller.state;
      Object.assign(s, { x: 0, z: 60, heading: Math.PI / 2, vx: 12, vz: 0 });
      controller.update({ ...idle, throttle: true, steering: 0.2, drift: true }, dt);
      assert.ok(Number.isFinite(s.driftCharge));
    }
    assert.equal(controller.state.driftStage, index + 1);
    controller.update({ ...idle, throttle: true }, dt); assert.ok(controller.state.boost > 0);
    controller.hit(); assert.equal(controller.state.driftStage, 0); assert.equal(controller.state.boost, 0);
  }
});

for (const compact of [true, false]) test(`complete seeded 3-lap race and clean restart (${compact ? 'Pocket Loop' : 'Garden Circuit'})`, () => {
  const course = createCourse(compact); const race = new Race(course); const driver = new AiDriver(2026);
  const events: string[] = [];
  for (let i = 0; i < 60 * 200 && race.state !== 'results'; i++) {
    const input = driver.read(course, race.player, race.racers, dt);
    for (const event of race.update(input, dt)) events.push(event.type);
  }
  console.log(course.name, race.time.toFixed(1), race.racers.map((r) => `${r.name}:${r.progress.laps}/${r.progress.nextCheckpoint} rescue=${r.rescues}`).join(' '), race.items.usage);
  assert.equal(race.state, 'results'); assert.equal(race.player.progress.laps, 3);
  assert.equal(race.results.length, 8); assert.ok(events.includes('finish'));
  assert.equal(race.racers.filter((r) => !r.player && r.progress.laps === 3).length, 7, 'all AI must complete full valid laps without progress shortcuts');
  assert.equal(race.racers.reduce((total, r) => total + r.rescues, 0), 0, 'routine AI racing must not rely on rescue teleports');
  for (const count of Object.values(race.items.usage)) assert.ok(count > 0, 'all three items must be used in the integrated race');
  for (const row of race.results) if (row.finished) assert.ok(row.time! > 0);
  const results = JSON.stringify(race.results); step(race, 20); assert.equal(JSON.stringify(race.results), results);
  const restart = new Race(course);
  assert.equal(restart.state, 'countdown'); assert.equal(restart.time, 0);
  assert.equal(restart.items.objects.filter((object) => object.active).length, 0);
  for (const racer of restart.racers) { assert.equal(racer.coins, 0); assert.equal(racer.inventory.active, null); assert.equal(racer.progress.laps, 0); assert.equal(racer.finishTime, null); }
  assert.equal(restart.countdown, config.race.countdown);
});
