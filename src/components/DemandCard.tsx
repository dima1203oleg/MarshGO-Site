import React from 'react';
import { MapPin, Clock, Users,  Check, Send } from 'lucide-react';
import { PassengerDemand } from '../types';

interface DemandCardProps {
  demand: PassengerDemand;
  onPropose: (demandId: string) => void;
  onQuickAcceptBudget?: (demandId: string, budget: number) => void;
  isOwner?: boolean;
}

export const DemandCard: React.FC<DemandCardProps> = ({
  demand,
  onPropose,
  onQuickAcceptBudget,
  isOwner: _isOwner = false
}) => {
  return (
    <div className="bg-white rounded-2xl border border-[#DFE7F1] p-4 sm:p-5 hover:border-[#1769F4] transition shadow-sm hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        {/* Passenger Profile */}
        <div className="flex items-center gap-3">
          <img
            src={demand.passengerAvatar}
            alt={demand.passengerName}
            className="w-10 h-10 rounded-full object-cover border border-slate-200"
            referrerPolicy="no-referrer"
          />
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm text-[#14243B]">{demand.passengerName}</h4>
              <span className="text-xs text-amber-500 font-semibold">★ {demand.passengerRating.toFixed(1)}</span>
            </div>
            <span className="text-[11px] text-[#62718A]">{demand.createdAt}</span>
          </div>
        </div>

        {/* Total Budget Pill */}
        <div className="text-right">
          <div className="text-xs font-semibold text-[#62718A]">Бюджет пасажира:</div>
          <div className="text-lg sm:text-xl font-extrabold text-[#1769F4] tabular-nums">
            {demand.totalBudget} грн
          </div>
          <div className="text-[10px] text-slate-500 font-medium">
            {demand.budgetType === 'total_all' ? `загалом за ${demand.passengerCount} пасажирів` : 'за одне місце'}
          </div>
        </div>
      </div>

      {/* Route & Window */}
      <div className="my-3 p-3 rounded-xl bg-[#F5F8FD] border border-slate-100 space-y-1.5 text-xs">
        <div className="flex items-center justify-between font-bold text-[#14243B]">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#1769F4]" />
            <span>{demand.origin}</span>
            <span className="text-slate-400">→</span>
            <span>{demand.destination}</span>
          </div>
          <div className="flex items-center gap-1 text-slate-500">
            <Users className="w-3.5 h-3.5" />
            <span>{demand.passengerCount} пас.</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-600 text-[11px]">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Часове вікно: {demand.departureDate} ({demand.timeWindowStart} – {demand.timeWindowEnd})</span>
        </div>

        {demand.notes && (
          <p className="text-[11px] text-slate-600 italic border-t border-slate-200/60 pt-1 mt-1">
            "{demand.notes}"
          </p>
        )}
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
        <div className="text-xs text-[#62718A]">
          {demand.proposalsCount > 0 ? (
            <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              Вже {demand.proposalsCount} пропозиції водіїв
            </span>
          ) : (
            <span className="text-slate-400">Очікує перших пропозицій</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onQuickAcceptBudget && (
            <button
              onClick={() => onQuickAcceptBudget(demand.id, demand.totalBudget)}
              className="px-3 py-2 rounded-xl bg-[#F0FDF4] hover:bg-[#DCFCE7] text-[#16845C] text-xs font-bold border border-[#16845C]/30 transition flex items-center gap-1.5 active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Погодитися на {demand.totalBudget} грн</span>
            </button>
          )}

          <button
            onClick={() => onPropose(demand.id)}
            className="px-4 py-2 rounded-xl bg-[#1769F4] hover:bg-[#1358CE] text-white text-xs font-bold shadow-sm shadow-[#1769F4]/20 transition flex items-center gap-1.5 active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Запропонувати ціну</span>
          </button>
        </div>
      </div>
    </div>
  );
};
