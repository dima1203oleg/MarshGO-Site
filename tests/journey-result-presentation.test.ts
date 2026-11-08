import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ApiJourney } from '../src/services/productionApi';
import {
  buildJourneyResultSegments, formatJourneyDistance, formatJourneyDistanceSummary, formatJourneyDuration, formatJourneyDurationTile, formatJourneySegmentPrice, formatJourneyTotalPrice, journeyArrivalDayNote, journeyBoardingNote, journeyRouteBadge, journeyTimeBreakdown, searchPendingCopy, unavailableTransportNotices,
} from '../src/views/journeyResultPresentation';

const leg = (overrides: Partial<ApiJourney['legs'][number]>): ApiJourney['legs'][number] => ({
  id: 'leg', mode: 'BUS', offerId: null,
  origin: { name: 'Початок', coordinates: [24, 49] },
  destination: { name: 'Кінець', coordinates: [24.1, 49.1] },
  departureAt: '2026-10-13T08:10:00+03:00', arrivalAt: '2026-10-13T08:25:00+03:00',
  durationSeconds: 900, distanceMeters: 5000, priceMinor: 1500, currency: 'UAH',
  priceStatus: 'LOCKED', availabilityStatus: 'SCHEDULED', source: 'gtfs-static',
  lastUpdatedAt: '2026-10-12T10:00:00Z', driver: null, vehicle: null,
  ...overrides,
});

const journey = (overrides: Partial<ApiJourney> = {}): ApiJourney => ({
  id: 'journey-1', offerId: null, strategy: 'BALANCED', state: 'READY',
  totalDurationSeconds: 1500, requestedDepartureAt: '2026-10-13T08:00:00+03:00',
  waitingSeconds: 300, totalPriceMinor: 1500, currency: 'UAH', priceStatus: 'LOCKED',
  confirmedPriceMinor: null, estimatedPriceMinMinor: null, estimatedPriceMaxMinor: null,
  walkingMeters: 200, transfers: 0, reliabilityScore: null, legs: [
    leg({ id: 'walk', mode: 'WALK', source: 'pedestrian-router', priceMinor: null,
      departureAt: '2026-10-13T08:00:00+03:00', arrivalAt: '2026-10-13T08:05:00+03:00', durationSeconds: 300 }),
    leg({ id: 'bus' }),
  ],
  ...overrides,
});

