import type { CourseDefinition, GameEvent, ItemKind, KartState, RaceState } from '../data/types';
import { FixedStep } from './FixedStep';
import { KartController } from '../gameplay/KartController';
import { Race } from '../gameplay/Race';
import { Keyboard } from '../platform/Keyboard';
import { Sound } from '../platform/Sound';
import { Renderer } from '../rendering/Renderer';
import { createCourse } from '../tracks/course';
import { Interface } from '../ui/Interface';

export class Game {
  private state: RaceState = 'boot';
  private course: CourseDefinition = createCourse(new URLSearchParams(location.search).get('course') === 'short');
  private race = new Race(this.course);
  private menuKart = new KartController(this.course).state;
  private readonly input = new Keyboard();
  private readonly sound = new Sound();
  private readonly clock = new FixedStep();
  private readonly ui: Interface;
  private readonly rendering: Renderer;
  private lastFrame = 0;
  private animation = 0;
  private snapCamera = true;
  private countdownCue = 4;
  private readonly visual: KartState = { ...this.race.player.controller.state };
  private readonly onResize = () => this.rendering.resize();
  private readonly onVisibility = () => { if (document.hidden) this.pause(); this.lastFrame = 0; };
  private readonly onBlur = () => this.pause();
  private readonly onControls = () => this.pause();
  private readonly onForceItem = (event: Event) => {
    const item = (event as CustomEvent<unknown>).detail;
    if (['banana', 'shell', 'mushroom'].includes(String(item))) this.race.player.inventory.add(item as ItemKind);
  };
  private readonly onContextLost = (event: Event) => {
    event.preventDefault(); this.pause();
    this.ui.showLap(0, 0);
    document.querySelector('#lap-toast')!.textContent = 'Graphics connection lost. Reload to restore the course.';
  };
  constructor(root: HTMLElement) {
    this.ui = new Interface(root);
    this.setState('loading');
    this.rendering = new Renderer(document.querySelector('#world')!, this.course);
    this.ui.setCourse(this.course);
    this.ui.onStart = () => this.restart(); this.ui.onRestart = () => this.restart();
    this.ui.onResume = () => this.resume(); this.ui.onMenu = () => this.menu();
    this.ui.onCourse = (short) => this.selectCourse(short);
    this.ui.onSound = () => { this.sound.muted = !this.sound.muted; this.ui.setSound(this.sound.muted); if (!this.sound.muted && this.state !== 'paused') this.sound.unlock(); };
    this.input.onPause = () => this.state === 'paused' ? this.resume() : this.pause();
    this.input.onRestart = () => this.restart();
    window.addEventListener('resize', this.onResize); window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility); document.addEventListener('open-controls', this.onControls);
    if (import.meta.env.DEV) document.addEventListener('kart:force-item', this.onForceItem);
    this.rendering.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.setState('menu'); this.animation = requestAnimationFrame(this.frame);
  }
  private setState(state: RaceState, resetTiming = true): void {
    this.state = state;
    this.input.active = ['countdown', 'racing', 'paused', 'finished'].includes(state);
    this.input.driving = state === 'racing' || state === 'countdown';
    if (['menu', 'paused', 'results', 'countdown'].includes(state)) this.input.clear();
    if (resetTiming) { this.clock.reset(); this.lastFrame = 0; }
    this.ui.setState(state);
    if (['menu', 'paused', 'results'].includes(state)) this.sound.pause();
    this.emit({ type: 'state', state });
  }
  private emit(event: GameEvent): void {
    this.sound.event(event); document.dispatchEvent(new CustomEvent('kart:event', { detail: event }));
  }
  private selectCourse(short: boolean): void {
    if (this.state !== 'menu') return;
    this.course = createCourse(short); this.rendering.setCourse(this.course); this.ui.setCourse(this.course);
    this.menuKart = new KartController(this.course).state; this.reset();
  }
  private reset(): void {
    this.race = new Race(this.course); this.snapCamera = true; this.countdownCue = 4; this.ui.clearLap();
  }
  private restart(): void { this.reset(); this.sound.unlock(); this.setState('countdown'); }
  private menu(): void { this.reset(); this.setState('menu'); }
  private pause(): void {
    this.race.pause(); if (this.race.state === 'paused' && this.state !== 'menu') this.setState('paused');
  }
  private resume(): void {
    if (this.state === 'paused' && !this.ui.controls.open && !document.hidden) {
      this.race.resume(); this.sound.unlock(); this.setState(this.race.state);
    }
  }
  private readonly frame = (timestamp: number) => {
    const dt = this.lastFrame ? Math.min((timestamp - this.lastFrame) / 1000, 0.1) : 0;
    this.lastFrame = timestamp;
    let alpha = 1;
    if (['countdown', 'racing', 'finished'].includes(this.state)) {
      alpha = this.clock.advance(dt, (step) => {
        for (const event of this.race.update(this.input.consume(), step)) {
          if (event.type !== 'state') this.emit(event);
          if (event.type === 'lap' && event.racerId === 'player-1') this.ui.showLap(event.lap, event.time);
        }
        if (this.race.state !== this.state) {
          if (this.race.state === 'results') this.ui.showResults(this.race);
          this.setState(this.race.state, false);
        }
      });
      const cue = this.state === 'countdown' ? Math.ceil(this.race.countdown) : 0;
      if (cue !== this.countdownCue) { this.countdownCue = cue; this.sound.tone(cue === 0 ? 880 : 440, 0.15); }
    }
    const player = this.race.player, current = player.controller.state, previous = player.previous;
    Object.assign(this.visual, current, {
      x: previous.x + (current.x - previous.x) * alpha,
      z: previous.z + (current.z - previous.z) * alpha,
      heading: previous.heading + (current.heading - previous.heading) * alpha,
    });
    const moving = this.state === 'racing' || this.state === 'finished';
    this.rendering.draw(this.state === 'menu' ? this.menuKart : this.visual, moving ? dt : 0, this.state === 'menu', this.input.rearView, this.input.read().steering, this.snapCamera, this.race, alpha);
    this.snapCamera = false; this.ui.update(this.race, this.course, this.state === 'paused' ? 0 : dt);
    this.animation = requestAnimationFrame(this.frame);
  };
  dispose(): void {
    cancelAnimationFrame(this.animation); this.input.dispose(); this.sound.dispose(); this.rendering.dispose();
    window.removeEventListener('resize', this.onResize); window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibility); document.removeEventListener('open-controls', this.onControls);
    document.removeEventListener('kart:force-item', this.onForceItem);
  }
}
