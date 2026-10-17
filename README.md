# Pocket Circuit · Milestone Two

An original TypeScript / Three.js / Vite kart racer implementing Milestones One and Two on page 9 of [Specification.md](Specification.md). One player races seven seeded AI opponents for three validated laps, with drifting, three functioning items, checkpoint rescue and results. Garden Circuit is the main course; Pocket Loop is the compact verification course.

## Run and verify

Use **Node.js 24 LTS** and npm. Dependencies are pinned in `package-lock.json`.

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Open `http://127.0.0.1:4173/mariokart-browser-game/` for production preview and choose **Start race**. The complete static output is in `dist/`, with no runtime backend or secrets. Vite prints the development address; retain the `/mariokart-browser-game/` subpath.

```sh
npx playwright install chromium
npm run test:browser
```

The browser check serves actual production output, checks the three-second countdown, drives backward to trigger a wrong-way warning, requests rescue, uses item pickups, completes three laps with real keyboard input, checks all eight result rows, and restarts into a clean countdown. It also checks pause, resize, repeated restarts, a single canvas, refresh and absence of console/page/network errors. Playwright controls time without modifying race state; read-only HUD telemetry guides keyboard input.

## Controls

| Key | Action |
| --- | --- |
| W / Up | Accelerate |
| S / Down | Brake, then hold to reverse |
| A / Left, D / Right | Steer |
| Space | Hop; hold while steering at speed to drift |
| E | Use active item, then promote reserve |
| Down + E (or S + E) | Launch a banana or shell rearward |
| F | Rescue to the last valid checkpoint, with a two-second hold |
| R | Restart the entire race from the countdown |
| Q (hold) | Rear view |
| Escape | Pause / resume the whole race |

Tab and Enter operate the menus. Controls remain available from pause. Focus loss and hidden tabs pause the countdown/race and clear held keys. Resume explicitly to continue. Sound cues unlock after Start race; **Sound on/off** mutes them. Audio denial never blocks racing.

## Race and item rules

Eight visible grid positions lead into 3, 2, 1, GO. Cars cannot move and the race clock does not advance during the countdown. The first forward finish-line crossing starts lap one; it does not award a lap. Each lap requires all twelve gates in order and a forward crossing of the finish. Wide crossings, backward crossings, skipped gates, repeated finish crossings and teleports cannot award laps. A wrong-way message appears after sustained backward course travel.

Blue boxes award items; the larger centre boxes fill both available slots. Inventory holds active and reserve with a short visible draw period. E consumes active and automatically promotes reserve; there is no swapping. Stable pickup IDs, four-second box respawns and racer cooldowns prevent repeated overlapping awards. AI follows exactly the same pickup, inventory, collision, damage and checkpoint rules.

- **Banana:** drop a visible trap ahead, or rearward with Down + E. It arms after 0.6 seconds, lasts at most 25 seconds, and is consumed on a successful hit.
- **Shell:** launch a green projectile with swept/substepped collision, reflective barrier bounces, eight-second lifetime and four-bounce limit.
- **Mushroom:** gain a two-second acceleration / speed boost, including reduced grass penalty. Boost durations use a bounded maximum rather than stacking without limit.

Hits cause a short visible spin, slowdown, loss of up to three coins and 2.5 seconds of damage immunity. Owners have a 0.8-second launch grace period; after that their own hazards can hit them. Transient objects use a fixed 64-object pool and are cleared on restart. Weighted item tables favor traps near the front and recovery boosts farther behind; shells are excluded during the opening three seconds.

Coins respawn after six seconds, cap at ten and add 0.3% top speed each. Race coins are session-only. Hold a valid on-road drift to charge **one blue diamond at 0.7 s, two orange at 1.5 s, three purple at 2.5 s**, then release Space for the corresponding mini-turbo. Shapes and labels accompany colors. Hits, severe barrier impacts, invalid movement and rescue cancel charge.

F returns to the last validated gate facing forward, preserves the next required checkpoint and lap count, and holds the kart for two seconds while the field and race clock continue. Recovery grants temporary immunity. It never advances progress. AI uses the same rescue after six seconds without meaningful validated progress; normal seeded races complete without relying on rescue.

HUD: position, current lap / three, race clock, coins, active/reserve items, all racers on the mini-map, speed, surface, drift stage, wrong-way and rescue/damage/boost feedback. Finish order is locked by interpolated crossing time, including simultaneous crossings within a simulation step. When the player finishes, opponents continue for up to fifteen seconds. Results list accepted finishers first, then explicitly mark unfinished racers **DNF** in validated-progress order. Race again creates a fresh grid, countdown, inventory, pickups, projectiles, clocks and AI state.

## Architecture and tuning

```text
src/core/          Browser lifecycle, fixed-step timing, seeded randomness
src/gameplay/      Race, racer state, controller, checkpoints, ranking, rescue
src/ai/            Sampled racing-line driver and seeded traits
src/items/         Two-slot inventory, pickups, trap/shell/boost world
src/rendering/     Procedural scene, eight kart models, pooled item visuals, camera
src/ui/            DOM menus, HUD, countdown, results
src/platform/      Keyboard, capabilities, original Web Audio cues
src/data/          Shared types, typed configuration, item definitions/weights
src/tracks/        Course samples, surface queries, checkpoints and spawn grid
public/assets/     Asset notes (no external media)
tests/             Pure simulation checks and production browser smoke test
.github/workflows/ PR validation and Pages deployment
```

