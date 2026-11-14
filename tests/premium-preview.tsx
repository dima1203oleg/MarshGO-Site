import { createRoot } from 'react-dom/client';
import { JourneyActiveNavigation } from '../src/views/JourneyActiveNavigation';
import { themeService } from '../src/services/theme';
import type { ApiJourney } from '../src/services/productionApi';
import type { Coordinate } from '../shared/navigation/contracts';
import { buildFlightPath } from '../src/map/hyperFlightEngine';
import '../src/index.css';

const query = new URLSearchParams(location.search);
const long = query.has('long');
const missing = query.has('missing');
const disconnected = query.has('gap');
themeService.setTheme(query.get('theme') === 'light' ? 'light' : 'dark');
const walk: Coordinate[] = [[24.02, 49.8436], [24.023, 49.8436], [24.026, 49.8436], [24.026, 49.8446]];
const transit: Coordinate[] = long
  ? [walk.at(-1)!, [25.6, 49.6], [27.0, 50.0], [29.0, 50.2], [30.52, 50.45]]
  : [walk.at(-1)!, [24.026, 49.85], [24.04, 49.85], [24.04, 49.853]];
const arrival: Coordinate[] = [transit.at(-1)!, [transit.at(-1)![0] + 0.002, transit.at(-1)![1]], [transit.at(-1)![0] + 0.002, transit.at(-1)![1] + 0.001]];
const leg = (id: string, mode: string, coordinates: Coordinate[], start: number, duration: number): ApiJourney['legs'][number] => ({
  id, mode, offerId: null,
  origin: { name: mode === 'WALK' ? 'Початок тестового переходу' : 'Тестова посадка', coordinates: coordinates[0]! },
  destination: { name: mode === 'WALK' ? 'Кінець тестового переходу' : 'Тестова висадка', coordinates: coordinates.at(-1)! },
  departureAt: new Date(start).toISOString(), arrivalAt: new Date(start + duration * 1000).toISOString(),
  durationSeconds: duration, distanceMeters: buildFlightPath(coordinates)!.totalMeters,
  routeGeometry: coordinates, routeAccuracy: 'VERIFIED', source: 'synthetic-browser-fixture',
  priceMinor: null, priceStatus: 'UNKNOWN', availabilityStatus: 'AVAILABLE', lastUpdatedAt: new Date(start).toISOString(),
  driver: null, vehicle: null, ...(mode !== 'WALK' ? { routeName: 'TEST 45', liveStatus: 'SCHEDULED' } : {}),
});
const start = Date.parse('2026-11-14T08:00:00+02:00');
const journey: ApiJourney = {
  id: 'synthetic-premium-preview', offerId: null, state: 'PLANNED', strategy: 'BALANCED', totalDurationSeconds: 1800,
  totalPriceMinor: null, confirmedPriceMinor: null, estimatedPriceMinMinor: null, estimatedPriceMaxMinor: null,
  walkingMeters: buildFlightPath(walk)!.totalMeters + buildFlightPath(arrival)!.totalMeters, transfers: 0, reliabilityScore: null,
  legs: [leg('walk-start', 'WALK', walk, start, 300), leg('transit', 'TRAIN', transit, start + 300_000, 1200), leg('walk-end', 'WALK', arrival, start + 1_500_000, 300)],
};
if (missing) journey.legs[1].routeGeometry = null;
if (disconnected) journey.legs[2].routeGeometry = [[31, 51], [31.002, 51]];
createRoot(document.getElementById('root')!).render(<JourneyActiveNavigation key={location.search} journey={journey} initialLegIndex={Number(query.get('stage') ?? 0)} notice="Тестовий маршрут · не live-дані" onExit={() => { location.href = '/'; }}/>);
