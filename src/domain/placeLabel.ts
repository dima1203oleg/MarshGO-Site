const STREET_TOKEN = /^(вул|вулиц|просп|проспект|пр-кт|бульвар|бул|б-р|пров|провул|переулок|наб|набереж|площ|пл|шосе|шос|автодор|трас|ліни|лінії|масив|садиб|квартал|містечко|станц|зупин|аеропорт|вокзал|термінал)/i;
const ADMIN_TOKEN = /(област|район|громада|Україн|oblast|raion|hromada)/i;
const HOUSE_NUMBER = /^\d{1,4}\s*[a-zа-яіїєґ']{0,2}\.?$/i;

/**
 * Geocoder labels are most-specific-first and run to 120 characters, so a card title built from the
 * raw string spends its whole width on raions and hromadas and truncates before the destination.
 * Keep the full label for `title` attributes and screen readers via `fullPlaceLabel`.
 */
export function compactPlaceLabel(label: string | null | undefined): string {
  const parts = (label ?? '').split(',').map(part => part.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  const [first, ...rest] = parts;
  if (!STREET_TOKEN.test(first)) return first;
  const number = rest.find(part => HOUSE_NUMBER.test(part));
  const city = rest.find(part => !HOUSE_NUMBER.test(part) && !ADMIN_TOKEN.test(part));
  return [first, number, city].filter(Boolean).join(', ');
}

export const fullPlaceLabel = (label: string | null | undefined): string => (label ?? '').trim();
