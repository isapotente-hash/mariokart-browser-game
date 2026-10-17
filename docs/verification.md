# Milestone One verification

Date: 17 October 2026 (Australia/Sydney).

Toolchain: Windows, Node.js 24.19.0, npm 11.17.0, Vite 8.3.4, Three.js 0.186.1 and TypeScript 7.0.2.

- `npm test`: 8 passed, 0 failed.
- `npm run build`: passed including strict TypeScript checking, zero errors.
- `npm run test:browser`: 1 passed in 42.5 seconds (test body: 36.7 seconds), zero browser console/page errors, zero failed or HTTP-error requests.
- Chromium 156.0.8078.4 / Playwright 1.64.1 loaded the actual production build at `/mariokart-browser-game/`, drove a complete lap on Pocket Loop through all twelve gates using keyboard events, then checked pause, resize, restart, repeated menu/restart cycles and refresh.
- Screenshots captured from this run: [title](screenshots/title.png) at 1440 × 900 and [driving](screenshots/driving.png) at 800 × 600. Both were visually inspected.

The browser test uses Playwright Chromium with SwiftShader software WebGL and a controlled clock. This verifies behavior, not representative GPU performance. Initial HTML/CSS/JS output is approximately 148 kB gzip. Real-time desktop/mobile frame rates, hardware GPU performance, Edge, Firefox, Safari and screen-reader sessions remain unmeasured.

Future systems (AI, drift, items, scoring, finish locking, saves, audio, traversal and multiplayer) and their checks are deferred to later milestones. General camera occlusion avoidance and automatic graphics context restoration also remain future work. GitHub Actions and live Pages results are reported separately from these local checks.
