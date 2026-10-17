import type { GameEvent } from '../data/types';

export class Sound {
  private context: AudioContext | null = null;
  private voices = 0;
  private master: GainNode | null = null;
  private silent = false;
  get muted(): boolean { return this.silent; }
  set muted(value: boolean) { this.silent = value; if (this.master && this.context) this.master.gain.setValueAtTime(value ? 0 : 1, this.context.currentTime); }
  unlock(): void {
    try {
      if (!this.context) { this.context = new AudioContext(); this.master = this.context.createGain(); this.master.gain.value = this.muted ? 0 : 1; this.master.connect(this.context.destination); }
      void this.context.resume().catch(() => {});
    } catch { /* Audio can be unavailable without blocking gameplay. */ }
  }
  tone(frequency: number, duration = 0.12): void {
    const ctx = this.context;
    if (!ctx || this.muted || ctx.state !== 'running' || this.voices >= 6) return;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(0.035, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    oscillator.connect(gain).connect(this.master!); oscillator.start(); oscillator.stop(ctx.currentTime + duration);
    this.voices++; oscillator.onended = () => { this.voices--; oscillator.disconnect(); gain.disconnect(); };
  }
  event(event: GameEvent): void {
    if (!('racerId' in event) || event.racerId !== 'player-1') return;
    if (event.type === 'pickup') this.tone(event.item === 'coin' ? 1000 : 700);
    if (event.type === 'use' || event.type === 'boost') this.tone(440, 0.2);
    if (event.type === 'hit') this.tone(130, 0.25);
    if (event.type === 'finish') this.tone(880, 0.45);
    if (event.type === 'rescue') this.tone(230, 0.2);
  }
  pause(): void { void this.context?.suspend().catch(() => {}); }
  dispose(): void { void this.context?.close().catch(() => {}); }
}
