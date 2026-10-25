import assert from 'node:assert/strict';
import test from 'node:test';
import { getJourneySearchNoticeState } from '../src/features/search/model/journeySearchNotices';

test('distinguishes candidate-generation truncation from result sampling', () => {
  assert.deepEqual(getJourneySearchNoticeState({ resultsTruncated: true, candidateGenerationTruncated: true, resultSamplingTruncated: false }), {
    candidateGeneration: true, resultSampling: false,
  });
  assert.deepEqual(getJourneySearchNoticeState({ resultsTruncated: true, candidateGenerationTruncated: false, resultSamplingTruncated: true }), {
    candidateGeneration: false, resultSampling: true,
  });
  assert.deepEqual(getJourneySearchNoticeState({ resultsTruncated: true, candidateGenerationTruncated: true, resultSamplingTruncated: true }), {
    candidateGeneration: true, resultSampling: true,
  });
});

test('keeps compatibility with older responses that omit the sampling flag', () => {
  assert.deepEqual(getJourneySearchNoticeState({ resultsTruncated: true, candidateGenerationTruncated: false }), {
    candidateGeneration: false, resultSampling: true,
  });
  assert.deepEqual(getJourneySearchNoticeState({ resultsTruncated: true, candidateGenerationTruncated: true }), {
    candidateGeneration: true, resultSampling: false,
  });
});
