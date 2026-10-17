# Milestone Two verification

Date: 18 October 2026 (Australia/Sydney). Tested locally on Windows with Node.js 24.19.0, npm 11.17.0, Vite 8.3.4, Three.js 0.186.1, TypeScript 7.0.2 and Playwright 1.64.1 / Chromium 156.0.8078.4.

## Results

- `npm test`: **22 passed, 0 failed**, approximately 4.1 seconds in the final isolated run.
- `npm run build`: **passed with zero errors**, including strict TypeScript checking.
- `npm run test:browser`: **1 passed**, approximately 3.2 minutes using SwiftShader software WebGL and a controlled simulation clock. No browser console/page errors, failed requests or HTTP errors.
- Production output: approximately **158 kB gzip** for initial HTML/CSS/JS. This measures bundle size; it does not certify network latency or real-time rendering performance.

## Requirement evidence

| Requirement | Evidence |
| --- | --- |
| Seven AI opponents using a sampled racing line and speed-dependent look-ahead | `AiDriver.ts` samples a speed-scaled target with curvature, braking-distance, surface and hazard response, reaction timing and overtaking cooldowns. Integrated tests on both courses finish all seven AI racers through three validated laps with zero routine rescues. |
| Visible eight-kart starting grid and three-second countdown | Shared `gridPose` supplies simulation spawns and painted starting cells. Unit test locks all eight poses and the race clock during countdown; browser test holds W before GO and verifies no movement, then enters racing. Actual countdown screenshot below. |
| Three laps and wrong-way indicator | Ordered forward gates start lap one without awarding a lap, then require all twelve gates for each completed lap. Unit checks reject shortcuts/backward crossings; browser drives three laps and checks player completion, and separately drives backward until the warning is visible. |
| Banana trap | Integrated item usage plus isolated arming-delay, single-hit, ownership-grace, immunity and coin-loss checks. Visible procedural peel model shares pooled object state with collision. |
| Bouncing shell | Unit tests verify barrier reflection, swept victim hit and expiry. Integrated races use shells through the same player/AI inventory interface; procedural green shell visuals use the active world object state. |
| Mushroom speed boost | Unit test invokes inventory use and verifies actual controller acceleration and bounded boost duration. Browser uses collected items during the race; all three item types are exercised in integrated simulations. |
| Two-slot inventory | Capacity, draw lock and automatic reserve promotion are unit-tested; DOM active/reserve layout is visible in screenshots. Browser drives through pickups and uses 21 items before finishing this captured run. |
| Drift boosts | Unit tests verify blue / orange / purple timing, release boost and hit cancellation. AI uses drift inputs through the shared controller in complete integrated races. Renderer and HUD pair colored sparks with one/two/three diamond labels. |
| Checkpoint rescue | Unit test preserves lap and next gate, verifies safe forward pose, immunity and two-second hold while race time advances. Browser presses F after reversing, verifies no awarded lap and no movement during the penalty. |
| Position / laps / coins / item slots / mini-map HUD | Actual rendered race screenshots show all HUD components. Browser results show player position 2/8, all three completed laps, ten carried coins and all eight racers. Coin cap, pickup cooldown and physical speed benefit are implemented in the shared simulation. |
| Results and finish locking | Tests verify validated ranking, same-step crossing-time order, immutable finish data, fifteen-second timeout and explicit DNF rows. Browser checks eight result rows, a finished player, a stable results table and both restart controls. |
| Clean restart | Browser restarts from results and checks lap zero, time zero, empty inventory, zero coins, zero finishers and zero world hazards, followed by countdown pause/resume, resize and repeated restart with exactly one canvas. Unit tests create fresh races with empty session state. |
| Production static subpath and build | Browser serves `dist` under `/mariokart-browser-game/`, refreshes successfully, and asserts zero missing/failed assets. Final strict production build passes. |

## Captured production screens

All were captured from the actual local production build and visually inspected:

- [Title](screenshots/title-m2.png), 1440 × 900.
- [Countdown and starting grid](screenshots/countdown-m2.png), 800 × 600.
- [Wrong-way warning](screenshots/wrong-way-m2.png), 800 × 600.
- [Racing, HUD and boost](screenshots/racing-m2.png), 800 × 600.
- [Final results](screenshots/results-m2.png), 800 × 600. Player finished second at 56.84 seconds; all seven AI finished by 61.20 seconds, and Race again returned to a clean countdown.

Pure simulation races with seed 4782 finished in about 61.2 seconds on Pocket Loop and 70.3 seconds on Garden Circuit. All eight finished without rescue, with banana/shell/mushroom activation counts of 38/16/28 and 33/12/22 respectively. This evidence applies to the documented seed and courses; it is not a claim about every possible input sequence.

## Remaining scope and unmeasured checks

The test uses software WebGL and a controlled clock, so it does not certify real-time GPU frame rates, input latency or the 1080p 60 fps / mobile 30 fps targets. Edge, Firefox, Safari, mobile, screen readers and subjective hardware audio playback remain unmeasured. The fixed-step simulation checks cover rendered 30/60/120 fps equivalence; they do not guarantee cross-browser bit-identical floating point.

The original course remains a flat procedural test environment; course length tuning toward the final two-to-four-minute target, ramps/tricks, obstacle-aware camera occlusion and automatic graphics context restoration remain future work. Four release courses, twelve racers, vehicle selection, five additional items, traversal, full modes, split screen, gamepad/touch, saves, quality presets and the complete music/engine audio system belong to Milestone Three. GitHub Actions and live Pages results are reported separately from these local checks.
