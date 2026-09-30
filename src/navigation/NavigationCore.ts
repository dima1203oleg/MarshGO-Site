import type { EtaEstimate, LocationFix, MatchedLocation, RouteResult, RouteRequest } from '../../shared/navigation/contracts';
import type { NavigationError } from '../../shared/navigation/errors';

export type NavigationLifecycle = 'IDLE' | 'PLANNING' | 'ACTIVE' | 'PAUSED' | 'REROUTING' | 'OFFLINE' | 'ARRIVED' | 'ENDED' | 'ERROR';
export type Connectivity = 'ONLINE' | 'DEGRADED' | 'OFFLINE';
export type GpsState = { status: 'UNKNOWN' | 'AVAILABLE' | 'DEGRADED' | 'UNAVAILABLE'; accuracyMeters: number | null; lastFixAt: string | null };
export type MatchingState = { status: 'IDLE' | 'MATCHED' | 'LOW_CONFIDENCE'; confidence: number | null; provider: string | null };
export type NavigationState = {
  sessionId: string | null;
  lifecycle: NavigationLifecycle;
  route: RouteResult | null;
  routeVersion: number;
  currentLocation: MatchedLocation | null;
  gps: GpsState;
  matching: MatchingState;
  currentLegIndex: number;
  currentManeuverIndex: number;
  remainingDistanceMeters: number | null;
  remainingDurationSeconds: number | null;
  eta: EtaEstimate | null;
  offRoute: boolean;
  rerouteRequired: boolean;
  connectivity: Connectivity;
  error: NavigationError | null;
};

export type NavigationEvent =
  | { type: 'NAVIGATION_START_REQUESTED'; request: RouteRequest }
  | { type: 'NAVIGATION_SESSION_RECONCILED'; sessionId: string; route: RouteResult; paused: boolean }
  | { type: 'ROUTE_RECEIVED'; route: RouteResult }
  | { type: 'GPS_FIX_RECEIVED'; fix: LocationFix }
  | { type: 'LOCATION_MATCHED'; location: MatchedLocation }
  | { type: 'ROUTE_DEVIATION_DETECTED' }
  | { type: 'REROUTE_STARTED' }
  | { type: 'REROUTE_SUCCEEDED'; route: RouteResult }
  | { type: 'REROUTE_FAILED'; error: NavigationError }
  | { type: 'CONNECTIVITY_LOST' }
  | { type: 'CONNECTIVITY_RESTORED' }
  | { type: 'NAVIGATION_PAUSED' }
  | { type: 'NAVIGATION_RESUMED' }
  | { type: 'NAVIGATION_ARRIVED' }
  | { type: 'NAVIGATION_ENDED' }
  | { type: 'NAVIGATION_FAILED'; error: NavigationError };

export type NavigationEffect =
  | { type: 'REQUEST_ROUTE'; request: RouteRequest }
  | { type: 'REQUEST_REROUTE' }
  | { type: 'PERSIST_OFFLINE_STATE' }
  | { type: 'CLEAR_OFFLINE_STATE' }
  | { type: 'EMIT_TELEMETRY'; name: string };
export type TransitionResult = { state: NavigationState; effects: NavigationEffect[] };

export const initialNavigationState = (): NavigationState => ({
  sessionId: null, lifecycle: 'IDLE', route: null, routeVersion: 0, currentLocation: null,
  currentLegIndex: 0, currentManeuverIndex: 0, remainingDistanceMeters: null,
  remainingDurationSeconds: null, eta: null,
  gps: { status: 'UNKNOWN', accuracyMeters: null, lastFixAt: null },
  matching: { status: 'IDLE', confidence: null, provider: null }, offRoute: false, rerouteRequired: false,
  connectivity: 'ONLINE', error: null,
});

