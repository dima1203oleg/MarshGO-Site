import React, { useState } from 'react';
import {
  ArrowLeft,
  MapPin,
  Clock,
  Users,
  ShieldCheck,
  Check,
  RotateCcw,
  MessageSquare,
  CheckCircle2,
  Sparkles,
  Car
} from 'lucide-react';
import { PassengerDemand, Proposal, Booking } from '../types';
import { NegotiationModal } from '../components/NegotiationModal';

interface DemandDetailViewProps {
  demand: PassengerDemand;
  proposals: Proposal[];
  onBack: () => void;
  onAcceptProposal: (proposalId: string) => void;
  onCounterOffer: (proposalId: string, amount: number, comment?: string) => void;
  onOpenChat: (demandId: string) => void;
}

export const DemandDetailView: React.FC<DemandDetailViewProps> = ({
  demand,
  proposals,
  onBack,
  onAcceptProposal,
  onCounterOffer,
  onOpenChat
}) => {
  const [activeCounterProposal, setActiveCounterProposal] = useState<Proposal | null>(null);

  return (
    <div className="min-h-screen bg-[#F5F8FD] pb-24 md:pb-12">
      {/* Top Header */}
      <div className="sticky top-16 z-30 bg-white border-b border-[#DFE7F1] px-4 sm:px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-[#1769F4] transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Назад</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#14243B]">Запит #{demand.id.slice(-6)}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              {demand.status === 'booked' ? 'Заброньовано' : 'Активний попит'}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Demand Summary Card */}
        <div className="bg-white rounded-2xl border border-[#DFE7F1] p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-base sm:text-lg font-bold text-[#14243B]">
                <MapPin className="w-5 h-5 text-[#1769F4]" />
                <span>{demand.origin}</span>
                <span className="text-slate-400">→</span>
                <span>{demand.destination}</span>
              </div>
              <p className="text-xs text-[#62718A] mt-1 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                <span>{demand.departureDate} ({demand.timeWindowStart} – {demand.timeWindowEnd})</span>
                <span>·</span>
                <Users className="w-3.5 h-3.5" />
                <span>{demand.passengerCount} пасажири</span>
              </p>
            </div>

            <div className="text-right">
              <div className="text-xs text-[#62718A]">Ваш бюджет:</div>
              <div className="text-xl sm:text-2xl font-black text-[#1769F4] tabular-nums">
                {demand.totalBudget} грн
              </div>
              <div className="text-[10px] text-slate-500">
                {demand.budgetType === 'total_all' ? 'загалом за всіх' : 'за місце'}
              </div>
            </div>
          </div>

          {demand.notes && (
            <p className="text-xs text-slate-600 bg-[#F5F8FD] p-3 rounded-xl border border-slate-100 italic">
              "{demand.notes}"
            </p>
          )}
        </div>

        {/* Driver Proposals Section (FLOW B) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-base text-[#14243B]">
              Отримані пропозиції від водіїв ({proposals.length})
            </h3>
            <button
              onClick={() => onOpenChat(demand.id)}
              className="text-xs font-semibold text-[#1769F4] flex items-center gap-1.5 hover:underline"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Відкрити діалог</span>
            </button>
          </div>

          {proposals.length > 0 ? (
            <div className="space-y-3">
              {proposals.map((prop) => (
                <div
                  key={prop.id}
                  className={`bg-white rounded-2xl border p-5 shadow-sm space-y-3 transition ${
                    prop.status === 'accepted'
                      ? 'border-emerald-500 bg-emerald-50/20 ring-2 ring-emerald-500/20'
                      : 'border-[#DFE7F1] hover:border-[#1769F4]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Driver details */}
                    <div className="flex items-center gap-3">
                      <img
                        src={prop.driverAvatar}
                        alt={prop.driverName}
                        className="w-12 h-12 rounded-full object-cover border border-slate-200 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-sm text-[#14243B]">
                          <span>{prop.driverName}</span>
                          <ShieldCheck className="w-4 h-4 text-[#16845C]" />
                          <span className="text-xs text-amber-500 ml-1">★ {prop.driverRating.toFixed(1)}</span>
                        </div>
                        <div className="text-xs text-[#62718A] flex items-center gap-2 mt-0.5">
                          <Car className="w-3.5 h-3.5 text-slate-400" />
                          <span>{prop.vehicleSummary}</span>
                        </div>
                        <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
                          Виїзд о {prop.estimatedPickupTime} · Відхилення від траси: +{prop.detourMinutes} хв
                        </div>
                      </div>
                    </div>

                    {/* Price Block */}
                    <div className="text-left sm:text-right">
                      <div className="text-xs text-[#62718A]">Пропозиція водія:</div>
                      <div className="text-2xl font-black text-[#14243B] tabular-nums">
                        {prop.offeredPrice} грн
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        Ревізія #{prop.currentRevisionNumber}
                      </div>
                    </div>
                  </div>

                  {/* Comment */}
                  {prop.revisions[prop.revisions.length - 1]?.comment && (
                    <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="font-semibold text-[#14243B]">Коментар: </span>
                      {prop.revisions[prop.revisions.length - 1].comment}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[11px] text-[#62718A]">
                      Статус: <strong className="text-[#14243B] uppercase">{prop.status}</strong>
                    </span>

                    {prop.status === 'accepted' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-900 font-bold text-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Домовленість прийнята! Бронювання підтверджено</span>
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setActiveCounterProposal(prop)}
                          className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 active:scale-95"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Запропонувати свою ціну</span>
                        </button>

                        <button
                          onClick={() => onAcceptProposal(prop.id)}
                          className="px-4 py-2 rounded-xl bg-[#16845C] hover:bg-[#126b4a] text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 active:scale-95"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Погодитися на {prop.offeredPrice} грн</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-[#62718A]">
              Водії на маршруті отримали сповіщення. Перші зустрічні пропозиції з'являться тут найближчим часом.
            </div>
          )}
        </div>
      </div>

      {/* Negotiation Counter Modal */}
      {activeCounterProposal && (
        <NegotiationModal
          isOpen={!!activeCounterProposal}
          onClose={() => setActiveCounterProposal(null)}
          proposal={activeCounterProposal}
          demandTitle={`${demand.origin} → ${demand.destination}`}
          defaultPrice={activeCounterProposal.offeredPrice}
          userRole="passenger"
          onSubmitPrice={(newPrice, comment) => {
            onCounterOffer(activeCounterProposal.id, newPrice, comment);
            setActiveCounterProposal(null);
          }}
        />
      )}
    </div>
  );
};
