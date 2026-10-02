import React from 'react';
import {
  Car,
  Clock,

  ShieldCheck,
  Users,
  ChevronRight,
  Sparkles,




  Star,
  Bookmark,
  Ban
} from 'lucide-react';
import { TransportOffer } from '../types';
import { calculateEstimatedTravelTime } from '../services/travelTime';
import { blockUser } from '../services/blacklist';
import { RouteCoverImage } from './RouteCoverImage';

interface OfferCardProps {
  offer: TransportOffer;
  passengerCount?: number;
  onSelect: (offerId: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (offerId: string) => void;
}

export const OfferCard: React.FC<OfferCardProps> = ({
  offer,
  passengerCount: _passengerCount = 1,
  onSelect,
  isFavorite = false,
  onToggleFavorite
}) => {
  const isCommunity = offer.category === 'community';
  const isPerCar = offer.priceUnit === 'per_car';
  const isPerDay = offer.priceUnit === 'per_day';

  // Category labels and theme
  const categoryMeta: Record<string, { label: string; badgeClass: string; icon: React.ReactNode }> = {
    community: {
      label: 'Попутка',
      badgeClass: 'bg-emerald-50 text-[#16845C] border-emerald-200',
      icon: <Car className="w-3.5 h-3.5" />
    },
    taxi_pro: {
      label: 'Таксі та PRO',
      badgeClass: 'bg-amber-50 text-[#AE6C00] border-amber-200',
      icon: <Car className="w-3.5 h-3.5" />
    },
    bus: {
      label: 'Автобус',
      badgeClass: 'bg-blue-50 text-[#1769F4] border-blue-200',
      icon: <Car className="w-3.5 h-3.5" />
    },
    transfer: {
      label: 'Трансфер PRO',
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
      icon: <Sparkles className="w-3.5 h-3.5" />
    },
    carsharing: {
      label: 'Каршеринг (DEMO)',
      badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
      icon: <Car className="w-3.5 h-3.5" />
    }
  };

  const meta = categoryMeta[offer.category] || categoryMeta.community;

  // Format departure time
  const departureDate = new Date(offer.departureTime);
  const timeFormatted = departureDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Calculate estimated travel time accurately based on distance and vehicle type
  const travelTime = calculateEstimatedTravelTime(
    offer.distanceKm,
    offer.category,
    offer.departureTime,
    offer.vehicle
  );

  return (
    <div
      onClick={() => onSelect(offer.id)}
      className="bg-white rounded-2xl border border-[#DFE7F1] p-4 sm:p-5 hover:border-[#1769F4] hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Vehicle / Carrier Photo Thumbnail or Procedural Route Cover */}
        <div className="relative w-full sm:w-44 h-36 sm:h-auto rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-100">
          {offer.vehicle?.primaryPhoto ? (
            <img
              src={offer.vehicle.primaryPhoto}
              alt={`${offer.vehicle.make} ${offer.vehicle.model}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              referrerPolicy="no-referrer"
            />
          ) : (
            <RouteCoverImage
              origin={offer.origin}
              destination={offer.destination}
              category={offer.category}
              departureTime={offer.departureTime}
              className="w-full h-full min-h-[140px] group-hover:scale-105 transition-transform duration-300"
            />
          )}

          {/* Category Overlay Tag */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-black/70 text-white backdrop-blur-md">
            {meta.icon}
            <span>{meta.label}</span>
          </div>

          {/* Estimated Travel Time Overlay */}
          <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-[#081B35]/85 text-white backdrop-blur-md shadow-xs border border-white/20">
            <Clock className="w-3 h-3 text-[#38BDF8]" />
            <span>~{travelTime.durationFormatted}</span>
          </div>

          {isCommunity && (
            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white">
              0% комісії
            </div>
          )}

          {onToggleFavorite && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(offer.id);
              }}
              className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md transition-all active:scale-90 z-10 ${
                isFavorite
                  ? 'bg-rose-500 text-white shadow-md'
                  : 'bg-black/50 hover:bg-black/70 text-white'
              }`}
              title={isFavorite ? 'Видалити з вибраного' : 'Додати маршрут до вибраного'}
              aria-label={isFavorite ? 'Видалити з вибраного' : 'Додати маршрут до вибраного'}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
            </button>
          )}
        </div>

        {/* Content Details */}
        <div className="flex-1 flex flex-col justify-between">
          <div>
            {/* Top Row: Category tag, Partner badge & Driver */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {!offer.vehicle?.primaryPhoto && (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold border ${meta.badgeClass}`}>
                    {meta.icon}
                    <span>{meta.label}</span>
                  </span>
                )}
                {offer.partnerName && (
                  <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {offer.partnerName}
                  </span>
                )}
                {!offer.isLiveIntegration && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                    DEMO
                  </span>
                )}
              </div>

              {/* Price & Favorite Block */}
              <div className="flex items-center gap-2.5">
                <div className="text-right">
                  <div className="flex items-baseline justify-end gap-1">
                    <span className="text-xl sm:text-2xl font-extrabold text-[#14243B] tabular-nums">
                      {offer.priceAmount}
                    </span>
                    <span className="text-sm font-semibold text-slate-600">грн</span>
                  </div>
                  <div className="text-[11px] text-[#62718A]">
                    {isPerCar ? 'за авто' : isPerDay ? 'за добу' : 'за 1 місце'}
                  </div>
                </div>

                {onToggleFavorite && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(offer.id);
                    }}
                    className={`p-2 rounded-xl border transition-all active:scale-90 ${
                      isFavorite
                        ? 'bg-rose-50 text-rose-600 border-rose-300 ring-2 ring-rose-100 shadow-xs'
                        : 'bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 border-slate-200'
                    }`}
                    title={isFavorite ? 'Видалити з вибраного' : 'Додати маршрут до вибраного'}
                    aria-label={isFavorite ? 'Видалити з вибраного' : 'Додати маршрут до вибраного'}
                  >
                    <Bookmark className={`w-4 h-4 ${isFavorite ? 'fill-rose-600 text-rose-600' : ''}`} />
                  </button>
                )}
              </div>
            </div>

            {/* Driver & Vehicle Summary */}
            <div className="flex items-center justify-between gap-2.5 my-2">
              <div className="flex items-center gap-2.5">
                <img
                  src={offer.driver.avatar}
                  alt={offer.driver.name}
                  className="w-7 h-7 rounded-full object-cover border border-slate-200"
                  referrerPolicy="no-referrer"
                />
                <div className="text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-[#14243B]">
                    <span>{offer.driver.name}</span>
                    {offer.driver.isVerified && (
                      <span title="Верифікований користувач">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#16845C]" />
                      </span>
                    )}
                    {offer.driver.rating > 0 ? (
                      <div className="inline-flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60 ml-1">
                        <div className="flex items-center">
                          {[1, 2, 3, 4, 5].map((starIndex) => (
                            <Star
                              key={starIndex}
                              className={`w-3 h-3 ${
                                starIndex <= Math.round(offer.driver.rating)
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-amber-700 font-extrabold text-[11px] tabular-nums">
                          {offer.driver.rating.toFixed(1)}
                        </span>
                        <span className="text-slate-500 text-[10px]">
                          ({offer.driver.reviewsCount || offer.driver.tripsCount})
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[10px] ml-1">Новий водій</span>
                    )}
                  </div>
                  {offer.vehicle && (
                    <span className="text-slate-500 text-[11px]">
                      {offer.vehicle.make} {offer.vehicle.model} ({offer.vehicle.year}) · {offer.vehicle.color}
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Blacklist button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (
                    window.confirm(
                      `Додати водія "${offer.driver.name}" до чорного списку? Його пропозиції більше не відображатимуться у ваших результатах пошуку.`
                    )
                  ) {
                    blockUser({
                      id: offer.driver.id,
                      name: offer.driver.name,
                      avatar: offer.driver.avatar,
                      role: 'driver',
                      reason: 'Додано з результатів пошуку'
                    });
                  }
                }}
                className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition active:scale-90"
                title="Додати водія до чорного списку"
                aria-label="Додати водія до чорного списку"
              >
                <Ban className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Route, Departure & ETA */}
            <div className="my-3 text-xs bg-[#F5F8FD] p-3 rounded-xl border border-slate-100 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                {/* Departure (Origin) */}
                <div className="flex items-start gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#1769F4] mt-1 shrink-0 ring-4 ring-blue-100" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-sm text-[#14243B] tabular-nums">{timeFormatted}</span>
                      <span className="font-bold text-[#14243B]">· {offer.origin}</span>
                    </div>
                    <div className="text-[11px] text-[#62718A] truncate max-w-[220px]">{offer.originAddress}</div>
                  </div>
                </div>

                {/* Arrival (Destination & ETA) */}
                <div className="flex items-start gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#16845C] mt-1 shrink-0 ring-4 ring-emerald-100" />
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-extrabold text-sm text-[#16845C] tabular-nums">
                        {travelTime.etaFormatted}
                      </span>
                      {travelTime.isNextDay && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1 rounded">
                          +1 день
                        </span>
                      )}
                      <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                        ETA
                      </span>
                      <span className="font-bold text-[#14243B]">· {offer.destination}</span>
                    </div>
                    <div className="text-[11px] text-[#62718A] truncate max-w-[220px]">{offer.destinationAddress}</div>
                  </div>
                </div>
              </div>

              {/* Transit Highway & Speed Metrics calculated from Distance & Vehicle Type */}
              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between flex-wrap gap-2 text-[11px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 bg-blue-50 text-[#1769F4] px-2.5 py-1 rounded-lg border border-blue-200/60 font-bold">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>Час в дорозі: <strong>{travelTime.durationFormatted}</strong></span>
                  </div>
                  <span className="text-[#62718A] font-medium">{offer.distanceKm} км</span>
                  {travelTime.highwayRestBufferMinutes > 0 && (
                    <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      +{travelTime.highwayRestBufferMinutes} хв зупинка
                    </span>
                  )}
                </div>

                <div
                  className="flex items-center gap-1.5 text-[10px] text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200"
                  title={`Розраховано на основі відстані ${offer.distanceKm} км для транспортного засобу: ${travelTime.vehicleTypeLabel}`}
                >
                  <Car className="w-3 h-3 text-[#1769F4]" />
                  <span>{travelTime.vehicleTypeLabel} (~{travelTime.averageSpeedKmH} км/год)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Footer: Amenities & CTA */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-[#62718A]">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 font-medium text-[#14243B]">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>Вільних місць: <strong className="text-[#1769F4]">{offer.availableSeats}</strong> з {offer.totalSeats}</span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 text-slate-500 font-medium">
                <Clock className="w-3.5 h-3.5 text-[#1769F4]" />
                <span>Орієнтовно {travelTime.durationFormatted}</span>
              </div>
            </div>

            <div className="flex items-center gap-1 text-[#1769F4] font-semibold group-hover:translate-x-1 transition-transform">
              <span>Деталі рейсу</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
