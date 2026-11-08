import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApiJourney } from '../src/services/productionApi';
import { groupJourneyDepartures, journeyGroupAlternatives, journeyTemplateKey } from '../src/views/journeyDepartureGrouping';

type Leg = ApiJourney['legs'][number];

const leg = (overrides: Partial<Leg> = {}): Leg => ({
  id: 'leg-1', mode: 'TRAM', offerId: null,
  origin: { name: 'Площа Ринок', coordinates: [24.0311, 49.8413] },
  destination: { name: 'Аквапарк', coordinates: [24.0121, 49.8063] },
  departureAt: '2026-11-09T08:10:00+02:00', arrivalAt: '2026-11-09T08:27:00+02:00',
  durationSeconds: 1020, distanceMeters: 4200, priceMinor: 3000, priceStatus: 'LOCKED',
  availabilityStatus: 'SCHEDULED', source: 'gtfs-static', lastUpdatedAt: '2026-11-09T04:00:00Z',
  routeName: 'Т01', providerName: 'Львівелектротранс', ...overrides,
});

const journey = (id: string, departureAt: string, legs: Leg[] = [leg({ departureAt, arrivalAt: departureAt.replace(':10', ':27') })]): ApiJourney => ({
  id, offerId: null, strategy: 'BALANCED', state: 'READY', totalDurationSeconds: 1020,
  totalPriceMinor: 3000, confirmedPriceMinor: null, estimatedPriceMinMinor: null,
  estimatedPriceMaxMinor: null, walkingMeters: 300, transfers: 0, reliabilityScore: 0.9,
  legs,
});

test('the same template with different departures becomes one group and keeps every departure', () => {
  const journeys = [journey('08:10', '2026-11-09T08:10:00+02:00'), journey('08:24', '2026-11-09T08:24:00+02:00'), journey('08:38', '2026-11-09T08:38:00+02:00')];
  const groups = groupJourneyDepartures(journeys);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].primary.id, '08:10', 'the first strategy-sorted journey keeps the card');
  assert.deepEqual(groups[0].departures.map(item => item.id), ['08:10', '08:24', '08:38']);
  assert.deepEqual(journeyGroupAlternatives(groups[0]).map(item => item.id), ['08:24', '08:38']);
  assert.deepEqual(groups.flatMap(group => group.departures.map(item => item.id)).sort(), ['08:10', '08:24', '08:38']);
});

test('a different fare keeps its own card instead of hiding behind other departures', () => {
  const cheap = journey('cheap', '2026-11-09T08:10:00+02:00');
  const expensive = journey('expensive', '2026-11-09T08:24:00+02:00', [leg({ priceMinor: 4500, departureAt: '2026-11-09T08:24:00+02:00' })]);
  assert.equal(groupJourneyDepartures([cheap, expensive]).length, 2);
});

test('a different carrier, reliability or price status never merges', () => {
  const base = journey('base', '2026-11-09T08:10:00+02:00');
  const otherCarrier = journey('carrier', '2026-11-09T08:24:00+02:00', [leg({ providerName: 'Інший перевізник', departureAt: '2026-11-09T08:24:00+02:00' })]);
  const lowReliability = { ...journey('reliability', '2026-11-09T08:38:00+02:00'), reliabilityScore: 0.4 };
  const estimated = journey('estimated', '2026-11-09T08:52:00+02:00', [leg({ priceStatus: 'ESTIMATED', departureAt: '2026-11-09T08:52:00+02:00' })]);

  assert.equal(groupJourneyDepartures([base, otherCarrier]).length, 2);
  assert.equal(groupJourneyDepartures([base, lowReliability]).length, 2);
  assert.equal(groupJourneyDepartures([base, estimated]).length, 2);
});

test('a different boarding stop or a different leg chain is a different route', () => {
  const base = journey('base', '2026-11-09T08:10:00+02:00');
  const otherStop = journey('stop', '2026-11-09T08:24:00+02:00', [leg({
    origin: { name: 'Інша зупинка', coordinates: [24.0401, 49.8499] }, departureAt: '2026-11-09T08:24:00+02:00',
  })]);
  const withTransfer = journey('transfer', '2026-11-09T08:38:00+02:00', [
    leg({ departureAt: '2026-11-09T08:38:00+02:00', arrivalAt: '2026-11-09T08:50:00+02:00' }),
    leg({ id: 'leg-2', mode: 'BUS', routeName: 'А21', departureAt: '2026-11-09T08:55:00+02:00', arrivalAt: '2026-11-09T09:20:00+02:00' }),
  ]);

  assert.equal(groupJourneyDepartures([base, otherStop]).length, 2);
  assert.equal(groupJourneyDepartures([base, withTransfer]).length, 2);
});

