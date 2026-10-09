import { useEffect, useState } from 'react';
import { formatDistance } from '../domain/transportCatalog';
import { activeTypesForSearch, choiceFor, effectiveProviders, transportTypes, type TransportSelection, type TransportTypeId } from '../domain/transportPreferences';
import { productionApi, type ApiNearby, type ApiTransportProviders } from '../services/productionApi';

const rentalType = { bike: 'bike', scooter: 'scooter', moped: 'moped', carsharing: 'carsharing' } as const;
type RentalType = keyof typeof rentalType;
const isRental = (type: TransportTypeId): type is RentalType => type in rentalType;
const transitTypes: TransportTypeId[] = ['bus', 'marshrutka', 'trolleybus', 'tram', 'metro', 'city_train', 'funicular', 'train', 'suburban_train', 'intercity_bus', 'ferry'];

/** Results for the selected non-carpool types, per provider. Only real data is shown: availability near the start point, or what is connected. */
export function OtherModesPanel({ selection, groups, origin }: { selection: TransportSelection; groups: ApiTransportProviders[] | null; origin: { latitude: number; longitude: number } | null }) {
  const [nearby, setNearby] = useState<Partial<Record<RentalType, ApiNearby>>>({});
  const active = activeTypesForSearch(selection).filter((type) => type !== 'carpool' && type !== 'walk');
  const rentals = active.filter(isRental);
  const rentalKey = rentals.join(',');

  useEffect(() => {
    if (!origin || rentals.length === 0) return;
    let live = true;
    for (const type of rentals) productionApi.nearbyRentals(type, origin.latitude, origin.longitude, 1500).then((result) => { if (live) setNearby((current) => ({ ...current, [type]: result })); }).catch(() => undefined);
    return () => { live = false; };
  }, [origin?.latitude, origin?.longitude, rentalKey]);

  if (active.length === 0) return null;
  return <section aria-label="Інші види транспорту" className="mt-5"><h2 className="mb-2 text-sm font-extrabold text-[#0E1F35]">Інші види транспорту</h2>
    <div className="space-y-2">{active.map((type) => {
      const label = transportTypes.find((item) => item.id === type)?.label ?? type;
      const providerIds = effectiveProviders(selection, type, groups);
      const providers = groups?.find((group) => group.transportType === type)?.providers.filter((provider) => providerIds.includes(provider.id)) ?? [];
      const data = isRental(type) ? nearby[type] : undefined;
      return <div key={type} className="rounded-2xl bg-white p-3 shadow-sm"><b className="text-sm text-[#0E1F35]">{label}</b>
        {providers.length === 0 ? <p className="mt-1 text-xs text-slate-500">{choiceFor(selection, type).all ? 'Провайдери недоступні у цьому районі.' : 'Вибрані провайдери недоступні у цьому районі.'}</p>
          : <ul className="mt-1 divide-y divide-slate-100">{providers.map((provider) => { const mine = data?.assets.filter((asset) => asset.providerName === provider.name) ?? [];
            return <li key={provider.id} className="flex items-center justify-between gap-2 py-2 text-xs"><span className="font-bold text-[#0E1F35]">{provider.name}</span>
              <span className="text-right text-slate-500">{transitTypes.includes(type) ? `розклад для пошуку підключено${provider.services.length ? ` (${provider.services.join(', ')})` : ''}; тариф може бути відсутній`
                : isRental(type) ? (!origin ? 'оберіть «Звідки» для наявності' : !data ? 'шукаємо…' : mine.length > 0 ? `${data.assets.filter((asset) => asset.providerName === provider.name).length}+ вільних, найближчий ${formatDistance(mine[0].distanceM)}` : 'поблизу немає вільних')
                : 'підключено'}</span></li>; })}</ul>}
      </div>; })}</div>
  </section>;
}
