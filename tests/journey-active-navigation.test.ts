import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApiJourney } from '../src/services/productionApi';
import {
  activeLegInstruction,
  activeLegMeta,
  activeLegNextHint,
  activeLegPhase,
  activeLegStatus,
  activeLegTitle,
  activeNavigationDestination,
  activeNavigationStageLabel,
  activeNavigationStartIndex,
  formatStageCount,
  rideStopCount,
  shortPlace,
} from '../src/views/journeyStageNavigation';

type Leg = ApiJourney['legs'][number];

const baseLeg: Leg = {
  id: 'leg',
  mode: 'WALK',
  offerId: null,
  origin: { name: 'Площа Ринок, Львів', coordinates: [24.0315, 49.8419] },
  destination: { name: 'Проспект Свободи, Львів', coordinates: [24.0255, 49.8403] },
  departureAt: '2026-11-02T08:00:00+02:00',
  arrivalAt: '2026-11-02T08:05:00+02:00',
  durationSeconds: 300,
  distanceMeters: 380,
  priceMinor: null,
  priceStatus: 'UNKNOWN',
  availabilityStatus: 'AVAILABLE',
  source: 'walking-route',
  lastUpdatedAt: '2026-11-02T07:50:00+02:00',
  driver: null,
  vehicle: null,
};

const walk = (overrides: Partial<Leg> = {}): Leg => ({ ...baseLeg, ...overrides });
const tram = (overrides: Partial<Leg> = {}): Leg => ({
  ...baseLeg,
  id: 'tram',
  mode: 'TRAM',
  transportType: 'tram',
  routeName: '3',
  origin: { name: 'Площа Ринок, Львів', coordinates: [24.0315, 49.8419] },
  destination: { name: 'Соборна, Львів', coordinates: [24.0155, 49.8363] },
  departureAt: '2026-11-02T08:10:00+02:00',
  arrivalAt: '2026-11-02T08:20:00+02:00',
  durationSeconds: 600,
  distanceMeters: 2400,
  source: 'gtfs',
  liveStatus: 'SCHEDULED',
  stops: [
    { id: 'a', name: 'Площа Ринок' },
    { id: 'b', name: 'Театр опери' },
    { id: 'c', name: 'Університет' },
    { id: 'd', name: 'Соборна' },
  ],
  ...overrides,
});

const journey: ApiJourney = {
  id: 'journey-1',
  offerId: null,
  strategy: 'BALANCED',
  state: 'PLANNED',
  totalDurationSeconds: 1500,
  totalPriceMinor: 1000,
  confirmedPriceMinor: null,
  estimatedPriceMinMinor: null,
  estimatedPriceMaxMinor: null,
  walkingMeters: 760,
  transfers: 0,
  reliabilityScore: null,
  legs: [walk(), tram(), walk({ id: 'walk-2', departureAt: '2026-11-02T08:20:00+02:00', arrivalAt: '2026-11-02T08:25:00+02:00' })],
};

test('navigation starts on the first stage still ahead, not on a finished walk', () => {
  const legs = journey.legs;
  assert.equal(activeNavigationStartIndex(legs, Date.parse('2026-11-02T07:50:00+02:00')), 0);
  assert.equal(activeNavigationStartIndex(legs, Date.parse('2026-11-02T08:07:00+02:00')), 1);
  assert.equal(activeNavigationStartIndex(legs, Date.parse('2026-11-02T09:00:00+02:00')), 2);
});

test('a stage is upcoming, under way or past only by its own timestamps', () => {
  const leg = tram();
  assert.equal(activeLegPhase(leg, Date.parse('2026-11-02T08:05:00+02:00')), 'upcoming');
  assert.equal(activeLegPhase(leg, Date.parse('2026-11-02T08:12:00+02:00')), 'underway');
  assert.equal(activeLegPhase(leg, Date.parse('2026-11-02T08:21:00+02:00')), 'past');
});

test('schedule guidance never claims boarding or completion for the passenger', () => {
  const leg = tram();
  assert.equal(activeLegInstruction(leg, Date.parse('2026-11-02T08:05:00+02:00')), 'Посадка на зупинці «Площа Ринок»');
  assert.equal(activeLegInstruction(leg, Date.parse('2026-11-02T08:12:00+02:00')), 'За розкладом рейс у дорозі · висадка на «Соборна»');
  assert.equal(activeLegInstruction(leg, Date.parse('2026-11-02T08:21:00+02:00')), 'За розкладом час прибуття минув');
  assert.equal(activeLegInstruction(walk(), Date.parse('2026-11-02T08:01:00+02:00')), 'Прямуйте до «Проспект Свободи»');
  assert.equal(activeLegInstruction(walk(), Date.parse('2026-11-03T08:01:00+02:00')), 'Прямуйте до «Проспект Свободи»');
  for (const at of ['07:50', '08:12', '08:21']) assert.doesNotMatch(activeLegInstruction(leg, Date.parse(`2026-11-02T${at}:00+02:00`)), /Ви в дорозі|завершено/);
});

test('walk stages carry no status badge; transit keeps the honest source label', () => {
  assert.equal(activeLegStatus(walk()), null);
  assert.equal(activeLegStatus(tram()), 'SCHEDULED');
  assert.equal(activeLegStatus(tram({ scheduleSemantics: 'frequency_estimate' })), 'FREQUENCY');
  assert.equal(activeLegStatus(tram({ liveStatus: 'LIVE' })), 'UNCONFIRMED');
  assert.equal(activeLegStatus(tram({ liveStatus: 'UNVERIFIED' })), 'UNCONFIRMED');
  assert.equal(activeLegStatus(tram({ liveStatus: undefined })), 'UNCONFIRMED');
  assert.equal(activeLegStatus(tram(), 'LIVE'), 'LIVE');
});

test('the next hint describes the following stage without re-opening the plan', () => {
  assert.equal(activeLegNextHint(walk()), 'Далі: 5 хв пішки');
  assert.equal(activeLegNextHint(walk({ mode: 'BUS', transportType: 'bus', routeName: 'А32' })), 'Далі: Автобус А32 о 08:00');
  assert.equal(activeLegNextHint(undefined), null);
});

test('stage wording, stop count and destination come from real itinerary fields', () => {
  assert.equal(activeLegTitle(tram()), 'Трамвай 3');
  assert.equal(activeLegTitle(walk()), 'Пішки');
  assert.equal(rideStopCount(tram()), 3);
  assert.equal(rideStopCount(walk()), 0);
  assert.equal(activeLegMeta(tram()), '08:10 → 08:20 · 10 хв');
  assert.equal(activeLegMeta(walk()), '08:00 → 08:05 · 5 хв · 380 м');
  assert.equal(activeNavigationDestination(journey.legs), 'Проспект Свободи');
  assert.equal(shortPlace('вул. Соборна, 1, Львів'), 'вул. Соборна');
});

test('passengers count stages in Ukrainian plurals, never graph segments', () => {
  assert.equal(formatStageCount(1), '1 етап');
  assert.equal(formatStageCount(3), '3 етапи');
  assert.equal(formatStageCount(5), '5 етапів');
});

test('the sheet label distinguishes GPS navigation, waiting for GPS and stage preview', () => {
  assert.equal(activeNavigationStageLabel(true, true, 0, 4, 2), 'Навігація · етап 1 з 4 · 2 пересадки');
  assert.equal(activeNavigationStageLabel(true, false, 2, 4), 'Очікуємо GPS · етап 3 з 4');
  assert.equal(activeNavigationStageLabel(false, true, 1, 4), 'Перегляд · етап 2 з 4');
});
