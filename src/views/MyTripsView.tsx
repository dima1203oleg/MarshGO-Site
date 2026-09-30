import React, { useState } from 'react';
import {
  Clock,
  Car,
  QrCode,
  Phone,
  Share2,
  Star
} from 'lucide-react';
import { Booking } from '../types';
import { RatingModal } from '../components/RatingModal';

interface MyTripsViewProps {
  bookings: Booking[];
  onCancelBooking: (bookingId: string) => void;
  onRateTrip: (bookingId: string, rating: number, comment: string, tags: string[]) => void;
  onNavigate: (view: string) => void;
}

export const MyTripsView: React.FC<MyTripsViewProps> = ({
  bookings,
  onCancelBooking,
  onRateTrip,
  onNavigate
}) => {
  const [tab, setTab] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const [activeTicket, setActiveTicket] = useState<Booking | null>(bookings[0] || null);
  const [activeRatingBooking, setActiveRatingBooking] = useState<Booking | null>(null);

  const filteredBookings = bookings.filter((b) => {
    if (tab === 'cancelled') return b.status === 'cancelled';
    if (tab === 'completed') return b.status === 'completed';
    return b.status !== 'cancelled' && b.status !== 'completed';
  });

  return (
    <div className="min-h-screen bg-[#F5F8FD] pb-24 md:pb-12">
      <div className="sticky top-16 z-30 bg-white border-b border-[#DFE7F1] px-4 sm:px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-base sm:text-lg font-bold text-[#14243B]">Мої поїздки та квитки</h1>
          <button
            onClick={() => onNavigate('home')}
            className="text-xs font-semibold text-[#1769F4] hover:underline"
          >
            Знайти нову поїздку
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Tab Filters */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setTab('upcoming')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              tab === 'upcoming'
                ? 'bg-[#1769F4] text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Заплановані ({bookings.filter((b) => b.status === 'confirmed' || b.status === 'pending').length})
          </button>
          <button
            onClick={() => setTab('completed')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              tab === 'completed'
                ? 'bg-[#1769F4] text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Завершені ({bookings.filter((b) => b.status === 'completed').length})
          </button>
          <button
            onClick={() => setTab('cancelled')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              tab === 'cancelled'
                ? 'bg-[#1769F4] text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Скасовані
          </button>
        </div>

        {/* Bookings List */}
        {filteredBookings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredBookings.map((b) => (
              <div
                key={b.id}
                onClick={() => setActiveTicket(b)}
                className={`bg-white rounded-2xl border p-5 shadow-sm space-y-3 cursor-pointer transition ${
                  activeTicket?.id === b.id ? 'border-[#1769F4] ring-2 ring-[#1769F4]/10' : 'border-[#DFE7F1] hover:border-slate-300'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-[#1769F4] bg-blue-50 px-2.5 py-1 rounded-lg">
                    {b.bookingCode}
                  </span>
                  <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                    b.status === 'confirmed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : b.status === 'completed'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {b.status === 'confirmed' ? 'Підтверджено' : b.status === 'completed' ? 'Завершено' : b.status}
                  </span>
                </div>

                {/* Route */}
                <div>
                  <div className="font-bold text-sm text-[#14243B] flex items-center gap-1.5">
                    <span>{b.origin}</span>
                    <span className="text-slate-400">→</span>
                    <span>{b.destination}</span>
                  </div>
                  <div className="text-xs text-[#62718A] flex items-center gap-2 mt-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{new Date(b.departureTime).toLocaleString('uk-UA', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </div>
                </div>

                {/* Driver & Vehicle */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-slate-400" />
                    <span>{b.vehicleSummary}</span>
                  </div>
                  <div className="font-bold text-[#14243B] tabular-nums">
                    {b.finalPriceAmount} грн
                  </div>
                </div>

                {/* Reviews / Rating Bar */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  {b.hasReviewed ? (
                    <div className="flex items-center gap-1 text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{b.userRating}/5 (Оцінку надіслано)</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveRatingBooking(b);
                      }}
                      className="px-3 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold flex items-center gap-1.5 transition active:scale-95"
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                      <span>{b.status === 'completed' ? 'Залишити відгук' : 'Завершити та оцінити'}</span>
                    </button>
                  )}

                  {b.status === 'confirmed' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCancelBooking(b.id);
                      }}
                      className="text-[11px] font-semibold text-red-600 hover:underline"
                    >
                      Скасувати
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
            Немає поїздок у цьому розділі.
          </div>
        )}

        {/* Digital Ticket Voucher / QR Code Box */}
        {activeTicket && activeTicket.status === 'confirmed' && (
          <div className="bg-white rounded-2xl border-2 border-[#1769F4] p-6 shadow-xl space-y-4 max-w-lg mx-auto">
            <div className="text-center space-y-1">
              <span className="text-xs font-bold text-[#1769F4] uppercase tracking-wider">Електронний квиток MARSHGO</span>
              <h3 className="text-xl font-black text-[#14243B]">{activeTicket.origin} → {activeTicket.destination}</h3>
              <p className="text-xs text-slate-500">
                Покажіть цей QR-код водієві під час посадки
              </p>
            </div>

            {/* Stylized QR Code Graphic */}
            <div className="w-44 h-44 mx-auto p-3 bg-white border-2 border-slate-900 rounded-2xl shadow-inner flex flex-col items-center justify-center text-center">
              <QrCode className="w-28 h-28 text-slate-900 stroke-[1.5]" />
              <span className="text-[11px] font-black text-slate-900 tracking-wider mt-1">{activeTicket.bookingCode}</span>
            </div>

            {/* Contact details */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Водій:</span>
                <span className="font-bold text-[#14243B]">{activeTicket.driverName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Телефон водія:</span>
                <a
                  href={`tel:${activeTicket.driverPhoneFull}`}
                  className="font-bold text-[#1769F4] flex items-center gap-1 hover:underline"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{activeTicket.driverPhoneFull || activeTicket.driverPhoneMasked}</span>
                </a>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Автомобіль та номер:</span>
                <span className="font-bold text-[#14243B]">{activeTicket.vehicleSummary} ({activeTicket.vehiclePlate})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Сума внеску:</span>
                <span className="font-black text-[#16845C] text-sm tabular-nums">{activeTicket.finalPriceAmount} грн</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => alert(`Посилання на поїздку ${activeTicket.bookingCode} скопійовано для близьких.`)}
                className="w-full py-2.5 rounded-xl bg-[#081B35] hover:bg-[#0F284E] text-white text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                <span>Поділитися поїздкою з близькими</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Rating & Review Modal */}
      {activeRatingBooking && (
        <RatingModal
          isOpen={!!activeRatingBooking}
          onClose={() => setActiveRatingBooking(null)}
          booking={activeRatingBooking}
          onSubmitReview={(bId, score, text, tags) => {
            onRateTrip(bId, score, text, tags);
            setActiveRatingBooking(null);
          }}
        />
      )}
    </div>
  );
};

