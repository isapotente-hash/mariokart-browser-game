# Pocket Circuit · Milestone One

An original procedural 3D karting playground built with TypeScript, Three.js and Vite. This implements **Milestone One on page 9 of [Specification.md](Specification.md)**. Later milestones remain out of scope.

## Run locally

Use **Node.js 24 LTS** and npm. The lockfile pins the dependency tree.

```sh
npm ci
npm run dev
```

Open the address printed by Vite, including `/mariokart-browser-game/`. Choose **Take a lap**. Garden Circuit is the main test course; Pocket Loop is a shortened version for quick completion checks.

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

Production preview: `http://127.0.0.1:4173/mariokart-browser-game/`. The complete static output is in `dist/`; no runtime backend or secrets are required.

## Controls

| Key | Action |
| --- | --- |
| W / Up | Accelerate |
| S / Down | Brake, then hold at a stop to reverse |
| A / Left, D / Right | Steer |
| Q (hold) | Rear view |
| Escape | Pause / resume |
| R | Restart practice, clock and checkpoint progress |

Controls are available from title and pause. Tab and Enter operate menus. Opening controls, losing focus or hiding the tab pauses driving and clears held keys. Closing controls leaves practice paused until resumed. The pause menu also offers restart and return to title.

Follow every checkpoint forward and cross the chequered line to record a valid lap. Backward, out-of-order, wide, repeated finish-line and teleport crossings cannot award a lap. Practice continues for unlimited laps. Reset discards session progress. Race results belong to Milestone Two.

## Feature status

- DOM title, course selection, controls, pause and driving HUD, with focus indicators and keyboard navigation.
- Procedural Garden Circuit and compact Pocket Loop, kerbs, start arch, trees, spectator stand, clouds and distant hills.
- Keyboard kart with momentum, speed-dependent steering, brake-before-reverse, grass slowdown and sliding barrier contacts.
- Spring-smoothed chase camera, speed-sensitive field of view and held rear view.
- Fixed 60 Hz simulation, bounded catch-up, transform interpolation, explicit states, stable player ID and shared typed events.
- Ordered swept checkpoint validation, lap timing, speed, surface and mini-map display.
- Restart, focus/visibility pause, resize, WebGL 2 capability screen and graphics-context-loss message.
- Static repository-subpath build, lockfile, Pages deployment and separate PR validation workflows.

AI racers, drifting, items, countdown, finish/results, gamepads, touch driving, audio, saves, multiplayer and special traversal are not implemented in this milestone. A desktop keyboard and WebGL 2 are required. The flat-course camera stays above ground; general obstacle occlusion avoidance and automatic WebGL restoration are deferred.

## Architecture and decisions

```text
index.html                 Static entry page
src/main.ts                Capability check and boot
src/core/                  Lifecycle, events, fixed-step timing, seeded randomness
src/gameplay/              Kart simulation and ordered lap validation
src/tracks/                Procedural course and surface sampling
src/rendering/             Three.js scene, models, lighting and camera
src/ui/                    DOM menus and HUD
src/platform/              Browser input and graphics detection
src/data/                  Shared types and tunable configuration
src/ai/, src/items/        Milestone Two extension points
public/assets/             Asset notes; no external media
tests/                     Simulation and production-browser checks
.github/workflows/         PR validation and Pages deployment
```

The simulation uses plain world-space data independently of Three.js. Dimensions are metres and seconds. Tunables are in `src/data/config.ts`: 27 m/s forward cap, 8 m/s reverse cap and 13 m/s grass cap. Each rendered frame advances at most six fixed steps; stalls cannot launch a kart forward. Rendering interpolates transforms.

The first course is deliberately flat and uses one continuous route. Twelve checkpoint planes validate order, direction, lateral position and bounded swept movement. Track visuals, collision queries and gates share the same sampled loop. The barrier sits beyond a slow grass shoulder. Scenery uses seed 4782. Fixed-step tests use a local 1e-9 numerical tolerance; cross-browser bit-identical replays are not promised.

