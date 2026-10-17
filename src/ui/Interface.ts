import { config } from '../data/config';
import type { CourseDefinition, KartState, RaceState } from '../data/types';
import type { LapProgress } from '../gameplay/LapProgress';

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;
}

export class Interface {
  readonly menu: HTMLElement;
  readonly hud: HTMLElement;
  readonly pause: HTMLElement;
  readonly controls: HTMLDialogElement;
  private toastTimer = 0;
  private readonly speed: HTMLElement;
  private readonly time: HTMLElement;
  private readonly laps: HTMLElement;
  private readonly best: HTMLElement;
  private readonly mapMarker: SVGCircleElement;
  private readonly telemetry: HTMLElement;
  private readonly debug: HTMLElement;
  onStart: () => void = () => {};
  onResume: () => void = () => {};
  onRestart: () => void = () => {};
  onMenu: () => void = () => {};
  onCourse: (short: boolean) => void = () => {};

  constructor(root: HTMLElement) {
    root.innerHTML = `
      <div id="world"></div>
      <div class="vignette" aria-hidden="true"></div>
      <header class="site-header">
        <a class="brand" href="#menu" aria-label="Return to title"><span class="brand-icon" aria-hidden="true">P<span>↗</span></span><span class="brand-name"></span></a>
        <div class="header-right"><span class="build-tag">THE FIRST LAP <span> / </span> 001</span><button class="quiet-button" data-action="controls">Controls <span aria-hidden="true">↗</span></button></div>
      </header>
      <main id="menu" class="title-screen">
        <div class="eyebrow"><span class="live-dot"></span> A LITTLE KART. A WIDE OPEN ROAD.</div>
        <h1>Good turns.<br>Great <span>times.</span></h1>
        <p class="intro">A pocket-sized racing escape.<br>Find your line, feel the corners, and make<br class="wide-only"> the next lap your best one.</p>
        <div class="course-picker" aria-label="Select practice course">
          <div class="course-heading"><span>YOUR PLAYGROUND</span><span>01 / PRACTICE</span></div>
          <div class="course-option"><span class="course-stamp" aria-hidden="true">↝</span><div><label for="course-select">COURSE</label><select id="course-select"><option value="garden">Garden Circuit</option><option value="short">Pocket Loop · short test course</option></select></div><span class="course-badge">FREE DRIVE</span></div>
          <div class="course-details"><span id="course-length"></span><span>ONE KART</span><span>ENDLESS LAPS</span></div>
        </div>
        <button class="primary-button" id="start">Take a lap <span aria-hidden="true">↗</span></button>
        <p class="start-note"><span class="key">W</span> to go &nbsp; <span class="key">A</span><span class="key">D</span> to find your line</p>
      </main>
      <aside class="scene-caption" aria-hidden="true"><span class="caption-line"></span><span>MEET YOUR WEEKEND RIDE<br><strong>The little orange one.</strong></span></aside>
      <footer class="menu-footer"><span>BUILT FOR THE JOY OF THE DRIVE.</span><span><i></i> ORIGINAL 3D PLAYGROUND <span class="footer-divider">/</span> MILESTONE 01</span></footer>
      <section id="hud" class="hud" aria-label="Practice information" hidden>
        <div class="session-card"><span class="eyebrow">FREE DRIVE <span class="live-dot"></span></span><h2 id="hud-course"></h2><span class="session-description">Pass every gate. Make it a good lap.</span></div>
        <div class="lap-card"><div><span class="metric-label">VALID LAPS</span><strong id="lap-count">00</strong></div><div><span class="metric-label">SESSION TIME</span><strong id="race-time">00:00.00</strong></div></div>
        <div class="map-card"><svg viewBox="-78 -85 156 170" role="img" aria-label="Course mini map"><path id="map-path"></path><circle id="map-marker" r="4"></circle><path id="map-finish"></path></svg><span id="gate-count">GATE 01 / 12</span></div>
        <div class="driving-help"><span class="key">ESC</span> pause <span class="help-divider">/</span> <span class="key">R</span> restart <span class="help-divider">/</span> <span class="key">Q</span> rear view</div>
        <div class="speed-card"><span id="surface">ON THE TARMAC</span><div><strong id="speed">0</strong><span>KM/H</span></div><div class="speed-track"><i id="speed-fill"></i></div><p>LAST LAP <strong id="last-lap">—</strong></p></div>
        <div id="lap-toast" class="lap-toast" role="status" aria-live="polite" hidden></div>
        <output id="telemetry" hidden></output>
      </section>
      <section id="pause" class="modal-scrim" aria-label="Practice paused" hidden><div class="modal-card"><span class="eyebrow">A MOMENT IN THE PITS</span><h2>Take a breather.</h2><p>Your kart will be right here.</p><button class="primary-button" id="resume">Back to the track <span>↗</span></button><button class="secondary-button" id="restart">Restart practice</button><button class="text-button" id="back-menu">Return to title</button></div></section>
      <dialog id="controls"><div class="modal-card"><span class="eyebrow">THE DRIVER’S HANDBOOK</span><h2>Find your feet.</h2><dl class="control-list"><div><dt><kbd>W</kbd> / <kbd>↑</kbd></dt><dd>Accelerate</dd></div><div><dt><kbd>S</kbd> / <kbd>↓</kbd></dt><dd>Brake, then hold to reverse</dd></div><div><dt><kbd>A</kbd><kbd>D</kbd> / <kbd>←</kbd><kbd>→</kbd></dt><dd>Steer left / right</dd></div><div><dt><kbd>Q</kbd></dt><dd>Hold for rear view</dd></div><div><dt><kbd>R</kbd></dt><dd>Restart practice and lap progress</dd></div><div><dt><kbd>Esc</kbd></dt><dd>Pause / resume</dd></div></dl><p class="controls-note">Follow the circuit forward through all 12 gates to record a valid lap. Grass slows you down. This first playground is for keyboard driving; race opponents, drifting and items arrive in later milestones.</p><button class="primary-button" id="close-controls">Got it <span>✓</span></button></div></dialog>
      <pre id="debug" hidden></pre>
    `;
    document.title = config.title;
    root.querySelector('.brand-name')!.textContent = config.title;
    this.menu = root.querySelector('#menu')!;
    this.hud = root.querySelector('#hud')!;
    this.pause = root.querySelector('#pause')!;
    this.controls = root.querySelector('#controls')!;
    this.speed = root.querySelector('#speed')!;
    this.time = root.querySelector('#race-time')!;
    this.laps = root.querySelector('#lap-count')!;
    this.best = root.querySelector('#last-lap')!;
    this.mapMarker = root.querySelector('#map-marker')!;
    this.telemetry = root.querySelector('#telemetry')!;
    this.debug = root.querySelector('#debug')!;
    this.debug.hidden = !(import.meta.env.DEV && new URLSearchParams(location.search).has('debug'));
    root.querySelector('#start')!.addEventListener('click', () => this.onStart());
    root.querySelector('#resume')!.addEventListener('click', () => this.onResume());
    root.querySelector('#restart')!.addEventListener('click', () => this.onRestart());
    root.querySelector('#back-menu')!.addEventListener('click', () => this.onMenu());
    root.querySelector('.brand')!.addEventListener('click', (event) => { event.preventDefault(); this.onMenu(); });
    root.querySelectorAll('[data-action="controls"]').forEach((button) => button.addEventListener('click', () => {
      this.controls.showModal();
      document.dispatchEvent(new Event('open-controls'));
    }));
    root.querySelector('#close-controls')!.addEventListener('click', () => this.controls.close());
    root.querySelector('#course-select')!.addEventListener('change', (event) => this.onCourse((event.target as HTMLSelectElement).value === 'short'));
  }

