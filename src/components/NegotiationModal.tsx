import React, { useState } from 'react';
import { X, Send, ShieldAlert, CheckCircle2, History } from 'lucide-react';
import { Proposal } from '../types';

interface NegotiationModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal?: Proposal;
  demandTitle: string;
  defaultPrice?: number;
  userRole: 'passenger' | 'driver';
  onSubmitPrice: (priceAmount: number, comment?: string) => void;
}

export const NegotiationModal: React.FC<NegotiationModalProps> = ({
  isOpen,
  onClose,
  proposal,
  demandTitle,
  defaultPrice = 1000,
  userRole,
  onSubmitPrice
}) => {
  const [price, setPrice] = useState<number>(defaultPrice);
  const [comment, setComment] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (price <= 0) return;
    onSubmitPrice(price, comment);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-[#081B35] text-white flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base">
              {proposal ? 'Зустрічна пропозиція' : 'Запропонувати ціну водія'}
            </h3>
            <p className="text-xs text-slate-300">{demandTitle}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Revision History if existing proposal */}
        {proposal && proposal.revisions.length > 0 && (
          <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-700 mb-2">
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span>Історія версій переговорів (Ревізія #{proposal.currentRevisionNumber}):</span>
            </div>
            <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
              {proposal.revisions.map((rev) => (
                <div
                  key={rev.revisionNumber}
                  className="flex items-center justify-between p-1.5 rounded bg-white border border-slate-200"
                >
                  <span className="font-medium text-slate-600">
                    Версія #{rev.revisionNumber} ({rev.proposedByRole === 'driver' ? 'Водій' : 'Пасажир'}):
                  </span>
                  <span className="font-bold text-[#14243B] tabular-nums">{rev.priceAmount} грн</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Price Input Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#14243B] mb-1.5">
              Ваша пропозиція (грн):
            </label>
            <div className="relative">
              <input
                type="number"
                min="50"
                step="50"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full text-2xl font-extrabold text-[#1769F4] px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1769F4] tabular-nums"
                required
              />
              <span className="absolute right-4 top-4 text-sm font-semibold text-slate-500">UAH</span>
            </div>
            <p className="text-[11px] text-[#62718A] mt-1">
              {userRole === 'driver'
                ? 'Зазначте реальну суму участі у витратах на поїздку (0% комісії MARSHGO).'
                : 'Запропонуйте суму, комфортну для вашого бюджету.'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#14243B] mb-1.5">
              Коментар або умови посадки (необов'язково):
            </label>
            <textarea
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Наприклад: Заберу о 08:30 біля автовокзалу, є вільний багажник."
              className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1769F4] resize-none"
            />
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 text-amber-800 text-[11px] border border-amber-200">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
            <span>Кожна нова сума створює нову ревізію переговорів для запобігання помилкам.</span>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Скасувати
            </button>
            <button
              type="submit"
              className="w-1/2 py-2.5 rounded-xl bg-[#1769F4] hover:bg-[#1358CE] text-white text-xs font-bold shadow-md shadow-[#1769F4]/20 transition flex items-center justify-center gap-1.5 active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Надіслати пропозицію</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
