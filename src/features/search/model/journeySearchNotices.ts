export interface JourneySearchTruncationFields {
  resultsTruncated?: boolean;
  candidateGenerationTruncated?: boolean;
  resultSamplingTruncated?: boolean;
  gtfsTruncation?: {
    stopSelection?: boolean;
    candidateGraph?: boolean;
    searchBudget?: boolean;
    searchStepLimit?: boolean;
    candidatePoolLimit?: boolean;
    candidateSampling?: boolean;
    responsePage?: boolean;
  };
}

export interface JourneySearchNoticeState {
  candidateGeneration: boolean;
  resultSampling: boolean;
  gtfsReasons: string[];
}

const gtfsTruncationLabels: Array<[keyof NonNullable<JourneySearchTruncationFields['gtfsTruncation']>, string]> = [
  ['stopSelection', 'відбір зупинок'],
  ['candidateGraph', 'побудова графа розкладу'],
  ['searchBudget', 'обмеження обсягу пошуку'],
  ['searchStepLimit', 'ліміт кроків пошуку'],
  ['candidatePoolLimit', 'ліміт набору маршрутів'],
  ['candidateSampling', 'відбір кандидатів'],
  ['responsePage', 'ліміт кількості результатів'],
];

/** Keep search incompleteness distinct from the later per-strategy display cap. */
export function getJourneySearchNoticeState(result: JourneySearchTruncationFields): JourneySearchNoticeState {
  const gtfsReasons = gtfsTruncationLabels
    .filter(([reason]) => result.gtfsTruncation?.[reason] === true)
    .map(([, label]) => label);
  const candidateGeneration = result.candidateGenerationTruncated === true || gtfsReasons.length > 0;
  const resultSampling = result.resultSamplingTruncated
    ?? (result.resultsTruncated === true && !candidateGeneration);
  return { candidateGeneration, resultSampling, gtfsReasons };
}
