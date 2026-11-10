/** Refresh views after a server mutation without rewriting its committed result. */
export async function refreshCommittedActionData(
  refreshers: Array<() => Promise<unknown>>,
): Promise<boolean> {
  const results = await Promise.allSettled(
    refreshers.map((refresh) => Promise.resolve().then(refresh)),
  );
  return results.every((result) => result.status === 'fulfilled');
}
