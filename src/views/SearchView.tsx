import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  SlidersHorizontal,
  Sparkles,
  Map,
  List,
  AlertCircle,
  PlusCircle,
  Check,
  Clock,
  DollarSign,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Bookmark,
  Bell,
  Star,
  Zap,
  Ban
} from 'lucide-react';
import { TransportOffer, TransportCategory } from '../types';
import { OfferCard } from '../components/OfferCard';
import { MapPreview } from '../components/MapPreview';
import { RouteSubscriptionModal, RouteSubscription } from '../components/RouteSubscriptionModal';
import { calculateEstimatedTravelTime } from '../services/travelTime';
import { WeeklyPriceComparisonChart } from '../components/WeeklyPriceComparisonChart';
import { BlacklistModal } from '../components/BlacklistModal';
import { isUserInBlacklist, subscribeToBlacklistChanges } from '../services/blacklist';

interface SearchViewProps {
  offers: TransportOffer[];
  searchParams: {
    origin: string;
    destination: string;
    date: string;
    passengers: number;
  };
  initialCategory?: TransportCategory;
  onSelectOffer: (offerId: string) => void;
  onCreateDemandFromSearch: (params: { origin: string; destination: string; date: string; passengers: number }) => void;
  onBack: () => void;
}

export const SearchView: React.FC<SearchViewProps> = ({
  offers,
  searchParams,
  initialCategory = 'all',
  onSelectOffer,
  onCreateDemandFromSearch,
  onBack
}) => {
  // Favorites State (stored in localStorage)
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('mg_favorites');
      if (saved) return JSON.parse(saved);
    } catch { /* Storage can be unavailable in private browsing. */ }
    return [];
  });
  const [showOnlyFavorites, setShowOnlyFavorites] = useState<boolean>(false);
  const [favoriteToast, setFavoriteToast] = useState<string | null>(null);

  // Route Subscriptions State (stored in localStorage)
  const [subscriptions, setSubscriptions] = useState<RouteSubscription[]>(() => {
    try {
      const saved = localStorage.getItem('mg_route_subscriptions');
      if (saved) return JSON.parse(saved);
    } catch { /* Storage can be unavailable in private browsing. */ }
    return [];
  });
  const [isSubscribeModalOpen, setIsSubscribeModalOpen] = useState<boolean>(false);

  // Blacklist state
  const [blacklistVersion, setBlacklistVersion] = useState(0);
  const [isBlacklistModalOpen, setIsBlacklistModalOpen] = useState(false);

  useEffect(() => {
    return subscribeToBlacklistChanges(() => {
      setBlacklistVersion((v) => v + 1);
    });
  }, []);

  const currentSubscription = useMemo(() => {
    return (
      subscriptions.find(
        (s) =>
          s.origin.trim().toLowerCase() === (searchParams.origin || '').trim().toLowerCase() &&
          s.destination.trim().toLowerCase() === (searchParams.destination || '').trim().toLowerCase() &&
          (!s.date || !searchParams.date || s.date === searchParams.date)
      ) || null
    );
  }, [subscriptions, searchParams]);

  const isSubscribed = !!currentSubscription;

  const handleSaveSubscription = (newSub: RouteSubscription) => {
    setSubscriptions((prev) => {
      const filtered = prev.filter((s) => s.id !== newSub.id);
      const updated = [newSub, ...filtered];
      try {
        localStorage.setItem('mg_route_subscriptions', JSON.stringify(updated));
      } catch { /* Keep the in-memory change when browser storage is unavailable. */ }
      return updated;
    });
    setFavoriteToast(`Підписку на маршрут ${searchParams.origin} → ${searchParams.destination} активовано! 🔔`);
    setTimeout(() => setFavoriteToast(null), 3500);
  };

  const handleDeleteSubscription = (id: string) => {
    setSubscriptions((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      try {
        localStorage.setItem('mg_route_subscriptions', JSON.stringify(updated));
      } catch { /* Keep the in-memory change when browser storage is unavailable. */ }
      return updated;
    });
    setFavoriteToast('Підписку на оновлення скасовано');
    setTimeout(() => setFavoriteToast(null), 2500);
  };

  const handleToggleFavorite = (offerId: string) => {
    setFavoriteIds((prev) => {
      const isFav = prev.includes(offerId);
      const updated = isFav ? prev.filter((id) => id !== offerId) : [...prev, offerId];
      try {
        localStorage.setItem('mg_favorites', JSON.stringify(updated));
      } catch { /* Keep the in-memory change when browser storage is unavailable. */ }
      setFavoriteToast(isFav ? 'Маршрут видалено з вибраного' : 'Маршрут додано до вибраного ⭐');
      setTimeout(() => setFavoriteToast(null), 2500);
      return updated;
    });
  };

  // Transport Types Filter (multi-select)
  const [selectedTypes, setSelectedTypes] = useState<string[]>(initialCategory === 'all'
    ? ['community', 'taxi_pro', 'bus', 'transfer', 'carsharing']
    : [initialCategory]);

  // Departure Time Filter: 'all' | 'morning' (06:00-12:00) | 'day' (12:00-18:00) | 'evening' (18:00-24:00)
  const [timeFilter, setTimeFilter] = useState<'all' | 'morning' | 'day' | 'evening'>('all');

  // Max Price Filter (in UAH)
  const [maxPrice, setMaxPrice] = useState<number>(2000);

  // Sorting
  const [sortBy, setSortBy] = useState<'optimal' | 'cheapest' | 'fastest' | 'reliable'>('optimal');
  const [showMobileMap, setShowMobileMap] = useState<boolean>(false);
  const [showFilterDrawer, setShowFilterDrawer] = useState<boolean>(false);

  // Toggle single transport type in multi-select
  const handleToggleType = (typeId: string) => {
    setSelectedTypes((prev) => {
      if (prev.includes(typeId)) {
        // Prevent deselecting all
        if (prev.length === 1) return prev;
        return prev.filter((t) => t !== typeId);
      } else {
        return [...prev, typeId];
      }
    });
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedTypes(['community', 'taxi_pro', 'bus', 'transfer', 'carsharing']);
    setTimeFilter('all');
    setMaxPrice(2000);
    setSortBy('optimal');
  };

  // Count active non-default filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedTypes.length < 5) count += 1;
    if (timeFilter !== 'all') count += 1;
    if (maxPrice < 2000) count += 1;
    return count;
  }, [selectedTypes, timeFilter, maxPrice]);

  // Filter offers based on blacklist, route, transport types, price, and departure time
  const { filteredOffers, hiddenBlacklistedCount } = useMemo(() => {
    let blacklistedCount = 0;
    const list = offers.filter((o) => {
      // 0. Filter out drivers in Blacklist
      if (isUserInBlacklist(o.driver.id, o.driver.name)) {
        blacklistedCount++;
        return false;
      }

      // 1. Transport type match
      if (!selectedTypes.includes(o.category)) {
        return false;
      }

      // 2. Price filter
      if (o.priceAmount > maxPrice) {
        return false;
      }

      // 3. Departure time filter
      if (timeFilter !== 'all') {
        const depDate = new Date(o.departureTime);
        const hours = depDate.getHours();
        if (timeFilter === 'morning' && (hours < 6 || hours >= 12)) return false;
        if (timeFilter === 'day' && (hours < 12 || hours >= 18)) return false;
        if (timeFilter === 'evening' && (hours < 18 || hours >= 24)) return false;
      }

      // 4. Route matching (lenient case-insensitive)
      const matchesOrigin =
        !searchParams.origin ||
        o.origin.toLowerCase().includes(searchParams.origin.toLowerCase()) ||
        searchParams.origin.toLowerCase().includes(o.origin.toLowerCase());
      const matchesDest =
        !searchParams.destination ||
        o.destination.toLowerCase().includes(searchParams.destination.toLowerCase()) ||
        searchParams.destination.toLowerCase().includes(o.destination.toLowerCase());

      return matchesOrigin && matchesDest;
    });

    return { filteredOffers: list, hiddenBlacklistedCount: blacklistedCount };
  }, [offers, selectedTypes, maxPrice, timeFilter, searchParams, blacklistVersion]);

  // Sort filtered offers
  const sortedOffers = useMemo(() => {
    return [...filteredOffers].sort((a, b) => {
      if (sortBy === 'cheapest') return a.priceAmount - b.priceAmount;
      if (sortBy === 'fastest') {
        const timeA = calculateEstimatedTravelTime(a.distanceKm, a.category, a.departureTime, a.vehicle).durationMinutes;
        const timeB = calculateEstimatedTravelTime(b.distanceKm, b.category, b.departureTime, b.vehicle).durationMinutes;
        return timeA - timeB;
      }
      if (sortBy === 'reliable') return b.driver.rating - a.driver.rating;
      return 0; // optimal default
    });
  }, [filteredOffers, sortBy]);

  // Filter by favorites if toggled
  const displayedOffers = useMemo(() => {
    if (showOnlyFavorites) {
      return sortedOffers.filter((o) => favoriteIds.includes(o.id));
    }
    return sortedOffers;
  }, [sortedOffers, showOnlyFavorites, favoriteIds]);

  const transportTypeOptions = [
    { id: 'community', label: 'Попутка (0%)', badge: '0% комісії' },
    { id: 'taxi_pro', label: 'Таксі та PRO', badge: 'Комфорт' },
    { id: 'bus', label: 'Автобус', badge: 'Прямий рейс' },
    { id: 'transfer', label: 'Трансфер', badge: 'VIP' },
    { id: 'carsharing', label: 'Каршеринг', badge: 'DEMO' }
  ];

  return (
    <div className="min-h-screen bg-[#F5F8FD] pb-24 md:pb-12">
      {/* Top Search Filter Header */}
      <div className="sticky top-16 z-30 bg-white border-b border-[#DFE7F1] shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Route summary & back */}
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 rounded-xl text-slate-600 hover:text-[#14243B] hover:bg-slate-100 transition"
                aria-label="Назад до пошуку"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div>
                <h1 className="text-base sm:text-lg font-bold text-[#14243B] flex items-center gap-2">
                  <span>{searchParams.origin || 'Звідки'}</span>
                  <span className="text-slate-400">→</span>
                  <span className="text-[#1769F4]">{searchParams.destination || 'Куди'}</span>
                </h1>
                <div className="text-xs text-[#62718A] flex items-center gap-3 mt-0.5">
                  <span>{searchParams.date || 'Сьогодні'}</span>
                  <span>·</span>
                  <span>{searchParams.passengers} {searchParams.passengers === 1 ? 'пасажир' : 'пасажири'}</span>
                </div>
              </div>
            </div>

            {/* Actions: Filters toggle, Favorites, Subscribe, Sort & Mobile Map */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Favorites filter toggle button */}
              <button
                type="button"
                onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition flex items-center gap-1.5 active:scale-95 ${
                  showOnlyFavorites
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs ring-2 ring-rose-200'
                    : favoriteIds.length > 0
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                    : 'bg-[#F5F8FD] text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
                title={showOnlyFavorites ? 'Показати всі результати' : 'Показати збережені у вибраному маршрути'}
              >
                <Bookmark className={`w-3.5 h-3.5 ${showOnlyFavorites || favoriteIds.length > 0 ? 'fill-current' : ''}`} />
                <span>Вибране</span>
                {favoriteIds.length > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    showOnlyFavorites ? 'bg-white text-rose-600' : 'bg-rose-200 text-rose-800'
                  }`}>
                    {favoriteIds.length}
                  </span>
                )}
              </button>

              {/* Subscribe to route updates button */}
              <button
                type="button"
                onClick={() => setIsSubscribeModalOpen(true)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition flex items-center gap-1.5 active:scale-95 ${
                  isSubscribed
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-200'
                    : 'bg-[#F5F8FD] hover:bg-blue-50 text-slate-700 hover:text-[#1769F4] border-slate-200'
                }`}
                title={isSubscribed ? 'Ви підписані на оновлення цього маршруту' : 'Підписатися на оновлення за цим маршрутом'}
              >
                <Bell className={`w-3.5 h-3.5 ${isSubscribed ? 'fill-current' : ''}`} />
                <span>{isSubscribed ? 'Підписка активна' : 'Підписатися на оновлення'}</span>
              </button>

              {/* Filter drawer toggle button */}
              <button
                onClick={() => setShowFilterDrawer(!showFilterDrawer)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition flex items-center gap-1.5 ${
                  activeFiltersCount > 0 || showFilterDrawer
                    ? 'bg-[#1769F4] text-white border-[#1769F4] shadow-xs'
                    : 'bg-[#F5F8FD] text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Фільтри</span>
                {activeFiltersCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-white text-[#1769F4] text-[10px] font-black flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
                {showFilterDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {/* Mobile map toggle button */}
              <button
                onClick={() => setShowMobileMap(!showMobileMap)}
                className="lg:hidden px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
              >
                {showMobileMap ? <List className="w-4 h-4" /> : <Map className="w-4 h-4 text-[#1769F4]" />}
                <span>{showMobileMap ? 'Список' : 'Карта'}</span>
              </button>

              {/* Quick Sorting chips in header (desktop) */}
              <div className="hidden xl:flex items-center gap-1 bg-[#F5F8FD] dark:bg-[#122542] border border-slate-200 dark:border-slate-700 rounded-xl p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setSortBy('cheapest')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                    sortBy === 'cheapest'
                      ? 'bg-[#1769F4] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  <DollarSign className="w-3 h-3" />
                  <span>Найдешевші</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('fastest')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                    sortBy === 'fastest'
                      ? 'bg-[#1769F4] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span>Найшвидші</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('reliable')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                    sortBy === 'reliable'
                      ? 'bg-[#1769F4] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span>Найвищий рейтинг</span>
                </button>
              </div>
            </div>
          </div>

          {/* Transport Type Quick Toggle Chips */}
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <span className="text-[11px] font-bold text-slate-500 shrink-0 mr-1">Транспорт:</span>
            {transportTypeOptions.map((type) => {
              const isChecked = selectedTypes.includes(type.id);
              return (
                <button
                  key={type.id}
                  onClick={() => handleToggleType(type.id)}
                  className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 shrink-0 ${
                    isChecked
                      ? 'bg-[#1769F4] text-white shadow-xs'
                      : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                  <span>{type.label}</span>
                </button>
              );
            })}
          </div>

          {/* Expandable Advanced Filter Panel (Departure Time & Price) */}
          {showFilterDrawer && (
            <div className="mt-3 pt-3 border-t border-slate-200 animate-slideDown space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#F5F8FD] p-4 rounded-xl border border-slate-200">
                {/* 1. Departure Time Filter */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#14243B]">
                    <Clock className="w-4 h-4 text-[#1769F4]" />
                    <span>Час відправлення:</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                    <button
                      onClick={() => setTimeFilter('all')}
                      className={`p-2 rounded-lg font-semibold transition text-center ${
                        timeFilter === 'all'
                          ? 'bg-[#1769F4] text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Будь-який
                    </button>
                    <button
                      onClick={() => setTimeFilter('morning')}
                      className={`p-2 rounded-lg font-semibold transition text-center ${
                        timeFilter === 'morning'
                          ? 'bg-[#1769F4] text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      06:00 – 12:00
                    </button>
                    <button
                      onClick={() => setTimeFilter('day')}
                      className={`p-2 rounded-lg font-semibold transition text-center ${
                        timeFilter === 'day'
                          ? 'bg-[#1769F4] text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      12:00 – 18:00
                    </button>
                    <button
                      onClick={() => setTimeFilter('evening')}
                      className={`p-2 rounded-lg font-semibold transition text-center ${
                        timeFilter === 'evening'
                          ? 'bg-[#1769F4] text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      18:00 – 24:00
                    </button>
                  </div>
                </div>

                {/* 2. Price Filter */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-[#14243B]">
                      <DollarSign className="w-4 h-4 text-[#16845C]" />
                      <span>Максимальна ціна:</span>
                    </div>
                    <span className="font-extrabold text-sm text-[#16845C] tabular-nums">
                      до {maxPrice} грн
                    </span>
                  </div>

                  <input
                    type="range"
                    min="300"
                    max="2000"
                    step="50"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1769F4]"
                  />

                  {/* Price presets */}
                  <div className="flex items-center justify-between gap-1 text-[11px] text-slate-600">
                    <button
                      type="button"
                      onClick={() => setMaxPrice(550)}
                      className={`px-2 py-0.5 rounded border ${maxPrice === 550 ? 'bg-[#1769F4] text-white' : 'bg-white border-slate-200'}`}
                    >
                      до 550 грн
                    </button>
                    <button
                      type="button"
                      onClick={() => setMaxPrice(900)}
                      className={`px-2 py-0.5 rounded border ${maxPrice === 900 ? 'bg-[#1769F4] text-white' : 'bg-white border-slate-200'}`}
                    >
                      до 900 грн
                    </button>
                    <button
                      type="button"
                      onClick={() => setMaxPrice(1400)}
                      className={`px-2 py-0.5 rounded border ${maxPrice === 1400 ? 'bg-[#1769F4] text-white' : 'bg-white border-slate-200'}`}
                    >
                      до 1400 грн
                    </button>
                    <button
                      type="button"
                      onClick={() => setMaxPrice(2000)}
                      className={`px-2 py-0.5 rounded border ${maxPrice === 2000 ? 'bg-[#1769F4] text-white' : 'bg-white border-slate-200'}`}
                    >
                      Всі ціни
                    </button>
                  </div>
                </div>
              </div>

              {/* Reset button inside panel */}
              {activeFiltersCount > 0 && (
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-500">Застосовано фільтрів: {activeFiltersCount}</span>
                  <button
                    onClick={handleResetFilters}
                    className="flex items-center gap-1 font-bold text-red-600 hover:text-red-700 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Скинути всі фільтри</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Two-Column Container (Results List + Map) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Offers List (or hidden if mobile map toggled) */}
          <div className={`lg:col-span-7 space-y-4 ${showMobileMap ? 'hidden lg:block' : 'block'}`}>
            <div className="flex items-center justify-between text-xs text-[#62718A]">
              <div className="flex items-center gap-2">
                <span>
                  Знайдено варіантів:{' '}
                  <strong className="text-[#14243B]">{displayedOffers.length}</strong>
                  {showOnlyFavorites && <span className="text-slate-400"> (з {sortedOffers.length})</span>}
                </span>
                {showOnlyFavorites && (
                  <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-bold text-[11px] border border-rose-200">
                    Тільки вибрані
                  </span>
                )}
                {activeFiltersCount > 0 && (
                  <button
                    onClick={handleResetFilters}
                    className="text-[#1769F4] font-semibold hover:underline flex items-center gap-1"
                  >
                    <span>Скинути фільтри ({activeFiltersCount})</span>
                  </button>
                )}
              </div>
              <span>Ціни включають усі збори</span>
            </div>

            {/* Weekly Price Comparison Chart */}
            <WeeklyPriceComparisonChart
              origin={searchParams.origin || 'Початок маршруту'}
              destination={searchParams.destination || 'Кінець маршруту'}
              selectedDate={searchParams.date}
              currentOffers={offers}
              onSelectDay={(dayName, dateStr) => {
                setFavoriteToast(`Обрано день: ${dayName} (${dateStr}). Відображено тарифи.`);
                setTimeout(() => setFavoriteToast(null), 3000);
              }}
            />

            {/* Route Subscription Alert Banner */}
            <div
              className={`rounded-2xl p-4 border transition-all flex flex-col sm:flex-row items-center justify-between gap-3 ${
                isSubscribed
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                  : 'bg-white border-[#DFE7F1] shadow-xs text-[#14243B]'
              }`}
            >
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div
                  className={`p-2.5 rounded-xl shrink-0 ${
                    isSubscribed ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-[#1769F4]'
                  }`}
                >
                  <Bell className={`w-5 h-5 ${isSubscribed ? 'fill-emerald-600' : ''}`} />
                </div>
                <div>
                  <div className="font-extrabold text-xs sm:text-sm flex items-center gap-2 flex-wrap">
                    <span>
                      {isSubscribed
                        ? 'Ви підписані на оновлення цього маршруту'
                        : 'Сповіщення про нові рейси за цим маршрутом'}
                    </span>
                    {isSubscribed && (
                      <span className="text-[10px] font-bold bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full">
                        Активно
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#62718A] mt-0.5">
                    {isSubscribed
                      ? `Ми повідомимо вас через ${currentSubscription.channels.join(', ')} щойно з'явиться новий рейс на ${searchParams.date || 'сьогодні'}`
                      : `Не знайшли ідеальний варіант? Підпишіться на оновлення та дізнавайтеся першими про нові пропозиції водіїв.`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSubscribeModalOpen(true)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-2 w-full sm:w-auto justify-center ${
                  isSubscribed
                    ? 'bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-[#1769F4] hover:bg-[#1358CE] text-white shadow-sm shadow-[#1769F4]/20'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                <span>{isSubscribed ? 'Налаштувати підписку' : 'Підписатися на оновлення'}</span>
              </button>
            </div>

            {/* Quick Sorting Chips Bar directly above results */}
            <div className="flex items-center justify-between gap-2 flex-wrap bg-white dark:bg-[#0D1E36] p-2.5 sm:p-3 rounded-2xl border border-[#DFE7F1] dark:border-[#1D3455] shadow-xs">
              <div className="flex items-center gap-1.5 text-xs text-[#14243B] dark:text-white font-extrabold shrink-0">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#1769F4]" />
                <span>Сортування:</span>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
                <button
                  type="button"
                  onClick={() => setSortBy('cheapest')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 active:scale-95 ${
                    sortBy === 'cheapest'
                      ? 'bg-[#1769F4] text-white shadow-xs ring-2 ring-blue-200 dark:ring-blue-900'
                      : 'bg-[#F5F8FD] dark:bg-[#122542] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200/70'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Найдешевші</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSortBy('fastest')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 active:scale-95 ${
                    sortBy === 'fastest'
                      ? 'bg-[#1769F4] text-white shadow-xs ring-2 ring-blue-200 dark:ring-blue-900'
                      : 'bg-[#F5F8FD] dark:bg-[#122542] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200/70'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>Найшвидші</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSortBy('reliable')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 active:scale-95 ${
                    sortBy === 'reliable'
                      ? 'bg-[#1769F4] text-white shadow-xs ring-2 ring-blue-200 dark:ring-blue-900'
                      : 'bg-[#F5F8FD] dark:bg-[#122542] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200/70'
                  }`}
                >
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>Найвищий рейтинг</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSortBy('optimal')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 active:scale-95 ${
                    sortBy === 'optimal'
                      ? 'bg-[#1769F4] text-white shadow-xs ring-2 ring-blue-200 dark:ring-blue-900'
                      : 'bg-[#F5F8FD] dark:bg-[#122542] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200/70'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Оптимально</span>
                </button>
              </div>
            </div>

            {/* Hidden Blacklisted Drivers Notice */}
            {hiddenBlacklistedCount > 0 && (
              <div className="p-3 rounded-2xl bg-red-50/90 dark:bg-red-950/40 border border-red-200/90 dark:border-red-900/60 flex items-center justify-between text-xs text-red-900 dark:text-red-200 gap-2 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/70 text-red-600 dark:text-red-300 flex items-center justify-center shrink-0">
                    <Ban className="w-3.5 h-3.5" />
                  </div>
                  <span>
                    Приховано <strong>{hiddenBlacklistedCount} {hiddenBlacklistedCount === 1 ? 'пропозицію' : 'пропозиції'}</strong> від водіїв із вашого Чорного списку
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBlacklistModalOpen(true)}
                  className="font-extrabold text-red-700 dark:text-red-300 hover:underline shrink-0 text-xs px-2.5 py-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition border border-red-200/60 dark:border-red-800"
                >
                  Керувати списком
                </button>
              </div>
            )}

            {displayedOffers.length > 0 ? (
              displayedOffers.map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  passengerCount={searchParams.passengers}
                  onSelect={onSelectOffer}
                  isFavorite={favoriteIds.includes(offer.id)}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))
            ) : showOnlyFavorites ? (
              /* EMPTY FAVORITES STATE */
              <div className="bg-white rounded-2xl border border-dashed border-rose-200 p-8 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
                  <Bookmark className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#14243B]">
                    У вас поки немає збережених маршрутів
                  </h3>
                  <p className="text-xs text-[#62718A] max-w-md mx-auto mt-1">
                    Натисніть на значок закладки біля вартості або фото будь-якої поїздки, щоб зберегти її у вибране для швидкого доступу та порівняння.
                  </p>
                </div>

                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowOnlyFavorites(false)}
                    className="px-5 py-2.5 rounded-xl bg-[#1769F4] hover:bg-[#1358CE] text-white text-xs font-bold shadow-md shadow-[#1769F4]/20 transition"
                  >
                    Показати всі {sortedOffers.length} варіантів
                  </button>
                </div>
              </div>
            ) : (
              /* EMPTY RESULTS STATE (FLOW B) */
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#14243B]">
                    Не знайдено рейсів за заданими фільтрами
                  </h3>
                  <p className="text-xs text-[#62718A] max-w-md mx-auto mt-1">
                    Спробуйте розширити діапазон цін, змінити час відправлення або скинути фільтри. Також ви можете створити власний запит та запропонувати свій бюджет.
                  </p>
                </div>

                <div className="flex items-center justify-center gap-3 flex-wrap">
                  {activeFiltersCount > 0 && (
                    <button
                      onClick={handleResetFilters}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Скинути фільтри
                    </button>
                  )}

                  <button
                    onClick={() => onCreateDemandFromSearch(searchParams)}
                    className="px-6 py-2.5 rounded-xl bg-[#1769F4] hover:bg-[#1358CE] text-white text-xs font-bold shadow-md shadow-[#1769F4]/20 transition inline-flex items-center gap-2"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Опублікувати запит з моїм бюджетом</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSubscribeModalOpen(true)}
                    className="px-5 py-2.5 rounded-xl border border-blue-200 bg-blue-50 text-[#1769F4] text-xs font-bold hover:bg-blue-100 transition inline-flex items-center gap-2"
                  >
                    <Bell className="w-4 h-4" />
                    <span>Підписатися на оновлення</span>
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Rescue / Custom Request Banner */}
            {sortedOffers.length > 0 && (
              <div className="bg-[#EFF6FF] rounded-2xl border border-blue-200 p-4 flex items-center justify-between gap-3">
                <div className="text-xs">
                  <div className="font-bold text-[#14243B]">Не підходить час або вартість?</div>
                  <div className="text-[#62718A]">Опублікуйте свій запит — водії зроблять зустрічні пропозиції.</div>
                </div>
                <button
                  onClick={() => onCreateDemandFromSearch(searchParams)}
                  className="px-3.5 py-2 rounded-xl bg-[#1769F4] text-white font-bold text-xs hover:bg-[#1358CE] transition shrink-0"
                >
                  Створити запит
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Road Corridor Map (Sticky on Desktop) */}
          <div className={`lg:col-span-5 lg:sticky lg:top-40 ${showMobileMap ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-white rounded-2xl border border-[#DFE7F1] p-3 shadow-sm space-y-3">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="font-bold text-[#14243B]">Карта маршруту</span>
                <span className="text-slate-600 font-semibold text-[11px] bg-slate-100 px-2 py-0.5 rounded">
                  Огляд маршруту
                </span>
              </div>

              <MapPreview
                origin={searchParams.origin || 'Одеса'}
                destination={searchParams.destination || 'Київ'}
                className="h-80 lg:h-[480px]"
              />

              <div className="text-[11px] text-[#62718A] px-1 leading-relaxed">
                Точки посадки та висадки узгоджуються безпосередньо з водієм. Карта з’явиться, коли результат міститиме геометрію маршруту.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Favorite Toast Notification */}
      {favoriteToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#081B35] text-white px-5 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-bold border border-white/20 animate-fadeIn">
          <Bookmark className="w-4 h-4 text-rose-400 fill-current" />
          <span>{favoriteToast}</span>
        </div>
      )}

      {/* Route Subscription Modal */}
      <RouteSubscriptionModal
        isOpen={isSubscribeModalOpen}
        onClose={() => setIsSubscribeModalOpen(false)}
        searchParams={searchParams}
        existingSubscription={currentSubscription}
        onSaveSubscription={handleSaveSubscription}
        onDeleteSubscription={handleDeleteSubscription}
      />

      {/* Blacklist Modal */}
      <BlacklistModal
        isOpen={isBlacklistModalOpen}
        onClose={() => setIsBlacklistModalOpen(false)}
      />
    </div>
  );
};
