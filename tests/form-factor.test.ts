import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DESKTOP_MIN_WIDTH,
  DESKTOP_QUERY,
  TABLET_MIN_WIDTH,
  TABLET_QUERY,
  currentFormFactor,
  resolveFormFactor,
  subscribeFormFactor,
  useFormFactor,
} from '../src/services/formFactor';

type ChangeListener = () => void;
type StubList = { matches: boolean; listeners: Set<ChangeListener> };

/**
 * The service only touches window.matchMedia, so a recording stub is enough to
 * prove resolution, subscription and cleanup without a DOM renderer.
 */
function stubWindow(matchesFor: (query: string) => boolean) {
  const lists = new Map<string, StubList>();
  const host = globalThis as { window?: unknown };
  const original = host.window;
  const listFor = (query: string): StubList => {
    let list = lists.get(query);
    if (!list) {
      list = { matches: matchesFor(query), listeners: new Set<ChangeListener>() };
      lists.set(query, list);
    }
    return list;
  };
  host.window = {
    matchMedia(query: string) {
      const list = listFor(query);
      return {
        media: query,
        get matches() { return list.matches; },
        addEventListener(type: string, listener: ChangeListener) {
          assert.equal(type, 'change', 'only the change event is subscribed');
          list.listeners.add(listener);
        },
        removeEventListener(type: string, listener: ChangeListener) {
          assert.equal(type, 'change');
          list.listeners.delete(listener);
        },
      };
    },
  };
  return {
    lists,
    listenerCount: (query: string) => lists.get(query)?.listeners.size ?? 0,
    setMatches(query: string, matches: boolean) { listFor(query).matches = matches; },
    emit(query: string) { for (const listener of [...(lists.get(query)?.listeners ?? [])]) listener(); },
    restore() {
      if (original === undefined) delete host.window;
      else host.window = original;
    },
  };
}

test('resolveFormFactor keeps every phone width on the mobile shell', () => {
  for (const width of [0, 320, 375, 390, 430, 767]) {
    assert.equal(resolveFormFactor(width), 'mobile', `${width}px must stay mobile`);
  }
});

test('resolveFormFactor marks 768–1099 as tablet', () => {
  for (const width of [768, 834, 1024, 1099]) {
    assert.equal(resolveFormFactor(width), 'tablet', `${width}px must be tablet`);
  }
});

test('resolveFormFactor marks 1100 and up as desktop', () => {
  for (const width of [1100, 1280, 1440, 1920, 2560]) {
    assert.equal(resolveFormFactor(width), 'desktop', `${width}px must be desktop`);
  }
});

test('breakpoint constants match the stylesheet contract', () => {
  assert.equal(TABLET_MIN_WIDTH, 768);
  assert.equal(DESKTOP_MIN_WIDTH, 1100);
  assert.equal(DESKTOP_QUERY, '(min-width: 1100px)');
  assert.equal(TABLET_QUERY, '(min-width: 768px)');
});

test('currentFormFactor is SSR-safe and resolves through matchMedia', () => {
  const host = globalThis as { window?: unknown };
  const original = host.window;
  delete host.window;
  try {
    assert.equal(currentFormFactor(), 'mobile', 'without a window the phone shell is the default');
  } finally {
    if (original !== undefined) host.window = original;
  }

  const cases: [string, boolean, boolean, string][] = [
    ['phone', false, false, 'mobile'],
    ['tablet', false, true, 'tablet'],
    ['desktop', true, true, 'desktop'],
  ];
  for (const [name, desktop, tablet, expected] of cases) {
    const stub = stubWindow((query) => (query === DESKTOP_QUERY ? desktop : query === TABLET_QUERY ? tablet : false));
    try {
      assert.equal(currentFormFactor(), expected, `${name} viewport must resolve to ${expected}`);
    } finally {
      stub.restore();
    }
  }
});

test('currentFormFactor falls back to mobile when matchMedia is unavailable', () => {
  const host = globalThis as { window?: unknown };
  const original = host.window;
  host.window = {};
  try {
    assert.equal(currentFormFactor(), 'mobile');
  } finally {
    if (original === undefined) delete host.window;
    else host.window = original;
  }
});

test('subscribeFormFactor subscribes to both breakpoints and reports the resolved factor', () => {
  const stub = stubWindow((query) => query === TABLET_QUERY);
  const seen: string[] = [];
  try {
    const unsubscribe = subscribeFormFactor((factor) => seen.push(factor));
    assert.equal(stub.listenerCount(DESKTOP_QUERY), 1, 'desktop query must be subscribed');
    assert.equal(stub.listenerCount(TABLET_QUERY), 1, 'tablet query must be subscribed');

    stub.setMatches(DESKTOP_QUERY, true);
    stub.emit(DESKTOP_QUERY);
    stub.emit(TABLET_QUERY);
    assert.deepEqual(seen, ['desktop', 'desktop'], 'desktop wins over tablet when both match');

    stub.setMatches(DESKTOP_QUERY, false);
    stub.emit(DESKTOP_QUERY);
    assert.deepEqual(seen, ['desktop', 'desktop', 'tablet']);

    stub.setMatches(TABLET_QUERY, false);
    stub.emit(TABLET_QUERY);
    assert.deepEqual(seen, ['desktop', 'desktop', 'tablet', 'mobile']);

    unsubscribe();
    assert.equal(stub.listenerCount(DESKTOP_QUERY), 0, 'cleanup must remove the desktop listener');
    assert.equal(stub.listenerCount(TABLET_QUERY), 0, 'cleanup must remove the tablet listener');
    stub.emit(DESKTOP_QUERY);
    assert.equal(seen.length, 4, 'no callback may fire after unsubscribe');
  } finally {
    stub.restore();
  }
});

test('subscribeFormFactor without a window returns a no-op cleanup', () => {
  const host = globalThis as { window?: unknown };
  const original = host.window;
  delete host.window;
  try {
    const unsubscribe = subscribeFormFactor(() => assert.fail('must not be called without a window'));
    assert.equal(typeof unsubscribe, 'function');
    unsubscribe();
  } finally {
    if (original !== undefined) host.window = original;
  }
});

test('useFormFactor is exported as a hook wrapper over the same resolution', () => {
  assert.equal(typeof useFormFactor, 'function');
  // The hook body is useState(currentFormFactor) + subscribeFormFactor; both halves
  // are covered above, so a DOM renderer is not needed to prove the contract.
  const stub = stubWindow((query) => query === DESKTOP_QUERY);
  try {
    assert.equal(currentFormFactor(), 'desktop');
  } finally {
    stub.restore();
  }
});