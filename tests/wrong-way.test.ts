import assert from 'node:assert/strict';
import test from 'node:test';
import { Race } from '../src/gameplay/Race';
import { createCourse, sampleTrack } from '../src/tracks/course';

test('backwards travel produces a wrong-way warning without awarding course progress', () => {
  const race = new Race(createCourse(true)); race.state = 'racing';
  for (const ai of race.racers.slice(1)) ai.finishTime = 0;
  for (let i = 0; i < 150; i++) race.update({ throttle: false, brake: true, steering: 0 }, 1 / 60);
  const state = race.player.controller.state, road = sampleTrack(race.course, state);
  console.log('Reverse unit:', state.speed, race.player.wrongWayTime, state.vx * road.tangent.x + state.vz * road.tangent.z);
  assert.ok(race.player.wrongWayTime >= 0.6); assert.equal(race.player.progress.laps, 0);
});
