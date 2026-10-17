import { expect, test } from '@playwright/test';
import { createCourse, poseAt, sampleTrack } from '../../src/tracks/course';

test('production race: countdown, seven AI, items, rescue, three laps, results and clean restart', async ({ page }) => {
  const errors: string[] = [], failures: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', (request) => failures.push(request.url()));
  page.on('response', (response) => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
  const advance = async (seconds: number) => { for (let i = 0; i < Math.round(seconds * 10); i++) await page.clock.fastForward(100); };
  const read = () => page.locator('#telemetry').evaluate((element) => ({ ...((element as HTMLElement).dataset) }));
  await page.clock.install({ time: new Date('2026-10-18T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-18T00:00:01Z'));
  await page.goto('./');
  await page.clock.fastForward(100);
  await expect(page.getByRole('button', { name: 'Start race' })).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/title-m2.png' });
  await page.setViewportSize({ width: 800, height: 600 });
  await page.getByRole('button', { name: 'Controls' }).click({ force: true });
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click({ force: true });
  await page.getByLabel('COURSE', { exact: true }).selectOption('short');
  await page.getByRole('button', { name: 'Start race' }).click({ force: true });
  await page.clock.fastForward(100);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'countdown');
  await expect(page.locator('#countdown')).toHaveText('3');
  const start = await read();
  expect(start.aiCount).toBe('7');
  await page.screenshot({ path: 'docs/screenshots/countdown-m2.png' });
  await page.keyboard.down('w'); await advance(2);
  const locked = await read(); expect(locked.x).toBe(start.x); expect(locked.z).toBe(start.z); expect(locked.time).toBe('0');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'countdown');
  await advance(1.3); await page.keyboard.up('w');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'racing');
  // Real backwards movement must warn; checkpoint rescue must not grant a lap.
  await page.keyboard.down('s');
  for (let attempt = 0; attempt < 50 && (await read()).wrongWay !== 'true'; attempt++) await advance(0.1);
  await page.keyboard.up('s');
  await expect(page.locator('#wrong-way')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/wrong-way-m2.png' });
  await page.keyboard.press('f'); await advance(0.1);
  const rescued = await read(); expect(rescued.rescues).toBe('1'); expect(rescued.laps).toBe('0');
  await page.keyboard.down('w'); await advance(1); await page.keyboard.up('w');
  expect((await read()).x).toBe(rescued.x); expect((await read()).z).toBe(rescued.z);
  await advance(1.1);
  const course = createCourse(true);
  let steeringKey: 'a' | 'd' | null = null, throttleHeld = false, brakeHeld = false;
  let state = await read(), screenshotTaken = false;
  for (let frame = 0; frame < 1600; frame++) {
    if (await page.locator('body').getAttribute('data-state') === 'results') break;
    state = await read();
    const kart = { x: Number(state.x), z: Number(state.z), heading: Number(state.heading), speed: Number(state.speed) };
    const road = sampleTrack(course, kart);
    const target = poseAt(course, road.progress + 2 + Math.abs(kart.speed) * 0.35);
    const heading = Math.atan2(target.x - kart.x, target.z - kart.z);
    const error = Math.atan2(Math.sin(heading - kart.heading), Math.cos(heading - kart.heading));
    const nextKey = error > 0.045 ? 'a' : error < -0.045 ? 'd' : null;
    if (nextKey !== steeringKey) {
      if (steeringKey) await page.keyboard.up(steeringKey);
      if (nextKey) await page.keyboard.down(nextKey);
      steeringKey = nextKey;
    }
    const throttle = kart.speed < 8, brake = kart.speed > 9;
    if (throttle !== throttleHeld) { await page.keyboard[throttle ? 'down' : 'up']('w'); throttleHeld = throttle; }
    if (brake !== brakeHeld) { await page.keyboard[brake ? 'down' : 'up']('s'); brakeHeld = brake; }
    if (frame % 10 === 0 && state.active) await page.keyboard.press('e');
    await page.clock.fastForward(100);
    if (Number(state.laps) >= 1 && !screenshotTaken) { await page.screenshot({ path: 'docs/screenshots/racing-m2.png' }); screenshotTaken = true; }
    if (frame % 100 === 0) console.log(`Race ${state.time}s: lap ${state.laps}, gate ${state.checkpoint}, items ${state.itemsUsed}, finishers ${state.finishers}.`);
  }
  if (steeringKey) await page.keyboard.up(steeringKey);
  await page.keyboard.up('w'); await page.keyboard.up('s');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'results');
  state = await read(); expect(state.laps).toBe('3'); expect(Number(state.itemsUsed)).toBeGreaterThan(0);
  await expect(page.locator('#result-rows tr')).toHaveCount(8);
  await expect(page.locator('#result-rows tr[data-racer="player-1"]')).not.toContainText('DNF');
  await page.screenshot({ path: 'docs/screenshots/results-m2.png' });
  const results = await page.locator('#result-rows').textContent(); await advance(2); await expect(page.locator('#result-rows')).toHaveText(results!);
  await page.getByRole('button', { name: 'Race again' }).click({ force: true });
  await page.clock.fastForward(100);
  const restarted = await read();
  expect(restarted.laps).toBe('0'); expect(restarted.coins).toBe('0'); expect(restarted.worldItems).toBe('0');
  expect(restarted.active).toBe(''); expect(restarted.reserve).toBe(''); expect(restarted.time).toBe('0'); expect(restarted.finishers).toBe('0');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'countdown');
  await advance(1); await page.keyboard.press('Escape'); await page.clock.fastForward(100);
  const paused = await read(); await advance(2);
  expect((await read()).countdown).toBe(paused.countdown);
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.getByRole('button', { name: 'Back to the track' }).click({ force: true });
  await expect(page.locator('body')).toHaveAttribute('data-state', 'countdown');
  await page.keyboard.press('r'); await page.clock.fastForward(100);
  await expect(page.locator('#countdown')).toHaveText('3');
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Restart race' }).click({ force: true });
    await page.clock.fastForward(100); await expect(page.locator('body')).toHaveAttribute('data-state', 'countdown');
  }
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Return to title', exact: true }).filter({ visible: true }).click({ force: true });
  await page.reload(); await expect(page.getByRole('button', { name: 'Start race' })).toBeVisible();
  expect(errors).toEqual([]); expect(failures).toEqual([]);
});
