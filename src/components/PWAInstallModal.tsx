import React from 'react';
import { X, Share, PlusSquare, Download, CheckCircle2 } from 'lucide-react';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  isIOS: boolean;
  isInstallable: boolean;
  onInstall: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose,
  isIOS,
  isInstallable,
  onInstall
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-[#081B35] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1769F4] flex items-center justify-center">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base">Встановити MARSHGO</h3>
              <p className="text-xs text-slate-300">Працює як мобільний застосунок</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="space-y-2 text-xs text-[#62718A]">
            <div className="flex items-center gap-2 text-sm text-[#14243B] font-semibold">
              <CheckCircle2 className="w-4 h-4 text-[#16845C]" />
              <span>Швидкий доступ з головного екрана</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#14243B] font-semibold">
              <CheckCircle2 className="w-4 h-4 text-[#16845C]" />
              <span>Миттєві сповіщення про пропозиції водіїв</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#14243B] font-semibold">
              <CheckCircle2 className="w-4 h-4 text-[#16845C]" />
              <span>Офлайн перегляд квитків та маршрутів</span>
            </div>
          </div>

          {isIOS ? (
            /* iOS Safari Step-by-Step Instructions */
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <h4 className="font-bold text-xs text-[#14243B] uppercase tracking-wider">
                Інструкція для iPhone / Safari:
              </h4>
              <div className="flex items-start gap-3 text-xs text-[#14243B]">
                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0 font-bold">1</div>
                <div>
                  Натисніть кнопку <span className="font-semibold">«Поділитися»</span> (значок <Share className="w-3.5 h-3.5 inline text-[#1769F4]" /> внизу Safari).
                </div>
              </div>
              <div className="flex items-start gap-3 text-xs text-[#14243B]">
                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0 font-bold">2</div>
                <div>
                  Прокрутіть меню та виберіть <span className="font-semibold">«На початковий екран»</span> (<PlusSquare className="w-3.5 h-3.5 inline text-[#1769F4]" />).
                </div>
              </div>
              <div className="flex items-start gap-3 text-xs text-[#14243B]">
                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0 font-bold">3</div>
                <div>
                  Натисніть <span className="font-semibold">«Додати»</span> у правому верхньому кутку.
                </div>
              </div>
            </div>
          ) : isInstallable ? (
            <button
              onClick={() => {
                onInstall();
                onClose();
              }}
              className="w-full py-3 rounded-xl bg-[#1769F4] text-white font-semibold text-sm hover:bg-[#1358CE] shadow-md shadow-[#1769F4]/20 transition"
            >
              Встановити в 1 клік
            </button>
          ) : (
            <p className="text-xs text-slate-500 italic text-center">
              Відкрийте сайт у браузері Chrome або Safari для встановлення на робочий стіл.
            </p>
          )}

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Зрозуміло, закрити
          </button>
        </div>
      </div>
    </div>
  );
};
