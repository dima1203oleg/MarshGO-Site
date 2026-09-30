import React, { useState } from 'react';
import {
  ShieldCheck,
  X,
  Share2,
  PhoneCall,
  AlertTriangle,
  Lock,
  CheckCircle2,
  Copy,
  Check,
  Send,
  UserCheck,
  HeartHandshake
} from 'lucide-react';

interface SafetyTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripDetails?: {
    id?: string;
    origin?: string;
    destination?: string;
    driverName?: string;
    vehicleName?: string;
    licensePlateMasked?: string;
    departureTime?: string;
  };
}

export const SafetyTripModal: React.FC<SafetyTripModalProps> = ({
  isOpen,
  onClose,
  tripDetails
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const tripUrl = `https://marshgo.ua/track/${tripDetails?.id || 'live_7721'}`;
  const shareText = `Я вирушаю в поїздку MARSHGO: ${tripDetails?.origin || 'Одеса'} ➔ ${tripDetails?.destination || 'Київ'}. Водій: ${tripDetails?.driverName || 'Олександр'} (${tripDetails?.vehicleName || 'Toyota Camry'}). Відстежуй мою поїздку наживо: ${tripUrl}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareViber = () => {
    window.open(`viber://forward?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const handleShareTelegram = () => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(tripUrl)}&text=${encodeURIComponent(shareText)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-white dark:bg-[#0D1E36] w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-700 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold">
                Центр безпеки та захисту MARSHGO
              </h2>
              <p className="text-xs text-emerald-100">
                Ваша безпека, спокій близьких та верифіковані стандарти поїздок
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

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* Share Live Location Card */}
          <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 space-y-3">
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-[#1769F4] shrink-0" />
              <h3 className="font-extrabold text-[#14243B] dark:text-white text-sm">
                Поділитися поїздкою з близькими
              </h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Надішліть посилання рідним або друзям у месенджер. Вони зможуть бачити ваше переміщення, дані водія та орієнтовний час прибуття в режимі реального часу.
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-[#1769F4] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition shadow-2xs"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                <span>{copied ? 'Скопійовано!' : 'Копіювати посилання'}</span>
              </button>

              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(tripUrl)}&text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-xl bg-[#229ED9] hover:bg-[#1E88E5] text-white font-bold flex items-center gap-1.5 transition shadow-2xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Telegram</span>
              </a>

              <a
                href={`viber://forward?text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-xl bg-[#7360F2] hover:bg-[#6350E2] text-white font-bold flex items-center gap-1.5 transition shadow-2xs"
              >
                <span>Viber</span>
              </a>
            </div>
          </div>

          {/* Verification Pillars */}
          <div className="space-y-2.5">
            <h4 className="font-extrabold text-slate-700 dark:text-slate-200">
              Стандарти довіри MARSHGO Community:
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start gap-2.5">
                <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-[#14243B] dark:text-white">Верифікація особистості</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Перевірка документів та номеру телефону через Дія / BankID.
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-[#1769F4] dark:text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-[#14243B] dark:text-white">Захист конфіденційності</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Номери авто та прямі телефони відкриваються лише після підтвердження.
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start gap-2.5">
                <HeartHandshake className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-[#14243B] dark:text-white">Страховий захист</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Усі пасажири застраховані полісом ОСЦПВ на весь час поїздки.
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-[#14243B] dark:text-white">Справжні фото авто</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Модерація фотографій салону та екстер'єру для кожної поїздки.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Emergency Hotline SOS */}
          <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <div className="font-extrabold text-red-900 dark:text-red-200">
                  Екстрена допомога (SOS 112)
                </div>
                <div className="text-[11px] text-red-700 dark:text-red-300">
                  Єдиний номер екстрених служб в Україні
                </div>
              </div>
            </div>

            <a
              href="tel:112"
              className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Викликати 112</span>
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#1769F4] hover:bg-[#1358CE] text-white text-xs font-bold transition shadow-xs"
          >
            Зрозуміло
          </button>
        </div>
      </div>
    </div>
  );
};
