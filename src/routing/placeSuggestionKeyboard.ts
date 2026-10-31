export type PlaceSuggestionKeyAction = 'none' | 'highlight_next' | 'highlight_prev' | 'accept' | 'dismiss' | 'search';

// A geocoder dropdown is a combobox/listbox, not a form field: while it is open the arrow keys
// belong to the list, Enter accepts the highlighted option instead of submitting the search form,
// and Escape only closes the list.
export function placeSuggestionKeyAction(key: string, listOpen: boolean, activeIndex: number): PlaceSuggestionKeyAction {
  if (key === 'Escape') return listOpen ? 'dismiss' : 'none';
  if (key === 'ArrowDown') return listOpen ? 'highlight_next' : 'none';
  if (key === 'ArrowUp') return listOpen ? 'highlight_prev' : 'none';
  if (key === 'Enter') return listOpen && activeIndex >= 0 ? 'accept' : 'search';
  return 'none';
}

// With nothing highlighted yet, ArrowDown enters the list from the top and ArrowUp from the bottom.
export function moveActivePlaceIndex(activeIndex: number, optionCount: number, delta: 1 | -1): number {
  if (optionCount <= 0) return -1;
  const start = activeIndex >= 0 ? activeIndex : delta > 0 ? -1 : optionCount;
  return Math.min(optionCount - 1, Math.max(0, start + delta));
}

export function activePlaceOptionId(listId: string, activeIndex: number): string | undefined {
  return activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined;
}
