import assert from 'node:assert/strict';
import test from 'node:test';
import { FLOATING_INFO_TIMING, FloatingInfoLifecycle, type FloatingInfoScheduler } from '../src/map/floatingInfoLifecycle';

class FakeScheduler implements FloatingInfoScheduler {
  private now = 0;
  private nextId = 0;
  private tasks = new Map<number, { at: number; callback: () => void }>();

  schedule(callback: () => void, delayMs: number): unknown {
    const id = ++this.nextId;
    this.tasks.set(id, { at: this.now + delayMs, callback });
    return id;
  }

  cancel(handle: unknown): void { this.tasks.delete(handle as number); }

  advance(ms: number): void {
    const end = this.now + ms;
    while (true) {
      const next = [...this.tasks.entries()].sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next || next[1].at > end) break;
      this.tasks.delete(next[0]);
      this.now = next[1].at;
      next[1].callback();
    }
    this.now = end;
  }

  get pendingCount(): number { return this.tasks.size; }
}

test('floating information enters, remains legible for four seconds, then dissolves', () => {
  const scheduler = new FakeScheduler();
  const phases: string[] = [];
  const lifecycle = new FloatingInfoLifecycle(phase => phases.push(phase), false, scheduler);
  lifecycle.show(120);

  assert.deepEqual(phases, ['ENTERING']);
  scheduler.advance(120 + FLOATING_INFO_TIMING.enterMs - 1);
  assert.equal(lifecycle.phase, 'ENTERING');
  scheduler.advance(1);
  assert.equal(lifecycle.phase, 'VISIBLE');
  scheduler.advance(FLOATING_INFO_TIMING.visibleMs - 1);
  assert.equal(lifecycle.phase, 'VISIBLE');
  scheduler.advance(1);
  assert.equal(lifecycle.phase, 'DISSOLVING');
  scheduler.advance(FLOATING_INFO_TIMING.dissolveMs);
  assert.equal(lifecycle.phase, 'HIDDEN');
  assert.deepEqual(phases, ['ENTERING', 'VISIBLE', 'DISSOLVING', 'HIDDEN']);
});

test('a tap dismisses promptly and replacing a stage cancels its old lifecycle', () => {
  const scheduler = new FakeScheduler();
  const first: string[] = [];
  const lifecycle = new FloatingInfoLifecycle(phase => first.push(phase), false, scheduler);
  lifecycle.show();
  lifecycle.dismiss();
  scheduler.advance(FLOATING_INFO_TIMING.dismissMs);
  assert.deepEqual(first, ['ENTERING', 'DISSOLVING', 'HIDDEN']);

  const replaced: string[] = [];
  const next = new FloatingInfoLifecycle(phase => replaced.push(phase), false, scheduler);
  next.show();
  next.cancel();
  scheduler.advance(FLOATING_INFO_TIMING.enterMs + FLOATING_INFO_TIMING.visibleMs + FLOATING_INFO_TIMING.dissolveMs);
  assert.deepEqual(replaced, ['ENTERING', 'HIDDEN']);
  assert.equal(scheduler.pendingCount, 0);
});

test('reduced motion removes the card after the same readable hold without animated phases', () => {
  const scheduler = new FakeScheduler();
  const phases: string[] = [];
  const lifecycle = new FloatingInfoLifecycle(phase => phases.push(phase), true, scheduler);
  lifecycle.show(100);
  scheduler.advance(99);
  assert.equal(lifecycle.phase, 'ENTERING');
  scheduler.advance(1);
  assert.equal(lifecycle.phase, 'VISIBLE');
  scheduler.advance(FLOATING_INFO_TIMING.visibleMs);
  assert.equal(lifecycle.phase, 'HIDDEN');
  assert.deepEqual(phases, ['ENTERING', 'VISIBLE', 'HIDDEN']);
});