  setCourse(course: CourseDefinition): void {
    document.querySelector('#hud-course')!.textContent = course.name;
    document.querySelector('#course-length')!.textContent = `${Math.round(course.length)} M CIRCUIT`;
    const factor = course.id === 'pocket-loop' ? 1 / 0.35 : 1;
    document.querySelector('#map-path')!.setAttribute('d', `M ${course.samples.map((p) => `${p.x * factor},${p.z * factor}`).join(' L ')} Z`);
    const finish = course.checkpoints[0]!;
    document.querySelector('#map-finish')!.setAttribute('d', `M ${finish.x * factor - 5},${finish.z * factor} l 10,0`);
    (document.querySelector('#course-select') as HTMLSelectElement).value = course.id === 'pocket-loop' ? 'short' : 'garden';
  }

  setState(state: RaceState): void {
    document.body.dataset.state = state;
    this.menu.hidden = state !== 'menu';
    this.hud.hidden = state === 'menu';
    this.pause.hidden = state !== 'paused';
    document.querySelector<HTMLElement>('.scene-caption')!.hidden = state !== 'menu';
    document.querySelector<HTMLElement>('.menu-footer')!.hidden = state !== 'menu';
    document.querySelector<HTMLElement>('.build-tag')!.hidden = state !== 'menu';
    if (state === 'paused' && !this.controls.open) document.querySelector<HTMLButtonElement>('#resume')!.focus();
    if (state === 'menu') document.querySelector<HTMLButtonElement>('#start')!.focus({ preventScroll: true });
    if (state === 'racing') (document.activeElement as HTMLElement | null)?.blur();
  }

