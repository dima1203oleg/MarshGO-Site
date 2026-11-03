import type { StyleSpecification } from 'maplibre-gl';

type MutableLayer = {
  id: string;
  type: string;
  'source-layer'?: string;
  paint?: Record<string, unknown>;
};

const DARK = {
  background: '#0B1119',
  water: '#0A1B2B',
  waterway: '#102A40',
  park: '#0E2119',
  land: '#0C1520',
  building: '#151F2D',
  roadMajor: '#26384E',
  roadMid: '#1D2B3C',
  roadMinor: '#16222F',
  casing: '#080E16',
  rail: '#2B3B50',
  boundary: '#223248',
  label: '#C9D6E6',
  halo: '#070D15',
  icon: '#A9BCD0',
};

const isCasing = (id: string) => /casing|outline|halo/i.test(id);
const isMajorRoad = (id: string) => /motorway|trunk|primary/i.test(id);
const isMidRoad = (id: string) => /secondary|tertiary|bridge/i.test(id);
const isRoad = (id: string) => /road|street|highway|transportation|tunnel|service|path|track|pedestrian|rail/i.test(id);
const isRail = (id: string) => /rail|transit|subway|light_rail/i.test(id);
const isWater = (id: string, sourceLayer: string) => /water|ocean|sea|lake|river|bay/i.test(`${id} ${sourceLayer}`);
const isPark = (id: string, sourceLayer: string) => /park|wood|forest|grass|garden|playground|pitch|cemetery|nature|landcover|landuse/i.test(`${id} ${sourceLayer}`);

/**
 * Recolour the configured light vector style into the MARSHGO graphite-blue
 * night basemap. The deployment only ships a light style URL, and a canvas CSS
 * filter would also invert route and label colours, so the dark palette is
 * applied layer by layer while the provider's geometry, sprites and labels stay
 * exactly as published.
 */
export function darkenMapStyle(style: StyleSpecification): StyleSpecification {
  return {
    ...style,
    layers: style.layers.map(layer => {
      const mutable = layer as unknown as MutableLayer;
      const id = mutable.id.toLowerCase();
      const sourceLayer = (mutable['source-layer'] ?? '').toLowerCase();
      const paint: Record<string, unknown> = { ...(mutable.paint ?? {}) };

      // Route, zone and vehicle overlays are painted by the app itself, so a
      // basemap recolour must not steal their mode colours.
      if (id.startsWith('marshgo-')) return mutable as unknown as StyleSpecification['layers'][number];

      if (mutable.type === 'background') {
        paint['background-color'] = DARK.background;
      } else if (mutable.type === 'fill') {
        if (/building/i.test(`${id} ${sourceLayer}`)) {
          paint['fill-color'] = DARK.building;
          paint['fill-opacity'] = 0.85;
        } else if (isWater(id, sourceLayer)) {
          paint['fill-color'] = DARK.water;
        } else if (isPark(id, sourceLayer)) {
          paint['fill-color'] = DARK.park;
        } else {
          paint['fill-color'] = DARK.land;
        }
      } else if (mutable.type === 'line') {
        if (isCasing(id)) paint['line-color'] = DARK.casing;
        else if (isWater(id, sourceLayer)) paint['line-color'] = DARK.waterway;
        else if (isRail(id)) paint['line-color'] = DARK.rail;
        else if (isRoad(id)) {
          paint['line-color'] = isMajorRoad(id) ? DARK.roadMajor : isMidRoad(id) ? DARK.roadMid : DARK.roadMinor;
        } else if (/boundary|admin/i.test(id)) paint['line-color'] = DARK.boundary;
        else paint['line-color'] = DARK.roadMinor;
      } else if (mutable.type === 'symbol') {
        paint['text-color'] = DARK.label;
        paint['text-halo-color'] = DARK.halo;
        if ('icon-color' in paint) paint['icon-color'] = DARK.icon;
      } else if (mutable.type === 'raster') {
        paint['raster-opacity'] = 0.14;
        paint['raster-brightness-min'] = 0;
        paint['raster-brightness-max'] = 0.32;
        paint['raster-saturation'] = -0.7;
      }

      return { ...mutable, paint } as unknown as StyleSpecification['layers'][number];
    }),
  };
}
