import { expect, test } from '@playwright/test';
import { createCourse, poseAt, sampleTrack } from '../../src/tracks/course';

test('production subpath: render, keyboard drive a valid lap, pause, resize and restart', async ({ page }) => {
  const errors: string[] = [];
  const failures: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', (request) => failures.push(request.url()));
  page.on('response', (response) => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
  await page.clock.install({ time: new Date('2026-10-17T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-17T00:00:01Z'));
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Take a lap' })).toBeVisible();
  await page.clock.fastForward(100);
  await expect(page.locator('canvas')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/title.png' });
  console.log('Title rendered at the repository subpath.');
  await page.setViewportSize({ width: 800, height: 600 });

  await page.getByRole('button', { name: 'Controls' }).click({ force: true });
  console.log('Controls opened.');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click({ force: true });
  console.log('Controls closed.');
  await page.getByLabel('COURSE', { exact: true }).selectOption('short');
  console.log('Compact course selected.');
  await page.getByRole('button', { name: 'Take a lap' }).click({ force: true });
  await expect(page.locator('body')).toHaveAttribute('data-state', 'racing');
  await page.clock.fastForward(100);
  console.log('Keyboard practice started.');
  const course = createCourse(true);
  let steeringKey: 'a' | 'd' | null = null;
  let throttleHeld = false;
  let brakeHeld = false;
  let laps = 0;
  for (let step = 0; step < 600 && laps === 0; step++) {
    const state = await page.locator('#telemetry').evaluate((element) => ({ ...((element as HTMLElement).dataset) }));
    const kart = { x: Number(state.x), z: Number(state.z), heading: Number(state.heading), speed: Number(state.speed) };
    const track = sampleTrack(course, kart);
    const target = poseAt(course, track.progress + 2 + Math.abs(kart.speed) * 0.35);
    const heading = Math.atan2(target.x - kart.x, target.z - kart.z);
    const error = Math.atan2(Math.sin(heading - kart.heading), Math.cos(heading - kart.heading));
    const nextKey = error > 0.045 ? 'a' : error < -0.045 ? 'd' : null;
    if (nextKey !== steeringKey) {
      if (steeringKey) await page.keyboard.up(steeringKey);
      if (nextKey) await page.keyboard.down(nextKey);
      steeringKey = nextKey;
    }
    const throttle = kart.speed < 8;
    const brake = kart.speed > 9;
    if (throttle !== throttleHeld) { await page.keyboard[throttle ? 'down' : 'up']('w'); throttleHeld = throttle; }
    if (brake !== brakeHeld) { await page.keyboard[brake ? 'down' : 'up']('s'); brakeHeld = brake; }
    await page.clock.fastForward(100);
    laps = Number(await page.locator('#telemetry').getAttribute('data-laps'));
    if (step % 50 === 0) console.log(`Driving step ${step}: checkpoint ${state.checkpoint}, speed ${kart.speed.toFixed(1)}, laps ${laps}.`);
  }
  expect(laps, 'keyboard input completes every ordered checkpoint and finish gate').toBe(1);
  if (steeringKey) await page.keyboard.up(steeringKey);
  await page.keyboard.up('w'); await page.keyboard.up('s');
  await expect(page.locator('#lap-count')).toHaveText('01');
  await page.screenshot({ path: 'docs/screenshots/driving.png' });
  const time = await page.locator('#telemetry').getAttribute('data-time');
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'paused');
  await page.clock.fastForward(1000);
  await expect(page.locator('#telemetry')).toHaveAttribute('data-time', time!);
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.getByRole('button', { name: 'Back to the track' }).click({ force: true });
  await page.keyboard.press('r');
  await page.clock.fastForward(100);
  await expect(page.locator('#lap-count')).toHaveText('00');
  const resetSpeed = Number(await page.locator('#telemetry').getAttribute('data-speed'));
  expect(resetSpeed).toBe(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Return to title' }).click({ force: true });
  await expect(page.getByRole('button', { name: 'Take a lap' })).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Take a lap' }).click({ force: true });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Restart practice' }).click({ force: true });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Return to title' }).click({ force: true });
  }
  await page.reload();
  await expect(page.getByRole('button', { name: 'Take a lap' })).toBeVisible();
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
});
