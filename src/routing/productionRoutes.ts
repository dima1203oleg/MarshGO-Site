export type ProductionTab =
  | 'home' | 'search' | 'trips' | 'chat' | 'profile' | 'demand'
  | 'requests' | 'my-demands' | 'offer-new' | 'admin' | 'navigation';

const pathByTab: Record<ProductionTab, string> = {
  home: '/',
  search: '/journeys/search',
  trips: '/trips',
  chat: '/messages',
  profile: '/profile',
  demand: '/demands/new',
  requests: '/demands',
  'my-demands': '/demands/mine',
  'offer-new': '/offers/new',
  admin: '/admin/verification',
  navigation: '/navigate',
};

const tabByPath = new Map(Object.entries(pathByTab).map(([tab, path]) => [path, tab as ProductionTab]));

function normalizedPath(pathname: string): string {
  if (pathname === '/') return '/';
  return `/${pathname.split('/').filter(Boolean).join('/')}`;
}

export function productionTabForPath(pathname: string): ProductionTab | null {
  return tabByPath.get(normalizedPath(pathname)) ?? null;
}

export function pathForProductionTab(tab: ProductionTab): string {
  return pathByTab[tab];
}