  update(kart: KartState, progress: LapProgress, time: number, course: CourseDefinition, dt: number): void {
    this.speed.textContent = String(Math.round(Math.abs(kart.speed) * 3.6));
    this.time.textContent = formatTime(time);
    this.laps.textContent = String(progress.laps).padStart(2, '0');
    this.best.textContent = progress.lastLapTime ? formatTime(progress.lastLapTime) : '—';
    document.querySelector('#gate-count')!.textContent = `GATE ${String(progress.nextCheckpoint + 1).padStart(2, '0')} / 12`;
    document.querySelector('#surface')!.textContent = kart.surface === 'grass' ? 'TAKE THE SCENIC ROUTE' : 'ON THE TARMAC';
    (document.querySelector('#speed-fill') as HTMLElement).style.width = `${Math.min(100, Math.abs(kart.speed) / config.kart.maxSpeed * 100)}%`;
    const factor = course.id === 'pocket-loop' ? 1 / 0.35 : 1;
    this.mapMarker.setAttribute('cx', String(kart.x * factor)); this.mapMarker.setAttribute('cy', String(kart.z * factor));
    // Read-only telemetry allows smoke tests to exercise actual keyboard controls.
    Object.assign(this.telemetry.dataset, { x: String(kart.x), z: String(kart.z), heading: String(kart.heading), speed: String(kart.speed), checkpoint: String(progress.nextCheckpoint), laps: String(progress.laps), time: String(time) });
    if (!this.debug.hidden) this.debug.textContent = `frame ${(dt * 1000).toFixed(1)} ms\nspeed ${kart.speed.toFixed(2)} m/s\nsurface ${kart.surface}\ncheckpoint ${progress.nextCheckpoint}\ndrift: unavailable (M2)\nitems: unavailable (M2)`;
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) document.querySelector<HTMLElement>('#lap-toast')!.hidden = true;
    }
  }

  showLap(lap: number, time: number): void {
    const toast = document.querySelector<HTMLElement>('#lap-toast')!;
    toast.textContent = `LAP ${lap} COMPLETE · ${formatTime(time)}`; toast.hidden = false; this.toastTimer = 4;
  }
  clearLap(): void {
    this.toastTimer = 0; document.querySelector<HTMLElement>('#lap-toast')!.hidden = true;
  }
}