Simulation is independent of Three.js and runs at fixed 60 Hz, at most six catch-up steps per rendered frame. Rendering interpolates positions; paused states freeze simulation and sound. Distances are metres and time is seconds. `src/data/config.ts` centralizes limits and timing; normal forward cap is 27 m/s, reverse 8 m/s, grass 13 m/s, and boosts add up to 8 m/s. Seed 4782 generates scenery and item choices; each AI has a stable seed for pace, reaction time, aggression, lane preference, item delay and drift confidence. No rubber-banding, progress shortcuts or collision bypasses are used.

AI samples farther ahead as speed increases, brakes for curvature, adjusts its line for slower karts / hazards, holds overtaking lane choices to prevent oscillation, and uses a bounded response delay. Compact-course target speeds are lower to preserve the same physical controller around tighter corners. Current seeded races last approximately one minute on Pocket Loop and a little over one minute on Garden Circuit; the final two-to-four-minute course tuning target remains for later course expansion.

The flat course shares samples across visuals, collision, progress, rescue and AI. The camera stays above ground; general obstacle occlusion avoidance is deferred. Restart reuses the renderer and render pools; course changes dispose old geometry, materials and instances. All listeners and audio resources are released on teardown. `?debug` enables development diagnostics. To force an item in **development only**, use `document.dispatchEvent(new CustomEvent('kart:force-item', { detail: 'shell' }))` in the console; `banana` and `mushroom` also work. Production builds contain no writable force-item hook. `?course=short` selects Pocket Loop directly.

## Verification and limitations

See [Milestone Two verification](docs/verification-m2.md) for results and screenshots. Tests cover checkpoints, spawn safety, 30/60/120 fps timing, bounded catch-up, inventory promotion, weighted draws, pickup cooldowns, coin cap, hit immunity, item reflection/hits/lifetime, boost effects, drift stages, rescue, validated ranking, finish locking, DNF timeout, full seeded races and restart.

Milestone Three features remain out of scope: four release courses, twelve racers, driver/vehicle selection, additional items, traversal, game modes, split screen, gamepads, touch driving, persistent settings/saves, full engine/music audio and quality presets. Remapping and assists are not yet exposed. The original test course is flat; ramps/tricks are deferred. This is a desktop keyboard / WebGL 2 vertical slice. Real GPU frame-rate targets, mobile, Firefox, Safari, Edge and screen-reader sessions remain unmeasured.

## GitHub Pages

Configured repository: [isapotente-hash/mariokart-browser-game](https://github.com/isapotente-hash/mariokart-browser-game). Push a reviewed milestone to `main` to trigger deployment; local implementation does not itself publish a new milestone.

1. Select **Settings → Pages → Source → GitHub Actions** in the repository.
2. Push to `main` or manually run **Deploy game to GitHub Pages**.
3. Find the real published address in the successful workflow's `github-pages` environment. Later pushes update the game.

Actions uses Node 24, `npm ci`, type checks, unit tests, build and production browser verification before uploading `dist`. Only deployment receives `pages: write` and `id-token: write`; builds / PR validation use `contents: read`. PRs validate separately without deployment. The exact base is in `vite.config.ts`, default `/mariokart-browser-game/`. The deploy workflow supplies `VITE_BASE_PATH` from the repository name. Use `/` for an account site or custom domain. Imported code/styles use Vite-managed paths; future runtime media must use `import.meta.env.BASE_URL`. Update `playwright.config.ts` if changing the test subpath. See [Vite's Pages documentation](https://vite.dev/guide/static-deploy.html#github-pages).

PowerShell build overrides:

```powershell
$env:VITE_BASE_PATH = '/'
$env:VITE_GAME_TITLE = 'Your Kart Game'
npm run build
Remove-Item Env:VITE_BASE_PATH, Env:VITE_GAME_TITLE
```

## Assets and troubleshooting

Every model, material, UI graphic and sound cue is original procedural source; fonts are system fonts. No Nintendo assets or external media/font requests are used. Sound is a small set of generated cues, not the full music/engine system. Initial HTML/CSS/JS output is about **158 kB gzip**; this is a bundle measurement, not a network/frame-rate guarantee. Rendering caps pixel ratio at 1.75, instances trees and uses a single 1024-square shadow map. Desktop 60 fps / mobile 30 fps performance targets remain unmeasured.

- **Blank screen:** use the correct subpath and enable hardware acceleration / WebGL 2. Unsupported graphics receive an explanatory screen.
- **Missing assets:** verify `VITE_BASE_PATH` and serve `dist` with `npm run preview`; do not open it using `file://`.
- **No sound:** click Start race, turn Sound on and allow browser audio. Music/engine audio is not implemented.
- **Stale data:** hard-refresh after deployment. There is no service worker or persistent save yet.
- **Paused after tab switching:** focus the page and explicitly resume.
- **Lost graphics context:** reload using the displayed recovery message; automatic restoration is deferred.
- **Browser test connection failure:** permit loopback sockets for Vite and Chromium in restricted environments.
