import assert from 'node:assert/strict';
import test from 'node:test';
import { diagnosticsRequested, funnelLines, partialReasonNotices, showsCarpoolSection, splitResultNotices } from '../src/views/resultsDiagnostics';
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
  for (const expected of ['2 запитано', '100 згенеровано', '100 валідовано', '0 відхилено', '4 після дедуплікації',
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

