const RIDESHARE_SIMULATOR_ALIASES = new Set([
  'rideshare_lifecycle_simulator',
  'rideshare_simulator',
  'simulator',
]);

export function isRideshareSimulatorRequest(
  search: string,
  options: { isDev: boolean; demoEnabled: boolean },
): boolean {
  if (!options.isDev || !options.demoEnabled) return false;
  const requestedDemo = new URLSearchParams(search).get('demo');
  return requestedDemo !== null && RIDESHARE_SIMULATOR_ALIASES.has(requestedDemo);
}