describe('journey result presentation data', () => {
  it('includes walking and scheduled waits and keeps ribbon widths time-proportional', () => {
    const segments = buildJourneyResultSegments(journey());
    assert.deepEqual(segments.map(segment => [segment.kind, segment.durationSeconds]), [
      ['LEG', 300], ['WAIT', 300], ['LEG', 900],
    ]);
    assert.equal(segments[0]?.durationSeconds / segments[2]!.durationSeconds, 1 / 3);
    assert.equal(segments[1]?.label, 'Очікування');
  });

  it('does not turn unknown segment fares into zero or present a partial total as complete', () => {
    const unknownFareJourney = journey({
      legs: [leg({ id: 'bus', priceMinor: null, priceStatus: 'UNKNOWN' })],
      totalPriceMinor: 3000,
    });
    const segment = buildJourneyResultSegments(unknownFareJourney).find(item => item.leg?.id === 'bus')!;
    assert.equal(formatJourneySegmentPrice(segment), '—');
    assert.equal(formatJourneyTotalPrice(unknownFareJourney), '—');
  });

  it('does not round a positive sub-minute segment down to zero', () => {
    assert.equal(formatJourneyDuration(30), 'менше хвилини');
    assert.equal(formatJourneyDuration(60), '1 хв');
  });

  it('shrinks only the words a ~110 px segment tile cannot show without ellipsis', () => {
    assert.equal(formatJourneyDurationTile(30), '< 1 хв');
    assert.equal(formatJourneyDurationTile(60), '1 хв');
    assert.equal(formatJourneyDurationTile(420), formatJourneyDuration(420));
  });

  it('keeps short measured route distances in meters instead of rounding them to zero kilometers', () => {
    assert.equal(formatJourneyDistance(80), '80 м');
    assert.equal(formatJourneyDistance(1000), '1 км');
    assert.equal(formatJourneyDistance(null), 'відстань невідома');
  });

  it('labels partial and estimated aggregate distances without implying verified full mileage', () => {
    assert.equal(formatJourneyDistanceSummary([
      leg({ id: 'scooter', mode: 'SCOOTER', source: 'gbfs-geofence-scooter-estimate', distanceMeters: 2300 }),
      leg({ id: 'metro', mode: 'METRO', distanceMeters: null }),
    ]), 'Частково ≈ 2,3 км');
    assert.equal(formatJourneyDistanceSummary([
      leg({ id: 'bus-a', distanceMeters: 1200 }), leg({ id: 'bus-b', distanceMeters: 1800 }),
    ]), '3 км');
  });

  it('marks legacy synthetic walking distances as approximate', () => {
    for (const source of ['walking', 'transfer-walk']) {
      assert.equal(formatJourneyDistanceSummary([
        leg({ id: source, mode: 'WALK', source, distanceMeters: 900 }),
        leg({ id: 'bus', mode: 'BUS', distanceMeters: 3000 }),
      ]), '≈ 3,9 км');
    }
  });

  it('marks estimated leg fares and route totals as approximate in hryvnias', () => {
    const estimate = leg({ id: 'carpool', mode: 'COMMUNITY', routeName: 'MARSHGO', priceMinor: 12_000, priceStatus: 'DYNAMIC' });
    const result = journey({ legs: [estimate], totalPriceMinor: 12_000, priceStatus: 'DYNAMIC' });
    const community = buildJourneyResultSegments(result).find(item => item.leg?.id === 'carpool')!;
    assert.equal(community.label, 'Попутка');
    assert.equal(formatJourneySegmentPrice(community), '≈ 120\u00a0₴');
    assert.equal(formatJourneyTotalPrice(result), '≈ 120\u00a0₴');
  });

  it('uses the real fare once for a segment covered by a previous ticket', () => {
    const covered = leg({ id: 'transfer-leg', fareIncludedByPreviousSegment: true, priceMinor: null, priceStatus: 'UNKNOWN' });
    const segment = buildJourneyResultSegments(journey({ legs: [covered] })).find(item => item.leg?.id === 'transfer-leg')!;
    assert.equal(formatJourneySegmentPrice(segment), 'у квитку');
  });
});

describe('journey search pending copy', () => {
  it('shows a plain searching line before the wait becomes noticeable', () => {
    assert.deepEqual(searchPendingCopy(0), { title: 'Шукаємо маршрути…', note: null });
    assert.equal(searchPendingCopy(7).note, null);
    assert.match(searchPendingCopy(7).title, /7 с$/);
  });

  it('explains what is happening once the search passes 8 seconds', () => {
    const copy = searchPendingCopy(8);
    assert.match(copy.title, /8 с$/);
    assert.match(copy.note!, /перевізник/i);
  });

  it('admits the providers are slow past 20 seconds without inventing progress', () => {
    const copy = searchPendingCopy(20);
    assert.match(copy.title, /20 с$/);
    assert.match(copy.note!, /затягуються/);
    assert.doesNotMatch(`${copy.title} ${copy.note}`, /%|≈|近|ETA|приблизно/);
  });

  it('never claims a share of completion or a made-up arrival time', () => {
    [0, 3, 8, 19, 20, 61, 3600].forEach(seconds => {
      const copy = searchPendingCopy(seconds);
      assert.doesNotMatch(copy.title, /%/);
      assert.doesNotMatch(copy.note ?? '', /%/);
    });
  });

  it('floors fractional and negative elapsed time to a real second count', () => {
    assert.equal(searchPendingCopy(-4).title, 'Шукаємо маршрути…');
    assert.match(searchPendingCopy(12.9).title, /12 с$/);
  });
});

