/** The server's boundary for /places/suggest; keep both sides on the same numbers. */
export const PLACE_QUERY_MIN = 3;
export const PLACE_QUERY_MAX = 120;

/**
 * Returns the query the server accepts, or null when there is nothing worth
 * asking. Long place labels used to reach the API verbatim and surface
 * "place query must contain 3–120 characters" as rider-facing copy.
 */
export function normalizePlaceQuery(raw: string): string | null {
  const query = raw.trim().replace(/\s+/g, ' ');
  if (query.length < PLACE_QUERY_MIN) return null;
  return query.slice(0, PLACE_QUERY_MAX);
}
