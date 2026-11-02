export const MAX_DESTINATION_NAME_LENGTH = 120;

// Geocoder labels are unbounded (a Lviv street address came back at 122 characters) while the
// navigation API accepts destination names of 1–120 characters. Trailing administrative segments
// are the least useful part of a label, so drop them before cutting the text itself.
export function navigationDestinationName(label: string): string {
  const normalized = label.trim().replace(/\s+/g, ' ');
  if (!normalized) return 'Пункт призначення';
  if (normalized.length <= MAX_DESTINATION_NAME_LENGTH) return normalized;

  const parts = normalized.split(',').map(part => part.trim()).filter(Boolean);
  for (let keep = parts.length - 1; keep >= 1; keep -= 1) {
    const candidate = parts.slice(0, keep + 1).join(', ');
    if (candidate.length <= MAX_DESTINATION_NAME_LENGTH) return candidate;
  }
  const first = parts[0] ?? normalized;
  if (first.length <= MAX_DESTINATION_NAME_LENGTH) return first;
  return `${first.slice(0, MAX_DESTINATION_NAME_LENGTH - 1).trimEnd()}…`;
}