Course changes dispose previous geometry, materials and instanced meshes. Restart reuses the renderer and scene and replaces simulation state. Repeated restarts do not add canvases or scene objects. The title camera is static and there is no camera shake. `?debug` enables the development overlay only in dev mode; it is disabled in public builds.

## Verify

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

The browser test serves actual `dist/` output at the repository subpath, starts practice, drives an ordered full lap using real keyboard events, checks pause, resize, repeated restart and return to title, then refreshes. Console/page errors, failed requests and HTTP errors fail it. Playwright's clock makes input repeatable without modifying simulation state. Hidden HUD telemetry is read-only. Pocket Loop can also be selected with `?course=short`.

Simulation tests cover spawns, checkpoint order/direction, shortcut and teleport rejection, duplicate laps, braking and reverse delay, restart, wall stability, seeded randomness, catch-up limits and equivalent driving at 30/60/120 rendered fps.

The smoke test saves actual screenshots to `docs/screenshots/title.png` and `docs/screenshots/driving.png`. See [verification notes](docs/verification.md) for measured results and limitations.

## Publish on GitHub Pages

Repository: [isapotente-hash/mariokart-browser-game](https://github.com/isapotente-hash/mariokart-browser-game). This local repository has it configured as `origin`. No deployed URL is claimed.

1. Push these files to the repository's `main` branch using your normal GitHub credentials. In the initially empty checkout: `git add .`, `git commit -m "Implement Milestone One kart playground"`, then `git push -u origin main`.
2. Select **Settings → Pages → Source → GitHub Actions** in the repository.
3. Run **Deploy game to GitHub Pages** in Actions, or push a change to `main`.
4. Find the published address in the successful workflow's `github-pages` environment. Later pushes to `main` update the game.

The workflow uses Node 24, `npm ci`, type checking, simulation tests, production build and Chromium smoke testing before uploading `dist`. Only the deployment job receives `pages: write` and `id-token: write`; builds and PR validation receive `contents: read`. Pull requests validate separately without deploying.

The exact base-path setting is **`vite.config.ts`**, default `/mariokart-browser-game/`. The deployment workflow supplies `VITE_BASE_PATH` from the repository name. For an account site or custom domain set it to `/`. Imported code and styles use Vite-managed paths; future media must use `import.meta.env.BASE_URL`. Update `playwright.config.ts` if changing the test/deployment subpath.

PowerShell overrides:

```powershell
$env:VITE_BASE_PATH = '/'
$env:VITE_GAME_TITLE = 'Your Kart Game'
npm run build
Remove-Item Env:VITE_BASE_PATH, Env:VITE_GAME_TITLE
```

Publishing follows [Vite's official Pages instructions](https://vite.dev/guide/static-deploy.html#github-pages).

## Assets, performance and troubleshooting

All models, materials and interface graphics are original procedural source, with system fonts. No Nintendo assets or external media requests are bundled. There is no audio yet.

Initial HTML/CSS/JS output is approximately **148 kB gzip**, excluding headers and server-specific compression. This is a bundle measurement, not a network or frame-rate guarantee. The renderer caps pixel ratio at 1.75, instances trees and uses one shadow-casting light. Desktop 60 fps / mobile 30 fps acceptance targets remain unmeasured.

- **Blank screen:** open the correct Vite subpath and enable hardware acceleration / WebGL 2. Unsupported hardware gets an explanatory screen.
- **Missing assets:** check `VITE_BASE_PATH`; serve `dist` with `npm run preview` instead of opening `index.html` using `file://`.
- **Muted audio:** expected in Milestone One.
- **Stale browser data:** hard-refresh after deployment. No service worker or persistent save is used yet.
- **Stopped after switching tabs:** focus the page and choose **Back to the track**; focus loss intentionally pauses and clears input.
- **Lost graphics context:** follow the on-screen reload message. Automatic restoration is deferred.
- **Smoke test cannot connect:** permit loopback socket access for Vite and Chromium when running inside a restricted sandbox.
