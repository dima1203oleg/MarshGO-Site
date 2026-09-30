import React, { useState, useMemo } from 'react';
import {
  TrendingDown,
  TrendingUp,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Info,
  DollarSign,
  Tag
} from 'lucide-react';
import { TransportOffer } from '../types';

interface WeeklyPriceComparisonChartProps {
  origin: string;
  destination: string;
  selectedDate?: string;
  currentOffers: TransportOffer[];
  onSelectDay?: (dayName: string, dateStr: string) => void;
  className?: string;
}

export interface DayPriceInfo {
  dayIndex: number; // 0 = Mon, 6 = Sun
  dayShort: string;
  dayFull: string;
  dateStr: string;
  displayDate: string;
  price: number;
  busPrice: number;
  carpoolPrice: number;
  multiplier: number;
  statusTag: string;
  isCheapest: boolean;
  isPeak: boolean;
  diffPercent: number; // vs average
}

export const WeeklyPriceComparisonChart: React.FC<WeeklyPriceComparisonChartProps> = ({
  origin,
  destination,
  selectedDate = '',
  currentOffers,
  onSelectDay,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [activeDayIndex, setActiveDayIndex] = useState<number>(() => {
    const today = new Date().getDay(); // 0 is Sunday, 1 is Monday
    return today === 0 ? 6 : today - 1; // convert to 0 = Monday ... 6 = Sunday
  });

  // Calculate base price from existing offers or default distance
  const basePrice = useMemo(() => {
    if (currentOffers.length > 0) {
      const prices = currentOffers.map((o) => o.priceAmount).sort((a, b) => a - b);
      // Return median price
      const mid = Math.floor(prices.length / 2);
      return prices.length % 2 !== 0 ? prices[mid] : Math.round((prices[mid - 1] + prices[mid]) / 2);
    }
    return 450;
  }, [currentOffers]);

  // Generate 7 days of the week starting from upcoming Monday
  const weekData: DayPriceInfo[] = useMemo(() => {
    // Standard weekly seasonality index in Ukraine:
    // Mon: 0.98, Tue: 0.89, Wed: 0.85 (Cheapest), Thu: 0.96, Fri: 1.25 (Peak), Sat: 1.05, Sun: 1.22 (Peak return)
    const dayProfiles = [
      { short: 'Пн', full: 'Понеділок', multiplier: 0.96, tag: 'Звичайний потік' },
      { short: 'Вт', full: 'Вівторок', multiplier: 0.89, tag: 'Вигідно' },
      { short: 'Ср', full: 'Середа', multiplier: 0.84, tag: 'Найкраща ціна' },
      { short: 'Чт', full: 'Четвер', multiplier: 0.95, tag: 'Помірний попит' },
      { short: 'Пт', full: 'П’ятниця', multiplier: 1.24, tag: 'Пік виїзду' },
      { short: 'Сб', full: 'Субота', multiplier: 1.04, tag: 'Поїздки на вікенд' },
      { short: 'Нд', full: 'Неділя', multiplier: 1.22, tag: 'Пік повернення' }
    ];

    // Reference base date (calculate actual calendar days for this current week)
    const now = new Date();
    const currentDayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon
    const daysSinceMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
    const mondayDate = new Date(now);
    mondayDate.setDate(now.getDate() - daysSinceMonday);

    const calculatedDays: DayPriceInfo[] = dayProfiles.map((p, index) => {
      const dayDate = new Date(mondayDate);
      dayDate.setDate(mondayDate.getDate() + index);

      const dayPrice = Math.round((basePrice * p.multiplier) / 10) * 10;
      const busPrice = Math.round((dayPrice * 0.92) / 10) * 10;
      const carpoolPrice = Math.round((dayPrice * 0.88) / 10) * 10;

      const dateStr = dayDate.toISOString().split('T')[0];
      const displayDate = dayDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });

      return {
        dayIndex: index,
        dayShort: p.short,
        dayFull: p.full,
        dateStr,
        displayDate,
        price: dayPrice,
        busPrice,
        carpoolPrice,
        multiplier: p.multiplier,
        statusTag: p.tag,
        isCheapest: index === 2, // Wednesday
        isPeak: index === 4 || index === 6, // Friday or Sunday
        diffPercent: Math.round((p.multiplier - 1) * 100)
      };
    });

    return calculatedDays;
  }, [basePrice]);

  // Compute stats
  const minDay = weekData.reduce((prev, curr) => (curr.price < prev.price ? curr : prev), weekData[0]);
  const maxDay = weekData.reduce((prev, curr) => (curr.price > prev.price ? curr : prev), weekData[0]);
  const maxSavings = maxDay.price - minDay.price;
  const savingsPercent = Math.round((maxSavings / maxDay.price) * 100);

  // Height scale for bars (percentage of container height, min 35%, max 100%)
  const minVal = Math.min(...weekData.map((d) => d.price));
  const maxVal = Math.max(...weekData.map((d) => d.price));
  const range = maxVal - minVal || 1;

  const handleDayClick = (day: DayPriceInfo) => {
    setActiveDayIndex(day.dayIndex);
    if (onSelectDay) {
      onSelectDay(day.dayFull, day.dateStr);
    }
  };

  const selectedDayInfo = weekData[activeDayIndex] || weekData[0];

  return (
    <div
      className={`bg-white dark:bg-[#0D1E36] rounded-2xl border border-[#DFE7F1] dark:border-[#1D3455] p-4 sm:p-5 shadow-sm space-y-3.5 transition-all ${className}`}
    >
      {/* Header with Title and Savings Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-[#1769F4] dark:text-sky-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-sm sm:text-base text-[#14243B] dark:text-white">
              Графік цін за днями тижня
            </h3>
            <span className="text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              Економія до {savingsPercent}%
            </span>
          </div>
          <p className="text-xs text-[#62718A] dark:text-slate-400 mt-0.5">
            Динаміка вартості поїздки: <span className="font-semibold text-[#14243B] dark:text-slate-200">{origin} → {destination}</span>
          </p>
        </div>

        {/* Toggle Expand / Collapse */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="self-end sm:self-auto text-xs font-bold text-[#1769F4] dark:text-sky-400 hover:opacity-80 flex items-center gap-1 transition"
        >
          <span>{isExpanded ? 'Згорнути графік' : 'Показати динаміку'}</span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-4 animate-fadeIn">
          {/* Smart Recommendation Banner */}
          <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border border-emerald-200/80 dark:border-emerald-800/50 flex items-start gap-2.5 text-xs text-emerald-900 dark:text-emerald-200">
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-extrabold">Вигідна порада: </span>
              <span>
                Виїжджайте у <strong>{minDay.dayFull}</strong> (від {minDay.price} грн) замість{' '}
                <strong>{maxDay.dayFull}</strong> (до {maxDay.price} грн) та заощаджуйте{' '}
                <strong className="text-emerald-700 dark:text-emerald-300">до {maxSavings} грн</strong> на кожному квитку!
              </span>
            </div>
          </div>

          {/* Interactive Weekly Bar Chart */}
          <div className="bg-[#F5F8FD] dark:bg-[#122542] p-3 sm:p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
            {/* Bars Canvas */}
            <div className="h-44 sm:h-48 pt-6 pb-2 flex items-end justify-between gap-1.5 sm:gap-3">
              {weekData.map((day) => {
                const isSelected = day.dayIndex === activeDayIndex;
                // Bar height scale: 30% to 95%
                const normalizedHeight = 35 + ((day.price - minVal) / range) * 60;

                return (
                  <div
                    key={day.dayShort}
                    onClick={() => handleDayClick(day)}
                    className="flex-1 flex flex-col items-center h-full justify-end cursor-pointer group select-none"
                  >
                    {/* Price tooltip above bar */}
                    <div className="mb-1 text-center">
                      {day.isCheapest && (
                        <span className="hidden sm:inline-block text-[9px] font-black uppercase text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-1 py-0.2 rounded mb-0.5 whitespace-nowrap">
                          Хіт
                        </span>
                      )}
                      <div
                        className={`text-[11px] sm:text-xs font-black tabular-nums transition ${
                          isSelected
                            ? 'text-[#1769F4] dark:text-sky-400 scale-105'
                            : day.isCheapest
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-[#14243B] dark:text-slate-200'
                        }`}
                      >
                        {day.price} ₴
                      </div>
                    </div>

                    {/* Bar Pill */}
                    <div className="w-full max-w-[38px] sm:max-w-[48px] h-full flex items-end">
                      <div
                        style={{ height: `${normalizedHeight}%` }}
                        className={`w-full rounded-t-xl transition-all duration-300 relative flex flex-col justify-end ${
                          isSelected
                            ? 'bg-gradient-to-t from-[#1769F4] to-[#38BDF8] shadow-md ring-2 ring-[#1769F4]/40'
                            : day.isCheapest
                            ? 'bg-gradient-to-t from-emerald-500 to-teal-400 hover:opacity-90'
                            : day.isPeak
                            ? 'bg-gradient-to-t from-rose-500 to-amber-400 hover:opacity-90'
                            : 'bg-gradient-to-t from-slate-300 to-slate-400 dark:from-slate-700 dark:to-slate-600 hover:from-blue-300 hover:to-blue-400'
                        }`}
                      >
                        {/* Selected day pointer indicator */}
                        {isSelected && (
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white dark:bg-[#081B35] border-2 border-[#1769F4] shadow-xs" />
                        )}
                      </div>
                    </div>

                    {/* Day Label & Date under bar */}
                    <div className="mt-2 text-center">
                      <div
                        className={`text-xs font-bold transition ${
                          isSelected
                            ? 'text-[#1769F4] dark:text-sky-400 underline underline-offset-2'
                            : 'text-[#14243B] dark:text-slate-300'
                        }`}
                      >
                        {day.dayShort}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                        {day.displayDate}
                      </div>
                    </div>

                    {/* Difference badge */}
                    <div className="mt-1">
                      {day.diffPercent < 0 ? (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center">
                          {day.diffPercent}%
                        </span>
                      ) : day.diffPercent > 0 ? (
                        <span className="text-[10px] font-bold text-rose-500 flex items-center">
                          +{day.diffPercent}%
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400">0%</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend & Summary Info */}
            <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Найвигідніші дні</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span>Піковий попит</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#1769F4]" />
                  <span>Обраний день</span>
                </span>
              </div>

              <div className="text-[11px] text-[#1769F4] dark:text-sky-400 font-semibold">
                Клікніть на стовпчик для вибору дня
              </div>
            </div>
          </div>

          {/* Active Selected Day Micro-Breakdown */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A1A30] border border-slate-200/80 dark:border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-[#1769F4] dark:text-sky-300 flex items-center justify-center font-extrabold text-xs">
                {selectedDayInfo.dayShort}
              </div>
              <div>
                <div className="font-extrabold text-sm text-[#14243B] dark:text-white flex items-center gap-2">
                  <span>{selectedDayInfo.dayFull}, {selectedDayInfo.displayDate}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${
                    selectedDayInfo.isCheapest
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : selectedDayInfo.isPeak
                      ? 'bg-rose-100 text-rose-800 border-rose-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}>
                    {selectedDayInfo.statusTag}
                  </span>
                </div>
                <div className="text-[11px] text-[#62718A] dark:text-slate-400 mt-0.5">
                  Попутка від <strong>{selectedDayInfo.carpoolPrice} ₴</strong> · Автобус від <strong>{selectedDayInfo.busPrice} ₴</strong>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <div className="text-right">
                <div className="text-sm font-black text-[#14243B] dark:text-white">
                  від {selectedDayInfo.price} грн
                </div>
                <div className="text-[10px] text-slate-500">
                  {selectedDayInfo.diffPercent < 0
                    ? `на ${Math.abs(selectedDayInfo.diffPercent)}% дешевше за середнє`
                    : selectedDayInfo.diffPercent > 0
                    ? `на ${selectedDayInfo.diffPercent}% дорожче за середнє`
                    : 'середня ринкова ціна'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
