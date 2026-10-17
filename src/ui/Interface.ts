import { config } from '../data/config';
import type { CourseDefinition, RaceState } from '../data/types';
import type { Race } from '../gameplay/Race';
import { itemDefinitions } from '../data/items';

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
  onSound: () => void = () => {};

  constructor(root: HTMLElement) {
    root.innerHTML = `
      <div id="world"></div>
      <div class="vignette" aria-hidden="true"></div>
      <header class="site-header">
        <a class="brand" href="#menu" aria-label="Return to title"><span class="brand-icon" aria-hidden="true">P<span>↗</span></span><span class="brand-name"></span></a>
        <div class="header-right"><span class="build-tag">THE RACING LINE <span> / </span> 002</span><button class="quiet-button" id="sound" aria-pressed="false">Sound on</button><button class="quiet-button" data-action="controls">Controls <span aria-hidden="true">↗</span></button></div>
      </header>
      <main id="menu" class="title-screen">
        <div class="eyebrow"><span class="live-dot"></span> A LITTLE KART. A WIDE OPEN ROAD.</div>
        <h1>Good turns.<br>Great <span>times.</span></h1>
        <p class="intro">A pocket-sized racing escape.<br>Find your line, feel the corners, and make<br class="wide-only"> the next lap your best one.</p>
        <div class="course-picker" aria-label="Select practice course">
          <div class="course-heading"><span>YOUR PLAYGROUND</span><span>02 / RACE</span></div>
          <div class="course-option"><span class="course-stamp" aria-hidden="true">↝</span><div><label for="course-select">COURSE</label><select id="course-select"><option value="garden">Garden Circuit</option><option value="short">Pocket Loop · short test course</option></select></div><span class="course-badge">3 LAP RACE</span></div>
          <div class="course-details"><span id="course-length"></span><span>EIGHT RACERS</span><span>THREE ITEMS</span></div>
        </div>
        <button class="primary-button" id="start">Start race <span aria-hidden="true">↗</span></button>
        <p class="start-note"><span class="key">W</span> to go &nbsp; <span class="key">A</span><span class="key">D</span> to find your line</p>
      </main>
      <aside class="scene-caption" aria-hidden="true"><span class="caption-line"></span><span>MEET YOUR WEEKEND RIDE<br><strong>The little orange one.</strong></span></aside>
      <footer class="menu-footer"><span>BUILT FOR THE JOY OF THE DRIVE.</span><span><i></i> ORIGINAL 3D PLAYGROUND <span class="footer-divider">/</span> MILESTONE 02</span></footer>
      <section id="hud" class="hud" aria-label="Race information" hidden>
        <div class="session-card"><span class="eyebrow">VERSUS · 8 RACERS <span class="live-dot"></span></span><h2 id="hud-course"></h2><div class="race-standing"><strong id="position">1 / 8</strong><span>COINS <b id="coin-count">00</b> / 10</span></div></div>
        <div class="lap-card"><div><span class="metric-label">LAP</span><strong id="lap-count">1 / 3</strong></div><div><span class="metric-label">RACE TIME</span><strong id="race-time">00:00.00</strong></div></div>
        <div class="map-card"><svg viewBox="-78 -85 156 170" role="img" aria-label="Course mini map"><path id="map-path"></path><g id="map-opponents"></g><circle id="map-marker" r="4"></circle><path id="map-finish"></path></svg><span id="gate-count">GATE 01 / 12</span></div>
        <div class="driving-help"><span class="key">ESC</span> pause <span class="key">F</span> rescue <span class="key">E</span> item <span class="key">SPACE</span> drift</div>
        <div class="item-panel" aria-label="Two-slot inventory"><div class="item-slot" id="active-slot"><small>ACTIVE · E</small><b>—</b><span>Empty</span></div><div class="item-slot reserve" id="reserve-slot"><small>RESERVE</small><b>—</b><span>Empty</span></div></div>
        <div id="countdown" class="countdown" role="status" aria-live="polite" hidden></div>
        <div id="wrong-way" class="wrong-way" role="status" hidden>↶ WRONG WAY · Turn around or press F to rescue</div>
        <div id="kart-status" class="kart-status" role="status" hidden></div>
        <div id="drift-meter" class="drift-meter" hidden></div>
        <div class="speed-card"><span id="surface">ON THE TARMAC</span><div><strong id="speed">0</strong><span>KM/H</span></div><div class="speed-track"><i id="speed-fill"></i></div><p>LAST LAP <strong id="last-lap">—</strong></p></div>
        <div id="lap-toast" class="lap-toast" role="status" aria-live="polite" hidden></div>
        <output id="telemetry" hidden></output>
      </section>
      <section id="pause" class="modal-scrim" aria-label="Race paused" hidden><div class="modal-card"><span class="eyebrow">A MOMENT IN THE PITS</span><h2>Take a breather.</h2><p>The whole race is paused.</p><button class="primary-button" id="resume">Back to the track <span>↗</span></button><button class="secondary-button" id="restart">Restart race</button><button class="text-button" id="back-menu">Return to title</button></div></section>
      <section id="results" class="modal-scrim" aria-label="Race results" hidden><div class="modal-card results-card"><span class="eyebrow">THREE LAPS. EVERY TURN COUNTED.</span><h2>Across the line.</h2><p id="result-summary"></p><table><thead><tr><th>POS</th><th>DRIVER</th><th>TIME</th><th>COINS</th></tr></thead><tbody id="result-rows"></tbody></table><p class="controls-note">Finishers are locked in crossing order. Unfinished racers follow by validated course progress.</p><button class="primary-button" id="race-again">Race again <span>↗</span></button><button class="text-button" id="results-menu">Return to title</button></div></section>
      <dialog id="controls"><div class="modal-card"><span class="eyebrow">THE DRIVER’S HANDBOOK</span><h2>Find your feet.</h2><dl class="control-list"><div><dt><kbd>W</kbd> / <kbd>↑</kbd></dt><dd>Accelerate</dd></div><div><dt><kbd>S</kbd> / <kbd>↓</kbd></dt><dd>Brake, then hold to reverse</dd></div><div><dt><kbd>A</kbd><kbd>D</kbd> / <kbd>←</kbd><kbd>→</kbd></dt><dd>Steer left / right</dd></div><div><dt><kbd>Space</kbd></dt><dd>Hop; hold while turning to drift</dd></div><div><dt><kbd>E</kbd> / <kbd>↓</kbd> + <kbd>E</kbd></dt><dd>Use active item / launch rearward</dd></div><div><dt><kbd>F</kbd> / <kbd>R</kbd></dt><dd>Checkpoint rescue / restart race</dd></div><div><dt><kbd>Q</kbd> / <kbd>Esc</kbd></dt><dd>Rear view (hold) / pause</dd></div></dl><p class="controls-note">Race seven opponents for three ordered laps. Hold drift to charge ◆ blue, ◆◆ orange or ◆◆◆ purple, then release Space to boost. Blue boxes award items; larger boxes fill both slots. E uses the active item and promotes reserve. Banana traps arm after a short delay; shells bounce; mushrooms boost. Coins cap at ten. F rescues to your last valid checkpoint with a two-second hold. Finish, see results, then race again.</p><button class="primary-button" id="close-controls">Got it <span>✓</span></button></div></dialog>
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
    root.querySelector('#race-again')!.addEventListener('click', () => this.onRestart());
    root.querySelector('#results-menu')!.addEventListener('click', () => this.onMenu());
    root.querySelector('#sound')!.addEventListener('click', () => this.onSound());
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
    document.querySelector<HTMLElement>('#results')!.hidden = state !== 'results';
    this.hud.hidden = state === 'menu' || state === 'results';
    if (state === 'menu') document.querySelector<HTMLButtonElement>('#start')!.focus({ preventScroll: true });
    if (state === 'results') document.querySelector<HTMLButtonElement>('#race-again')!.focus();
    if (state === 'racing') (document.activeElement as HTMLElement | null)?.blur();
  }

  update(race: Race, course: CourseDefinition, dt: number): void {
    const player = race.player, kart = player.controller.state, progress = player.progress;
    this.speed.textContent = String(Math.round(Math.abs(kart.speed) * 3.6));
    this.time.textContent = formatTime(player.finishTime ?? race.time);
    this.laps.textContent = `${Math.min(3, progress.laps + 1)} / 3`;
    this.best.textContent = progress.lastLapTime ? formatTime(progress.lastLapTime) : '—';
    document.querySelector('#position')!.textContent = `${race.ranked.findIndex((racer) => racer.id === player.id) + 1} / 8`;
    document.querySelector('#coin-count')!.textContent = String(player.coins).padStart(2, '0');
    document.querySelector('#gate-count')!.textContent = `GATE ${String(progress.nextCheckpoint + 1).padStart(2, '0')} / 12`;
    document.querySelector('#surface')!.textContent = kart.surface === 'grass' ? 'OFF ROAD' : 'ON THE TARMAC';
    (document.querySelector('#speed-fill') as HTMLElement).style.width = `${Math.min(100, Math.abs(kart.speed) / (config.kart.maxSpeed + 8) * 100)}%`;
    const factor = course.id === 'pocket-loop' ? 1 / 0.35 : 1;
    this.mapMarker.setAttribute('cx', String(kart.x * factor)); this.mapMarker.setAttribute('cy', String(kart.z * factor));
    const map = document.querySelector('#map-opponents')!;
    if (map.childElementCount !== 7) {
      map.replaceChildren();
      for (const racer of race.racers.slice(1)) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('r', '3'); circle.setAttribute('fill', racer.color); circle.setAttribute('stroke', '#fff7e7'); circle.setAttribute('stroke-width', '1');
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title'); title.textContent = racer.name; circle.append(title); map.append(circle);
      }
    }
    for (let i = 1; i < race.racers.length; i++) {
      const s = race.racers[i]!.controller.state, marker = map.children[i - 1]!;
      marker.setAttribute('cx', String(s.x * factor)); marker.setAttribute('cy', String(s.z * factor));
    }
    for (const [id, kind] of [['active-slot', player.inventory.active], ['reserve-slot', player.inventory.reserve]] as const) {
      const slot = document.querySelector<HTMLElement>(`#${id}`)!;
      const definition = kind ? itemDefinitions[kind] : null;
      slot.querySelector('b')!.textContent = definition?.icon ?? '—'; slot.querySelector('span')!.textContent = definition?.name ?? 'Empty';
      slot.title = definition?.description ?? 'Drive through a blue item box';
      slot.classList.toggle('drawing', player.inventory.drawRemaining > 0 && kind !== null);
      slot.dataset.item = kind ?? 'empty';
    }
    const countdown = document.querySelector<HTMLElement>('#countdown')!;
    countdown.hidden = !(race.state === 'countdown' || (race.state === 'racing' && race.time < 0.8));
    countdown.textContent = race.state === 'countdown' ? String(Math.ceil(race.countdown)) : 'GO!';
    document.querySelector<HTMLElement>('#wrong-way')!.hidden = player.wrongWayTime < 0.6;
    const status = document.querySelector<HTMLElement>('#kart-status')!;
    status.hidden = race.state !== 'finished' && player.rescueRemaining === 0 && kart.spin === 0 && kart.boost === 0;
    status.textContent = race.state === 'finished' ? 'FINISH! Waiting for the field…' : player.rescueRemaining > 0 ? `RESCUE · ${player.rescueRemaining.toFixed(1)}s penalty` : kart.spin > 0 ? 'HIT · Brief damage immunity' : 'BOOST!';
    const drift = document.querySelector<HTMLElement>('#drift-meter')!;
    drift.hidden = kart.driftSide === 0;
    drift.textContent = kart.driftStage > 0 ? `${'◆'.repeat(kart.driftStage)} ${['', 'BLUE', 'ORANGE', 'PURPLE'][kart.driftStage]} · Release Space to boost` : 'DRIFT · Charging';
    drift.dataset.stage = String(kart.driftStage);
    Object.assign(this.telemetry.dataset, {
      x: String(kart.x), z: String(kart.z), heading: String(kart.heading), speed: String(kart.speed), checkpoint: String(progress.nextCheckpoint), laps: String(progress.laps), time: String(race.time), countdown: String(race.countdown),
      active: player.inventory.active ?? '', reserve: player.inventory.reserve ?? '', aiCount: String(race.brains.size), finishers: String(race.racers.filter((r) => r.finishTime !== null).length), rescues: String(player.rescues),
      coins: String(player.coins), itemsUsed: String(race.stats.playerUses), hits: String(race.stats.hits), boosts: String(race.stats.boosts), worldItems: String(race.items.objects.filter((object) => object.active).length),
      drift: String(kart.driftStage), immunity: String(kart.immunity), wrongWay: String(player.wrongWayTime >= 0.6),
    });
    if (!this.debug.hidden) this.debug.textContent = `frame ${(dt * 1000).toFixed(1)} ms\nspeed ${kart.speed.toFixed(2)} m/s\nsurface ${kart.surface}\ncheckpoint ${progress.nextCheckpoint}\ndrift ${kart.driftStage} (${kart.driftCharge.toFixed(2)}s)\nitems ${player.inventory.active ?? 'empty'} / ${player.inventory.reserve ?? 'empty'}`;
    if (this.toastTimer > 0) { this.toastTimer -= dt; if (this.toastTimer <= 0) document.querySelector<HTMLElement>('#lap-toast')!.hidden = true; }
  }
  showResults(race: Race): void {
    const rows = document.querySelector('#result-rows')!; rows.replaceChildren();
    const player = race.results.find((row) => row.id === race.player.id)!;
    document.querySelector('#result-summary')!.textContent = `You finished ${player.place} / 8 in ${formatTime(player.time ?? race.time)}. ${player.coins} coins collected.`;
    for (const row of race.results) {
      const tr = document.createElement('tr'); tr.dataset.racer = row.id;
      if (row.id === race.player.id) tr.className = 'player-result';
      for (const value of [String(row.place), row.name, row.finished ? formatTime(row.time!) : 'DNF', String(row.coins)]) {
        const cell = document.createElement('td'); cell.textContent = value; tr.append(cell);
      }
      rows.append(tr);
    }
  }
  setSound(muted: boolean): void {
    const button = document.querySelector('#sound')!; button.textContent = muted ? 'Sound off' : 'Sound on'; button.setAttribute('aria-pressed', String(muted));
  }
  showLap(lap: number, time: number): void {
    const toast = document.querySelector<HTMLElement>('#lap-toast')!;
    toast.textContent = `LAP ${lap} COMPLETE · ${formatTime(time)}`; toast.hidden = false; this.toastTimer = 4;
  }
  clearLap(): void {
    this.toastTimer = 0; document.querySelector<HTMLElement>('#lap-toast')!.hidden = true;
  }
}
