import type { DrivingInput } from '../data/types';

export class Keyboard {
  private keys = new Set<string>();
  private itemRequested = false;
  private rescueRequested = false;
  active = false;
  driving = true;
  onPause: () => void = () => {};
  onRestart: () => void = () => {};
  private readonly down = (event: KeyboardEvent) => {
    if (!this.active || document.querySelector('dialog[open]') || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === 'Escape') { if (!event.repeat) this.onPause(); return; }
    if (event.code === 'KeyR') { if (!event.repeat) this.onRestart(); return; }
    if (!this.driving) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    this.keys.add(event.code);
    if (!event.repeat && event.code === 'KeyE') this.itemRequested = true;
    if (!event.repeat && event.code === 'KeyF') this.rescueRequested = true;
  };
  private readonly up = (event: KeyboardEvent) => { this.keys.delete(event.code); };
  private readonly blur = () => this.clear();
  constructor() {
    window.addEventListener('keydown', this.down);
    window.addEventListener('keyup', this.up);
    window.addEventListener('blur', this.blur);
  }
  read(): DrivingInput {
    return {
      throttle: this.keys.has('KeyW') || this.keys.has('ArrowUp'),
      brake: this.keys.has('KeyS') || this.keys.has('ArrowDown'),
      steering: Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')) - Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')),
      drift: this.keys.has('Space'),
      rearward: this.keys.has('ArrowDown') || this.keys.has('KeyS'),
    };
  }
  consume(): DrivingInput {
    const input = { ...this.read(), useItem: this.itemRequested, rescue: this.rescueRequested };
    this.itemRequested = false; this.rescueRequested = false; return input;
  }
  get rearView(): boolean { return this.keys.has('KeyQ'); }
  clear(): void { this.keys.clear(); this.itemRequested = false; this.rescueRequested = false; }
  dispose(): void {
    window.removeEventListener('keydown', this.down);
    window.removeEventListener('keyup', this.up);
    window.removeEventListener('blur', this.blur);
    this.clear();
  }
}
