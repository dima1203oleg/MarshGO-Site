import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { productionApi } from '../src/services/productionApi';
import ts from 'typescript';

const navigationSource = readFileSync(new URL('../src/views/ProductionNavigation.tsx', import.meta.url), 'utf8');
const onboardingSource = readFileSync(new URL('../src/components/OnboardingSlides.tsx', import.meta.url), 'utf8');

describe('navigation passenger-matching consent', () => {
  it('does not enable passenger matching when navigation starts', () => {
    const startIndex = navigationSource.indexOf('const start = async');
    const endIndex = navigationSource.indexOf('// Immediate start without intermediate page');
    assert.ok(startIndex >= 0 && endIndex > startIndex, 'navigation start handler boundaries exist');
    const start = navigationSource.slice(startIndex, endIndex);
    assert.match(start, /setMatchingEnabled\(false\)/);
    assert.doesNotMatch(start, /setNavigationMatching\(created\.id,\s*true\)/);
    assert.doesNotMatch(navigationSource, /AUTO_MATCHING_KEY|autoMatchingPreferred/);
  });

  it('offers a separate explicit switch and describes it in onboarding', () => {
    assert.match(navigationSource, /onClick=\{\(\) => void toggleMatching\(\)\}/);
    assert.match(navigationSource, /setNavigationMatching\(session\.id, next\)/);
    assert.match(onboardingSource, /окремо увімкни пошук уздовж маршруту/);
  });
});

const hasRouteDeclaration = navigationSource.match(/^const hasRoute = .*;$/m)?.[0].replace(': ApiNavigationSession', '');
const gpsPolicyStart = navigationSource.indexOf('  const progressBlocked =');
const gpsPolicyEnd = navigationSource.indexOf('  const [onRoute,', gpsPolicyStart);
const statusPolicyStart = navigationSource.indexOf('  const matchingPaused =');
const statusPolicyEnd = navigationSource.indexOf('  const matchingPanel =', statusPolicyStart);
assert.ok(hasRouteDeclaration && gpsPolicyStart >= 0 && gpsPolicyEnd > gpsPolicyStart && statusPolicyStart >= 0 && statusPolicyEnd > statusPolicyStart);
const evaluateMatching = new Function('session', 'clock', 'visible', 'navigationState', 'matchingEnabled',
  `${hasRouteDeclaration}\n${navigationSource.slice(gpsPolicyStart, gpsPolicyEnd)}\n${navigationSource.slice(statusPolicyStart, statusPolicyEnd)}\nreturn { progressBlocked, matchingGpsFresh, matchingPaused, matchingStatus };`);
function deferred<T = any>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flushCallbacks = () => new Promise<void>((resolve) => setImmediate(resolve));

