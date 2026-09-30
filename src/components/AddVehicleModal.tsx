import React, { useState } from 'react';
import {
  Car,
  X,
  Plus,
  AlertCircle
} from 'lucide-react';
import { Vehicle } from '../types';

interface AddVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddVehicle: (newVehicle: Omit<Vehicle, 'id'> & { id?: string }) => void;
}

const PRESET_VEHICLES = [
  {
    make: 'Volkswagen',
    model: 'Passat B8',
    year: 2021,
    color: 'Сірий графіт',
    bodyType: 'sedan' as const,
    seats: 4,
    photoUrl: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=1000&q=80'
  },
  {
    make: 'Renault',
    model: 'Trafic Grand',
    year: 2022,
    color: 'Білий',
    bodyType: 'minivan' as const,
    seats: 8,
    photoUrl: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1000&q=80'
  },
  {
    make: 'Skoda',
    model: 'Octavia A7',
    year: 2020,
    color: 'Синій металік',
    bodyType: 'station_wagon' as const,
    seats: 4,
    photoUrl: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1000&q=80'
  },
  {
    make: 'Hyundai',
    model: 'Tucson',
    year: 2023,
    color: 'Темно-сірий',
    bodyType: 'suv' as const,
    seats: 4,
    photoUrl: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=1000&q=80'
  }
];

