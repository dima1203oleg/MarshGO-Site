export type ProductionTab =
  | 'home' | 'search' | 'trips' | 'chat' | 'profile' | 'demand'
  | 'requests' | 'my-demands' | 'offer-new' | 'admin' | 'navigation';

export type ProductionRouteKind = 'tab' | 'offer' | 'booking' | 'demand' | 'journey' | 'conversation';
export type ProductionRoute = { tab: ProductionTab; kind: ProductionRouteKind; entityId: string | null };

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

function safeEntityId(segment: string | undefined): string | null {
  if (!segment) return null;
  try {
    const id = decodeURIComponent(segment);
    return /^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function productionRouteForPath(pathname: string): ProductionRoute | null {
  const path = normalizedPath(pathname);
  const staticTab = tabByPath.get(path);
  if (staticTab) return { tab: staticTab, kind: 'tab', entityId: null };
  if (path === '/search') return { tab: 'search', kind: 'tab', entityId: null };

  const segments = path.split('/').filter(Boolean);
  if (segments.length !== 2) return null;
  const id = safeEntityId(segments[1]);
  if (!id || id === 'new' || id === 'mine') return null;
  switch (segments[0]) {
    case 'offers': return { tab: 'search', kind: 'offer', entityId: id };
    case 'bookings':
    case 'trips': return { tab: 'trips', kind: 'booking', entityId: id };
    case 'demands': return { tab: 'my-demands', kind: 'demand', entityId: id };
    case 'journeys': return { tab: 'trips', kind: 'journey', entityId: id };
    case 'messages': return { tab: 'chat', kind: 'conversation', entityId: id };
    default: return null;
  }
}

export function productionTabForPath(pathname: string): ProductionTab | null {
  return productionRouteForPath(pathname)?.tab ?? null;
}

export function pathForProductionTab(tab: ProductionTab): string {
  return pathByTab[tab];
}

export function pathForProductionEntity(kind: Exclude<ProductionRouteKind, 'tab'>, id: string): string {
  const collection: Record<Exclude<ProductionRouteKind, 'tab'>, string> = {
    offer: 'offers', booking: 'bookings', demand: 'demands', journey: 'journeys', conversation: 'messages',
  };
  return `/${collection[kind]}/${encodeURIComponent(id)}`;
}
