import React, { useState } from 'react';
import {
  ArrowLeft,
  Car,

  Trash2,

  Plus,

  } from 'lucide-react';
import { Vehicle } from '../types';
import { AddVehicleModal } from '../components/AddVehicleModal';

interface DriverVehicleViewProps {
  vehicle: Vehicle;
  vehicles?: Vehicle[];
  activeVehicleId?: string;
  onBack: () => void;
  onUpdateVehicle: (updated: Partial<Vehicle>) => void;
  onAddPhoto: (url: string, caption?: string) => void;
  onRemovePhoto: (photoId: string) => void;
  onSetPrimaryPhoto: (photoId: string) => void;
  onSetActiveVehicle?: (id: string) => void;
  onAddVehicle?: (newVeh: Omit<Vehicle, 'id'> & { id?: string }) => void;
}

export const DriverVehicleView: React.FC<DriverVehicleViewProps> = ({
  vehicle,
  vehicles = [],
  activeVehicleId,
  onBack,
  onUpdateVehicle,
  onAddPhoto,
  onRemovePhoto,
  onSetPrimaryPhoto,
  onSetActiveVehicle,
  onAddVehicle
}) => {
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isAddVehicleModalOpen, setIsAddVehicleModalOpen] = useState(false);

  const allVehicles = vehicles.length > 0 ? vehicles : [vehicle];
  const currentActiveId = activeVehicleId || vehicle.id;

  const samplePhotoUrls = [
    { label: `Вид спереду (${vehicle.model})`, url: vehicle.photos[0]?.url || 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1000&q=80' },
    { label: 'Салон авто', url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1000&q=80' },
    { label: 'Задня оптика', url: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=1000&q=80' },
    { label: 'Місткий багажник', url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1000&q=80' }
  ];

  const handleAddSample = (sample: { label: string; url: string }) => {
    onAddPhoto(sample.url, sample.label);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

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
            <span>Назад до кабінету</span>
          </button>
          <span className="text-xs font-bold text-[#14243B]">Мій автомобіль</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Vehicles Switcher Tabs */}
        <div className="bg-white rounded-2xl border border-[#DFE7F1] p-3 shadow-sm flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
            <span className="text-xs font-bold text-slate-500 mr-1 shrink-0">Автомобіль:</span>
            {allVehicles.map((veh) => {
              const isSelected = veh.id === vehicle.id;
              return (
                <button
                  key={veh.id}
                  type="button"
                  onClick={() => {
                    if (onSetActiveVehicle) onSetActiveVehicle(veh.id);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                    isSelected
                      ? 'bg-[#1769F4] text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <Car className="w-3.5 h-3.5" />
                  <span>{veh.make} {veh.model}</span>
                  {veh.id === currentActiveId && (
                    <span className="text-[9px] bg-white/20 px-1 rounded ml-1">Основне</span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setIsAddVehicleModalOpen(true)}
            className="text-xs font-bold text-[#1769F4] hover:underline flex items-center gap-1 shrink-0 px-2"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Додати авто</span>
          </button>
        </div>

        {/* Photos Management */}
        <div className="bg-white rounded-2xl border border-[#DFE7F1] p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-[#14243B]">
                Справжні фотографії автомобіля ({vehicle.photos.length}/8)
              </h2>
              <p className="text-xs text-[#62718A]">
                Пасажири обирають водіїв з реальними фотографіями авто у 4 рази частіше.
              </p>
            </div>
            {saveSuccess && (
              <span className="text-xs font-bold text-[#16845C] bg-emerald-50 px-2.5 py-1 rounded-full animate-fadeIn">
                Оновлено!
              </span>
            )}
          </div>

          {/* Grid of uploaded photos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {vehicle.photos.map((photo) => (
              <div
                key={photo.id}
                className="relative group rounded-xl overflow-hidden bg-slate-100 border border-slate-200 aspect-video sm:aspect-square"
              >
                <img
                  src={photo.url}
                  alt={photo.caption || ''}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />

                {/* Primary Badge */}
                {photo.isPrimary ? (
                  <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded text-[10px] font-extrabold bg-[#1769F4] text-white shadow">
                    Головне
                  </span>
                ) : (
                  <button
                    onClick={() => onSetPrimaryPhoto(photo.id)}
                    className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-black/60 text-white opacity-0 group-hover:opacity-100 transition"
                  >
                    Зробити головним
                  </button>
                )}

                {/* Delete button */}
                <button
                  onClick={() => onRemovePhoto(photo.id)}
                  className="absolute bottom-1.5 right-1.5 p-1 rounded-full bg-red-600/90 text-white hover:bg-red-700 opacity-0 group-hover:opacity-100 transition shadow"
                  aria-label="Видалити фото"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Add Sample Verified Photo Preset */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <span className="text-xs font-bold text-slate-700">Швидке додавання ракурсів для {vehicle.model}:</span>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {samplePhotoUrls.map((sample, i) => (
                <button
                  key={i}
                  onClick={() => handleAddSample(sample)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-[#1769F4] transition shrink-0 flex items-center gap-1.5"
                >
                  <Plus className="w-3 h-3 text-[#1769F4]" />
                  <span>{sample.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Vehicle Specs & Privacy */}
        <div className="bg-white rounded-2xl border border-[#DFE7F1] p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-base text-[#14243B]">Дані автомобіля</h3>
            <span className="text-xs text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
              Документи перевірено
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-500 font-medium mb-1">Марка та модель:</label>
              <input
                type="text"
                value={`${vehicle.make} ${vehicle.model}`}
                disabled
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-[#14243B]"
              />
            </div>
            <div>
              <label className="block text-slate-500 font-medium mb-1">Рік випуску:</label>
              <input
                type="number"
                value={vehicle.year}
                onChange={(e) => onUpdateVehicle({ year: Number(e.target.value) })}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-[#F5F8FD] font-bold text-[#14243B]"
              />
            </div>
            <div>
              <label className="block text-slate-500 font-medium mb-1">Колір кузова:</label>
              <input
                type="text"
                value={vehicle.color}
                onChange={(e) => onUpdateVehicle({ color: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-[#F5F8FD] font-bold text-[#14243B]"
              />
            </div>
            <div>
              <label className="block text-slate-500 font-medium mb-1">
                Номерний знак (прихований публічно):
              </label>
              <input
                type="text"
                value={vehicle.licensePlateFull || 'AA 1234 AA'}
                onChange={(e) => onUpdateVehicle({ licensePlateFull: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-[#F5F8FD] font-bold text-[#14243B]"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Публічно видно як: {vehicle.licensePlateMasked} (для захисту приватності)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Vehicle Modal */}
      <AddVehicleModal
        isOpen={isAddVehicleModalOpen}
        onClose={() => setIsAddVehicleModalOpen(false)}
        onAddVehicle={(newVeh) => {
          if (onAddVehicle) {
            onAddVehicle(newVeh);
          }
        }}
      />
    </div>
  );
};
