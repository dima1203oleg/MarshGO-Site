import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApiStoredJourney } from '../src/services/productionApi';
import { storedJourneyToApiJourney } from '../src/routing/storedJourneyView';

const kyivRow = {
  id: '2fdd046a-a884-44a9-a641-cf9b1b6bf0c8',
  origin_name: 'Русанівські Сади, Київ',
  destination_name: 'Березняки, Київ',
  origin_coordinates: [30.5921, 50.0532],
  destination_coordinates: [30.6211, 50.0644],
  requested_departure_at: '2026-11-01T04:00:00Z',
  strategy: 'BALANCED',
  state: 'PLANNED',
  passenger_count: 1,
  total_price_minor: 9000,
  confirmed_price_minor: null,
  total_duration_s: 11080,
  walking_distance_m: 2400,
  transfer_count: 2,
  reliability_score: 0.8,
  waitingSeconds: 600,
  legs: [
    {
      id: 'leg-1', mode: 'WALK', offerId: null, bookingId: null, state: 'SUGGESTED', priceMinor: null, priceStatus: 'UNKNOWN',
      originName: 'Русанівські Сади, Київ', originCoordinates: [30.5921, 50.0532],
      destinationName: 'Зупинка «Русанівська набережна»', destinationCoordinates: [30.5975, 50.0549],
      departureAt: '2026-11-01T04:00:00Z', arrivalAt: '2026-11-01T04:12:00Z',
      durationSeconds: 720, distanceMeters: 900, availabilityStatus: 'AVAILABLE',
      source: 'walking-estimate', lastUpdatedAt: '2026-10-31T14:50:03Z', routeGeometry: null, stops: [],
    },
    {
      id: 'leg-2', mode: 'BUS', offerId: null, bookingId: null, state: 'SUGGESTED', priceMinor: 3000, priceStatus: 'ESTIMATED',
      originName: 'Зупинка «Русанівська набережна»', originCoordinates: [30.5975, 50.0549],
      destinationName: 'Зупинка «Березняки»', destinationCoordinates: [30.6181, 50.0631],
      departureAt: '2026-11-01T04:15:00Z', arrivalAt: '2026-11-01T04:31:00Z',
      durationSeconds: 960, distanceMeters: 4100, availabilityStatus: 'SCHEDULED',
      source: 'gtfs', lastUpdatedAt: '2026-10-31T14:50:03Z',
      routeGeometry: [[30.5975, 50.0549], [30.6181, 50.0631]],
      stops: [{ id: 'stop-1', name: 'Зупинка «Русанівська набережна»', coordinates: [30.5975, 50.0549] }],
    },
  ],
} as unknown as ApiStoredJourney;

test('a stored journey keeps its per-leg geometry, stops and times for the canonical route screen', () => {
  const view = storedJourneyToApiJourney(kyivRow);
  assert.equal(view.id, kyivRow.id);
  assert.equal(view.totalDurationSeconds, 11080);
  assert.equal(view.transfers, 2);
  assert.equal(view.walkingMeters, 2400);
  assert.equal(view.legs.length, 2);
  assert.deepEqual(view.legs[1].routeGeometry, [[30.5975, 50.0549], [30.6181, 50.0631]]);
  assert.equal(view.legs[1].stops?.[0]?.name, 'Зупинка «Русанівська набережна»');
  assert.equal(view.legs[1].departureAt, '2026-11-01T04:15:00Z');
  assert.equal(view.legs[1].durationSeconds, 960);
  assert.equal(view.legs[1].priceMinor, 3000);
});

test('a leg without its own alighting point chains to the next boarding point instead of teleporting', () => {
  const withoutTransferPoint = {
    ...kyivRow,
    legs: kyivRow.legs.map((leg, index) => index === 0
      ? { ...leg, destinationName: undefined, destinationCoordinates: undefined }
      : leg),
  } as unknown as ApiStoredJourney;
  const view = storedJourneyToApiJourney(withoutTransferPoint);
  assert.deepEqual(view.legs[0].origin.coordinates, [30.5921, 50.0532]);
  assert.equal(view.legs[0].origin.name, 'Русанівські Сади, Київ');
  assert.deepEqual(view.legs[0].destination.coordinates, [30.5975, 50.0549]);
  assert.deepEqual(view.legs[1].destination.coordinates, [30.6181, 50.0631]);
  assert.equal(view.legs[1].destination.name, 'Зупинка «Березняки»');

  const withoutLastDrop = {
    ...kyivRow,
    legs: kyivRow.legs.map((leg, index) => index === 1 ? { ...leg, destinationName: undefined, destinationCoordinates: undefined } : leg),
  } as unknown as ApiStoredJourney;
  const lastLeg = storedJourneyToApiJourney(withoutLastDrop).legs[1];
  assert.deepEqual(lastLeg.destination.coordinates, [30.6211, 50.0644]);
  assert.equal(lastLeg.destination.name, 'Березняки, Київ');
});

test('price status follows the stored record instead of inventing a confirmed price', () => {
  assert.equal(storedJourneyToApiJourney(kyivRow).priceStatus, 'ESTIMATED');
  assert.equal(storedJourneyToApiJourney(kyivRow).totalPriceMinor, 9000);
  assert.equal(storedJourneyToApiJourney({ ...kyivRow, confirmed_price_minor: 8500 } as unknown as ApiStoredJourney).priceStatus, 'LOCKED');
  const free = { ...kyivRow, total_price_minor: null, confirmed_price_minor: null } as unknown as ApiStoredJourney;
  const freeView = storedJourneyToApiJourney(free);
  assert.equal(freeView.priceStatus, 'UNKNOWN');
  assert.equal(freeView.totalPriceMinor, null);
});

test('a walk-only journey derives duration and transfers from its legs when the row omits them', () => {
  const sparse = { ...kyivRow, total_duration_s: null, transfer_count: null, waitingSeconds: null } as unknown as ApiStoredJourney;
  const view = storedJourneyToApiJourney(sparse);
  assert.equal(view.totalDurationSeconds, 720 + 960);
  assert.equal(view.transfers, 0);
  assert.equal(view.waitingSeconds, 0);
});

test('the visible line label is the published route name, never the internal feed route id', () => {
  const withFeedIds = {
    ...kyivRow,
    legs: kyivRow.legs.map((leg) => leg.mode === 'BUS'
      ? { ...leg, routeId: 'ff328fb1-7fbf-4041-864e-9b37168590a8:3_744', routeName: '70Д', transportType: 'bus' }
      : leg),
  } as unknown as ApiStoredJourney;
  const busLeg = storedJourneyToApiJourney(withFeedIds).legs[1];
  assert.equal(busLeg.routeName, '70Д');
  assert.equal(busLeg.transportType, 'bus');
  assert.ok(!JSON.stringify(busLeg.routeName).includes('ff328fb1'));

  const unnamed = storedJourneyToApiJourney({
    ...kyivRow,
    legs: kyivRow.legs.map((leg) => leg.mode === 'BUS' ? { ...leg, routeId: 'ff328fb1-7fbf-4041-864e-9b37168590a8:3_744' } : leg),
  } as unknown as ApiStoredJourney).legs[1];
  assert.equal(unnamed.routeName, undefined);
});
