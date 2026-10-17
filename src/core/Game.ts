import type { CourseDefinition, GameEvent, KartState, RaceState } from '../data/types';
import { FixedStep } from './FixedStep';
import { KartController } from '../gameplay/KartController';
import { LapProgress } from '../gameplay/LapProgress';
import { Keyboard } from '../platform/Keyboard';
import { Renderer } from '../rendering/Renderer';
import { createCourse } from '../tracks/course';
import { Interface } from '../ui/Interface';

export class Game {
  private state: RaceState = 'boot';
  private course: CourseDefinition = createCourse(new URLSearchParams(location.search).get('course') === 'short');
  private kart = new KartController(this.course);
  private progress = new LapProgress(this.course);
  private readonly input = new Keyboard();
  private readonly clock = new FixedStep();
  private readonly ui: Interface;
  private readonly rendering: Renderer;
  private time = 0;
  private lastFrame = 0;
  private animation = 0;
  private snapCamera = true;
  private previous: KartState = { ...this.kart.state };
  private readonly visual: KartState = { ...this.kart.state };
  private readonly onResize = () => this.rendering.resize();
  private readonly onVisibility = () => { if (document.hidden) this.pause(); this.lastFrame = 0; };
  private readonly onBlur = () => this.pause();
  private readonly onControls = () => this.pause();
  private readonly onContextLost = (event: Event) => {
    event.preventDefault(); this.pause();
    this.ui.showLap(0, 0);
    const message = document.querySelector<HTMLElement>('#lap-toast')!;
    message.textContent = 'Graphics connection lost. Reload this page to restore the course.';
  };

  constructor(root: HTMLElement) {
    this.ui = new Interface(root);
    this.setState('loading');
    this.rendering = new Renderer(document.querySelector('#world')!, this.course);
    this.ui.setCourse(this.course);
    this.ui.onStart = () => this.restart();
    this.ui.onRestart = () => this.restart();
    this.ui.onResume = () => this.resume();
    this.ui.onMenu = () => this.menu();
    this.ui.onCourse = (short) => this.selectCourse(short);
    this.input.onPause = () => this.state === 'paused' ? this.resume() : this.pause();
    this.input.onRestart = () => this.restart();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
    document.addEventListener('open-controls', this.onControls);
    this.rendering.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.setState('menu');
    this.animation = requestAnimationFrame(this.frame);
  }

  private setState(state: RaceState): void {
    this.state = state;
    this.input.active = state === 'racing' || state === 'paused';
    this.input.clear(); this.clock.reset(); this.lastFrame = 0;
    this.ui.setState(state);
    this.emit({ type: 'state', state });
  }
  private emit(event: GameEvent): void {
    document.dispatchEvent(new CustomEvent('kart:event', { detail: event }));
  }
  private selectCourse(short: boolean): void {
    if (this.state !== 'menu') return;
    this.course = createCourse(short); this.rendering.setCourse(this.course);
    this.ui.setCourse(this.course); this.reset();
  }
  private reset(): void {
    this.kart = new KartController(this.course); this.progress = new LapProgress(this.course);
    this.previous = { ...this.kart.state }; this.time = 0;
    this.snapCamera = true; this.ui.clearLap();
  }
  private restart(): void { this.reset(); this.setState('racing'); }
  private menu(): void { this.reset(); this.setState('menu'); }
  private pause(): void { if (this.state === 'racing') this.setState('paused'); }
  private resume(): void {
    if (this.state === 'paused' && !this.ui.controls.open && !document.hidden) this.setState('racing');
  }
  private readonly frame = (timestamp: number) => {
    const dt = this.lastFrame ? Math.min((timestamp - this.lastFrame) / 1000, 0.1) : 0;
    this.lastFrame = timestamp;
    let alpha = 1;
    if (this.state === 'racing') {
      alpha = this.clock.advance(dt, (step) => {
        Object.assign(this.previous, this.kart.state);
        this.kart.update(this.input.read(), step); this.time += step;
        for (const event of this.progress.update(this.previous, this.kart.state, this.time)) {
          this.emit(event);
          if (event.type === 'lap') this.ui.showLap(event.lap, event.time);
        }
      });
    }
    const current = this.kart.state;
    Object.assign(this.visual, current, {
      x: this.previous.x + (current.x - this.previous.x) * alpha,
      z: this.previous.z + (current.z - this.previous.z) * alpha,
      heading: this.previous.heading + (current.heading - this.previous.heading) * alpha,
    });
    this.rendering.draw(this.visual, this.state === 'racing' ? dt : 0, this.state === 'menu', this.input.rearView, this.input.read().steering, this.snapCamera);
    this.snapCamera = false;
    this.ui.update(current, this.progress, this.time, this.course, dt);
    this.animation = requestAnimationFrame(this.frame);
  };
  dispose(): void {
    cancelAnimationFrame(this.animation); this.input.dispose(); this.rendering.dispose();
    window.removeEventListener('resize', this.onResize); window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibility); document.removeEventListener('open-controls', this.onControls);
  }
}
