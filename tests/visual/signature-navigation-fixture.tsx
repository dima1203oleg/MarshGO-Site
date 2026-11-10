import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { ApiJourney } from '../../src/services/productionApi';
import { JourneyRouteMapScreen } from '../../src/views/JourneyRouteMapScreen';
import '../../src/index.css';

// Local-only visual fixture: it renders the production route screen without
// inventing a user session or making authenticated journey requests.
const day = '2026-11-11T08:';
const journey = {
  id: 'visual-only-signature-route',
  offerId: null,
  strategy: 'BALANCED',
  state: 'READY',
  totalDurationSeconds: 2_640,
  requestedDepartureAt: `${day}00:00+02:00`,
  waitingSeconds: 0,
  totalPriceMinor: 6_000,
  confirmedPriceMinor: 6_000,
  estimatedPriceMinMinor: null,
  estimatedPriceMaxMinor: null,
  walkingMeters: 880,
  transfers: 0,
  reliabilityScore: null,
  currency: 'UAH',
  priceStatus: 'LOCKED',
  legs: [
    {
      id: 'visual-walk-access', mode: 'WALK', transportType: 'walk', offerId: null,
      origin: { name: 'Центр', coordinates: [24.031, 49.842] },
      destination: { name: 'Площа Галицька', coordinates: [24.028, 49.84] },
      departureAt: `${day}00:00+02:00`, arrivalAt: `${day}04:00+02:00`,
      durationSeconds: 240, distanceMeters: 330, priceMinor: 0, priceStatus: 'LOCKED',
      availabilityStatus: 'AVAILABLE', source: 'visual-fixture', lastUpdatedAt: `${day}00:00+02:00`,
      routeAccuracy: 'approximate', geometrySource: 'walking-estimate',
      routeGeometry: [[24.031, 49.842], [24.029, 49.841], [24.028, 49.84]],
      driver: null, vehicle: null,
    },
    {
      id: 'visual-bus-a53', mode: 'BUS', transportType: 'bus', routeName: 'A53', offerId: null,
      origin: { name: 'Площа Галицька', coordinates: [24.028, 49.84] },
      destination: { name: 'Сихів', coordinates: [24.05, 49.805] },
      departureAt: `${day}04:00+02:00`, arrivalAt: `${day}37:00+02:00`,
      durationSeconds: 1_980, distanceMeters: 7_400, priceMinor: 6_000, priceStatus: 'LOCKED',
      availabilityStatus: 'AVAILABLE', source: 'visual-fixture', lastUpdatedAt: `${day}00:00+02:00`,
      headsign: 'Сихів', routeAccuracy: 'approximate',
      routeGeometry: [[24.028, 49.84], [24.025, 49.832], [24.035, 49.819], [24.046, 49.809], [24.05, 49.805]],
      driver: null, vehicle: null,
    },
    {
      id: 'visual-walk-egress', mode: 'WALK', transportType: 'walk', offerId: null,
      origin: { name: 'Сихів', coordinates: [24.05, 49.805] },
      destination: { name: 'Проспект Червоної Калини', coordinates: [24.054, 49.802] },
      departureAt: `${day}37:00+02:00`, arrivalAt: `${day}44:00+02:00`,
      durationSeconds: 420, distanceMeters: 550, priceMinor: 0, priceStatus: 'LOCKED',
      availabilityStatus: 'AVAILABLE', source: 'visual-fixture', lastUpdatedAt: `${day}00:00+02:00`,
      routeAccuracy: 'approximate', geometrySource: 'walking-estimate',
      routeGeometry: [[24.05, 49.805], [24.052, 49.803], [24.054, 49.802]],
      driver: null, vehicle: null,
    },
  ],
} as unknown as ApiJourney;

const root = document.getElementById('root');
if (!root) throw new Error('Missing preview root');
createRoot(root).render(<StrictMode><JourneyRouteMapScreen journey={journey} onBack={() => undefined} /></StrictMode>);