/** Pure serializable FSM. I/O, clocks and platform APIs belong to adapters. */
export function transition(state: NavigationState, event: NavigationEvent): TransitionResult {
  const noEffects: NavigationEffect[] = [];
  switch (event.type) {
    case 'NAVIGATION_SESSION_RECONCILED':
      return { state: {
        ...state,
        sessionId: event.sessionId,
        lifecycle: event.paused ? 'PAUSED' : state.connectivity === 'OFFLINE' ? 'OFFLINE' : 'ACTIVE',
        route: event.route,
        routeVersion: event.route.routeVersion,
        remainingDistanceMeters: event.route.distanceMeters,
        remainingDurationSeconds: event.route.durationSeconds,
        offRoute: false,
        rerouteRequired: false,
        error: null,
      }, effects: [] };
    case 'NAVIGATION_START_REQUESTED':
      if (!['IDLE', 'ENDED', 'ERROR'].includes(state.lifecycle)) return { state, effects: noEffects };
      return { state: { ...initialNavigationState(), lifecycle: 'PLANNING', connectivity: state.connectivity }, effects: [{ type: 'REQUEST_ROUTE', request: event.request }] };
    case 'ROUTE_RECEIVED':
      if (!['PLANNING', 'REROUTING', 'OFFLINE'].includes(state.lifecycle)) return { state, effects: noEffects };
      return { state: { ...state, lifecycle: state.connectivity === 'OFFLINE' ? 'OFFLINE' : 'ACTIVE', route: event.route, routeVersion: event.route.routeVersion, remainingDistanceMeters: event.route.distanceMeters, remainingDurationSeconds: event.route.durationSeconds, offRoute: false, rerouteRequired: false, error: null }, effects: [] };
    case 'GPS_FIX_RECEIVED':
      if (!['ACTIVE', 'REROUTING', 'OFFLINE'].includes(state.lifecycle)) return { state, effects: noEffects };
      return { state: { ...state, gps: { status: event.fix.accuracyMeters > 50 ? 'DEGRADED' : 'AVAILABLE', accuracyMeters: event.fix.accuracyMeters, lastFixAt: event.fix.capturedAtClient } }, effects: [] };
    case 'LOCATION_MATCHED':
      if (!['ACTIVE', 'REROUTING', 'OFFLINE'].includes(state.lifecycle)) return { state, effects: noEffects };
      if (!state.route) return { state, effects: noEffects };
      {
        const remainingDistanceMeters = Math.max(0, state.route.distanceMeters - event.location.distanceAlongRouteMeters);
        const ratio = state.route.distanceMeters > 0 ? Math.min(1, remainingDistanceMeters / state.route.distanceMeters) : 0;
        const remainingDurationSeconds = Math.max(0, Math.round(state.route.durationSeconds * ratio));
        const timestamp = Date.parse(event.location.capturedAtClient);
        const eta = Number.isFinite(timestamp) ? {
          arrivalAt: new Date(timestamp + remainingDurationSeconds * 1000).toISOString(), remainingSeconds: remainingDurationSeconds,
          baselineSeconds: remainingDurationSeconds, ...(state.route.trafficDelaySeconds === undefined ? {} : { trafficDelaySeconds: Math.round(state.route.trafficDelaySeconds * ratio) }),
          uncertaintySeconds: Math.round(Math.max(30, remainingDurationSeconds * 0.15)), confidence: event.location.confidence,
          source: state.connectivity === 'ONLINE' && state.route.trafficAware ? 'TRAFFIC' as const : state.connectivity === 'OFFLINE' ? 'BASELINE' as const : 'LIVE_PROGRESS' as const,
        } : null;
        let maneuverIndex = 0; let maneuverEndMeters = 0;
        for (let index = 0; index < state.route.maneuvers.length; index += 1) {
          maneuverEndMeters += state.route.maneuvers[index].distanceMeters;
          if (event.location.distanceAlongRouteMeters > maneuverEndMeters) maneuverIndex = Math.min(index + 1, state.route.maneuvers.length - 1);
        }
        const arrived = remainingDistanceMeters <= 30
          && event.location.confidence >= 0.7
          && event.location.distanceFromRouteMeters <= Math.max(25, event.location.accuracyMeters * 1.5);
        return { state: {
          ...state, currentLocation: event.location, currentManeuverIndex: maneuverIndex,
          remainingDistanceMeters, remainingDurationSeconds, eta,
          lifecycle: arrived ? 'ARRIVED' : state.lifecycle,
          matching: { status: event.location.confidence < 0.5 ? 'LOW_CONFIDENCE' : 'MATCHED', confidence: event.location.confidence, provider: event.location.matchingProvider },
        }, effects: arrived && state.lifecycle !== 'ARRIVED' ? [{ type: 'EMIT_TELEMETRY', name: 'navigation.arrived' }] : [] };
      }
    case 'ROUTE_DEVIATION_DETECTED':
      if (state.lifecycle !== 'ACTIVE' || state.connectivity === 'OFFLINE') return { state, effects: noEffects };
      return { state: { ...state, offRoute: true, rerouteRequired: true }, effects: [{ type: 'REQUEST_REROUTE' }] };
    case 'REROUTE_STARTED':
      if (state.lifecycle !== 'ACTIVE' || !state.rerouteRequired) return { state, effects: noEffects };
      return { state: { ...state, lifecycle: 'REROUTING' }, effects: [] };
    case 'REROUTE_SUCCEEDED':
      if (state.lifecycle !== 'REROUTING' || event.route.routeVersion <= state.routeVersion) return { state, effects: noEffects };
      return { state: { ...state, lifecycle: 'ACTIVE', route: event.route, routeVersion: event.route.routeVersion, remainingDistanceMeters: event.route.distanceMeters, remainingDurationSeconds: event.route.durationSeconds, offRoute: false, rerouteRequired: false, error: null }, effects: [] };
    case 'REROUTE_FAILED':
      if (state.lifecycle !== 'REROUTING') return { state, effects: noEffects };
      return { state: { ...state, lifecycle: state.connectivity === 'OFFLINE' ? 'OFFLINE' : 'ACTIVE', rerouteRequired: false, error: event.error }, effects: [] };
    case 'CONNECTIVITY_LOST':
      if (['IDLE', 'ENDED', 'ERROR'].includes(state.lifecycle)) return { state: { ...state, connectivity: 'OFFLINE' }, effects: [] };
      return { state: { ...state, lifecycle: 'OFFLINE', connectivity: 'OFFLINE', eta: state.eta ? { ...state.eta, source: 'BASELINE' } : null }, effects: [{ type: 'PERSIST_OFFLINE_STATE' }] };
    case 'CONNECTIVITY_RESTORED':
      if (state.lifecycle !== 'OFFLINE') return { state: { ...state, connectivity: 'ONLINE' }, effects: [] };
      return { state: { ...state, lifecycle: state.route ? 'ACTIVE' : 'PLANNING', connectivity: 'ONLINE' }, effects: [{ type: 'CLEAR_OFFLINE_STATE' }] };
    case 'NAVIGATION_PAUSED':
      if (!['ACTIVE', 'REROUTING'].includes(state.lifecycle)) return { state, effects: noEffects };
      return { state: { ...state, lifecycle: 'PAUSED' }, effects: [{ type: 'EMIT_TELEMETRY', name: 'navigation.paused' }] };
    case 'NAVIGATION_RESUMED':
      if (state.lifecycle !== 'PAUSED') return { state, effects: noEffects };
      return { state: { ...state, lifecycle: state.connectivity === 'OFFLINE' ? 'OFFLINE' : 'ACTIVE' }, effects: [{ type: 'EMIT_TELEMETRY', name: 'navigation.resumed' }] };
    case 'NAVIGATION_ARRIVED':
      if (!['ACTIVE', 'OFFLINE'].includes(state.lifecycle)) return { state, effects: noEffects };
      return { state: { ...state, lifecycle: 'ARRIVED' }, effects: [{ type: 'EMIT_TELEMETRY', name: 'navigation.arrived' }] };
    case 'NAVIGATION_ENDED':
      if (['IDLE', 'ENDED'].includes(state.lifecycle)) return { state, effects: noEffects };
      return { state: { ...initialNavigationState(), lifecycle: 'ENDED', connectivity: state.connectivity }, effects: [{ type: 'CLEAR_OFFLINE_STATE' }, { type: 'EMIT_TELEMETRY', name: 'navigation.ended' }] };
    case 'NAVIGATION_FAILED':
      return { state: { ...state, lifecycle: 'ERROR', error: event.error }, effects: [{ type: 'EMIT_TELEMETRY', name: 'navigation.failed' }] };
  }
}
