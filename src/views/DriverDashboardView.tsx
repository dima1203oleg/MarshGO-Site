import React, { useState } from 'react';
import {
  Car,
  Compass,
  Users,
  ShieldCheck,
  ArrowRight,
  Camera,
  Leaf,
  Calculator
} from 'lucide-react';
import { User, Vehicle } from '../types';
import { DriverTrustBar } from '../components/DriverTrustBar';
import { FuelCostCalculatorModal } from '../components/FuelCostCalculatorModal';
import { SafetyTripModal } from '../components/SafetyTripModal';

interface DriverDashboardViewProps {
  user: User;
  vehicle: Vehicle;
  vehicles?: Vehicle[];
  onNavigate: (view: string) => void;
}

export const DriverDashboardView: React.FC<DriverDashboardViewProps> = ({
  user,
  vehicle,
  vehicles = [],
  onNavigate
}) => {
  const [isFuelCalcOpen, setIsFuelCalcOpen] = useState(false);
  const [isSafetyOpen, setIsSafetyOpen] = useState(false);
  const vehicleCount = vehicles.length > 0 ? vehicles.length : 1;
  return (
    <div className="min-h-screen bg-[#F5F8FD] pb-24 md:pb-12">
      {/* Top Banner */}
      <div className="bg-[#081B35] text-white pt-6 pb-12 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <img
                src={user.avatar}
                alt={user.name}
                className="w-14 h-14 rounded-full object-cover border-2 border-[#1769F4]"
                referrerPolicy="no-referrer"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-extrabold">{user.name}</h1>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-xs text-slate-300">
                  Режим водія · На платформі з {user.memberSince}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-center">
                <div className="text-amber-400 font-extrabold text-sm">★ {user.rating.toFixed(1)}</div>
                <div className="text-[10px] text-slate-300">Рейтинг</div>
              </div>
              <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-center">
                <div className="text-white font-extrabold text-sm">{user.tripsCount}</div>
                <div className="text-[10px] text-slate-300">Поїздок</div>
              </div>
              <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-center">
                <div className="text-emerald-400 font-extrabold text-sm">98%</div>
                <div className="text-[10px] text-slate-300">Пунктуальність</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-6 space-y-6">
        {/* Driver Trust Level Progress Bar */}
        <DriverTrustBar
          rating={user.rating}
          tripsCount={user.tripsCount}
          punctualityPercent={98}
          verifiedDocuments={true}
        />

        {/* Vehicle Summary Card */}
        <div className="bg-white rounded-2xl border border-[#DFE7F1] p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Car className="w-5 h-5 text-[#1769F4]" />
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base text-[#14243B]">Основне авто</h2>
                {vehicleCount > 1 && (
                  <span className="text-[11px] font-bold bg-blue-50 text-[#1769F4] px-2 py-0.5 rounded-full border border-blue-100">
                    Гараж: {vehicleCount} авто
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => onNavigate('driver-vehicle')}
              className="text-xs font-semibold text-[#1769F4] hover:underline flex items-center gap-1"
            >
              <span>Гараж та фото ({vehicle.photos.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center">
            {vehicle.photos[0] ? (
              <img
                src={vehicle.photos[0].url}
                alt={vehicle.model}
                className="w-full sm:w-44 h-32 rounded-xl object-cover border border-slate-200"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full sm:w-44 h-32 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                <Camera className="w-8 h-8" />
              </div>
            )}

            <div className="flex-1 space-y-1 text-xs">
              <div className="text-base font-extrabold text-[#14243B]">
                {vehicle.make} {vehicle.model} ({vehicle.year})
              </div>
              <p className="text-slate-500">Колір: {vehicle.color} · Тип: {vehicle.bodyType}</p>
              <div className="flex items-center gap-3 text-slate-600 pt-1">
                <span>Номерний знак: <strong className="text-slate-800">{vehicle.licensePlateFull || vehicle.licensePlateMasked}</strong></span>
                <span>·</span>
                <span>Місць: <strong>{vehicle.seats}</strong></span>
              </div>
              <div className="pt-2 flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[11px] font-semibold">
                  Фото перевірено
                </span>
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 text-[11px] font-semibold">
                  Кондиціонер
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-semibold">
                  Місце для багажу
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Driver Core Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Action 1: Demands Feed */}
          <div
            onClick={() => onNavigate('driver-requests')}
            className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-[#1769F4] hover:shadow-md cursor-pointer transition space-y-3 group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1769F4] flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-[#14243B]">Заявки пасажирів</h3>
              <p className="text-xs text-[#62718A] mt-1">
                Переглядайте попит, пропонуйте свою ціну або погоджуйтеся на бюджет.
              </p>
            </div>
            <div className="text-xs font-semibold text-[#1769F4] flex items-center gap-1">
              <span>Відкрити біржу</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Action 2: Community Carpool */}
          <div
            onClick={() => onNavigate('driver-offer-new')}
            className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-[#16845C] hover:shadow-md cursor-pointer transition space-y-3 group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#16845C] flex items-center justify-center group-hover:scale-105 transition-transform">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-[#14243B]">Створити попутку</h3>
                <span className="text-[10px] font-bold px-1.5 rounded bg-emerald-100 text-emerald-800">0%</span>
              </div>
              <p className="text-xs text-[#62718A] mt-1">
                Опублікуйте свій регулярний або разовий маршрут для спільного розподілу витрат.
              </p>
            </div>
            <div className="text-xs font-semibold text-[#16845C] flex items-center gap-1">
              <span>Створити рейс</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Action 3: MARSHGO Navigation */}
          <div
            onClick={() => onNavigate('navigation')}
            className="bg-[#081B35] p-5 rounded-2xl border border-slate-700 text-white hover:shadow-lg cursor-pointer transition space-y-3 group"
          >
            <div className="w-10 h-10 rounded-xl bg-[#1769F4] text-white flex items-center justify-center group-hover:scale-105 transition-transform">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-white">MARSHGO Навігація</h3>
                <span className="text-[10px] font-bold px-1.5 rounded bg-blue-500/30 text-[#38BDF8]">Beta</span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Їдьте трасою. Навігатор підбере пасажирів дорогою без зайвого відхилення.
              </p>
            </div>
            <div className="text-xs font-semibold text-[#38BDF8] flex items-center gap-1">
              <span>Запустити GPS-маршрут</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Driver Community Impact & Tools Banner */}
        <div className="bg-white rounded-2xl border border-[#DFE7F1] p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-extrabold text-base text-[#14243B] flex items-center gap-2">
                <span>Ваш внесок у спільноту MARSHGO</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                  Еко-довіра
                </span>
              </h3>
              <p className="text-xs text-[#62718A]">
                Спільні поїздки зменшують трафік на трасах України та бережуть довкілля
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFuelCalcOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#1769F4] font-bold text-xs flex items-center gap-1.5 transition"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Калькулятор пального</span>
              </button>

              <button
                type="button"
                onClick={() => setIsSafetyOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1.5 transition"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Центр безпеки</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[11px] text-slate-500 font-medium">Компенсовано пального</div>
              <div className="text-lg font-black text-[#14243B] mt-1 flex items-baseline gap-1">
                <span>~14 850 ₴</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[11px] text-slate-500 font-medium">Пасажирів перевезено</div>
              <div className="text-lg font-black text-[#1769F4] mt-1">
                210 людей
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[11px] text-slate-500 font-medium">Зниження викидів CO₂</div>
              <div className="text-lg font-black text-emerald-600 mt-1 flex items-center gap-1">
                <Leaf className="w-4 h-4" />
                <span>-1.84 т CO₂</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[11px] text-slate-500 font-medium">Безпека та безаварійність</div>
              <div className="text-lg font-black text-emerald-700 mt-1">
                100% захист
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <FuelCostCalculatorModal
        isOpen={isFuelCalcOpen}
        onClose={() => setIsFuelCalcOpen(false)}
        defaultOrigin="Одеса"
        defaultDestination="Київ"
        defaultDistanceKm={475}
      />

      <SafetyTripModal
        isOpen={isSafetyOpen}
        onClose={() => setIsSafetyOpen(false)}
        tripDetails={{
          origin: 'Одеса',
          destination: 'Київ',
          driverName: user.name,
          vehicleName: `${vehicle.make} ${vehicle.model}`
        }}
      />
    </div>
  );
};
