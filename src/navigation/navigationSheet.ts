export type NavigationSheetLevel = 'collapsed' | 'partial' | 'expanded';

/** Move one snap point per deliberate vertical swipe; small GPS/hand jitter does not change the sheet state. */
export function snapNavigationSheet(level: NavigationSheetLevel, verticalDelta: number, threshold = 24): NavigationSheetLevel {
  if (verticalDelta <= -threshold) return level === 'collapsed' ? 'partial' : 'expanded';
  if (verticalDelta >= threshold) return level === 'expanded' ? 'partial' : 'collapsed';
  return level;
}
