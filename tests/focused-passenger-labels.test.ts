import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApiJourney, ApiJourneyLive } from '../src/services/productionApi';
import { buildRouteMapAnnotations } from '../src/views/routeMapAnnotations';

const journey = { id: 'j', legs: [{ id: 't', mode: 'TRAM', transportType: 'tram', routeName: '8', durationSeconds: 600, origin: { name: 'Посадка', coordinates: [24.01, 49.8] }, destination: { name: 'Висадка', coordinates: [24.02, 49.81] } }] } as unknown as ApiJourney;
const live = { journeyId: 'j', segments: [{ legId: 't', status: 'LIVE', lineRoutes: [{ id: 'l', direction: 'А → Б', geometryScope: 'full_route', coordinates: [[24,49.79],[24.01,49.8],[24.02,49.81],[24.03,49.82]], zones: { beforeBoarding: [[24,49.79],[24.01,49.8]], passengerSegment: [[24.01,49.8],[24.02,49.81]], afterAlighting: [[24.02,49.81],[24.03,49.82]] } }], vehicles: [] }] } as unknown as ApiJourneyLive;

test('passenger focus retains boarding and alighting but hides A/C labels', () => {
  const labels = buildRouteMapAnnotations({ journey, live, focusedOnly: true });
  assert.ok(labels.some(label => label.kind === 'BOARDING'));
  assert.ok(labels.some(label => label.kind === 'ALIGHTING'));
  assert.equal(labels.some(label => label.kind === 'TERMINUS' || label.kind === 'ROUTE'), false);
  assert.ok(buildRouteMapAnnotations({ journey, live }).some(label => label.kind === 'TERMINUS'));
});