describe('unavailableTransportNotices', () => {
  // Captured from a real public search: Lviv, Личаківська → Городоцька, 2026-11-01.
  const blockedProviders = [
    'transportType:marshrutka:no-routed-provider-in-corridor',
    'transportType:trolleybus:no-routed-provider-in-corridor',
    'transportType:metro:no-routed-provider-in-corridor',
    'transportType:taxi:no-routed-provider-in-corridor',
    'transportType:bike:no-routed-provider-in-corridor',
    'transportType:carsharing:no-routed-provider-in-corridor',
    'transportType:transfer:no-routed-provider-in-corridor',
    'door-to-door-walking:requires-WALKING_ROUTING_URL',
    'walking-transfers-between-unmatched-stops',
    'community-intermediate-pickup:requires-explicit-driver-approved-stop',
  ];
  const unsupportedPreferences = blockedProviders
    .filter(token => token.startsWith('transportType:'))
    .map(token => token.replace('no-routed-provider-in-corridor', 'not-in-route-engine'));

  it('names every requested-but-unavailable mode in Ukrainian and never leaks a machine token', () => {
    const texts = unavailableTransportNotices(blockedProviders, unsupportedPreferences).map(notice => notice.text);
    for (const mode of ['Маршрутки', 'Тролейбуси', 'Метро', 'Таксі', 'Велопрокати', 'Каршеринг', 'Зовнішні трансфери']) {
      assert.ok(texts.some(text => text.startsWith(`${mode}:`)), `no line for ${mode}`);
    }
    assert.ok(!texts.some(text => /transportType|no-routed-provider|not-in-route-engine|WALKING_ROUTING_URL/.test(text)), 'a raw token reached the UI');
  });

  it('says one sentence per mode even when two lists report it', () => {
    const notices = unavailableTransportNotices(blockedProviders, unsupportedPreferences);
    assert.equal(new Set(notices.map(notice => notice.mode)).size, notices.length);
    assert.equal(notices.filter(notice => notice.mode === 'metro').length, 1);
  });

  // The server reports every uncovered mode in the corridor, not just the chosen ones; a passenger
  // who asked for a tram must not be lectured about metro they never selected.
  it('stays silent about modes the passenger did not ask for', () => {
    const notices = unavailableTransportNotices(blockedProviders, ['transportType:tram:not-in-route-engine']);
    assert.deepEqual(notices.map(notice => notice.mode), ['tram']);
  });

  it('keeps the specific corridor reason over the generic engine reason', () => {
    const metro = unavailableTransportNotices(blockedProviders, unsupportedPreferences)
      .find(notice => notice.mode === 'metro');
    assert.match(metro!.text, /немає жодного підключеного розкладу/);
  });

  it('ignores search rules and non-transport preferences', () => {
    const notices = unavailableTransportNotices(
      ['door-to-door-walking:requires-WALKING_ROUTING_URL', 'walking-transfers-between-unmatched-stops'],
      ['maxPriceMinor:public-transit-fare-unavailable', 'preferredVehicleClass', 'future-internal-token'],
    );
    assert.deepEqual(notices, []);
  });

  it('falls back to an honest «недоступно» instead of inventing a cause', () => {
    const [notice] = unavailableTransportNotices(['transportType:train:something-new'], ['transportType:train:something-new']);
    assert.equal(notice.text, 'Потяги: недоступно в цьому пошуку.');
  });

  it('returns nothing when the search blocked nothing', () => {
    assert.deepEqual(unavailableTransportNotices([], []), []);
  });
});

describe('journeyBoardingNote', () => {
  // Shape copied from the real public Lviv -> Kyiv answer (2026-11-02): three
  // journeys board the same 09:03Z train, so duration, price, transfers, walking
  // and total waiting time are all equal and only the tram trip differs.
  const sameTrainExceptTram = (tramDeparture: string) => journey({
    id: `j-${tramDeparture}`,
    totalDurationSeconds: 34548,
    requestedDepartureAt: '2026-11-02T06:00:00.000Z',
    transfers: 1,
    walkingMeters: 3022,
    legs: [
      leg({ id: 'walk-1', mode: 'WALK', source: 'pedestrian-router', priceMinor: null,
        departureAt: '2026-11-02T06:00:00.000Z', arrivalAt: '2026-11-02T06:02:24.000Z', durationSeconds: 144 }),
      leg({ id: 'tram', mode: 'TRAM', departureAt: tramDeparture, arrivalAt: '2026-11-02T08:00:00.000Z', durationSeconds: 1200 }),
      leg({ id: 'rail', mode: 'RAIL', departureAt: '2026-11-02T09:03:00.000Z', arrivalAt: '2026-11-02T14:59:00.000Z', durationSeconds: 21360 }),
    ],
  });

  it('separates cards that are otherwise identical on every displayed metric', () => {
    const notes = ['2026-11-02T06:21:00.000Z', '2026-11-02T06:33:00.000Z', '2026-11-02T08:08:00.000Z']
      .map(departure => journeyBoardingNote(sameTrainExceptTram(departure)));
    assert.deepEqual(notes, ['Трамвай о 08:21', 'Трамвай о 08:33', 'Трамвай о 10:08']);
    assert.equal(new Set(notes).size, 3);
  });

  it('names the vehicle the passenger actually boards, in Kyiv time', () => {
    const note = journeyBoardingNote(journey({ legs: [leg({ id: 'bus', mode: 'BUS', departureAt: '2026-10-13T08:10:00+03:00' })] }));
    assert.equal(note, 'Автобус о 08:10');
  });

  it('stays silent for a walk-only journey instead of naming a vehicle', () => {
    const note = journeyBoardingNote(journey({ legs: [leg({ id: 'walk', mode: 'WALK', source: 'pedestrian-router', priceMinor: null })] }));
    assert.equal(note, '');
  });

  it('stays silent when the boarding time is not a real timestamp', () => {
    const note = journeyBoardingNote(journey({ legs: [leg({ id: 'tram', mode: 'TRAM', departureAt: 'not-a-time' })] }));
    assert.equal(note, '');
  });
});

