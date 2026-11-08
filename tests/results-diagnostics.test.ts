import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { diagnosticsRequested, funnelLines, gtfsTruncationNotices, partialReasonNotices, showsCarpoolSection, splitResultNotices } from '../src/views/resultsDiagnostics';
import type { ApiJourneySearchResult } from '../src/services/productionApi';

const searchResult = {
  journeys: [], partial: true, partialReasons: ['walking_routing_unavailable'],
  blockedProviders: [], unsupportedPreferences: [], providerErrors: [],
  candidateCount: 100, paretoCount: 4, returnedCount: 4, alternativeLimitPerStrategy: 12,
  resultsTruncated: true, candidateGenerationTruncated: true, resultSamplingTruncated: true,
  completeness: {
    providersQueried: 2, providersSucceeded: 2, providersFailed: 0,
    modesAvailable: ['bus', 'tram'], modesUnavailable: [{ mode: 'marshrutka', available: false, requested: false, reason: 'no_source_declares_this_category' }],
    candidatesGenerated: 100, candidatesValidated: 100, candidatesRejected: 0, candidatesDeduplicated: 4,
    resultsReturned: 4, searchTruncated: true, searchComplete: false, transitSearchFailed: false,
  },
} as unknown as ApiJourneySearchResult;

test('the customer list keeps one line and the rest becomes diagnostics', () => {
  const notices = [
    { tone: 'amber' as const, text: 'Пішохідні підходи показано приблизно.' },
    { tone: 'rose' as const, text: 'Деякі розклади тимчасово недоступні.' },
    { tone: 'slate' as const, text: 'Маршрутка: немає джерела.' },
  ];
  const split = splitResultNotices(notices);
  assert.equal(split.headline?.text, 'Деякі розклади тимчасово недоступні.');
  assert.deepEqual(split.technical.map(notice => notice.tone), ['amber', 'slate']);
  assert.deepEqual(splitResultNotices([]), { headline: null, technical: [] });
});

test('diagnostics opt in only through the developer flag', () => {
  assert.equal(diagnosticsRequested('?debug=1', null), true);
  assert.equal(diagnosticsRequested('?date=2026-11-03&debug=1&x=2', null), true);
  assert.equal(diagnosticsRequested('', '1'), true);
  assert.equal(diagnosticsRequested('?debug=0', null), false);
  assert.equal(diagnosticsRequested('?debug=10', null), false);
  assert.equal(diagnosticsRequested('', null), false);
});

test('funnel lines report the real counts of every search stage', () => {
  const lines = funnelLines(searchResult).join('\n');
  for (const expected of ['2 запитано', '100 згенеровано', '100 валідовано', '0 відхилено', '4 після Pareto-фільтра',
    'Pareto 4', 'повернуто 4', 'ліміт 12', 'marshrutka — no_source_declares_this_category', 'Зрізано: results']) {
    assert.ok(lines.includes(expected), `missing "${expected}" in ${lines}`);
  }
});

test('an empty carpool block disappears only when transit already answered', () => {
  assert.equal(showsCarpoolSection(0, true), false);
  assert.equal(showsCarpoolSection(0, false), true);
  assert.equal(showsCarpoolSection(3, true), true);
});

test('known planner reasons become honest passenger lines, unknown ones stay silent for the panel to fall back', () => {
  const emptyReason = partialReasonNotices(['no_stop_within_walking_distance']);
  assert.equal(emptyReason.length, 1);
  assert.equal(emptyReason[0].tone, 'amber');
  assert.ok(emptyReason[0].text.includes('немає зупинки в межах пішої доступності'));
  assert.equal(partialReasonNotices(['walking_routing_unavailable'])[0].text.includes('Пішохідні підходи'), true);
  assert.deepEqual(partialReasonNotices(['some_future_reason']), []);
  assert.deepEqual(partialReasonNotices(undefined), []);
});

