import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DOMINO_PHYSICS, dominoAnchors, nearestDominoIndex, projectedDominoPosition } from '../src/components/magneticDomino';
import { JourneySegmentStrip } from '../src/design-system/journey/JourneySegmentStrip';
import { sensory } from '../src/sensory/SensoryOrchestrator';
import { sonicEngine } from '../src/sensory/SonicFeedbackEngine';
import { hapticAdapter } from '../src/sensory/HapticFeedbackAdapter';
import { interactionPreferences } from '../src/sensory/InteractionPreferences';

for (const count of [2, 3, 5, 8, 12]) {
  test(`${count} stages keep every leg and the accessible scrollport`, () => {
    const items = Array.from({ length: count }, (_, index) => ({ id: `leg-${index}`, mode: 'WALK', label: `Довга назва етапу ${index}`, durationSeconds: 120, durationLabel: '2 хв', priceLabel: '', color: 'var(--mg-blue)' }));
    const html = renderToStaticMarkup(createElement(JourneySegmentStrip, { items, ariaLabel: 'Етапи маршруту', onSelect: () => undefined }));
    assert.equal((html.match(/role="listitem"/g) ?? []).length, count);
    assert.equal((html.match(/aria-label="Вибрати сегмент:/g) ?? []).length, count);
    assert.match(html, /mg-domino/);
    assert.match(html, /tabindex="0" role="list"/);
  });
}

test('anchors clamp both boundaries and capture the nearest real position', () => {
  const anchors = dominoAnchors([0, 120, 240, 360, 480], 330);
  assert.deepEqual(anchors, [0, 120, 240, 330, 330]);
  assert.equal(nearestDominoIndex(anchors, 0), 0);
  assert.equal(nearestDominoIndex(anchors, 187), 2);
  assert.equal(nearestDominoIndex(anchors, 330), 3);
  assert.equal(nearestDominoIndex([], 0), -1);
});

test('momentum is bounded and reverses immediately with gesture direction', () => {
  assert.equal(projectedDominoPosition(200, 0, 320, 900), 200);
  assert.equal(projectedDominoPosition(200, 100, 320, 900), 680);
  assert.equal(projectedDominoPosition(200, -100, 320, 900), 0);
  assert.ok(projectedDominoPosition(200, -.5, 320, 900) < 200);
  assert.ok(projectedDominoPosition(200, .5, 320, 900) > 200);
});

test('a rapid sequence across ribbons limits both audio and haptics even with sound disabled', t => {
  const previous = interactionPreferences.get();
  const play = t.mock.method(sonicEngine, 'play', () => true);
  const fire = t.mock.method(hapticAdapter, 'fire', () => true);
  try {
    for (const soundsEnabled of [true, false]) {
      interactionPreferences.set({ soundsEnabled, hapticsEnabled: true });
      sensory.resetDiagnostics();
      play.mock.resetCalls(); fire.mock.resetCalls();
      for (let index = 0; index < 24; index += 1) sensory.emit({ type: 'DOMINO_DETENT', ribbonId: `ribbon-${index % 2}`, index });
      assert.equal(fire.mock.callCount(), 1);
      assert.equal(play.mock.callCount(), soundsEnabled ? 1 : 0);
      assert.equal(sensory.diagnostics().throttled['rate-limit'], 23);
    }
    assert.ok(DOMINO_PHYSICS.feedbackIntervalMs >= 90);
  } finally { interactionPreferences.set(previous); sensory.resetDiagnostics(); }
});

function controllerHarness() {
  let now = 1000;
  let sequence = 0;
  let resize = () => undefined;
  let disconnected = false;
  const timers = new Map<number, () => void>();
  const frames = new Map<number, (time: number) => void>();
  const document: { activeElement: ElementStub | null } = { activeElement: null };
  class ElementStub extends EventTarget {
    dataset: Record<string, string> = {};
    style = { scrollSnapType: 'x mandatory' };
    children: ElementStub[] = [];
    offsetLeft = 0;
    clientWidth = 240;
    scrollWidth = 600;
    scrollLeft = 0;
    captured = new Set<number>();
    matches() { return true; }
    contains(element: unknown) { return element === this; }
    querySelector() { return null; }
    focus() { document.activeElement = this; }
    setPointerCapture(id: number) { this.captured.add(id); }
    hasPointerCapture(id: number) { return this.captured.has(id); }
    releasePointerCapture(id: number) { this.captured.delete(id); }
  }
  const element = new ElementStub();
  element.children = Array.from({ length: 5 }, (_, index) => {
    const child = new ElementStub(); child.offsetLeft = index * 120; return child;
  });
  const source = readFileSync(new URL('../src/components/magneticDomino.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports: { attachMagneticDomino?: (element: unknown, callback: (index: number) => void) => () => void } = {};
  runInNewContext(code, {
    exports, HTMLElement: ElementStub, document,
    performance: { now: () => now },
    getComputedStyle: () => ({ getPropertyValue: () => '260ms' }),
    requestAnimationFrame: (callback: (time: number) => void) => { const id = ++sequence; frames.set(id, callback); return id; },
    cancelAnimationFrame: (id: number) => frames.delete(id),
    window: {
      matchMedia: () => ({ matches: false }),
      setTimeout: (callback: () => void) => { const id = ++sequence; timers.set(id, callback); return id; },
      clearTimeout: (id: number) => timers.delete(id),
    },
    ResizeObserver: class {
      constructor(callback: () => undefined) { resize = callback; }
      observe() {}
      disconnect() { disconnected = true; }
    },
  });
  const detents: number[] = [];
  const detach = exports.attachMagneticDomino!(element, index => detents.push(index));
  const dispatch = (type: string, values: Record<string, unknown> = {}) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { isPrimary: true, button: 0, pointerType: 'mouse', pointerId: 1, clientX: 200, clientY: 0 }, values);
    element.dispatchEvent(event);
    return event;
  };
  const advance = (ms: number) => {
    now += ms;
    const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(now));
  };
  return { element, detents, detach, dispatch, advance, resize: () => resize(), timers, frames, disconnected: () => disconnected };
}

test('mount, resize, automatic scroll and touch-down cannot emit detents', () => {
  const h = controllerHarness();
  h.element.scrollLeft = 120; h.dispatch('scroll'); h.resize();
  h.dispatch('pointerdown', { pointerType: 'touch' });
  assert.deepEqual(h.detents, []);
  h.detach();
});

test('a vertical gesture does not capture the pointer or block page scrolling', () => {
  const h = controllerHarness();
  h.dispatch('pointerdown');
  const move = h.dispatch('pointermove', { clientX: 195, clientY: 50 });
  assert.equal(move.defaultPrevented, false);
  assert.equal(h.element.captured.size, 0);
  assert.deepEqual(h.detents, []);
  h.detach();
});

test('cancelled mouse drag cannot swallow the next keyboard-generated click', () => {
  const h = controllerHarness();
  h.dispatch('pointerdown'); h.dispatch('pointermove', { clientX: 90 }); h.dispatch('scroll');
  assert.deepEqual(h.detents, [1]);
  h.dispatch('pointercancel', { clientX: 90 });
  h.advance(300);
  assert.equal(h.dispatch('click', { detail: 0 }).defaultPrevented, false);
  h.detach();
});

test('unmount during a captured drag releases capture, timers and listeners', () => {
  const h = controllerHarness();
  h.dispatch('pointerdown'); h.dispatch('pointermove', { clientX: 90 }); h.dispatch('scroll');
  assert.equal(h.element.captured.size, 1);
  h.detach();
  assert.equal(h.element.captured.size, 0);
  assert.equal(h.timers.size, 0);
  assert.equal(h.frames.size, 0);
  assert.equal(h.disconnected(), true);
  assert.equal(h.element.style.scrollSnapType, 'x mandatory');
  const before = h.detents.length;
  h.element.scrollLeft = 240; h.dispatch('wheel', { deltaX: 150, deltaY: 0 }); h.dispatch('scroll');
  assert.equal(h.detents.length, before);
});

test('unmount during kinetic capture cancels every pending frame', () => {
  const h = controllerHarness();
  h.dispatch('pointerdown'); h.dispatch('pointermove', { clientX: 90 }); h.dispatch('pointerup', { clientX: 90 });
  assert.equal(h.frames.size, 1);
  h.detach();
  assert.equal(h.frames.size, 0);
  h.advance(400);
  assert.equal(h.element.style.scrollSnapType, 'x mandatory');
});

test('silent mode disables both detent channels', t => {
  const play = t.mock.method(sonicEngine, 'play', () => true);
  const fire = t.mock.method(hapticAdapter, 'fire', () => true);
  const mode = sensory.diagnostics().mode;
  try {
    sensory.resetDiagnostics(); sensory.setMode('silent');
    sensory.emit({ type: 'DOMINO_DETENT', ribbonId: 'silent', index: 1 });
    assert.equal(play.mock.callCount(), 0); assert.equal(fire.mock.callCount(), 0);
  } finally { sensory.setMode(mode); sensory.resetDiagnostics(); }
});
