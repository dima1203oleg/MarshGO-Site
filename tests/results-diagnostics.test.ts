import assert from 'node:assert/strict';
import test from 'node:test';
import { diagnosticsRequested, funnelLines, showsCarpoolSection, splitResultNotices } from '../src/views/resultsDiagnostics';
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

// SITE-3.1 diagnostics. The live Lviv search measured 80 extended-reach candidates against 1 returned
// journey, so the funnel must keep the two numbers apart instead of printing one as the other.
test('the funnel keeps extended-reach candidates apart from journeys actually returned', () => {
  const extended = {
    ...searchResult,
    completeness: { ...searchResult.completeness, walkReachExtended: true, journeysWithExtendedReach: 80 },
  } as unknown as ApiJourneySearchResult;
  const lines = funnelLines(extended).join('\n');
  assert.match(lines, /Піший радіус розширено: кандидатів із зайвим плечем 80 · віддано 4/);
  assert.doesNotMatch(funnelLines(searchResult).join('\n'), /Піший радіус/);
});
