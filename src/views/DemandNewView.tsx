import React, { useState } from 'react';
import {
  ArrowLeft,
  MapPin,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { PassengerDemand } from '../types';

interface DemandNewViewProps {
  initialRoute?: {
    origin: string;
    destination: string;
    date: string;
    passengers: number;
  };
  onBack: () => void;
  onCreated: (demand: PassengerDemand) => void;
}

export const DemandNewView: React.FC<DemandNewViewProps> = ({
  initialRoute,
  onBack,
  onCreated
}) => {
  const [origin, setOrigin] = useState(initialRoute?.origin || 'Одеса');
  const [destination, setDestination] = useState(initialRoute?.destination || 'Київ');
  const [departureDate, setDepartureDate] = useState(initialRoute?.date || '2026-09-30');
  const [timeWindowStart, setTimeWindowStart] = useState('08:00');
  const [timeWindowEnd, setTimeWindowEnd] = useState('10:00');
  const [passengerCount, setPassengerCount] = useState(initialRoute?.passengers || 2);
  const [totalBudget, setTotalBudget] = useState(1200);
  const [budgetType, setBudgetType] = useState<'total_all' | 'per_seat'>('total_all');
  const [notes, setNotes] = useState('Їдемо вдвох із невеликими рюкзаками. Потрібен виїзд без запізнень.');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin.trim() || !destination.trim() || totalBudget <= 0) return;

    // Call storage creation via prop
    const created: any = {
      origin,
      destination,
      departureDate,
      timeWindowStart,
      timeWindowEnd,
      passengerCount,
      totalBudget,
      budgetType,
      notes
    };
    onCreated(created);
  };

  return (
    <div className="min-h-screen bg-[#F5F8FD] pb-24 md:pb-12">
      {/* Top Header */}
      <div className="sticky top-16 z-30 bg-white border-b border-[#DFE7F1] px-4 sm:px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-[#1769F4] transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Назад</span>
          </button>
          <span className="text-xs font-bold text-[#14243B]">Зворотна біржа попиту</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-[#081B35] to-[#1769F4] rounded-2xl p-5 text-white shadow-md space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-semibold text-[#38BDF8]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Пасажир обирає умови</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold font-display">
            Шукаю поїздку: Назвіть свій бюджет
          </h1>
          <p className="text-xs text-slate-200">
            Опублікуйте свій маршрут та комфортну суму. Водії, які їдуть цим коридором, надішлють вам пропозиції.
          </p>
        </div>

        {/* Form Card */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#DFE7F1] p-5 sm:p-6 shadow-sm space-y-4">
          {/* Origin & Destination */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-[#14243B] mb-1">Звідки:</label>
              <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-[#F5F8FD] focus-within:bg-white focus-within:border-[#1769F4] transition">
                <MapPin className="w-4 h-4 text-[#1769F4] shrink-0" />
                <input
                  type="text"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="Місто або зручна зупинка"
                  className="w-full text-sm font-bold text-[#14243B] bg-transparent focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#14243B] mb-1">Куди:</label>
              <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-[#F5F8FD] focus-within:bg-white focus-within:border-[#1769F4] transition">
                <MapPin className="w-4 h-4 text-[#16845C] shrink-0" />
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Куди саме потрібно доїхати"
                  className="w-full text-sm font-bold text-[#14243B] bg-transparent focus:outline-none"
                  required
                />
              </div>
            </div>
          </div>

          {/* Date & Time Window */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#14243B] mb-1">Дата:</label>
              <input
                type="date"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold text-[#14243B] bg-[#F5F8FD] focus:bg-white focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#14243B] mb-1">Виїзд не раніше:</label>
              <input
                type="time"
                value={timeWindowStart}
                onChange={(e) => setTimeWindowStart(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold text-[#14243B] bg-[#F5F8FD] focus:bg-white focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#14243B] mb-1">Не пізніше:</label>
              <input
                type="time"
                value={timeWindowEnd}
                onChange={(e) => setTimeWindowEnd(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold text-[#14243B] bg-[#F5F8FD] focus:bg-white focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Passengers count */}
          <div>
            <label className="block text-xs font-bold text-[#14243B] mb-1">Кількість людей:</label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map((num) => (
                <button
                  type="button"
                  key={num}
                  onClick={() => setPassengerCount(num)}
                  className={`w-12 h-10 rounded-xl font-bold text-xs transition ${
                    passengerCount === num
                      ? 'bg-[#1769F4] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {num} {num === 1 ? 'особа' : 'особи'}
                </button>
              ))}
            </div>
          </div>

          {/* Budget Input & Unit Selector */}
          <div className="p-4 rounded-xl bg-[#EFF6FF] border border-blue-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-[#14243B]">
                Скільки ви готові заплатити?
              </label>
              <div className="flex items-center gap-1 p-0.5 bg-white rounded-lg border border-blue-200 text-[11px]">
                <button
                  type="button"
                  onClick={() => setBudgetType('total_all')}
                  className={`px-2.5 py-1 rounded font-bold transition ${
                    budgetType === 'total_all' ? 'bg-[#1769F4] text-white' : 'text-slate-600'
                  }`}
                >
                  Загалом за всіх ({passengerCount} пас.)
                </button>
                <button
                  type="button"
                  onClick={() => setBudgetType('per_seat')}
                  className={`px-2.5 py-1 rounded font-bold transition ${
                    budgetType === 'per_seat' ? 'bg-[#1769F4] text-white' : 'text-slate-600'
                  }`}
                >
                  За 1 місце
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                type="number"
                min="50"
                step="50"
                value={totalBudget}
                onChange={(e) => setTotalBudget(Number(e.target.value))}
                className="w-full text-2xl font-black text-[#1769F4] p-3 rounded-xl border border-blue-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#1769F4] tabular-nums"
                required
              />
              <span className="absolute right-4 top-3.5 text-sm font-bold text-slate-500">UAH</span>
            </div>

            <p className="text-[11px] text-[#62718A]">
              {budgetType === 'total_all'
                ? `Сума ${totalBudget} грн є загальним бюджетом за всіх ${passengerCount} пасажирів.`
                : `Сума ${totalBudget} грн за одне місце (загалом ${totalBudget * passengerCount} грн).`}
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-[#14243B] mb-1">
              Коментар до поїздки (багаж, тварини, діти):
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Опишіть ваші побажання щодо точки посадки або багажу..."
              className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-[#F5F8FD] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1769F4] resize-none"
            />
          </div>

          {/* Submit button */}
          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-[#1769F4] hover:bg-[#1358CE] text-white font-extrabold text-sm shadow-lg shadow-[#1769F4]/25 transition flex items-center justify-center gap-2 active:scale-95"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>Опублікувати запит на біржі (Бюджет {totalBudget} грн)</span>
          </button>
        </form>
      </div>
    </div>
  );
};
