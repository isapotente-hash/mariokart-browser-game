# Pocket Circuit · Racing, Battle & Electrodrome

An original browser kart racer built with TypeScript, Three.js and Vite. The release implements page 9 of [Specification.md](Specification.md): four courses, twelve racers, eight original drivers, vehicle customization, eight items, special traversal, three racing modes plus Balloon Battle, local split screen, saves, procedural audio and quality presets. Electrodrome is an additional user-supplied imported course; its embedded attribution is preserved in [the asset credits](public/assets/tracks/README.md).

## Run

Use Node.js **24 LTS** and npm. The dependency lockfile is committed.

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Production preview: `http://127.0.0.1:4173/mariokart-browser-game/`. Choose **Race setup**, configure a mode and vehicle, then **Start race**. The static output is `dist/`; no runtime server or secrets are required.

```sh
npx playwright install chromium
npm run test:browser
```

Browser checks use the production build, real DOM controls and keyboard driving. `?course=short` uses compact versions of the four release courses for practical completion checks; traversal remains active. Normal play uses the full courses. See [Electrodrome verification](docs/verification-electrodrome.md), [Battle Mode verification](docs/verification-m4.md), [release verification](docs/verification-m3.md) and [Milestone Two verification](docs/verification-m2.md).

## Play

| Mode | Rules |
| --- | --- |
| Balloon Battle | Switchyard Plaza, twelve racers, three visible balloons each. Score opponent hits during a 30/60/120/180-second match (default two minutes), with safe respawns and one declared winner. |
| Versus | Choose course, difficulty, 50/100/150/200cc, one to five laps, all/basic/no items, mirror and one or two players. |
| Grand Prix | Four courses in order, three laps each. Points: 15, 12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1. Ties use wins, then final-race position. Resume an unfinished local cup or abandon it with confirmation. |
| Time Trial | One player, no opponents or random boxes, exactly three boosts. Personal bests and optional recorded transform ghosts are local. Comparisons separate course/physics version, vehicle, speed, mirror and assists. |

Finishers retain their crossing order; remaining AI have fifteen seconds after both humans finish. Results explicitly mark unfinished racers DNF. Every lap requires all twelve checkpoints in order and a forward finish crossing. Rescue preserves the required gate and lap count, with a two-second hold. Racing rules do not change with graphics quality.

| Course | Features |
| --- | --- |
| Electrodrome (bonus) | Supplied GLB venue, elevated magnetic roads including inverted sections, long glider jump and a magnetic return connector. Available in Versus and Time Trial; the four-race Grand Prix remains unchanged. |
| Garden Circuit | Hills, an ordinary jump/trick ramp and a grassy inside branch. |
| Harbour Run | Underwater tunnel with altered drag/grip, moving cargo and an outer pier route. |
| Sky Foundry | Banked anti-gravity surface, local gravity/camera alignment, glider launch and lower recovery route. |
| Starlight Causeway | Exposed night road, chained turns, falling/rescue and an alternate boost line. |

Mirror reflects physical geometry, banking and navigation. Gliders open only at marked launches. Ordinary jumps remain jumps; press drift immediately after takeoff for a landing boost. Gliding supports pitch and gentle yaw, bounded lift/descent and a return to the driving surface.

Eight selectable original drivers cover light, medium and heavy profiles. Three chassis, three tyre sets and two gliders alter both the procedural model and physics. Each of the five stats is `clamp(1 + driver + chassis + tyres + glider modifiers, 0.75, 1.30)`. Sail provides more lift; Delta trades lift for speed. All 144 combinations have validated bounded stats.

## Balloon Battle

Choose **Race setup → Balloon Battle → Start battle**. Switchyard Plaza is an 88 × 88 m open courtyard with four solid cover islands and intersecting central approaches. Four central double boxes reward exposure; twelve outer boxes form a safer supply loop. Twelve separated pads face inward. Both one-player and two-player split screen retain twelve competitors.

