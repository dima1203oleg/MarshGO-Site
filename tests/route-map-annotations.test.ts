import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApiJourney, ApiJourneyLive } from '../src/services/productionApi';
import {
  buildRouteMapAnnotations,
  formatSegmentCount,
  formatStopCount,
  primaryTransitLeg,
} from '../src/views/routeMapAnnotations';
import { darkenMapStyle } from '../src/map/style/darkStyle';

const journey = {
  id: 'journey-1',
  legs: [
    {
      id: 'walk-in', mode: 'WALK', transportType: 'walk', durationSeconds: 120, distanceMeters: 126,
      origin: { name: 'вул. Гетьмана Петра Дорошенка', coordinates: [24.0138, 49.8086] },
      destination: { name: 'вул. Гетьмана Петра Дорошенка', coordinates: [24.0162, 49.8089] },
      departureAt: '2026-11-02T10:00:00Z', arrivalAt: '2026-11-02T10:02:00Z',
      routeGeometry: [[24.0138, 49.8086], [24.015, 49.8087], [24.0162, 49.8089]],
    },
    {
      id: 'tram-1', mode: 'TRAM', transportType: 'tram', routeName: '1', durationSeconds: 780,
      origin: { name: 'Гетьмана П. Дорошенка', coordinates: [24.0162, 49.8089] },
      destination: { name: 'Залізничний вокзал', coordinates: [24.0621, 49.8398] },
      departureAt: '2026-11-02T10:02:00Z', arrivalAt: '2026-11-02T10:15:00Z',
      routeGeometry: [[24.0162, 49.8089], [24.04, 49.824], [24.0621, 49.8398]],
      stops: Array.from({ length: 7 }, (_, index) => ({ id: `stop-${index}`, name: `Зупинка ${index}` })),
    },
    {
      id: 'walk-out', mode: 'WALK', transportType: 'walk', durationSeconds: 180, distanceMeters: 210,
      origin: { name: 'Залізничний вокзал', coordinates: [24.0621, 49.8398] },
      destination: { name: 'Привокзальна площа', coordinates: [24.0646, 49.8414] },
      departureAt: '2026-11-02T10:15:00Z', arrivalAt: '2026-11-02T10:18:00Z',
      routeGeometry: [[24.0621, 49.8398], [24.063, 49.8406], [24.0646, 49.8414]],
    },
  ],
} as unknown as ApiJourney;

function liveWith(options: { scope?: 'full_route' | 'leg_only'; etaSeconds?: number | null; confidence?: 'OBSERVED' | 'PREDICTED' | 'NONE'; predictedArrivalAt?: string; emphasized?: boolean; level?: 'L1' | 'L2' | 'L3' } = {}): ApiJourneyLive {
  return {
    journeyId: 'journey-1',
    checkedAt: '2026-11-02T10:00:00Z',
    segments: [{
      legId: 'tram-1',
      status: 'LIVE',
      lineRoutes: [{
        id: 'line-1', providerId: 'lviv', routeId: '1', name: '1',
        direction: 'Сихів → Залізничний вокзал',
        directionId: '0', geometrySource: 'gtfs_shape',
        coordinates: [[24.0, 49.8], [24.0162, 49.8089], [24.04, 49.824], [24.0621, 49.8398], [24.08, 49.85]],
        geometryScope: options.scope ?? 'full_route',
        zones: {
          boardingShapeIndex: 1,
          alightingShapeIndex: 3,
          beforeBoarding: [[24.0, 49.8], [24.0162, 49.8089]],
          passengerSegment: [[24.0162, 49.8089], [24.04, 49.824], [24.0621, 49.8398]],
          afterAlighting: [[24.0621, 49.8398], [24.08, 49.85]],
          snapMeters: 8,
        },
      }],
      vehicles: [{
        id: 'tram-vehicle-1', providerId: 'lviv', coordinates: [24.01, 49.805],
        bearing: 30, speed: 6, updatedAt: '2026-11-02T09:59:40Z', tripId: 'trip-1',
        routeId: '1', directionId: '0', approachingBoarding: true, remainingStops: 2,
        emphasized: options.emphasized ?? true,
        approachEvidence: {
          source: 'OBSERVED_PROGRESS', remainingStops: 2,
          ...(options.predictedArrivalAt ? { predictedArrivalAt: options.predictedArrivalAt } : {}),
        },
        etaSeconds: options.etaSeconds === undefined ? 240 : options.etaSeconds,
        etaConfidence: options.confidence ?? 'PREDICTED',
        priority: options.level === 'L1'
          ? { level: 'L1', reason: 'other_route' }
          : { level: options.level ?? 'L3', reason: 'approaching_boarding_stop' },
      }],
    }],
  };
}

