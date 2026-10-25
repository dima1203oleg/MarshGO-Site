export interface JourneySearchTruncationFields {
  resultsTruncated?: boolean;
  candidateGenerationTruncated?: boolean;
  resultSamplingTruncated?: boolean;
}

export interface JourneySearchNoticeState {
  candidateGeneration: boolean;
  resultSampling: boolean;
}

/** Keep search incompleteness distinct from the later per-strategy display cap. */
export function getJourneySearchNoticeState(result: JourneySearchTruncationFields): JourneySearchNoticeState {
  const candidateGeneration = result.candidateGenerationTruncated === true;
  const resultSampling = result.resultSamplingTruncated
    ?? (result.resultsTruncated === true && !candidateGeneration);
  return { candidateGeneration, resultSampling };
}
