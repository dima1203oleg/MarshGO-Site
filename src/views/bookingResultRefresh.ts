/** Refresh post-booking views without changing the outcome of a committed booking. */
export async function refreshCommittedBookingData(
  refreshers: Array<() => Promise<unknown>>,
): Promise<boolean> {
  const results = await Promise.allSettled(
    refreshers.map((refresh) => Promise.resolve().then(refresh)),
  );
  return results.every((result) => result.status === 'fulfilled');
}
