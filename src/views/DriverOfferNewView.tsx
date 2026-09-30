import React, { useState } from 'react';
import {
  ArrowLeft,
  Car,




  ShieldCheck,
  CheckCircle2,

  Plus,
  Check
} from 'lucide-react';
import { Vehicle } from '../types';
import { AddVehicleModal } from '../components/AddVehicleModal';

interface DriverOfferNewViewProps {
  vehicle?: Vehicle;
  vehicles?: Vehicle[];
  onBack: () => void;
  onOfferCreated: (offerData: any) => void;
  onAddVehicle?: (newVeh: Omit<Vehicle, 'id'> & { id?: string }) => void;
}

export const DriverOfferNewView: React.FC<DriverOfferNewViewProps> = ({
  vehicle,
  vehicles = [],
  onBack,
  onOfferCreated,
  onAddVehicle
}) => {
  // Combine single vehicle prop with vehicles list
  const allVehicles: Vehicle[] = vehicles.length > 0 ? vehicles : vehicle ? [vehicle] : [];

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(
    vehicle?.id || allVehicles[0]?.id || ''
  );
  const [isAddVehicleModalOpen, setIsAddVehicleModalOpen] = useState(false);

  const currentVehicle: Vehicle =
    allVehicles.find((v) => v.id === selectedVehicleId) || allVehicles[0] || vehicle!;

  const [origin, setOrigin] = useState('Одеса');
  const [originAddress, setOriginAddress] = useState('Центральний автовокзал (вул. Колонтаївська)');
  const [destination, setDestination] = useState('Київ');
  const [destinationAddress, setDestinationAddress] = useState('Метро Житомирська');
  const [departureDate, setDepartureDate] = useState('2026-09-30');
  const [departureTime, setDepartureTime] = useState('08:00');
  const [availableSeats, setAvailableSeats] = useState(() =>
    currentVehicle ? Math.max(1, currentVehicle.seats - 1) : 3
  );
  const [priceAmount, setPriceAmount] = useState(500);
  const [intermediateStops, setIntermediateStops] = useState('Умань, Біла Церква');

  const handleSelectVehicle = (veh: Vehicle) => {
    setSelectedVehicleId(veh.id);
    // Adjust available seats to vehicle capacity minus driver
    setAvailableSeats(Math.min(availableSeats, Math.max(1, veh.seats - 1)));
  };

  const handleCreatedVehicle = (newVeh: Omit<Vehicle, 'id'> & { id?: string }) => {
    if (onAddVehicle) {
      onAddVehicle(newVeh);
    }
    if (newVeh.id) {
      setSelectedVehicleId(newVeh.id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin.trim() || !destination.trim() || priceAmount <= 0) return;

    const departureISO = `${departureDate}T${departureTime}:00Z`;
    // Estimate arrival 6 hours later
    const arrivalDate = new Date(new Date(departureISO).getTime() + 6 * 3600 * 1000);

    const activeVeh = currentVehicle;

    const offerData = {
      category: activeVeh?.bodyType === 'minivan' ? ('minibus' as const) : ('community' as const),
      source: 'marshgo_community' as const,
      isLiveIntegration: true,
      origin,
      originAddress,
      destination,
      destinationAddress,
      departureTime: departureISO,
      arrivalTime: arrivalDate.toISOString(),
      durationMinutes: 360,
      distanceKm: 475,
      intermediateStops: intermediateStops.split(',').map((s) => s.trim()).filter(Boolean),
      driver: {
        id: 'usr_drv_alex',
        name: 'Олександр',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
        rating: 4.9,
        tripsCount: 120,
        isVerified: true,
        isPro: false
      },
      vehicle: {
        make: activeVeh.make,
        model: activeVeh.model,
        year: activeVeh.year,
        color: activeVeh.color,
        primaryPhoto:
          activeVeh.photos[0]?.url ||
          'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1000&q=80',
        allPhotos: activeVeh.photos.map((p) => p.url)
      },
      totalSeats: activeVeh.seats,
      availableSeats,
      priceAmount,
      priceUnit: 'per_seat' as const,
      comfortTags: [
        activeVeh.features.airConditioning ? 'Кондиціонер' : null,
        activeVeh.features.luggageAllowed ? 'Місце для багажу' : null,
        activeVeh.features.childSeat ? 'Дитяче крісло' : null,
        'Не палимо'
      ].filter(Boolean) as string[],
      cancellationPolicy: 'Гнучка (до 24 год безкоштовно)' as const
    };

    onOfferCreated(offerData);
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
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#14243B]">Нова попутка</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              0% комісії
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 space-y-5">
        <div className="bg-gradient-to-r from-[#081B35] to-[#16845C] rounded-2xl p-5 text-white shadow-md space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-semibold text-emerald-300">
            <Car className="w-3.5 h-3.5" />
            <span>Спільний розподіл витрат на пальне</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold font-display">
            Створити попутку на {currentVehicle.make} {currentVehicle.model}
          </h1>
          <p className="text-xs text-slate-200">
            Платформа MARSHGO не бере жодної комісії з приватних попуток Community.
          </p>
        </div>

        {/* Vehicle Switcher Bar */}
        <div className="bg-white rounded-2xl border border-[#DFE7F1] p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4 text-[#1769F4]" />
              <h3 className="font-extrabold text-sm text-[#14243B]">
                Оберіть автомобіль для поїздки:
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsAddVehicleModalOpen(true)}
              className="text-xs font-bold text-[#1769F4] hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Додати авто</span>
            </button>
          </div>

          {/* Vehicle Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {allVehicles.map((veh) => {
              const isSelected = veh.id === selectedVehicleId;
              const primaryPhoto = veh.photos[0]?.url || 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=400&q=80';
              return (
                <div
                  key={veh.id}
                  onClick={() => handleSelectVehicle(veh)}
                  className={`p-3 rounded-xl border cursor-pointer transition relative flex flex-col justify-between ${
                    isSelected
                      ? 'border-[#1769F4] bg-blue-50/60 ring-2 ring-[#1769F4]/20 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <img
                      src={primaryPhoto}
                      alt={veh.model}
                      className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-[#14243B] truncate">
                        {veh.make} {veh.model}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {veh.year} р. · {veh.color}
                      </div>
                      <div className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded inline-block mt-0.5">
                        {veh.seats} місць
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#1769F4] text-white flex items-center justify-center shadow-xs">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#DFE7F1] p-5 sm:p-6 shadow-sm space-y-4">
          {/* Origin & Details */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-[#14243B] mb-1">Звідки (Місто та адреса виїзду):</label>
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="Місто відправлення"
                  className="w-full text-sm font-bold text-[#14243B] p-3 rounded-xl border border-slate-200 bg-[#F5F8FD] focus:bg-white focus:outline-none"
                  required
                />
                <input
                  type="text"
                  value={originAddress}
                  onChange={(e) => setOriginAddress(e.target.value)}
                  placeholder="Точка або район виїзду (наприклад: Центральний автовокзал)"
                  className="w-full text-xs text-slate-600 p-2.5 rounded-xl border border-slate-200 bg-[#F5F8FD] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#14243B] mb-1">Куди (Місто та адреса прибуття):</label>
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Місто призначення"
                  className="w-full text-sm font-bold text-[#14243B] p-3 rounded-xl border border-slate-200 bg-[#F5F8FD] focus:bg-white focus:outline-none"
                  required
                />
                <input
                  type="text"
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  placeholder="Точка висадки (наприклад: Метро Житомирська)"
                  className="w-full text-xs text-slate-600 p-2.5 rounded-xl border border-slate-200 bg-[#F5F8FD] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#14243B] mb-1">Проміжні міста (через кому):</label>
              <input
                type="text"
                value={intermediateStops}
                onChange={(e) => setIntermediateStops(e.target.value)}
                placeholder="Умань, Біла Церква"
                className="w-full text-xs text-slate-700 p-2.5 rounded-xl border border-slate-200 bg-[#F5F8FD] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-[#14243B] mb-1">Дата виїзду:</label>
              <input
                type="date"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                className="w-full text-xs font-bold text-[#14243B] p-2.5 rounded-xl border border-slate-200 bg-[#F5F8FD] focus:bg-white focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#14243B] mb-1">Час відправлення:</label>
              <input
                type="time"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                className="w-full text-xs font-bold text-[#14243B] p-2.5 rounded-xl border border-slate-200 bg-[#F5F8FD] focus:bg-white focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Seats & Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-[#14243B] mb-1">
                Вільних місць (макс. {currentVehicle.seats - 1}):
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 6].filter((s) => s <= currentVehicle.seats - 1).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setAvailableSeats(s)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                      availableSeats === s
                        ? 'bg-[#1769F4] text-white shadow-xs'
                        : 'bg-[#F5F8FD] text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#14243B] mb-1">Внесок за місце (грн):</label>
              <div className="relative">
                <input
                  type="number"
                  value={priceAmount}
                  onChange={(e) => setPriceAmount(Number(e.target.value))}
                  min={100}
                  max={2500}
                  step={20}
                  className="w-full text-base font-extrabold text-[#14243B] p-2.5 pr-12 rounded-xl border border-slate-200 bg-[#F5F8FD] focus:bg-white focus:outline-none"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  ₴ / місце
                </span>
              </div>
            </div>
          </div>

          {/* Fair Cost Calculation Info */}
          <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 text-xs text-emerald-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Справедливий розрахунок витрат MARSHGO</span>
            </div>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              Орієнтовна компенсація пального на відстань 475 км: ~{availableSeats * priceAmount} грн за {availableSeats} місць.
              Це повністю покриває витрати на бензин/дизель або зарядку авто без комерційної націнки.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-[#1769F4] hover:bg-[#1358CE] text-white font-bold text-sm shadow-md shadow-[#1769F4]/20 transition flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Опублікувати поїздку на {currentVehicle.make}</span>
          </button>
        </form>
      </div>

      {/* Add Vehicle Modal */}
      <AddVehicleModal
        isOpen={isAddVehicleModalOpen}
        onClose={() => setIsAddVehicleModalOpen(false)}
        onAddVehicle={handleCreatedVehicle}
      />
    </div>
  );
};
