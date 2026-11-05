import type { RouteSheetSnap } from './routeSheet';

/**
 * The stops panel of the route sheet and of the active-navigation sheet.
 *
 * Both sheets used to open with every scheduled segment's stop list already
 * expanded (route sheet) or with the panel rendered as a sibling of the leg
 * card (navigation sheet). On a 390×844 viewport that turned the sheet into
 * ~970 px of separate stop blocks inside an 1848 px scroll area, so the
 * itinerary itself was the thing the passenger could not find.
 *
 * The rule now: one segment's stops open at a time, inside that segment's own
 * card, and opening them raises the sheet to the detent where they are
 * actually visible.
 */

/** Tapping the open segment collapses it; tapping another moves the block there. */
export function nextStopsLegId(openLegId: string | null, legId: string): string | null {
  return openLegId === legId ? null : legId;
}

/** Below FULL the segment list is a sliver (71 px on 390×844), so a stops block opened there would be invisible. */
export function stopsDetent(): RouteSheetSnap {
  return 'expanded';
}

/** True when opening the stops block has to move the sheet up first. */
export function sheetNeedsRaiseForStops(snap: RouteSheetSnap): boolean {
  return snap !== stopsDetent();
}
