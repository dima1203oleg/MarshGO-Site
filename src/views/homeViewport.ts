/** Reserve the real fixed tab-bar height; shell padding can include empty safe-area space. */
export function calculateHomeAvailableHeight(
  viewportHeight: number,
  contentTop: number,
  fixedTabbarTop: number | null,
  shellPaddingBottom: number,
): number {
  const tabbarGap = fixedTabbarTop === null || !Number.isFinite(fixedTabbarTop)
    ? 0
    : Math.max(0, viewportHeight - fixedTabbarTop);
  const fallbackPadding = Number.isFinite(shellPaddingBottom) ? Math.max(0, shellPaddingBottom) : 0;
  const reservedBottom = tabbarGap || fallbackPadding;
  return Math.max(300, Math.floor(viewportHeight - contentTop - reservedBottom - 4));
}