test('the template key covers leg order, so reversed chains stay apart', () => {
  const tramFirst = journey('tram-first', '2026-11-09T08:10:00+02:00', [
    leg({ departureAt: '2026-11-09T08:10:00+02:00' }),
    leg({ id: 'leg-2', mode: 'BUS', routeName: 'А21', departureAt: '2026-11-09T08:40:00+02:00' }),
  ]);
  const busFirst = journey('bus-first', '2026-11-09T08:10:00+02:00', [
    leg({ id: 'leg-2', mode: 'BUS', routeName: 'А21', departureAt: '2026-11-09T08:10:00+02:00' }),
    leg({ departureAt: '2026-11-09T08:40:00+02:00' }),
  ]);
  assert.notEqual(journeyTemplateKey(tramFirst), journeyTemplateKey(busFirst));
});

test('grouping preserves input order of first appearances and never drops a journey', () => {
  const journeys = [
    journey('tram-a', '2026-11-09T08:10:00+02:00'),
    journey('bus-a', '2026-11-09T08:20:00+02:00', [leg({ mode: 'BUS', routeName: 'А21', departureAt: '2026-11-09T08:20:00+02:00' })]),
    journey('tram-b', '2026-11-09T08:34:00+02:00'),
  ];
  const groups = groupJourneyDepartures(journeys);
  assert.deepEqual(groups.map(group => group.primary.id), ['tram-a', 'bus-a']);
  assert.deepEqual(groups.flatMap(group => group.departures.map(item => item.id)), ['tram-a', 'tram-b', 'bus-a']);
});

const shapeA: [number, number][] = [[24.0311, 49.8413], [24.0250, 49.8300], [24.0121, 49.8063]];
const shapeB: [number, number][] = [[24.0311, 49.8413], [24.0180, 49.8250], [24.0121, 49.8063]];

test('an identical shape across departures stays one group', () => {
  const first = journey('08:10', '2026-11-09T08:10:00+02:00', [leg({ routeGeometry: shapeA, geometrySource: 'gtfs-shape', departureAt: '2026-11-09T08:10:00+02:00' })]);
  const later = journey('08:24', '2026-11-09T08:24:00+02:00', [leg({ routeGeometry: shapeA.map(point => [...point] as [number, number]), geometrySource: 'gtfs-shape', departureAt: '2026-11-09T08:24:00+02:00' })]);
  const groups = groupJourneyDepartures([first, later]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].departures.map(item => item.id), ['08:10', '08:24']);
});

test('the same stops and fare along a different path keeps separate cards (§7.2 «Різні геометрії»)', () => {
  const direct = journey('direct', '2026-11-09T08:10:00+02:00', [leg({ routeGeometry: shapeA, geometrySource: 'gtfs-shape', departureAt: '2026-11-09T08:10:00+02:00' })]);
  const detour = journey('detour', '2026-11-09T08:24:00+02:00', [leg({ routeGeometry: shapeB, geometrySource: 'gtfs-shape', departureAt: '2026-11-09T08:24:00+02:00' })]);
  assert.notEqual(journeyTemplateKey(direct), journeyTemplateKey(detour));
  const groups = groupJourneyDepartures([direct, detour]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map(group => group.primary.id), ['direct', 'detour']);
});

test('an estimated walking path never hides behind a verified shape of the same coordinates', () => {
  const verified = journey('verified', '2026-11-09T08:10:00+02:00', [leg({ routeGeometry: shapeA, geometrySource: 'gtfs-shape', departureAt: '2026-11-09T08:10:00+02:00' })]);
  const estimated = journey('estimated', '2026-11-09T08:24:00+02:00', [leg({ routeGeometry: shapeA, geometrySource: 'walking-estimate', departureAt: '2026-11-09T08:24:00+02:00' })]);
  assert.equal(groupJourneyDepartures([verified, estimated]).length, 2);
});
