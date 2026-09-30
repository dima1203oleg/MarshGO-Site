import React, { useState } from 'react';
import {
  ArrowLeft
} from 'lucide-react';
import { PassengerDemand } from '../types';
import { DemandCard } from '../components/DemandCard';
import { NegotiationModal } from '../components/NegotiationModal';

interface DriverRequestsViewProps {
  demands: PassengerDemand[];
  onBack: () => void;
  onSubmitProposal: (demandId: string, priceAmount: number, comment?: string) => void;
  onQuickAcceptBudget: (demandId: string, budget: number) => void;
}

export const DriverRequestsView: React.FC<DriverRequestsViewProps> = ({
  demands,
  onBack,
  onSubmitProposal,
  onQuickAcceptBudget
}) => {
  const [selectedDemandForProposal, setSelectedDemandForProposal] = useState<PassengerDemand | null>(null);
  const [filterCity, setFilterCity] = useState<string>('all');

  const filteredDemands = demands.filter((d) => {
    if (filterCity === 'all') return true;
    return d.origin.toLowerCase().includes(filterCity.toLowerCase()) || d.destination.toLowerCase().includes(filterCity.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-[#F5F8FD] pb-24 md:pb-12">
      {/* Top Header */}
      <div className="sticky top-16 z-30 bg-white border-b border-[#DFE7F1] px-4 sm:px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-[#1769F4] transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Назад</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#14243B]">Запити пасажирів (Попит)</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {filteredDemands.length} відкритих
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Banner */}
        <div className="bg-white rounded-2xl border border-[#DFE7F1] p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-[#14243B]">
              Біржа попиту: пасажири шукають авто
            </h1>
            <p className="text-xs text-[#62718A] mt-1 max-w-xl">
              Ви можете погодитися на вказаний бюджет пасажира в 1 клік або надіслати власну зустрічну ціну.
            </p>
          </div>

          {/* Quick city filter chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 self-start sm:self-auto">
            {['all', 'Одеса', 'Київ', 'Стрий', 'Вінниця'].map((city) => (
              <button
                key={city}
                onClick={() => setFilterCity(city)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                  filterCity === city
                    ? 'bg-[#1769F4] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {city === 'all' ? 'Всі міста' : city}
              </button>
            ))}
          </div>
        </div>

        {/* Demands List */}
        <div className="space-y-4">
          {filteredDemands.map((demand) => (
            <DemandCard
              key={demand.id}
              demand={demand}
              onPropose={() => setSelectedDemandForProposal(demand)}
              onQuickAcceptBudget={onQuickAcceptBudget}
            />
          ))}
        </div>
      </div>

      {/* Driver Proposal Negotiation Modal */}
      {selectedDemandForProposal && (
        <NegotiationModal
          isOpen={!!selectedDemandForProposal}
          onClose={() => setSelectedDemandForProposal(null)}
          demandTitle={`${selectedDemandForProposal.origin} → ${selectedDemandForProposal.destination}`}
          defaultPrice={Math.max(50, selectedDemandForProposal.totalBudget - 200)}
          userRole="driver"
          onSubmitPrice={(priceAmount, comment) => {
            onSubmitProposal(selectedDemandForProposal.id, priceAmount, comment);
            setSelectedDemandForProposal(null);
          }}
        />
      )}
    </div>
  );
};
