/** User-facing fallback text for journey preference constraints returned by Server. */
export function journeyPreferenceMessage(value: string): string | null {
  switch (value) {
    case 'CHEAPEST:unpriced-route-segments-unavailable':
    case 'CHEAPEST:public-transit-fares-unavailable':
      return 'найдешевший варіант серед маршрутів без відомих тарифів визначити неможливо';
    default:
      return null;
  }
}
