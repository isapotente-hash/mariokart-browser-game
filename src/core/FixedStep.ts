import { config } from '../data/config';

export class FixedStep {
  private accumulator = 0;
  advance(elapsed: number, update: (dt: number) => void): number {
    this.accumulator += Math.max(0, Math.min(elapsed, config.simulation.maxFrame));
    let steps = 0;
    while (this.accumulator + 1e-10 >= config.simulation.step && steps < config.simulation.maxSteps) {
      update(config.simulation.step);
      this.accumulator -= config.simulation.step;
      steps++;
    }
    if (steps === config.simulation.maxSteps) this.accumulator = 0;
    return Math.max(0, this.accumulator / config.simulation.step);
  }
  reset(): void { this.accumulator = 0; }
}
