import React, { useState } from 'react';
import {
  Calculator,
  X,
  TrendingDown
} from 'lucide-react';

interface FuelCostCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultOrigin?: string;
  defaultDestination?: string;
  defaultDistanceKm?: number;
}

const CITY_DISTANCES: Record<string, number> = {
  'odesa-kyiv': 475,
  'kyiv-odesa': 475,
  'lviv-kyiv': 540,
  'kyiv-lviv': 540,
  'dnipro-kyiv': 480,
  'kyiv-dnipro': 480,
  'kharkiv-kyiv': 480,
  'kyiv-kharkiv': 480,
  'lviv-odesa': 790,
  'odesa-lviv': 790,
  'ternopil-kyiv': 420,
  'kyiv-ternopil': 420,
  'vinnytsia-kyiv': 265,
  'kyiv-vinnytsia': 265
};

const FUEL_TYPES = [
  { id: 'a95', name: 'Бензин А-95', defaultPrice: 58.5, defaultConsumption: 7.5, unit: 'л' },
  { id: 'diesel', name: 'Дизель (ДП)', defaultPrice: 55.0, defaultConsumption: 6.2, unit: 'л' },
  { id: 'lpg', name: 'Газ (LPG)', defaultPrice: 29.5, defaultConsumption: 9.8, unit: 'л' },
  { id: 'ev', name: 'Електрокар (EV)', defaultPrice: 12.0, defaultConsumption: 18.0, unit: 'кВт·год' }
];