describe('journeyRouteBadge', () => {
  // The server collapses route_short_name || route_long_name || route_id into one string, so the
  // client has to decide from the shape of the token whether a № prefix would be a claim.
  it('prefixes a bare route number the way the canonical board draws it', () => {
    assert.equal(journeyRouteBadge('48'), '№48');
    assert.equal(journeyRouteBadge(' 115 '), '№115');
    assert.equal(journeyRouteBadge('48А'), '№48А');
  });

  it('keeps the prefix for a letter-first number from the live Lviv feed', () => {
    // POST /api/v1/journeys/search, «Львівавтодор — розклад (GTFS)», 2026-11-04: legs arrive as
    // WALK → BUS:А21 → WALK, so this exact shape is what the real results card has to badge.
    assert.equal(journeyRouteBadge('А21'), '№А21');
    assert.equal(journeyRouteBadge('А92'), '№А92');
  });

  it('leaves a long name and an id-shaped token without the number prefix', () => {
    assert.equal(journeyRouteBadge('Львів – Київ'), 'Львів – Київ');
    assert.equal(journeyRouteBadge('lviv:bus:48:R7'), 'lviv:bus:48:R7');
    assert.equal(journeyRouteBadge('IT482026'), 'IT482026');
  });

  it('returns nothing for a missing name so the tile keeps the mode word', () => {
    assert.equal(journeyRouteBadge(undefined), null);
    assert.equal(journeyRouteBadge(null), null);
    assert.equal(journeyRouteBadge('   '), null);
  });
});

describe('journey arrival day and time split', () => {
  it('names an arrival after midnight instead of showing an ambiguous clock', () => {
    assert.equal(journeyArrivalDayNote('2026-11-10T00:48:00+02:00', '2026-11-09T08:00:00+02:00'), 'наступного дня');
    assert.equal(journeyArrivalDayNote('2026-11-09T23:48:00+02:00', '2026-11-09T08:00:00+02:00'), '');
    assert.equal(journeyArrivalDayNote('2026-11-11T02:00:00+02:00', '2026-11-09T22:00:00+02:00'), 'через 2 дні');
    assert.equal(journeyArrivalDayNote('2026-11-14T02:00:00+02:00', '2026-11-09T22:00:00+02:00'), 'через 5 днів');
  });

  it('compares Kyiv calendar days, not UTC days', () => {
    // 23:30 UTC on Nov 9 is already 01:30 on Nov 10 in Kyiv (UTC+2 in winter).
    assert.equal(journeyArrivalDayNote('2026-11-09T23:30:00Z', '2026-11-09T20:00:00Z'), 'наступного дня');
  });

  it('stays silent when a timestamp is missing instead of guessing a day', () => {
    assert.equal(journeyArrivalDayNote('not-a-time', '2026-11-09T08:00:00+02:00'), '');
    assert.equal(journeyArrivalDayNote('2026-11-09T09:00:00+02:00'), '');
  });

  it('separates riding, walking and waiting from the real timestamps', () => {
    const split = journeyTimeBreakdown(journey());
    assert.deepEqual(split, { walkingSeconds: 300, ridingSeconds: 900, waitingSeconds: 300 });
  });

  it('derives the wait from the total when the server omits it', () => {
    const split = journeyTimeBreakdown(journey({ waitingSeconds: undefined, totalDurationSeconds: 1500 }));
    assert.equal(split.waitingSeconds, 300);
    assert.equal(split.walkingSeconds + split.ridingSeconds + split.waitingSeconds, 1500);
  });
});
