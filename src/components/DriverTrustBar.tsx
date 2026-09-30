import React, { useState } from 'react';
import {
  ShieldCheck,
  Star,
  Award,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Sparkles,
  Info,
  TrendingUp
} from 'lucide-react';

interface DriverTrustBarProps {
  rating: number; // 0.0 to 5.0
  tripsCount?: number;
  punctualityPercent?: number;
  verifiedDocuments?: boolean;
  className?: string;
  compact?: boolean;
}

export const DriverTrustBar: React.FC<DriverTrustBarProps> = ({
  rating,
  tripsCount = 84,
  punctualityPercent = 98,
  verifiedDocuments = true,
  className = '',
  compact = false
}) => {
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Normalize rating between 0 and 5
  const clampedRating = Math.min(5.0, Math.max(0, rating));
  // Percentage for progress bar (0% - 100%)
  const percentage = Math.min(100, Math.max(0, Math.round((clampedRating / 5.0) * 100)));

  // Determine trust tier based on rating
  const getTier = () => {
    if (clampedRating >= 4.85) {
      return {
        label: 'Еталонний рівень довіри',
        badge: 'Platinum PRO',
        color: 'from-emerald-500 via-teal-400 to-cyan-400',
        textColor: 'text-emerald-400',
        badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        description: 'Бездоганна репутація серед сотень пасажирів'
      };
    }
    if (clampedRating >= 4.6) {
      return {
        label: 'Високий рівень довіри',
        badge: 'Gold Verified',
        color: 'from-blue-500 via-indigo-400 to-emerald-400',
        textColor: 'text-sky-400',
        badgeBg: 'bg-blue-500/20 text-sky-300 border-blue-500/40',
        description: 'Відмінні відгуки та висока пунктуальність'
      };
    }
    if (clampedRating >= 4.0) {
      return {
        label: 'Надійний рівень довіри',
        badge: 'Silver Active',
        color: 'from-amber-500 via-sky-400 to-blue-500',
        textColor: 'text-amber-400',
        badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        description: 'Стабільні позитивні поїздки'
      };
    }
    return {
      label: 'Початковий рівень',
      badge: 'Новачок',
      color: 'from-slate-400 to-blue-400',
      textColor: 'text-slate-300',
      badgeBg: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
      description: 'Формування рейтингу на сервісі'
    };
  };

  const tier = getTier();

  if (compact) {
    return (
      <div className={`space-y-1.5 ${className}`}>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-bold text-[#14243B] dark:text-white">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Довіра водія: {percentage}%</span>
          </div>
          <span className="font-extrabold text-amber-500 flex items-center gap-1">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>{clampedRating.toFixed(1)} / 5.0</span>
          </span>
        </div>

        {/* Compact Progress Bar */}
        <div className="relative h-2 w-full bg-slate-200 dark:bg-slate-700/60 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${tier.color} rounded-full transition-all duration-700 ease-out`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-[#0D1E36] rounded-2xl border border-[#DFE7F1] dark:border-[#1D3455] p-4 sm:p-5 shadow-sm space-y-4 transition-all ${className}`}>
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#1769F4] to-[#38BDF8] text-white flex items-center justify-center shrink-0 shadow-md">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm sm:text-base text-[#14243B] dark:text-white">
                Індекс довіри водія
              </h3>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${tier.badgeBg}`}>
                {tier.badge}
              </span>
            </div>
            <p className="text-xs text-[#62718A] dark:text-slate-400">
              {tier.label} · {tier.description}
            </p>
          </div>
        </div>

        {/* Rating Score Badge */}
        <div className="flex items-center gap-3 bg-[#F5F8FD] dark:bg-[#122542] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700/60 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 text-amber-500 font-extrabold text-base">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span>{clampedRating.toFixed(1)}</span>
            <span className="text-xs text-slate-400 font-normal">/ 5.0</span>
          </div>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
          <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
            {percentage}%
          </div>
        </div>
      </div>

      {/* Main Interactive Progress Bar */}
      <div className="space-y-2">
        <div className="relative pt-1">
          {/* Background Track */}
          <div className="h-3.5 w-full bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden border border-slate-200/80 dark:border-slate-700/60 p-0.5">
            {/* Animated Gradient Fill */}
            <div
              className={`h-full bg-gradient-to-r ${tier.color} rounded-full transition-all duration-1000 ease-out relative shadow-sm`}
              style={{ width: `${percentage}%` }}
            >
              {/* Shine highlight animation on top of bar */}
              <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse" />
            </div>
          </div>

          {/* Glowing Pin Marker at Current Position */}
          <div
            className="absolute top-0 -translate-y-1/2 -translate-x-1/2 pointer-events-none transition-all duration-1000"
            style={{ left: `${percentage}%` }}
          >
            <div className="w-5 h-5 rounded-full bg-white dark:bg-[#081B35] shadow-md border-2 border-emerald-400 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            </div>
          </div>
        </div>

        {/* Milestone Scale Markers along track */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold px-0.5">
          <span>0 (Новий)</span>
          <span className="hidden sm:inline">3.0 (Базовий)</span>
          <span>4.0 (Надійний)</span>
          <span>4.5 (PRO)</span>
          <span className="text-emerald-500 font-bold">5.0 (Еталон)</span>
        </div>
      </div>

      {/* Trust Factors Micro-Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
        <div className="p-2.5 rounded-xl bg-[#F5F8FD] dark:bg-[#122542] border border-slate-200/60 dark:border-slate-700/50">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-semibold">
            <Star className="w-3 h-3 text-amber-500" />
            <span>Середня оцінка</span>
          </div>
          <div className="text-sm font-extrabold text-[#14243B] dark:text-white mt-0.5">
            ★ {clampedRating.toFixed(1)}
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-[#F5F8FD] dark:bg-[#122542] border border-slate-200/60 dark:border-slate-700/50">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-semibold">
            <Award className="w-3 h-3 text-blue-500" />
            <span>Успішні рейси</span>
          </div>
          <div className="text-sm font-extrabold text-[#14243B] dark:text-white mt-0.5">
            {tripsCount} поїздок
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-[#F5F8FD] dark:bg-[#122542] border border-slate-200/60 dark:border-slate-700/50">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-semibold">
            <TrendingUp className="w-3 h-3 text-emerald-500" />
            <span>Пунктуальність</span>
          </div>
          <div className="text-sm font-extrabold text-[#14243B] dark:text-white mt-0.5">
            {punctualityPercent}%
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-[#F5F8FD] dark:bg-[#122542] border border-slate-200/60 dark:border-slate-700/50">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-semibold">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>Документи</span>
          </div>
          <div className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
            {verifiedDocuments ? 'Перевірено' : 'На перевірці'}
          </div>
        </div>
      </div>

      {/* Expandable Breakdown Button */}
      <div className="pt-1 border-t border-slate-100 dark:border-slate-700/60">
        <button
          type="button"
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="w-full flex items-center justify-between text-xs font-bold text-[#1769F4] dark:text-sky-400 hover:opacity-80 transition py-1"
        >
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            <span>Як формується індекс довіри та переваги високого рівня</span>
          </span>
          {showBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Detailed Breakdown Panel */}
        {showBreakdown && (
          <div className="mt-3 p-3.5 rounded-xl bg-blue-50/60 dark:bg-[#0A1A30] border border-blue-200/60 dark:border-[#1E3A8A]/50 text-xs space-y-2.5 animate-fadeIn">
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              Індекс довіри MARSHGO розраховується автоматичним алгоритмом на основі підтверджених відгуків після кожної поїздки:
            </p>

            <ul className="space-y-1.5 text-slate-600 dark:text-slate-300">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span><strong>60%</strong> — Середня оцінка від пасажирів за останні поїздки.</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span><strong>20%</strong> — Кількість завершених рейсів без скасувань з ініціативи водія.</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                <span><strong>20%</strong> — Верифіковані документи (посвідчення водія, техпаспорт авто).</span>
              </li>
            </ul>

            <div className="pt-2 border-t border-blue-200/40 dark:border-blue-900/40 flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>Водії з рівнем &gt; 90% отримують пріоритет у видачі пошуку та швидше бронювання!</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
