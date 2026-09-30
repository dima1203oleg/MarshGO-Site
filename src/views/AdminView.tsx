import React, { useState } from 'react';
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Users,
  Car,
  FileCheck,
  Activity,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { User, Vehicle, TransportOffer, PassengerDemand } from '../types';

interface AdminViewProps {
  user: User;
  vehicle: Vehicle;
  offers: TransportOffer[];
  demands: PassengerDemand[];
  demoMode: boolean;
  onToggleDemo: () => void;
  onBack: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  user,
  vehicle,
  offers,
  demands,
  demoMode,
  onToggleDemo,
  onBack
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'drivers' | 'policy' | 'flags'>('overview');

  return (
    <div className="min-h-screen bg-[#F5F8FD] pb-24 md:pb-12">
      {/* Top Header */}
      <div className="sticky top-16 z-30 bg-[#081B35] text-white px-4 sm:px-6 py-3 border-b border-slate-700">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1 rounded-lg text-slate-300 hover:text-white transition"
              aria-label="Назад"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base font-bold flex items-center gap-2">
                <span>MARSHGO Операційна панель</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-[#38BDF8]">
                  Admin v1.2
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleDemo}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                demoMode ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${demoMode ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              <span>{demoMode ? 'DEMO РЕЖИМ АКТИВНИЙ' : 'LIVE PRODUCTION'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === 'overview' ? 'bg-[#081B35] text-white' : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Огляд платформи
          </button>
          <button
            onClick={() => setActiveTab('drivers')}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === 'drivers' ? 'bg-[#081B35] text-white' : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Верифікація авто ({vehicle.photos.length} фото)
          </button>
          <button
            onClick={() => setActiveTab('policy')}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === 'policy' ? 'bg-[#081B35] text-white' : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Carpool Cost Sharing Guardrails
          </button>
          <button
            onClick={() => setActiveTab('flags')}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === 'flags' ? 'bg-[#081B35] text-white' : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Партнери та Feature Flags
          </button>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <span className="text-[11px] text-[#62718A] uppercase font-bold">Активні рейси</span>
                <div className="text-2xl font-black text-[#14243B] mt-1 tabular-nums">{offers.length}</div>
                <div className="text-[10px] text-emerald-600 mt-0.5">Всі напрямки валідні</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <span className="text-[11px] text-[#62718A] uppercase font-bold">Відкритий попит</span>
                <div className="text-2xl font-black text-[#1769F4] mt-1 tabular-nums">{demands.length}</div>
                <div className="text-[10px] text-blue-600 mt-0.5">Біржа попиту</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <span className="text-[11px] text-[#62718A] uppercase font-bold">Комісія Community</span>
                <div className="text-2xl font-black text-emerald-600 mt-1 tabular-nums">0%</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Справжній carpool</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <span className="text-[11px] text-[#62718A] uppercase font-bold">GPS Навігація</span>
                <div className="text-2xl font-black text-purple-600 mt-1">Beta</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Foreground safe</div>
              </div>
            </div>

            {/* Audit log table */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <h3 className="font-bold text-sm text-[#14243B]">Журнал останніх подій аудиту</h3>
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50 flex items-center justify-between">
                  <span>Верифіковано водія: Олександр Коваленко (Toyota Camry)</span>
                  <span className="text-slate-400">10 хв тому</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 flex items-center justify-between">
                  <span>Опубліковано запит пасажира Одеса → Київ (бюджет 1200 грн)</span>
                  <span className="text-slate-400">15 хв тому</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 flex items-center justify-between">
                  <span>Перевірка GPS-безпеки: автовимкнення підбору при stale сигналі</span>
                  <span className="text-emerald-700 font-semibold">OK</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Vehicle & Driver verification */}
        {activeTab === 'drivers' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#14243B]">Перевірка автомобіля: {vehicle.make} {vehicle.model}</h3>
                <p className="text-xs text-[#62718A]">Номер: {vehicle.licensePlateFull} (приховано публічно)</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                Схвалено адміністратором
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {vehicle.photos.map((p) => (
                <div key={p.id} className="rounded-xl overflow-hidden border border-slate-200 aspect-video">
                  <img src={p.url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Cost Sharing Policy */}
        {activeTab === 'policy' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 text-xs">
            <h3 className="font-bold text-sm text-[#14243B]">
              Cost-Sharing Policy Engine & Юридичні обмеження
            </h3>
            <p className="text-[#62718A] leading-relaxed">
              Відповідно до інструкції, MARSHGO не стверджує, що сума нижче певної кількості грн/км автоматично звільняє від ліцензії перевізника в Україні. 
              Система застосовує внутрішні risk guardrails та розділяє режим <strong>Community (0% комісії MARSHGO)</strong> і режим <strong>PRO / Ліцензовані перевізники</strong>.
            </p>
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 font-medium">
              ✓ 0% комісії платформи для Community зафіксовано на рівні коду.
              <br />
              ✓ Будь-які підозри щодо комерційної регулярної діяльності маркуються для ручної перевірки.
            </div>
          </div>
        )}

        {/* Tab 4: Partner Flags */}
        {activeTab === 'flags' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 text-xs">
            <h3 className="font-bold text-sm text-[#14243B]">Статуси партнерських підключень</h3>
            <div className="divide-y divide-slate-100">
              <div className="py-2.5 flex items-center justify-between">
                <span>Власні спільні поїздки MARSHGO Community</span>
                <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">LIVE (Власна база)</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span>Uklon / Bolt Таксі адаптер</span>
                <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded">DEMO MODE (Очікує API-контракт)</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span>INFOBUS / FlixBus Адаптер квитків</span>
                <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded">DEMO MODE (Очікує API-контракт)</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span>Укрзалізниця АТ</span>
                <span className="text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded">COMING SOON (P2)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