Each successful opponent hit pops one balloon and earns **+1 point**. A self-hit costs one point. Losing all three balloons or requesting rescue costs **2 points**, with scores floored at zero. Inventory clears and the kart waits for **three simulation seconds**; the safest available pad is selected at the end of the hold. Respawn restores three balloons and grants **three seconds of damage protection**. Active respawn holds and the match clock freeze on pause. Cover blocks karts, shells and explosives; leader strikes travel overhead. All eight items use the shared capacity, cooldown, immunity and ownership rules. There are no battle coins or lap checkpoints.

At the buzzer, results freeze. Rank by score, successful opponent hits, fewer balloons lost, earliest successful scoring hit, then original grid order. The winner is named even when scores tie. The HUD shows remaining time, live leaders, points, balloon count, attack warnings and respawn countdowns. Three separate 3D balloons above every kart disappear as hits land, including at low graphics quality.

Arena AI selects available supplies when empty, tracks and predicts moving opponents when armed, routes around cover with a visibility graph, and steers away from spatial item threats and nearby karts. It drives the same physical controller and uses the same items as humans. Recovery attempts reverse first; a manual AI rescue incurs the same score penalty. Race checkpoint logic is inactive in battle. Only Balloon Battle is exposed; additional expanded rule sets remain future scope.

## Controls

| Action | Player 1 | Player 2 |
| --- | --- | --- |
| Accelerate / brake-reverse | W / S | I / K |
| Steer | A / D | J / L |
| Hop / hold drift | Space | U |
| Item | E | Y |
| Rear view (hold) | Q | O |
| Rescue | F | H |
| Glider dive / pull up | Up / Down | N / M |
| Shared pause / restart | Escape / R | Escape / R |

Player One also has arrow-key driving shortcuts when those keys are not assigned to Player Two. Settings supports remapping, auto-acceleration, edge steering assist and separate input assignments. Keyboard rollover can limit two players on one keyboard.

Gamepad: A/RT accelerate, B/LT brake, left stick steer/pitch, X/RB drift, LB item, Y rear view, Back rescue and Start shared pause. Two gamepads or keyboard plus gamepad are supported. Disconnect pauses and offers reconnection or reassignment. Large multi-touch controls support one landscape viewport; touch split screen is outside the target. The on-screen **Pause** button opens shared pause. Settings and the control handbook are available there. Focus loss/hidden tabs pause and clear held keys; resume explicitly.

## Items and handling

Two slots hold active and reserve. Using active promotes reserve; no free swapping. Pickups have stable IDs, draw delay, capacity checks and respawn cooldowns. Brake + Item launches eligible items rearward. AI uses the same rules.

- Trap: delayed arming, owner grace and bounded lifetime.
- Bouncing shell: swept collision, barrier reflection and bounded bounces/lifetime.
- Boost: two seconds of increased acceleration/speed and reduced grass penalty.
- Homing seeker: course guidance, limited turn rate and visible/audio warning.
- Timed explosive: visible fuse, short travel, radius hit once per racer.
- Shield burst: clears nearby threats and provides a three-second defense window.
- Invincibility: seven seconds of immunity and a moderate speed benefit.
- Leader strike: route-following attack on the leading eligible opponent, advance warning and shield counter.

Weighted draws favor defense near the front and recovery behind. High-impact items have opening restrictions and low weights. Hits apply bounded spin/slowdown, up to three lost coins and brief immunity. Coins cap at ten and add 0.3% top speed each. Blue/orange/purple drift stages charge at 0.7/1.5/2.5 seconds and also use shapes/text. Release for a boost. Hits, rescue and severe impacts cancel charge.

## Settings and local records

Settings includes low/medium/high graphics, automatic/side/stacked split, reduced camera motion, HUD scale, three audio volumes, mute, assists, inputs and touch controls. Quality controls pixel ratio, shadows, particles, draw distance and decoration density. Two players share one 60 Hz simulation, independent cameras, rear views, inventories and HUDs.

Version 3 localStorage stores settings, garage currency, earned badges, cup progress and personal bests. Known schemas migrate; invalid values are sanitized. Larger ghosts use IndexedDB with memory fallback. Storage denial never blocks playing. Export/import small progress JSON from Settings; ghosts remain in the local database. Reset progress requires confirmation and retains settings. There is no global leaderboard.