function gpsEffectHarness() {
  const effectStart = navigationSource.indexOf("  useEffect(() => {\n    if (!session || session.state !== 'active' || !('geolocation' in navigator)) return;");
  const effectEnd = navigationSource.indexOf('\n  // ---- Turn-by-turn', effectStart);
  assert.ok(effectStart >= 0 && effectEnd > effectStart, 'the real GPS subscription effect is extracted');
  const executable = ts.transpileModule(`${hasRouteDeclaration}\n${navigationSource.slice(effectStart, effectEnd)}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const events: unknown[] = [];
  const matches: Array<ReturnType<typeof deferred>> = [];
  const sends: Array<ReturnType<typeof deferred>> = [];
  const snapshots: Array<ReturnType<typeof deferred>> = [];
  const starts: Array<ReturnType<typeof deferred>> = [];
  const matchedVersions: number[] = [];
  let state: any;
  let listener: (fix: any) => void;
  let cleanup: (() => void) | undefined;
  let dependencies: unknown[] | undefined;
  let subscriptions = 0;
  let unsubscriptions = 0;
  const scope = {
    navigator: { geolocation: {}, onLine: true }, document: { visibilityState: 'visible' },
    useEffect: (effect: () => (() => void) | undefined, next: unknown[]) => {
      if (!dependencies || next.some((value, index) => !Object.is(value, dependencies![index]))) {
        cleanup?.(); dependencies = next; cleanup = effect();
      }
    },
    locationProvider: { current: {
      subscribe: (callback: typeof listener) => { listener = callback; subscriptions += 1; return () => { unsubscriptions += 1; }; },
      start: () => { const pending = deferred(); starts.push(pending); return pending.promise; }, stop: async () => {},
    } },
    mapMatchingProvider: { current: { match: (_fixes: unknown[], options: { route: { routeVersion: number } }) => {
      matchedVersions.push(options.route.routeVersion);
      const pending = deferred(); matches.push(pending); return pending.promise;
    } } },
    productionApi: {
      sendNavigationLocation: () => { const pending = deferred(); sends.push(pending); return pending.promise; },
      activeNavigation: () => { const pending = deferred(); snapshots.push(pending); return pending.promise; },
    },
    navigationStore: { dispatch: (event: unknown) => events.push(event) },
    canonicalRoute: (session: any) => ({ routeVersion: session.route_version }),
    validateLocationFix: (fix: unknown) => ({ accepted: true, fix }), isDuplicateLocationFix: () => false,
    lastValidatedFixRef: { current: null }, lastSentRef: { current: null },
    offRouteGuardRef: { current: { observe: () => ({ confirmedOffRoute: false, requestReroute: false }) } },
    navigationErrorMessage: (_error: unknown, message: string) => message,
    setSession: (update: any) => { state = typeof update === 'function' ? update(state) : update; events.push(['session', state]); },
    setGpsMessage: (message: string) => events.push(['message', message]),
    setLiveFix: () => {}, setLiveSpeed: () => {}, setLiveHeading: () => {}, setOnRoute: () => {},
  };
  const renderEffect = new Function('session', ...Object.keys(scope), executable);
  return {
    render: (next: any) => { state = next; renderEffect(next, ...Object.values(scope)); },
    emit: (longitude: number) => listener({ latitude: 49, longitude, accuracyMeters: 5, speedMps: 2, headingDegrees: 90, capturedAtClient: new Date().toISOString() }),
    dispose: () => cleanup?.(),
    get state() { return state; }, get subscriptions() { return subscriptions; }, get unsubscriptions() { return unsubscriptions; },
    events, matches, sends, snapshots, starts, matchedVersions,
  };
}

const now = Date.now();
const freshSession = { state: 'active', route: [[24, 49], [25, 50]], route_distance_m: 1000, route_duration_s: 100,
  current_location_at: new Date(now - 1000).toISOString(), progress_status: 'RELIABLE' };

describe('navigation GPS lifecycle (executed screen effect, controlled providers)', () => {
  const session = (version: number) => ({ ...freshSession, id: 'owned-session', route_version: version });
  const result = { accepted: true, onRoute: true, capturedAt: new Date(now).toISOString(), progressStatus: 'RELIABLE', progressOrdinal: 2, progressFraction: 0.5 };

  it('resubscribes on route version change and ignores old route matching and location responses', async () => {
    const harness = gpsEffectHarness();
    harness.render(session(1)); harness.emit(24);
    harness.render(session(2));
    assert.equal(harness.subscriptions, 2);
    assert.equal(harness.unsubscriptions, 1);
    const eventCount = harness.events.length;
    harness.matches[0].resolve({ location: { routeVersion: 1 } });
    harness.sends[0].resolve(result);
    await flushCallbacks();
    assert.equal(harness.events.length, eventCount, 'old effect must not update messages, GPS state or stores');
    assert.equal(harness.snapshots.length, 0, 'cancelled send must not start a refetch');
    harness.emit(24.001);
    assert.deepEqual(harness.matchedVersions, [1, 2]);
    harness.matches[1].resolve({ location: { routeVersion: 2 } });
    harness.sends[1].resolve(result);
    await flushCallbacks();
    assert.equal(harness.state.route_version, 2);
    assert.equal(harness.state.progress_ordinal, 2, 'new route receives progress without needing the later snapshot');
    assert.ok(harness.events.some((event: any) => event.type === 'LOCATION_MATCHED' && event.location.routeVersion === 2));
    harness.dispose();
  });

  it('ignores match, send and provider errors after cleanup', async () => {
    const harness = gpsEffectHarness();
    harness.render(session(1)); harness.emit(24); harness.dispose();
    const eventCount = harness.events.length;
    for (const pending of [harness.matches[0], harness.sends[0], harness.starts[0]]) pending.reject(new Error('late failure'));
    await flushCallbacks();
    assert.equal(harness.events.length, eventCount, 'cancelled callbacks must not announce errors or offline state');
  });

  it('refuses older snapshots of the same route and a refetch completed after reroute', async () => {
    const harness = gpsEffectHarness();
    harness.render(session(1)); harness.emit(24);
    harness.sends[0].resolve(result); await flushCallbacks();
    assert.equal(harness.snapshots.length, 1);
    harness.snapshots[0].resolve({ ...session(1), current_location_at: new Date(now - 30_000).toISOString() });
    await flushCallbacks();
    assert.equal(harness.state.current_location_at, result.capturedAt);
    harness.emit(24.001); harness.sends[1].resolve(result); await flushCallbacks();
    assert.equal(harness.snapshots.length, 2);
    harness.render(session(2));
    const eventCount = harness.events.length;
    harness.snapshots[1].resolve({ ...session(1), current_location_at: new Date(now + 1000).toISOString() });
    await flushCallbacks();
    assert.equal(harness.state.route_version, 2);
    assert.equal(harness.events.length, eventCount, 'old refetch cannot reset the current route');
    harness.dispose();
  });
});

describe('navigation matching status policy (executed screen declarations)', () => {
  it('permits fresh reliable progress and describes route checking without claiming a booking', () => {
    const result = evaluateMatching(freshSession, now, true, { connectivity: 'ONLINE' }, true);
    assert.equal(result.matchingPaused, false);
    assert.match(result.matchingStatus, /GPS узгоджений/);
    assert.doesNotMatch(result.matchingStatus, /бронювання|гарантовано|безпечно/);
  });

  it('pauses new matching for ambiguous, off-route, stale, hidden, offline and paused navigation', () => {
    const cases = [
      { session: { ...freshSession, progress_status: 'UNCERTAIN' }, text: /неоднозначний/ },
      { session: { ...freshSession, progress_status: 'OFF_ROUTE' }, text: /поза маршрутом/ },
      { session: { ...freshSession, current_location_at: new Date(now - 60001).toISOString() }, text: /свіжу GPS/ },
      { session: freshSession, visible: false, text: /зв’язку/ },
      { session: freshSession, connectivity: 'OFFLINE', text: /зв’язку/ },
      { session: { ...freshSession, state: 'paused' }, text: /інтерес збережено/ },
      { session: { ...freshSession, route: null }, text: /Оберіть напрямок/ },
    ];
    for (const scenario of cases) {
      const result = evaluateMatching(scenario.session, now, scenario.visible ?? true, { connectivity: scenario.connectivity ?? 'ONLINE' }, true);
      assert.equal(result.matchingPaused, true);
      assert.match(result.matchingStatus, scenario.text);
    }
  });

  it('does not label legacy NULL progress reliable or imply consent when matching is off', () => {
    const legacy = evaluateMatching({ ...freshSession, progress_status: null }, now, true, { connectivity: 'ONLINE' }, true);
    assert.match(legacy.matchingStatus, /Очікуємо підтвердження/);
    const disabled = evaluateMatching(freshSession, now, true, { connectivity: 'ONLINE' }, false);
    assert.match(disabled.matchingStatus, /Пошук вимкнено/);
  });

  it('sends optional heading and preserves the server progress response through the real API client', async (t) => {
    const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
    const response = { accepted: true, onRoute: true, capturedAt: new Date(now).toISOString(), progressStatus: 'UNCERTAIN', progressOrdinal: null, progressFraction: null };
    t.mock.method(globalThis, 'fetch', async (path: string, init: RequestInit) => {
      calls.push({ path, body: JSON.parse(String(init.body)) as Record<string, unknown> });
      return Response.json({ data: response });
    });
    const input = { coordinates: [24, 49] as [number, number], accuracyMeters: 5, capturedAt: response.capturedAt };
    assert.deepEqual(await productionApi.sendNavigationLocation('owned-session', { ...input, headingDeg: 180 }), response);
    assert.equal(calls[0].path, '/api/v1/navigation/sessions/owned-session/location');
    assert.equal(calls[0].body.headingDeg, 180);
    await productionApi.sendNavigationLocation('owned-session', input);
    assert.equal(Object.hasOwn(calls[1].body, 'headingDeg'), false);
  });
});
