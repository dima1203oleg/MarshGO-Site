import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ApiJourney } from '../src/services/productionApi';
import {
  buildJourneyResultSegments, formatJourneySegmentPrice, formatJourneyTotalPrice,
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
    const unknownFareJourney = journey({ legs: [leg({ id: 'bus', priceMinor: null, priceStatus: 'UNKNOWN' })] });
    const segment = buildJourneyResultSegments(unknownFareJourney).find(item => item.leg?.id === 'bus')!;
    assert.equal(formatJourneySegmentPrice(segment), '—');
    assert.equal(formatJourneyTotalPrice(unknownFareJourney), '—');
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