Audio unlocks on Start and includes original generated music, engine pitch, drift, pickups, impacts, item warnings, countdown and finish cues. Master/music/effects volumes and mute persist. Pause suspends audio; unavailable audio does not block racing.

## Architecture and verification

`src/data` contains content and balance; `src/tracks` supplies geometry, local frames and collision queries; `src/gameplay` owns physics, race, traversal and mode sessions; `src/ai` and `src/items` share that simulation. `src/rendering` owns procedural visuals and cameras, `src/platform` input/audio/save/ghost adapters, and `src/ui` DOM menus and HUDs. Seeded simulation runs at fixed 60 Hz with bounded catch-up and interpolation. Spatial track caches, instanced scenery and fixed transient pools limit work; course swaps dispose geometry/materials and teardown removes listeners/audio nodes.

`npm test` covers progress/finish locking, fixed-step timing, inventory, all item systems, saves, ghosts, cup scoring, independent inputs and physical course runs. Browser checks exercise menu-to-race-to-results paths, real keyboard driving and saved data. Development-only testing can grant any item with `document.dispatchEvent(new CustomEvent('kart:force-item', { detail: 'homing' }))`; valid names are `banana`, `shell`, `mushroom`, `homing`, `explosive`, `shield`, `invincibility`, `leader`. Production contains no writable force-item hook. `?debug` enables development telemetry.

Initial HTML/CSS/JavaScript transfer is approximately **244 kB gzip**, plus the **763 kB supplied JPEG home artwork**, before the imported model. Selecting Electrodrome downloads its 15.5 MB GLB; other courses do not request it. This is a bundle measurement. Tests use Windows Chromium with software SwiftShader; desktop 1080p/60 fps and physical mobile 30 fps targets, real controllers, Firefox/Safari/Edge and screen-reader sessions remain unmeasured. Hardware rendering benchmarks must be reported separately from accelerated-clock verification.

## Publish to GitHub Pages

Configured repository: [isapotente-hash/mariokart-browser-game](https://github.com/isapotente-hash/mariokart-browser-game).

1. Push the reviewed milestone to `main`.
2. In repository **Settings → Pages**, select **GitHub Actions** as the source.
3. The **Deploy game to GitHub Pages** workflow installs with `npm ci`, typechecks, runs simulation tests, builds and runs production browser checks before uploading `dist`.
4. Find the actual published URL in the successful workflow's `github-pages` environment. Later pushes update the game. Manual dispatch is also supported; PRs validate separately.

Node 24 is used locally and in Actions. Only the deployment job receives `pages: write` and `id-token: write`; build/PR jobs have `contents: read`. Configure `base` in `vite.config.ts` or set `VITE_BASE_PATH`: `/mariokart-browser-game/` for this project site, `/` for an account site/custom domain. The workflow derives the base from the repository name. Imports use Vite-managed asset paths; future runtime media must use `import.meta.env.BASE_URL`. Update the test base in `playwright.config.ts` if changing the deployment subpath.

## Assets and troubleshooting

The original courses, drivers, icons, effects and sounds are procedural source. Electrodrome uses the supplied GLB with its own source/license metadata, credited separately. The home screen uses the supplied Mario Kart image with functional local mode buttons. Fonts are system fonts. See the [home screen and game bug audit](docs/bug-audit-2026-10-18.md) for collision, camera, input and recovery fixes and their verification.

- Blank screen: enable hardware acceleration/WebGL 2 and use the correct subpath. Unsupported graphics show an explanatory screen.
- Missing assets: verify `VITE_BASE_PATH`; serve `dist` with preview instead of opening `file://`.
- Muted audio: Start a race, check mute/master/music/effects controls and browser audio permission.
- Stale browser data: hard-refresh after deployment. Export local progress before resetting it. There is no service worker.
- Paused after switching tabs: focus the game and explicitly resume.
- Lost graphics context: use the displayed reload guidance. Automatic restoration is deferred.
- Browser test cannot connect: permit loopback sockets for Vite and Chromium in restricted environments.
