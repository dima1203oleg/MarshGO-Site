import type { ApiJourneySearchResult } from '../services/productionApi';

export type ResultNotice = { tone: 'amber' | 'blue' | 'rose' | 'slate'; text: string };

const headlinePriority: ResultNotice['tone'][] = ['rose', 'amber', 'blue', 'slate'];

/** The list keeps one honest line about the search; every other limitation is developer diagnostics. */
export function splitResultNotices(notices: ResultNotice[]): { headline: ResultNotice | null; technical: ResultNotice[] } {
  const headline = headlinePriority.map(tone => notices.find(notice => notice.tone === tone)).find(Boolean) ?? null;
  return { headline, technical: headline ? notices.filter(notice => notice !== headline) : [...notices] };
}

/** Candidate counts for each search stage, so a missing route can be attributed instead of guessed. */
export function funnelLines(result: ApiJourneySearchResult): string[] {
  const lines: string[] = [];
  const completeness = result.completeness;
  if (completeness) {
    lines.push(`Провайдери: ${completeness.providersQueried} запитано · ${completeness.providersSucceeded} успішно · ${completeness.providersFailed} із збоєм`);
    lines.push(`Кандидати: ${completeness.candidatesGenerated} згенеровано · ${completeness.candidatesValidated} валідовано · ${completeness.candidatesRejected} відхилено · ${completeness.candidatesDeduplicated} після дедуплікації`);
    lines.push(`Видано: ${completeness.resultsReturned} · пошук ${completeness.searchComplete ? 'завершений' : 'обмежений'}${completeness.transitSearchFailed ? ' · публічний транспорт не відповідав' : ''}`);
    // The extended count is validated candidates, not returned cards — the two numbers must not be merged.
    if (completeness.walkReachExtended) {
      lines.push(`Піший радіус розширено: кандидатів із зайвим плечем ${completeness.journeysWithExtendedReach ?? '—'} · віддано ${completeness.resultsReturned}`);
    }
    if (completeness.modesAvailable.length) lines.push(`Категорії з джерелом: ${completeness.modesAvailable.join(', ')}`);
    const unexplained = completeness.modesUnavailable.filter(mode => !mode.available);
    if (unexplained.length) lines.push(`Категорії без джерела: ${unexplained.map(mode => `${mode.mode} — ${mode.reason}`).join('; ')}`);
  }
  lines.push(`Ранжування: кандидатів ${result.candidateCount ?? '—'} · Pareto ${result.paretoCount ?? '—'} · повернуто ${result.returnedCount ?? '—'} · ліміт ${result.alternativeLimitPerStrategy ?? '—'} на режим`);
  const truncated = [result.resultsTruncated && 'results', result.candidateGenerationTruncated && 'candidate-generation',
    result.resultSamplingTruncated && 'sampling'].filter(Boolean);
  lines.push(`Зрізано: ${truncated.length ? truncated.join(', ') : 'нічого'}`);
  return lines;
}

/** Diagnostics never render for ordinary customers; a developer opts in with ?debug=1 or the stored flag. */
export const diagnosticsRequested = (search: string, storedFlag: string | null): boolean =>
  /(?:^|[?&])debug=1(?:&|$)/.test((search ?? '').replace(/^\?/, '')) || storedFlag === '1';

/** An empty carpool block under real transit results is noise; with no transit answer it is the empty state. */
export const showsCarpoolSection = (offerCount: number, transitResultPresent: boolean): boolean =>
  offerCount > 0 || !transitResultPresent;
