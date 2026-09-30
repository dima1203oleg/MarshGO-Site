import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  ShieldCheck,
  Car,
  Settings,
  HelpCircle,
  FileText,
  RotateCcw,
  CheckCircle2,
  Lock,
  ArrowRight,
  Sparkles,
  Camera,
  Ban,
  Plus,
  Trash2,
  Check,
  PieChart,
  X
} from 'lucide-react';
import { User, Vehicle, Booking } from '../types';
import { UserAvatar } from '../components/UserAvatar';
import { AvatarGeneratorModal } from '../components/AvatarGeneratorModal';
import { ThemeToggle } from '../components/ThemeToggle';
import { DriverTrustBar } from '../components/DriverTrustBar';
import { BlacklistModal } from '../components/BlacklistModal';
import { AddVehicleModal } from '../components/AddVehicleModal';
import { ExpenseStatistics } from '../components/ExpenseStatistics';
import { getBlacklist, subscribeToBlacklistChanges } from '../services/blacklist';

interface ProfileViewProps {
  user: User;
  vehicle: Vehicle;
  vehicles?: Vehicle[];
  activeVehicleId?: string;
  bookings?: Booking[];
  onRoleSwitch: (role: 'passenger' | 'driver') => void;
  onNavigate: (view: string) => void;
  onResetData: () => void;
  onUpdateAvatar?: (avatarDataUri: string) => void;
  onStartTour?: () => void;
  onSetActiveVehicle?: (id: string) => void;
  onAddVehicle?: (newVeh: Omit<Vehicle, 'id'> & { id?: string }) => void;
  onDeleteVehicle?: (id: string) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  vehicle,
  vehicles = [],
  activeVehicleId,
  bookings = [],
  onRoleSwitch,
  onNavigate,
  onResetData,
  onUpdateAvatar,
  onStartTour,
  onSetActiveVehicle,
  onAddVehicle,
  onDeleteVehicle
}) => {
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isBlacklistModalOpen, setIsBlacklistModalOpen] = useState(false);
  const [isAddVehicleModalOpen, setIsAddVehicleModalOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [blacklistCount, setBlacklistCount] = useState(() => getBlacklist().length);
  const isDriver = user.activeRole === 'driver';

  const allVehicles = vehicles.length > 0 ? vehicles : [vehicle];
  const currentActiveId = activeVehicleId || vehicle?.id || allVehicles[0]?.id;

  useEffect(() => {
    return subscribeToBlacklistChanges((list) => {
      setBlacklistCount(list.length);
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F8FD] pb-24 md:pb-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl border border-[#DFE7F1] p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative group cursor-pointer" onClick={() => setIsAvatarModalOpen(true)}>
                <UserAvatar
                  src={user.avatar}
                  name={user.name}
                  size="xl"
                  className="border-2 border-[#1769F4] shadow-sm group-hover:opacity-90 transition"
                />
                <button
                  type="button"
                  title="Змінити або згенерувати аватар"
                  className="absolute bottom-0 right-0 p-1.5 bg-[#1769F4] text-white rounded-full shadow-md group-hover:scale-110 transition active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-bold text-[#14243B]">{user.name}</h1>
                  <span title="Верифікований профіль">
                    <ShieldCheck className="w-4 h-4 text-[#16845C]" />
                  </span>
                </div>
                <p className="text-xs text-[#62718A]">{user.phone} · {user.email}</p>
                <div className="flex items-center gap-2 mt-2 text-xs">
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                    Документи перевірено
                  </span>
                  <span className="text-amber-500 font-bold">★ {user.rating.toFixed(1)}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-600">{user.tripsCount} поїздок</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAvatarModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#1769F4] border border-blue-200 font-bold text-xs transition active:scale-95 shadow-xs"
            >
              <Sparkles className="w-4 h-4" />
              <span>Згенерувати унікальний аватар</span>
            </button>
          </div>

          {/* Quick Role Switcher */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-[#14243B]">Активний режим програми:</span>
            <div className="flex items-center p-1 bg-[#F5F8FD] rounded-xl border border-slate-200 text-xs">
              <button
                onClick={() => onRoleSwitch('passenger')}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  !isDriver ? 'bg-[#1769F4] text-white shadow-sm' : 'text-slate-600'
                }`}
              >
                Пасажир
              </button>
              <button
                onClick={() => onRoleSwitch('driver')}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  isDriver ? 'bg-[#1769F4] text-white shadow-sm' : 'text-slate-600'
                }`}
              >
                Водій
              </button>
            </div>
          </div>

          {/* Theme Mode Selector (Night Visibility) */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-xs font-bold text-[#14243B] block">Тема оформлення (Нічний режим)</span>
              <span className="text-[11px] text-[#62718A]">Краща видимість та комфорт для очей під час нічних поїздок</span>
            </div>
            <ThemeToggle variant="segmented" />
          </div>
        </div>

        {/* Quick Driver Section if driver */}
        {isDriver && (
          <>
            <DriverTrustBar
              rating={user.rating}
              tripsCount={user.tripsCount}
              punctualityPercent={98}
              verifiedDocuments={true}
            />

            {/* Driver Garage Section */}
            <div className="bg-white rounded-2xl border border-[#DFE7F1] p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1769F4] flex items-center justify-center">
                    <Car className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base text-[#14243B] flex items-center gap-2">
                      <span>Гараж автомобілів</span>
                      <span className="text-xs font-black bg-blue-100 text-[#1769F4] px-2 py-0.5 rounded-full">
                        {allVehicles.length}
                      </span>
                    </h3>
                    <p className="text-[11px] text-[#62718A]">
                      Обирайте активне авто або додавайте нові для швидкого перемикання
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddVehicleModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-[#1769F4] hover:bg-[#1358CE] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Додати авто</span>
                </button>
              </div>

              {/* Vehicle list */}
              <div className="space-y-2.5">
                {allVehicles.map((veh) => {
                  const isActive = veh.id === currentActiveId;
                  const primaryPhoto =
                    veh.photos[0]?.url ||
                    'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=400&q=80';

                  return (
                    <div
                      key={veh.id}
                      className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isActive
                          ? 'border-[#1769F4] bg-blue-50/50 shadow-xs ring-1 ring-[#1769F4]/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={primaryPhoto}
                          alt={veh.model}
                          className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-[#14243B]">
                              {veh.make} {veh.model}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">({veh.year})</span>
                            {isActive && (
                              <span className="text-[10px] font-extrabold bg-[#1769F4] text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                                <span>Основне авто</span>
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                            <span>Колір: <strong className="text-slate-700">{veh.color}</strong></span>
                            <span>·</span>
                            <span>Місць: <strong className="text-slate-700">{veh.seats}</strong></span>
                            <span>·</span>
                            <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                              {veh.licensePlateMasked}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {!isActive && onSetActiveVehicle && (
                          <button
                            type="button"
                            onClick={() => onSetActiveVehicle(veh.id)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-300 hover:border-[#1769F4] text-slate-700 hover:text-[#1769F4] bg-white transition"
                          >
                            Зробити основним
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            if (onSetActiveVehicle && !isActive) {
                              onSetActiveVehicle(veh.id);
                            }
                            onNavigate('driver-vehicle');
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-[#1769F4] hover:bg-blue-50 transition"
                        >
                          Фото та дані
                        </button>

                        {allVehicles.length > 1 && onDeleteVehicle && (
                          <button
                            type="button"
                            onClick={() => onDeleteVehicle(veh.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                            title="Видалити авто з гаража"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Expense Statistics Section */}
        <ExpenseStatistics bookings={bookings} />

        {/* Menu list */}
        <div className="bg-white rounded-2xl border border-[#DFE7F1] divide-y divide-slate-100 shadow-sm overflow-hidden text-xs">
          {/* Blacklist item */}
          <button
            onClick={() => setIsBlacklistModalOpen(true)}
            className="w-full p-4 text-left flex items-center justify-between hover:bg-slate-50 transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
                <Ban className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#14243B] text-xs sm:text-sm">Чорний список</span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    {blacklistCount} {blacklistCount === 1 ? 'заблокований' : 'заблокованих'}
                  </span>
                </div>
                <span className="text-[11px] text-[#62718A]">
                  Ігнорувати пропозиції від небажаних водіїв або пасажирів
                </span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </button>

          <button
            onClick={() => onNavigate('admin')}
            className="w-full p-4 text-left flex items-center justify-between hover:bg-slate-50 transition"
          >
            <div className="flex items-center gap-3">
              <Lock className="w-4 h-4 text-slate-500" />
              <span className="font-bold text-[#14243B]">Операційна адмін-панель (Модерація & Режими)</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </button>

          <button
            onClick={() => setIsRulesModalOpen(true)}
            className="w-full p-4 text-left flex items-center justify-between hover:bg-slate-50 transition"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-slate-500" />
              <span className="font-bold text-[#14243B]">Правила Community та юридична безпека</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </button>

          {onStartTour && (
            <button
              onClick={onStartTour}
              className="w-full p-4 text-left flex items-center justify-between hover:bg-slate-50 transition border-b border-slate-100"
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="w-4 h-4 text-[#1769F4]" />
                <div>
                  <span className="font-bold text-[#14243B] text-xs sm:text-sm block">Онбординг-тур по сервісу</span>
                  <span className="text-[11px] text-slate-500">Повторити підказки: пошук, створення запитів та маршрутів</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>
          )}

          <button
            onClick={onResetData}
            className="w-full p-4 text-left flex items-center justify-between hover:bg-slate-50 transition text-red-600"
          >
            <div className="flex items-center gap-3">
              <RotateCcw className="w-4 h-4" />
              <span className="font-bold">Скинути демонстраційні дані до початкових</span>
            </div>
            <span className="text-[11px] text-slate-400">Reset State</span>
          </button>
        </div>
      </div>

      {/* Avatar Generator Modal */}
      <AvatarGeneratorModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        currentAvatar={user.avatar}
        userName={user.name}
        onSaveAvatar={(newAvatarUri) => {
          if (onUpdateAvatar) {
            onUpdateAvatar(newAvatarUri);
          }
        }}
      />

      {/* Blacklist Modal */}
      <BlacklistModal
        isOpen={isBlacklistModalOpen}
        onClose={() => setIsBlacklistModalOpen(false)}
        onBlacklistUpdated={() => setBlacklistCount(getBlacklist().length)}
      />

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

      {/* Rules & Legal Safety Modal */}
      {isRulesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-[#0D1E36] w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-700 to-indigo-800 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">Правила спільноти MARSHGO</h3>
                  <p className="text-xs text-blue-200">Юридичні принципи та чесний Carpool</p>
                </div>
              </div>
              <button
                onClick={() => setIsRulesModalOpen(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs text-slate-700 dark:text-slate-300 overflow-y-auto">
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <strong className="text-emerald-900 dark:text-emerald-200 block mb-1">
                  1. 0% платформної комісії для попуток (Cost Sharing)
                </strong>
                <p>
                  Сервіс не бере комісії з водія та пасажирів за некомерційні спільні поїздки. Сума компенсації розраховується суто для покриття пального та рідин.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                <strong className="text-[#14243B] dark:text-white block mb-1">
                  2. Відповідальність та ліцензування
                </strong>
                <p>
                  Комерційні перевезення (таксі, автобуси) вимагають ліцензії та позначені спеціальним бейджем PRO з прозорою фіскалізацією.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800">
                <strong className="text-purple-900 dark:text-purple-200 block mb-1">
                  3. Верифікація та безпека пасажирів
                </strong>
                <p>
                  Усі водії проходять верифікацію документів. Усі пасажири застраховані полісом обовʼязкового страхування на час перебування в авто.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setIsRulesModalOpen(false)}
                className="px-5 py-2 bg-[#1769F4] text-white rounded-xl font-bold text-xs hover:bg-[#1358CE] transition"
              >
                Зрозуміло
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