test('the current nested Server walkingReach contract adds nearest-stop distances to an empty result', () => {
  const [notice] = partialReasonNotices(['no_stop_within_walking_distance'], {
    walkingReach: { nearestOriginStopMeters: 1_250, nearestDestinationStopMeters: 2_000 },
  });
  assert.match(notice.text, /Найближча зупинка: від початку — 1\s?250 м; від призначення — 2\s?000 м/);
});

test('the current nested Server walkingReach contract discloses extended-walk results', () => {
  const [notice] = partialReasonNotices(['walk_reach_extended'], {
    walkingReach: {
      extended: true,
      journeysWithExtendedReach: 3,
      nearestOriginStopMeters: null,
      nearestDestinationStopMeters: 1_750,
    },
  });
  assert.match(notice.text, /Маршрутів із довшим пішим підходом: 3/);
  assert.match(notice.text, /найближча зупинка біля пункту призначення — 1\s?750 м/);
  assert.doesNotMatch(notice.text, /від початку пошуку/);
});

test('extended walking reach discloses only server-provided returned count and nearest-stop distances', () => {
  const [full] = partialReasonNotices(['walk_reach_extended'], {
    walkReachExtended: true,
    journeysWithExtendedReach: 2,
    nearestOriginStopMeters: 1_250,
    nearestDestinationStopMeters: null,
  });
  assert.equal(full.tone, 'amber');
  assert.match(full.text, /найближча зупинка далі за задану пішу відстань/);
  assert.match(full.text, /Маршрутів із довшим пішим підходом: 2/);
  assert.match(full.text, /від початку пошуку — 1\s?250 м/);
  assert.doesNotMatch(full.text, /пункту призначення/);

  const [withoutMeasurements] = partialReasonNotices(['walk_reach_extended']);
  assert.match(withoutMeasurements.text, /найближча зупинка далі за задану пішу відстань/);
  assert.doesNotMatch(withoutMeasurements.text, /Маршрутів із довшим пішим підходом:|\d+ м/);
});


describe('gtfs truncation flags', () => {
  const flags = (overrides: Partial<NonNullable<ApiJourneySearchResult['gtfsTruncation']>> = {}) => ({
    stopSelection: false, candidateGraph: false, searchBudget: false, searchStepLimit: false,
    candidatePoolLimit: false, candidateSampling: false, responsePage: false, ...overrides,
  });

  test('every true flag becomes its own passenger-visible limit', () => {
    const notices = gtfsTruncationNotices({ gtfsTruncation: flags({
      stopSelection: true, candidateGraph: true, searchBudget: true, searchStepLimit: true,
      candidatePoolLimit: true, candidateSampling: true, responsePage: true,
    }) });
    assert.equal(notices.length, 7);
    assert.deepEqual(notices.map(notice => notice.tone), Array(7).fill('amber'));
    for (const expected of ['зупинки пересадки', 'граф варіантів', 'бюджет пошуку', 'кроки пошуку',
      'пул кандидатів', 'вибірка кандидатів', 'сторінка відповіді']) {
      assert.ok(notices.some(notice => notice.short === expected), `missing ${expected}`);
    }
    assert.ok(notices.every(notice => notice.text.endsWith('.')));
  });

  test('a false flag stays silent instead of claiming a limit that did not happen', () => {
    const notices = gtfsTruncationNotices({ gtfsTruncation: flags({ candidateGraph: true }) });
    assert.deepEqual(notices.map(notice => notice.short), ['граф варіантів']);
    assert.deepEqual(gtfsTruncationNotices({ gtfsTruncation: flags() }), []);
  });

  test('a response without the block produces no invented limits', () => {
    assert.deepEqual(gtfsTruncationNotices({}), []);
  });

  test('the developer funnel names every truncated stage', () => {
    const lines = funnelLines({
      ...searchResult,
      gtfsTruncation: flags({ candidateGraph: true, candidatePoolLimit: true }),
    }).join('\n');
    assert.match(lines, /Зрізано: results, candidate-generation, sampling, candidateGraph, candidatePoolLimit/);
  });
});
