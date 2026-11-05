import type { MapStatus } from './MapAdapter';

/**
 * One source of truth for map-surface status copy.
 *
 * The six map surfaces (route sheet, active navigation, navigation, transport
 * map, offer preview, rendezvous map) used to phrase the same failure six
 * different ways, three of them in engineering words a passenger cannot act on
 * («базові тайли», «стиль і підкладка MARSHGO», «manifest провайдера», «фон мапи»).
 * Keep the wording here so it cannot drift again, and keep the rule:
 *
 * 1. no vendor or engineering vocabulary in passenger-facing text;
 * 2. a partially missing basemap never hides the data we do have — the sentence says
 *    what stays visible, because our own sources are installed once the style loads;
 * 3. a state that never got a style must promise nothing. When the style request
 *    itself fails, MapLibre does not reach `load`, our sources are never installed and
 *    the canvas is empty — verified in `basemap-blocked-light/dark.png` (2026-11-05),
 *    where the transport map showed zero markers under a failed basemap.
 */
export type MapStatusSubject = 'journey' | 'transport' | 'meet' | 'preview';

/** What keeps working when the streets are missing but the canvas itself rendered. */
const STILL_VISIBLE: Record<MapStatusSubject, string> = {
  journey: 'маршрут і зупинки видно',
  transport: 'зупинки й маршрути видно у списку нижче',
  meet: 'точку зустрічі й статус нижче видно',
  preview: 'лінію маршруту видно',
};

/** Short, pill-safe label for chrome that truncates (max-w + truncate). */
export function mapStatusNote(status: MapStatus): string {
  switch (status) {
    case 'available': return '';
    case 'loading': return 'Завантажуємо карту…';
    case 'unconfigured': return 'Карта без вулиць';
    case 'degraded': return 'Карта частково';
    case 'failed': return 'Карта недоступна';
  }
}

/** Full human sentence for banners, titles and aria-labels. */
export function mapStatusDetail(status: MapStatus, subject: MapStatusSubject = 'journey'): string {
  const still = STILL_VISIBLE[subject];
  switch (status) {
    case 'available': return '';
    case 'loading': return 'Завантажуємо карту…';
    case 'unconfigured': return `Мапа тимчасово без вулиць і будинків — ${still}.`;
    case 'degraded': return `Мапа завантажилася частково — ${still}.`;
    case 'failed': return 'Карта не завантажилася — перевірте мережу й спробуйте ще раз.';
  }
}
