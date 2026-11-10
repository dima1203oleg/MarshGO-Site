export type FloatingInfoPhase = 'ENTERING' | 'VISIBLE' | 'DISSOLVING' | 'HIDDEN';

export const FLOATING_INFO_TIMING = {
  enterMs: 350,
  visibleMs: 4_000,
  dissolveMs: 750,
  dismissMs: 275,
} as const;

export type FloatingInfoScheduler = {
  schedule: (callback: () => void, delayMs: number) => unknown;
  cancel: (handle: unknown) => void;
};

const browserScheduler: FloatingInfoScheduler = {
  schedule: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  cancel: handle => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** One disposable map info card. Replacing a stage cancels every prior phase. */
export class FloatingInfoLifecycle {
  private timer: unknown | null = null;
  private generation = 0;
  private currentPhase: FloatingInfoPhase = 'HIDDEN';

  constructor(
    private readonly onPhase: (phase: FloatingInfoPhase) => void,
    private readonly reducedMotion = false,
    private readonly scheduler: FloatingInfoScheduler = browserScheduler,
  ) {}

  get phase(): FloatingInfoPhase { return this.currentPhase; }

  show(delayMs = 0): void {
    this.cancelTimer();
    const generation = ++this.generation;
    this.setPhase('ENTERING');
    this.timer = this.scheduler.schedule(() => {
      if (generation !== this.generation) return;
      this.setPhase('VISIBLE');
      this.timer = this.scheduler.schedule(() => this.beginDissolve(generation), FLOATING_INFO_TIMING.visibleMs);
    }, Math.max(0, delayMs) + (this.reducedMotion ? 0 : FLOATING_INFO_TIMING.enterMs));
  }

  dismiss(): void {
    if (this.currentPhase === 'HIDDEN' || this.currentPhase === 'DISSOLVING') return;
    this.cancelTimer();
    const generation = ++this.generation;
    if (this.reducedMotion) {
      this.setPhase('HIDDEN');
      return;
    }
    this.setPhase('DISSOLVING');
    this.timer = this.scheduler.schedule(() => {
      if (generation === this.generation) this.setPhase('HIDDEN');
    }, FLOATING_INFO_TIMING.dismissMs);
  }

  cancel(): void {
    this.cancelTimer();
    this.generation += 1;
    this.setPhase('HIDDEN');
  }

  private beginDissolve(generation: number): void {
    if (generation !== this.generation) return;
    this.timer = null;
    if (this.reducedMotion) {
      this.setPhase('HIDDEN');
      return;
    }
    this.setPhase('DISSOLVING');
    this.timer = this.scheduler.schedule(() => {
      if (generation === this.generation) this.setPhase('HIDDEN');
    }, FLOATING_INFO_TIMING.dissolveMs);
  }

  private setPhase(phase: FloatingInfoPhase): void {
    if (this.currentPhase === phase) return;
    this.currentPhase = phase;
    this.onPhase(phase);
  }

  private cancelTimer(): void {
    if (this.timer === null) return;
    this.scheduler.cancel(this.timer);
    this.timer = null;
  }
}
