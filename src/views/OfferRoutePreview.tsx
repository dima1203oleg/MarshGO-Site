import { useEffect, useState } from 'react';
import { OfferRouteMap } from '../map/OfferRouteMap';
import { productionApi, type ApiOffer } from '../services/productionApi';

/** Search results omit road geometry; fetch it from the offer detail endpoint when it is missing. */
export function OfferRoutePreview({ offer }: { offer: ApiOffer }) {
  const [geometry, setGeometry] = useState<ApiOffer['route_geometry']>(offer.route_geometry);
  useEffect(() => {
    if (offer.route_geometry !== undefined) { setGeometry(offer.route_geometry); return; }
    let active = true;
    setGeometry(undefined);
    productionApi.offer(offer.id).then((detail) => { if (active) setGeometry(detail.route_geometry ?? null); }).catch(() => { if (active) setGeometry(null); });
    return () => { active = false; };
  }, [offer.id, offer.route_geometry]);
  if (geometry === undefined) return null;
  return <OfferRouteMap origin={offer.origin_name.split(',')[0]} destination={offer.destination_name.split(',')[0]} geometry={geometry ?? undefined} />;
}