export const AddVehicleModal: React.FC<AddVehicleModalProps> = ({
  isOpen,
  onClose,
  onAddVehicle
}) => {
  const [make, setMake] = useState('Volkswagen');
  const [model, setModel] = useState('Passat B8');
  const [year, setYear] = useState<number>(2021);
  const [color, setColor] = useState('Сірий графіт');
  const [bodyType, setBodyType] = useState<Vehicle['bodyType']>('sedan');
  const [seats, setSeats] = useState<number>(4);
  const [licensePlateFull, setLicensePlateFull] = useState('AA 7788 XX');
  const [photoUrl, setPhotoUrl] = useState(
    'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=1000&q=80'
  );

  // Features
  const [airConditioning, setAirConditioning] = useState(true);
  const [phoneCharging, setPhoneCharging] = useState(true);
  const [luggageAllowed, setLuggageAllowed] = useState(true);
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [childSeat, setChildSeat] = useState(true);

  const [formError, setFormError] = useState('');

  if (!isOpen) return null;

  const handleSelectPreset = (preset: typeof PRESET_VEHICLES[0]) => {
    setMake(preset.make);
    setModel(preset.model);
    setYear(preset.year);
    setColor(preset.color);
    setBodyType(preset.bodyType);
    setSeats(preset.seats);
    setPhotoUrl(preset.photoUrl);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!make.trim() || !model.trim()) {
      setFormError('Вкажіть марку та модель автомобіля');
      return;
    }
    if (seats < 1 || seats > 9) {
      setFormError('Кількість пасажирських місць має бути від 1 до 9');
      return;
    }

    const cleanPlate = licensePlateFull.trim().toUpperCase() || 'AA 1234 AA';
    // Generate masked plate e.g. "AA •••• AA"
    const parts = cleanPlate.split(' ');
    const licensePlateMasked =
      parts.length >= 2 ? `${parts[0]} •••• ${parts[parts.length - 1]}` : `${cleanPlate.slice(0, 2)} •••• ${cleanPlate.slice(-2)}`;

    onAddVehicle({
      driverId: 'usr_drv_alex',
      make: make.trim(),
      model: model.trim(),
      year: Number(year) || 2021,
      color: color.trim() || 'Чорний',
      bodyType,
      seats: Number(seats),
      licensePlateMasked,
      licensePlateFull: cleanPlate,
      photos: [
        {
          id: `ph_${Date.now()}`,
          url:
            photoUrl.trim() ||
            'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=1000&q=80',
          isPrimary: true,
          caption: `${make} ${model} (${color})`
        }
      ],
      features: {
        airConditioning,
        phoneCharging,
        luggageAllowed,
        petsAllowed,
        childSeat,
        smokingAllowed: false
      }
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-white dark:bg-[#0D1E36] w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-[#1769F4] dark:text-sky-400 flex items-center justify-center shrink-0">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#14243B] dark:text-white">
                Додати новий автомобіль
              </h2>
              <p className="text-xs text-[#62718A] dark:text-slate-400">
                Зареєструйте авто в гаражі для швидкого вибору під час публікації поїздок
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            aria-label="Закрити"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-red-100 text-red-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Quick presets */}
          <div>
            <label className="block text-xs font-extrabold text-[#14243B] dark:text-slate-200 mb-1.5">
              Швидкий вибір популярного авто:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
              {PRESET_VEHICLES.map((preset) => (
                <button
                  key={`${preset.make}_${preset.model}`}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`p-2 rounded-xl border text-left transition ${
                    make === preset.make && model === preset.model
                      ? 'border-[#1769F4] bg-blue-50 dark:bg-blue-950/60 ring-2 ring-blue-200 dark:ring-blue-900 font-bold text-[#1769F4] dark:text-sky-300'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="font-bold truncate">{preset.make}</div>
                  <div className="text-[11px] text-slate-500 truncate">{preset.model}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Make & Model */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-extrabold text-[#14243B] dark:text-slate-200 mb-1">
                Марка авто *
              </label>
              <input
                type="text"
                required
                value={make}
                onChange={(e) => setMake(e.target.value)}
                placeholder="Наприклад: Toyota, Renault, Mercedes"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0A1A30] border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#1769F4] text-[#14243B] dark:text-white font-semibold"
              />
            </div>

            <div>
              <label className="block font-extrabold text-[#14243B] dark:text-slate-200 mb-1">
                Модель авто *
              </label>
              <input
                type="text"
                required
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Наприклад: Camry, Megane, Vito"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0A1A30] border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#1769F4] text-[#14243B] dark:text-white font-semibold"
              />
            </div>
          </div>

          {/* Year & Color */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-extrabold text-[#14243B] dark:text-slate-200 mb-1">
                Рік випуску
              </label>
              <input
                type="number"
                min="1995"
                max="2026"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0A1A30] border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#1769F4] text-[#14243B] dark:text-white font-semibold"
              />
            </div>

            <div>
              <label className="block font-extrabold text-[#14243B] dark:text-slate-200 mb-1">
                Колір кузова
              </label>
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="Сріблястий"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0A1A30] border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#1769F4] text-[#14243B] dark:text-white font-semibold"
              />
            </div>

            <div>
              <label className="block font-extrabold text-[#14243B] dark:text-slate-200 mb-1">
                Пасажирських місць *
              </label>
              <select
                value={seats}
                onChange={(e) => setSeats(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0A1A30] border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#1769F4] text-[#14243B] dark:text-white font-bold"
              >
                <option value={1}>1 місце</option>
                <option value={2}>2 місця</option>
                <option value={3}>3 місця</option>
                <option value={4}>4 місця (Стандарт)</option>
                <option value={6}>6 місць (Мінівен)</option>
                <option value={7}>7 місць (Мінівен 7+1)</option>
                <option value={8}>8 місць (Мікроавтобус)</option>
              </select>
            </div>
          </div>

          {/* Body Type Selector */}
          <div>
            <label className="block text-xs font-extrabold text-[#14243B] dark:text-slate-200 mb-1">
              Тип кузова:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-xs">
              {[
                { id: 'sedan', label: 'Седан' },
                { id: 'suv', label: 'Кросовер / SUV' },
                { id: 'minivan', label: 'Мінівен' },
                { id: 'station_wagon', label: 'Універсал' },
                { id: 'hatchback', label: 'Хетчбек' }
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setBodyType(t.id as any)}
                  className={`p-2 rounded-xl border text-center transition font-semibold ${
                    bodyType === t.id
                      ? 'bg-[#1769F4] text-white border-[#1769F4] shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* License Plate & Photo URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-extrabold text-[#14243B] dark:text-slate-200 mb-1">
                Номерний знак авто
              </label>
              <input
                type="text"
                value={licensePlateFull}
                onChange={(e) => setLicensePlateFull(e.target.value.toUpperCase())}
                placeholder="AA 1234 BB"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0A1A30] border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#1769F4] text-[#14243B] dark:text-white font-mono font-bold uppercase"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Буде приховано для захисту приватності до бронювання
              </span>
            </div>

            <div>
              <label className="block font-extrabold text-[#14243B] dark:text-slate-200 mb-1">
                Фотографія автомобіля (URL)
              </label>
              <input
                type="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0A1A30] border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#1769F4] text-[#14243B] dark:text-white font-mono text-[11px]"
              />
            </div>
          </div>

          {/* Photo Preview */}
          {photoUrl && (
            <div className="relative rounded-xl overflow-hidden aspect-video max-h-36 bg-slate-100 border border-slate-200">
              <img
                src={photoUrl}
                alt="Попередній перегляд авто"
                className="w-full h-full object-cover"
                onError={() => {}}
              />
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-bold">
                {make} {model} ({color})
              </div>
            </div>
          )}

          {/* Features Checkboxes */}
          <div>
            <label className="block text-xs font-extrabold text-[#14243B] dark:text-slate-200 mb-1.5">
              Зручності та умови в салоні:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={airConditioning}
                  onChange={(e) => setAirConditioning(e.target.checked)}
                  className="rounded text-[#1769F4] focus:ring-0"
                />
                <span className="text-slate-700 dark:text-slate-300 font-semibold">Кондиціонер / Клімат</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={phoneCharging}
                  onChange={(e) => setPhoneCharging(e.target.checked)}
                  className="rounded text-[#1769F4] focus:ring-0"
                />
                <span className="text-slate-700 dark:text-slate-300 font-semibold">Зарядка (Type-C / Lightning)</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={luggageAllowed}
                  onChange={(e) => setLuggageAllowed(e.target.checked)}
                  className="rounded text-[#1769F4] focus:ring-0"
                />
                <span className="text-slate-700 dark:text-slate-300 font-semibold">Місце для багажу</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={childSeat}
                  onChange={(e) => setChildSeat(e.target.checked)}
                  className="rounded text-[#1769F4] focus:ring-0"
                />
                <span className="text-slate-700 dark:text-slate-300 font-semibold">Дитяче крісло / Бустер</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={petsAllowed}
                  onChange={(e) => setPetsAllowed(e.target.checked)}
                  className="rounded text-[#1769F4] focus:ring-0"
                />
                <span className="text-slate-700 dark:text-slate-300 font-semibold">Можна з тваринами</span>
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Скасувати
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold bg-[#1769F4] hover:bg-[#1358CE] text-white shadow-md active:scale-95 transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Зберегти авто в гараж</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