export const FuelCostCalculatorModal: React.FC<FuelCostCalculatorModalProps> = ({
  isOpen,
  onClose,
  defaultOrigin = 'Одеса',
  defaultDestination = 'Київ',
  defaultDistanceKm = 475
}) => {
  const origin = defaultOrigin;
  const destination = defaultDestination;
  const [fuelTypeId, setFuelTypeId] = useState('a95');
  const [distanceKm, setDistanceKm] = useState<number>(() => {
    const key = `${defaultOrigin.toLowerCase()}-${defaultDestination.toLowerCase()}`;
    return CITY_DISTANCES[key] || defaultDistanceKm || 475;
  });

  const selectedFuel = FUEL_TYPES.find((f) => f.id === fuelTypeId) || FUEL_TYPES[0];

  const [fuelPrice, setFuelPrice] = useState<number>(selectedFuel.defaultPrice);
  const [consumption, setConsumption] = useState<number>(selectedFuel.defaultConsumption);
  const [passengersCount, setPassengersCount] = useState<number>(3);
  const [includeWearAndTear, setIncludeWearAndTear] = useState<boolean>(true);

  if (!isOpen) return null;

  const handleFuelChange = (typeId: string) => {
    setFuelTypeId(typeId);
    const fuel = FUEL_TYPES.find((f) => f.id === typeId);
    if (fuel) {
      setFuelPrice(fuel.defaultPrice);
      setConsumption(fuel.defaultConsumption);
    }
  };

  // Calculations
  const totalFuelUnits = (distanceKm * consumption) / 100;
  const baseFuelCost = totalFuelUnits * fuelPrice;
  const wearAndTearCost = includeWearAndTear ? baseFuelCost * 0.15 : 0; // 15% for oil, tires, washer
  const totalTripCost = Math.round(baseFuelCost + wearAndTearCost);
  // Driver + Passengers share
  const totalPersonsInCar = passengersCount + 1; // driver + passengers
  const costPerSeat = Math.round(totalTripCost / totalPersonsInCar);
  const driverReimbursementTotal = costPerSeat * passengersCount;

  // Comparison with train / commercial bus (~650-800 грн)
  const averageCommercialTicket = 680;
  const userSavingsPerTrip = Math.max(0, averageCommercialTicket - costPerSeat);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-white dark:bg-[#0D1E36] w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm text-white flex items-center justify-center shrink-0">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold">
                Калькулятор справедливого розподілу пального
              </h2>
              <p className="text-xs text-blue-100">
                Прозорий розрахунок без комерційної націнки згідно з принципами Community
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition"
            aria-label="Закрити"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* Route info */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-bold uppercase">
                Маршрут
              </span>
              <span className="font-extrabold text-sm text-[#14243B] dark:text-white">
                {origin} ➔ {destination}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-bold uppercase">
                Відстань
              </span>
              <span className="font-extrabold text-sm text-[#1769F4] dark:text-sky-400">
                {distanceKm} км
              </span>
            </div>
          </div>

          {/* Distance Slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-extrabold text-slate-700 dark:text-slate-200">
                Коригування відстані (км):
              </label>
              <span className="font-bold text-[#14243B] dark:text-white">{distanceKm} км</span>
            </div>
            <input
              type="range"
              min="50"
              max="1200"
              step="10"
              value={distanceKm}
              onChange={(e) => setDistanceKm(Number(e.target.value))}
              className="w-full accent-[#1769F4] cursor-pointer"
            />
          </div>

          {/* Fuel Type Selector */}
          <div>
            <label className="font-extrabold text-slate-700 dark:text-slate-200 mb-1.5 block">
              Тип палива або живлення:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {FUEL_TYPES.map((fuel) => (
                <button
                  key={fuel.id}
                  type="button"
                  onClick={() => handleFuelChange(fuel.id)}
                  className={`p-2 rounded-xl border text-center transition font-bold ${
                    fuelTypeId === fuel.id
                      ? 'bg-[#1769F4] text-white border-[#1769F4] shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="truncate">{fuel.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Fuel Price & Consumption */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-extrabold text-slate-700 dark:text-slate-200 mb-1 block">
                Ціна за 1 {selectedFuel.unit} (грн):
              </label>
              <input
                type="number"
                step="0.5"
                value={fuelPrice}
                onChange={(e) => setFuelPrice(Number(e.target.value))}
                className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-extrabold text-[#14243B] dark:text-white"
              />
            </div>

            <div>
              <label className="font-extrabold text-slate-700 dark:text-slate-200 mb-1 block">
                Розхід на 100 км ({selectedFuel.unit}):
              </label>
              <input
                type="number"
                step="0.1"
                value={consumption}
                onChange={(e) => setConsumption(Number(e.target.value))}
                className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-extrabold text-[#14243B] dark:text-white"
              />
            </div>
          </div>

          {/* Passengers count */}
          <div>
            <label className="font-extrabold text-slate-700 dark:text-slate-200 mb-1 block">
              Кількість попутників (пасажирів):
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 6, 7].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setPassengersCount(num)}
                  className={`flex-1 py-1.5 rounded-xl font-bold transition text-xs ${
                    passengersCount === num
                      ? 'bg-[#1769F4] text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Wear and tear checkbox */}
          <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={includeWearAndTear}
              onChange={(e) => setIncludeWearAndTear(e.target.checked)}
              className="rounded text-[#1769F4] focus:ring-0"
            />
            <div>
              <span className="text-slate-800 dark:text-slate-200 font-bold block">
                Враховувати амортизацію та рідини (+15%)
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                Мастило, омивач скла, знос гуми та гальмівних колодок
              </span>
            </div>
          </label>

          {/* Results Block */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800 p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-bold uppercase block">
                  Рекомендований внесок за 1 місце:
                </span>
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
                  {costPerSeat} ₴ <span className="text-xs font-normal text-emerald-600">/ попутник</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] text-slate-600 dark:text-slate-400 font-bold uppercase block">
                  Загальна сума пального:
                </span>
                <div className="text-lg font-extrabold text-[#14243B] dark:text-white">
                  {totalTripCost} ₴
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60 grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 text-emerald-900 dark:text-emerald-200">
                <TrendingDown className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Економія пасажира: ~{userSavingsPerTrip} ₴ vs автобус</span>
              </div>
              <div className="text-right text-emerald-900 dark:text-emerald-200 font-semibold">
                Компенсація водію: {driverReimbursementTotal} ₴ ({passengersCount} місць)
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#1769F4] hover:bg-[#1358CE] text-white text-xs font-bold transition shadow-xs"
          >
            Зрозуміло, дякую!
          </button>
        </div>
      </div>
    </div>
  );
};
