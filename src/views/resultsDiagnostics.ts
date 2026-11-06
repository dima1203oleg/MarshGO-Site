import type { ApiJourneySearchResult } from '../services/productionApi';

export type ResultNotice = { tone: 'amber' | 'blue' | 'rose' | 'slate'; text: string };

const headlinePriority: ResultNotice['tone'][] = ['rose', 'amber', 'blue', 'slate'];

/** The list keeps one honest line about the search; every other limitation is developer diagnostics. */
export function splitResultNotices(notices: ResultNotice[]): { headline: ResultNotice | null; technical: ResultNotice[] } {
  const headline = headlinePriority.map(tone => notices.find(notice => notice.tone === tone)).find(Boolean) ?? null;
  return { headline, technical: headline ? notices.filter(notice => notice !== headline) : [...notices] };
}

/** Passenger-facing truncation facts; the Server flags each independently (truncationState). */
export function truncationNotices(result: Pick<ApiJourneySearchResult, 'resultsTruncated' | 'candidateGenerationTruncated' | 'resultSamplingTruncated'>): ResultNotice[] {
  const notices: ResultNotice[] = [];
  if (result.resultsTruncated) notices.push({ tone: 'blue', text: 'Показано найкращі варіанти для обраного режиму поїздки.' });
  if (result.candidateGenerationTruncated) notices.push({ tone: 'amber', text: 'Пошук не охопив усі можливі варіанти в частині джерел. Деякі маршрути можуть бути відсутні; спробуйте змінити час або види транспорту.' });
  // resultLimitReached upstream: the source ranked more variants than it returned.
  if (result.resultSamplingTruncated) notices.push({ tone: 'amber', text: 'Частина джерел обмежила кількість варіантів, тому деякі маршрути могли не потрапити до результатів.' });
  return notices;
}

/** Candidate counts for each search stage, so a missing route can be attributed instead of guessed. */
export function funnelLines(result: ApiJourneySearchResult): string[] {
  const lines: string[] = [];
  const completeness = result.completeness;
  if (completeness) {
    lines.push(`Провайдери: ${completeness.providersQueried} запитано · ${completeness.providersSucceeded} успішно · ${completeness.providersFailed} із збоєм`);
    lines.push(`Кандидати: ${completeness.candidatesGenerated} згенеровано · ${completeness.candidatesValidated} валідовано · ${completeness.candidatesRejected} відхилено · ${completeness.candidatesDeduplicated} після дедуплікації`);
    lines.push(`Видано: ${completeness.resultsReturned} · пошук ${completeness.searchComplete ? 'завершений' : 'обмежений'}${completeness.transitSearchFailed ? ' · публічний транспорт не відповідав' : ''}`);
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

/** Passenger-honest sentences for planner reasons the API names; unknown reasons must never pass silently. */
const partialReasonMessages: Record<string, string> = {
  walking_routing_unavailable: 'Пішохідні підходи до зупинок показано приблизно.',
  no_stop_within_walking_distance: 'Поблизу ваших точок немає зупинки в межах пішої доступності, тому маршрутів не знайдено. Спробуйте точки ближче до зупинок або інший вид транспорту.',
  walk_reach_extended: 'Для частини знайдених маршрутів найближча зупинка далі за задану пішу відстань.',
};

type WalkingReachDisclosure = Pick<NonNullable<ApiJourneySearchResult['completeness']>,
  'walkReachExtended' | 'journeysWithExtendedReach' | 'nearestOriginStopMeters' | 'nearestDestinationStopMeters'>;

const distanceMeters = (value: number | null | undefined): string | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? `${new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(value)} м`
    : null;

export function partialReasonNotices(reasons: string[] | undefined, completeness?: WalkingReachDisclosure): ResultNotice[] {
  return (reasons ?? []).filter(reason => partialReasonMessages[reason])
    .map(reason => {
      if (reason !== 'walk_reach_extended') return { tone: 'amber' as const, text: partialReasonMessages[reason] };
      const details: string[] = [];
      const count = completeness?.journeysWithExtendedReach;
      if (typeof count === 'number' && Number.isFinite(count) && count >= 0) {
        details.push(`Маршрутів із довшим пішим підходом: ${new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(count)}`);
      }
      const originDistance = distanceMeters(completeness?.nearestOriginStopMeters);
      const destinationDistance = distanceMeters(completeness?.nearestDestinationStopMeters);
      if (originDistance) details.push(`найближча зупинка від початку пошуку — ${originDistance}`);
      if (destinationDistance) details.push(`найближча зупинка біля пункту призначення — ${destinationDistance}`);
      return {
        tone: 'amber' as const,
        text: details.length ? `${partialReasonMessages[reason]} ${details.join('; ')}` : partialReasonMessages[reason],
      };
    });
}

