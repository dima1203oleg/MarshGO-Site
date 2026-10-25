import assert from 'node:assert/strict';
import test from 'node:test';
import { getJourneySearchNoticeState } from '../src/features/search/model/journeySearchNotices';

test('distinguishes candidate-generation truncation from result sampling', () => {
  assert.deepEqual(getJourneySearchNoticeState({ resultsTruncated: true, candidateGenerationTruncated: true, resultSamplingTruncated: false }), {
    candidateGeneration: true, resultSampling: false, gtfsReasons: [],
  });
  assert.deepEqual(getJourneySearchNoticeState({ resultsTruncated: true, candidateGenerationTruncated: false, resultSamplingTruncated: true }), {
    candidateGeneration: false, resultSampling: true, gtfsReasons: [],
  });
  assert.deepEqual(getJourneySearchNoticeState({ resultsTruncated: true, candidateGenerationTruncated: true, resultSamplingTruncated: true }), {
    candidateGeneration: true, resultSampling: true, gtfsReasons: [],
  });
});

test('keeps compatibility with older responses that omit the sampling flag', () => {
  assert.deepEqual(getJourneySearchNoticeState({ resultsTruncated: true, candidateGenerationTruncated: false }), {
    candidateGeneration: false, resultSampling: true, gtfsReasons: [],
  });
  assert.deepEqual(getJourneySearchNoticeState({ resultsTruncated: true, candidateGenerationTruncated: true }), {
    candidateGeneration: true, resultSampling: false, gtfsReasons: [],
  });
});

test('explains GTFS truncation causes and keeps response-page loss distinct from sampling notices', () => {
  assert.deepEqual(getJourneySearchNoticeState({
    resultsTruncated: true,
    resultSamplingTruncated: false,
    gtfsTruncation: { candidateGraph: true, responsePage: true },
  }), {
    candidateGeneration: true,
    resultSampling: false,
    gtfsReasons: ['побудова графа розкладу', 'ліміт кількості результатів'],
  });
});
