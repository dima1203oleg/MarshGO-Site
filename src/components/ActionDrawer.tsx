import React from 'react';
import { X, Search, Car, Navigation, ArrowRight } from 'lucide-react';

interface ActionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (action: 'demand_new' | 'driver_offer_new' | 'navigation') => void;
}

export const ActionDrawer: React.FC<ActionDrawerProps> = ({
  isOpen,
  onClose,
  onSelectAction
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl border border-slate-200 animate-slideUp">
        {/* Top drag handle indicator */}
        <div className="pt-3 pb-1 flex justify-center sm:hidden">
          <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Drawer Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-[#14243B]">Чим можемо допомогти?</h3>
            <p className="text-xs text-[#62718A]">Оберіть необхідну дію для швидкого старту</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            aria-label="Закрити"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options List */}
        <div className="p-6 space-y-3">
          {/* Action 1: Passenger Demand */}
          <button
            onClick={() => {
              onClose();
              onSelectAction('demand_new');
            }}
            className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-[#1769F4] hover:bg-[#F5F8FD] transition group flex items-start gap-4"
          >
            <div className="w-11 h-11 rounded-xl bg-[#EFF6FF] text-[#1769F4] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Search className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-[#14243B]">Шукаю поїздку (Назвати ціну)</h4>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#1769F4] transition-colors" />
              </div>
              <p className="text-xs text-[#62718A] mt-1">
                Вкажіть маршрут, час та бюджет. Водії побачать заявку і запропонують авто.
              </p>
            </div>
          </button>

          {/* Action 2: Community Carpool */}
          <button
            onClick={() => {
              onClose();
              onSelectAction('driver_offer_new');
            }}
            className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-[#16845C] hover:bg-[#F0FDF4] transition group flex items-start gap-4"
          >
            <div className="w-11 h-11 rounded-xl bg-[#DCFCE7] text-[#16845C] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Car className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-[#14243B]">Пропоную попутку</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">0% комісії</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#16845C] transition-colors" />
              </div>
              <p className="text-xs text-[#62718A] mt-1">
                Спільний розподіл витрат на пальне. Жодної комісії сервісу MARSHGO.
              </p>
            </div>
          </button>

          {/* Action 3: MARSHGO Navigation */}
          <button
            onClick={() => {
              onClose();
              onSelectAction('navigation');
            }}
            className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-[#1769F4] hover:bg-[#081B35]/5 transition group flex items-start gap-4"
          >
            <div className="w-11 h-11 rounded-xl bg-[#081B35] text-[#38BDF8] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Navigation className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-[#14243B]">MARSHGO Навігація</h4>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">Beta</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#1769F4] transition-colors" />
              </div>
              <p className="text-xs text-[#62718A] mt-1">
                Їдьте власним маршрутом. За бажанням система підкаже пасажирів дорогою.
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
