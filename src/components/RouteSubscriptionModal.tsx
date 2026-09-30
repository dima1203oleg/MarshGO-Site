import React, { useState } from 'react';
import {
  X,
  Bell,
  BellRing,
  CheckCircle2,
  Calendar,
  MapPin,
  DollarSign,
  Send,
  MessageSquare,
  Mail,
  Smartphone,
  Trash2,
  ShieldCheck
} from 'lucide-react';

export interface RouteSubscription {
  id: string;
  origin: string;
  destination: string;
  date: string;
  maxPrice?: number;
  channels: ('push' | 'telegram' | 'sms' | 'email')[];
  contactInfo: string;
  categories: string[];
  createdAt: string;
}

interface RouteSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchParams: {
    origin: string;
    destination: string;
    date: string;
    passengers: number;
  };
  existingSubscription?: RouteSubscription | null;
  onSaveSubscription: (subscription: RouteSubscription) => void;
  onDeleteSubscription?: (id: string) => void;
}

export const RouteSubscriptionModal: React.FC<RouteSubscriptionModalProps> = ({
  isOpen,
  onClose,
  searchParams,
  existingSubscription,
  onSaveSubscription,
  onDeleteSubscription
}) => {
  const [maxPrice, setMaxPrice] = useState<number>(existingSubscription?.maxPrice || 1200);
  const [enablePriceFilter, setEnablePriceFilter] = useState<boolean>(!!existingSubscription?.maxPrice);
  const [channels, setChannels] = useState<('push' | 'telegram' | 'sms' | 'email')[]>(
    existingSubscription?.channels || ['push', 'telegram']
  );
  const [contactInfo, setContactInfo] = useState<string>(
    existingSubscription?.contactInfo || '+380 97 123 4567'
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    existingSubscription?.categories || ['community', 'taxi_pro', 'bus']
  );
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const toggleChannel = (channel: 'push' | 'telegram' | 'sms' | 'email') => {
    setChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (channels.length === 0) return;

    const sub: RouteSubscription = {
      id: existingSubscription?.id || `sub_${Date.now()}`,
      origin: searchParams.origin || 'Будь-звідки',
      destination: searchParams.destination || 'Будь-куди',
      date: searchParams.date || new Date().toISOString().split('T')[0],
      maxPrice: enablePriceFilter ? maxPrice : undefined,
      channels,
      contactInfo,
      categories: selectedCategories,
      createdAt: existingSubscription?.createdAt || new Date().toISOString()
    };

    onSaveSubscription(sub);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 1500);
  };

  const handleDelete = () => {
    if (existingSubscription && onDeleteSubscription) {
      onDeleteSubscription(existingSubscription.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-[#F5F8FD]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-100 text-[#1769F4]">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#14243B]">
                {existingSubscription ? 'Налаштування підписки' : 'Підписка на оновлення маршруту'}
              </h3>
              <p className="text-xs text-[#62718A]">
                Отримуйте сповіщення, щойно водій опублікує новий рейс
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {isSuccess ? (
          <div className="p-8 text-center space-y-4 my-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div>
              <h4 className="text-lg font-black text-[#14243B]">Підписку успішно активовано!</h4>
              <p className="text-xs text-[#62718A] max-w-xs mx-auto mt-1">
                Ми повідомимо вас про будь-які нові пропозиції за маршрутом{' '}
                <strong>{searchParams.origin} → {searchParams.destination}</strong>
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
            {/* Route Summary Badge */}
            <div className="bg-[#EFF6FF] border border-blue-200 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold text-[#1769F4] uppercase tracking-wider">
                  Обраний напрямок:
                </span>
                <div className="text-sm font-extrabold text-[#14243B] flex items-center gap-2">
                  <span>{searchParams.origin || 'Звідки'}</span>
                  <span className="text-slate-400">→</span>
                  <span className="text-[#1769F4]">{searchParams.destination || 'Куди'}</span>
                </div>
                <div className="text-xs text-[#62718A] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Дата: {searchParams.date || 'Сьогодні'}</span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Автопошук 24/7
                </span>
              </div>
            </div>

            {/* Channels Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#14243B] block">
                Куди надсилати сповіщення:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'push', label: 'Push-сповіщення', icon: <Bell className="w-4 h-4 text-[#1769F4]" />, desc: 'У браузері миттєво' },
                  { id: 'telegram', label: 'Telegram Бот', icon: <Send className="w-4 h-4 text-sky-500" />, desc: '@MarshGoBot' },
                  { id: 'sms', label: 'SMS сповіщення', icon: <Smartphone className="w-4 h-4 text-emerald-600" />, desc: 'На мобільний номер' },
                  { id: 'email', label: 'Email лист', icon: <Mail className="w-4 h-4 text-purple-600" />, desc: 'Детальний звіт' }
                ].map((ch) => {
                  const isChecked = channels.includes(ch.id as any);
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => toggleChannel(ch.id as any)}
                      className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition ${
                        isChecked
                          ? 'border-[#1769F4] bg-blue-50/60 ring-2 ring-[#1769F4]/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="p-1.5 rounded-lg bg-white shadow-xs shrink-0">{ch.icon}</div>
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-[#14243B]">{ch.label}</div>
                        <div className="text-[10px] text-slate-500">{ch.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Contact Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#14243B] block">
                Контактні дані для зв'язку:
              </label>
              <input
                type="text"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="+380... або email/нікнейм"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-[#14243B] font-medium focus:outline-none focus:border-[#1769F4] bg-slate-50 focus:bg-white transition"
              />
            </div>

            {/* Price Limit Filter */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#14243B] flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enablePriceFilter}
                    onChange={(e) => setEnablePriceFilter(e.target.checked)}
                    className="w-4 h-4 rounded text-[#1769F4] focus:ring-[#1769F4] accent-[#1769F4]"
                  />
                  <span>Сповіщати лише якщо ціна не перевищує ліміт</span>
                </label>
                {enablePriceFilter && (
                  <span className="text-xs font-extrabold text-[#1769F4]">{maxPrice} грн</span>
                )}
              </div>

              {enablePriceFilter && (
                <div className="space-y-2 pl-5">
                  <input
                    type="range"
                    min={300}
                    max={2500}
                    step={50}
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1769F4]"
                  />
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>від 300 грн</span>
                    <span>до 2500 грн</span>
                  </div>
                </div>
              )}
            </div>

            {/* Transport Types */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <label className="text-xs font-bold text-[#14243B] block">
                Бажані типи транспорту:
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { id: 'community', label: 'Попутка (0%)' },
                  { id: 'bus', label: 'Автобус' },
                  { id: 'taxi_pro', label: 'Таксі та PRO' },
                  { id: 'transfer', label: 'Трансфер' }
                ].map((cat) => {
                  const isCatSelected = selectedCategories.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        isCatSelected
                          ? 'bg-[#1769F4] text-white border-[#1769F4]'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions Footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              {existingSubscription && onDeleteSubscription ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3.5 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Скасувати підписку</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 transition"
                >
                  Скасувати
                </button>
              )}

              <button
                type="submit"
                disabled={channels.length === 0}
                className="px-6 py-2.5 rounded-xl bg-[#1769F4] hover:bg-[#1358CE] text-white font-bold text-xs shadow-md shadow-[#1769F4]/20 transition flex items-center gap-2 disabled:opacity-50"
              >
                <Bell className="w-4 h-4" />
                <span>{existingSubscription ? 'Зберегти зміни' : 'Підтвердити підписку'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