test('marks boarding, alighting and both walks from confirmed itinerary fields', () => {
  const labels = buildRouteMapAnnotations({ journey, live: null });
  const walk = labels.filter(label => label.kind === 'WALK');
  const boarding = labels.find(label => label.kind === 'BOARDING');
  const alighting = labels.find(label => label.kind === 'ALIGHTING');

  assert.equal(walk.length, 2);
  assert.equal(walk[0]?.tone, 'green');
  assert.equal(walk.at(-1)?.tone, 'blue');
  assert.match(walk[0]?.detail ?? '', /2 хв · 126 м/);
  assert.deepEqual(boarding?.coordinates, [24.0162, 49.8089]);
  assert.equal(boarding?.detail, 'Гетьмана П. Дорошенка');
  assert.deepEqual(alighting?.coordinates, [24.0621, 49.8398]);
  assert.equal(alighting?.detail, 'Залізничний вокзал');
});

test('focused ride hides route continuations and shows only its verified approach vehicle', () => {
  const labels = buildRouteMapAnnotations({ journey, live: liveWith(), now: Date.parse('2026-11-02T10:00:00Z') });
  const termini = labels.filter(label => label.kind === 'TERMINUS');
  const routeBadges = labels.filter(label => label.kind === 'ROUTE');
  const vehicles = labels.filter(label => label.kind === 'VEHICLE');

  assert.equal(termini.length, 0);
  assert.equal(routeBadges.length, 0);
  assert.equal(vehicles.length, 1);
  assert.equal(vehicles[0]?.detail, '≈ 4 хв');
  assert.equal(vehicles[0]?.tone, 'blue');
});

test('leg-only geometry hides the continuation instead of inventing it', () => {
  const labels = buildRouteMapAnnotations({ journey, live: liveWith({ scope: 'leg_only' }), now: Date.parse('2026-11-02T10:00:00Z') });
  assert.equal(labels.some(label => label.kind === 'TERMINUS'), false);
  assert.equal(labels.some(label => label.kind === 'ROUTE'), false);
});

test('keeps a confirmed approaching vehicle but omits its unconfirmed ETA', () => {
  const now = Date.parse('2026-11-02T10:00:00Z');
  const unconfirmed = buildRouteMapAnnotations({ journey, live: liveWith({ etaSeconds: 240, confidence: 'NONE', emphasized: false, level: 'L1' }), now });
  assert.equal(unconfirmed.find(label => label.kind === 'VEHICLE')?.detail, 'наближається');
  assert.equal(unconfirmed.some(label => label.kind === 'VEHICLE' && label.detail?.includes('хв')), false);

  const approaching = buildRouteMapAnnotations({ journey, live: liveWith({ etaSeconds: null, confidence: 'NONE', emphasized: true }), now });
  assert.equal(approaching.find(label => label.kind === 'VEHICLE')?.detail, 'наближається');
});

test('uses the server predicted-arrival evidence when the API omits etaConfidence', () => {
  const labels = buildRouteMapAnnotations({
    journey,
    live: liveWith({ confidence: 'NONE', predictedArrivalAt: '2026-11-02T10:04:00Z' }),
    now: Date.parse('2026-11-02T10:00:00Z'),
  });
  assert.equal(labels.find(label => label.kind === 'VEHICLE')?.detail, '≈ 4 хв');
});

test('picks the transit leg that owns the journey and uses Ukrainian plurals', () => {
  assert.equal(primaryTransitLeg(journey.legs)?.id, 'tram-1');
  assert.equal(primaryTransitLeg(journey.legs, 'walk-out')?.id, 'tram-1');
  assert.equal(formatSegmentCount(3), '3 сегменти');
  assert.equal(formatStopCount(7), '7 зупинок');
  assert.equal(formatStopCount(1), '1 зупинка');
});

test('dark basemap recolours the vector style but leaves overlay paint untouched', () => {
  const style = {
    version: 8,
    sources: {},
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#FFFFFF' } },
      { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: { 'fill-color': '#AAD3DF' } },
      { id: 'highway-primary', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', paint: { 'line-color': '#FC8' } },
      { id: 'place-labels', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', paint: { 'text-color': '#333' } },
      { id: 'marshgo-route', type: 'line', source: 'marshgo-route', paint: { 'line-color': '#8B3CE6' } },
    ],
  } as unknown as Parameters<typeof darkenMapStyle>[0];

  const dark = darkenMapStyle(style) as unknown as { layers: Array<{ id: string; paint: Record<string, unknown> }> };
  const byId = new Map(dark.layers.map(layer => [layer.id, layer.paint]));
  assert.equal(byId.get('background')?.['background-color'], '#071521');
  assert.equal(byId.get('water')?.['fill-color'], '#0B1B2C');
  assert.equal(byId.get('highway-primary')?.['line-color'], '#3A5674');
  assert.equal(byId.get('place-labels')?.['text-color'], '#AABFD1');
  assert.equal(byId.get('marshgo-route')?.['line-color'], '#8B3CE6');
  // The source style is not mutated in place.
  assert.equal((style as unknown as { layers: Array<{ paint: Record<string, unknown> }> }).layers[0]!.paint['background-color'], '#FFFFFF');
});
