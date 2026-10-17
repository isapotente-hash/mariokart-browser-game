import assert from 'node:assert/strict';
import test from 'node:test';
import { FixedStep } from '../src/core/FixedStep';
import { seededRandom } from '../src/core/random';
import { KartController } from '../src/gameplay/KartController';
import { LapProgress } from '../src/gameplay/LapProgress';
import { createCourse, poseAt, sampleTrack } from '../src/tracks/course';
import type { Checkpoint, Point } from '../src/data/types';

const course = createCourse();
const gateSides = (gate: Checkpoint): [Point, Point] => [
  { x: gate.x - Math.sin(gate.heading) * 0.7, z: gate.z - Math.cos(gate.heading) * 0.7 },
  { x: gate.x + Math.sin(gate.heading) * 0.7, z: gate.z + Math.cos(gate.heading) * 0.7 },
];

test('course is closed, finite and each spawn is on the drivable ribbon', () => {
  for (const c of [course, createCourse(true)]) {
    assert.ok(c.length > 100);
    assert.equal(c.checkpoints.length, 12);
    assert.ok(sampleTrack(c, c.spawn).distance < 0.01);
    for (let s = 0; s < c.length; s += 0.5) {
      const pose = poseAt(c, s);
      assert.ok([pose.x, pose.z, pose.heading].every(Number.isFinite));
      assert.ok(sampleTrack(c, pose).distance < 0.01);
    }
  }
});

test('a valid lap requires every checkpoint in order and a forward finish crossing', () => {
  const laps = new LapProgress(course);
  for (let i = 1; i <= 12; i++) {
    const index = i % 12;
    const events = laps.update(...gateSides(course.checkpoints[index]!), i);
    assert.equal(events[0]?.type, 'checkpoint');
    assert.equal(laps.laps, i === 12 ? 1 : 0);
  }
  assert.equal(laps.lastLapTime, 12);
  assert.equal(laps.nextCheckpoint, 1);
  assert.deepEqual(laps.update(...gateSides(course.checkpoints[0]!), 13), []);
  assert.equal(laps.laps, 1);
});

test('backward crossings, skipped gates, wide shortcuts and teleport crossings award no progress', () => {
  const laps = new LapProgress(course);
  const [before, after] = gateSides(course.checkpoints[1]!);
  assert.deepEqual(laps.update(after, before, 1), []);
  assert.deepEqual(laps.update(...gateSides(course.checkpoints[2]!), 2), []);
  const gate = course.checkpoints[1]!;
  const shift = gate.halfWidth + 2;
  const wide = (point: Point) => ({ x: point.x + Math.cos(gate.heading) * shift, z: point.z - Math.sin(gate.heading) * shift });
  assert.deepEqual(laps.update(wide(before), wide(after), 3), []);
  assert.deepEqual(laps.update({ x: gate.x - 10 * Math.sin(gate.heading), z: gate.z - 10 * Math.cos(gate.heading) }, after, 4), []);
  assert.equal(laps.nextCheckpoint, 1);
  assert.equal(laps.laps, 0);
});

test('fixed simulation has the same acceleration at 30, 60 and 120 render frames per second', () => {
  const results = [30, 60, 120].map((fps) => {
    const kart = new KartController(course);
    const clock = new FixedStep();
    for (let i = 0; i < fps * 2; i++) clock.advance(1 / fps, (dt) => kart.update({ throttle: true, brake: false, steering: 0 }, dt));
    return kart.state;
  });
  for (const state of results.slice(1)) {
    for (const key of ['x', 'z', 'heading', 'speed'] as const) assert.ok(Math.abs(state[key] - results[0]![key]) < 1e-9);
  }
  assert.ok(results[0]!.speed > 10);
});

test('stalls have bounded catch-up and reset discards pending simulation time', () => {
  const clock = new FixedStep();
  let steps = 0;
  clock.advance(10, () => steps++);
  assert.equal(steps, 6);
  clock.advance(1 / 120, () => steps++);
  clock.reset();
  clock.advance(1 / 120, () => steps++);
  assert.equal(steps, 6);
});

test('braking stops before reversing, and restart resets motion and position', () => {
  const kart = new KartController(course);
  for (let i = 0; i < 40; i++) kart.update({ throttle: true, brake: false, steering: 0 }, 1 / 60);
  for (let i = 0; i < 20; i++) kart.update({ throttle: false, brake: true, steering: 0 }, 1 / 60);
  assert.ok(kart.state.speed >= 0);
  for (let i = 0; i < 60; i++) kart.update({ throttle: false, brake: true, steering: 0 }, 1 / 60);
  assert.ok(kart.state.speed < -0.1);
  kart.reset();
  assert.equal(kart.state.speed, 0);
  assert.equal(kart.state.x, course.spawn.x);
  assert.equal(kart.state.z, course.spawn.z);
});

test('a driven full lap is accepted on both procedural courses; wall contacts stay finite', () => {
  for (const c of [course, createCourse(true)]) {
    const kart = new KartController(c);
    const laps = new LapProgress(c);
    for (let i = 0; i < 60 * 100 && laps.laps === 0; i++) {
      const previous = { ...kart.state };
      const sample = sampleTrack(c, kart.state);
      const target = poseAt(c, sample.progress + 2 + Math.abs(kart.state.speed) * 0.35);
      const heading = Math.atan2(target.x - kart.state.x, target.z - kart.state.z);
      const error = Math.atan2(Math.sin(heading - kart.state.heading), Math.cos(heading - kart.state.heading));
      const desired = c.id === 'pocket-loop' ? 8 : 16;
      kart.update({ throttle: kart.state.speed < desired, brake: kart.state.speed > desired + 1, steering: Math.max(-1, Math.min(1, error * 3.5)) }, 1 / 60);
      laps.update(previous, kart.state, i / 60);
    }
    assert.equal(laps.laps, 1, `failed driven lap on ${c.name}`);
    for (let i = 0; i < 600; i++) kart.update({ throttle: true, brake: false, steering: 1 }, 1 / 60);
    assert.ok([kart.state.x, kart.state.z, kart.state.speed].every(Number.isFinite));
    assert.ok(sampleTrack(c, kart.state).distance <= c.width / 2 + 2.4);
  }
});

test('procedural scenery randomness is repeatable', () => {
  const a = seededRandom(1234);
  const b = seededRandom(1234);
  assert.deepEqual(Array.from({ length: 20 }, a), Array.from({ length: 20 }, b));
});
