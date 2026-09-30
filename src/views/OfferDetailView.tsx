import React, { useState } from 'react';
import {
  ArrowLeft,
  ShieldCheck,
  Clock,
  MapPin,
  Luggage,
  Wind,
  Zap,
  CheckCircle2,
  Share2,
  Check,
  Calculator,
} from 'lucide-react';
import { TransportOffer, Booking } from '../types';
import { OfferRouteMap } from '../map/OfferRouteMap';
import { FuelCostCalculatorModal } from '../components/FuelCostCalculatorModal';
import { SafetyTripModal } from '../components/SafetyTripModal';

interface OfferDetailViewProps {
  offer: TransportOffer;
  onBack: () => void;
  onBook: (offerId: string, seatsCount: number) => void;
  bookingSuccess?: Booking | null;
  onViewBooking: (bookingId: string) => void;
}

export const OfferDetailView: React.FC<OfferDetailViewProps> = ({
  offer,
  onBack,
  onBook,
  bookingSuccess,
  onViewBooking
}) => {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [selectedSeats, setSelectedSeats] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<'cash_to_driver' | 'online_sandbox'>('cash_to_driver');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [isFuelCalculatorOpen, setIsFuelCalculatorOpen] = useState(false);
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);

  const photos = offer.vehicle?.allPhotos && offer.vehicle.allPhotos.length > 0
    ? offer.vehicle.allPhotos
    : [offer.vehicle?.primaryPhoto || 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1000&q=80'];

  const isCommunity = offer.category === 'community';
  const isPerCar = offer.priceUnit === 'per_car';
  const totalAmount = isPerCar ? offer.priceAmount : offer.priceAmount * selectedSeats;

  const handleShare = async () => {
    const shareTitle = `Поїздка MARSHGO: ${offer.origin} → ${offer.destination}`;
    const shareText = `Поїздка ${offer.origin} → ${offer.destination} з водієм ${offer.driver.name}. Вартість: ${offer.priceAmount} грн (${isPerCar ? 'за авто' : 'за місце'}). Відправлення: ${new Date(offer.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl
        });
        setShareToast('Поїздкою успішно поділилися!');
        setTimeout(() => setShareToast(null), 3500);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    // Fallback: copy link and details to clipboard
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(`${shareTitle}\n${shareText}\n${shareUrl}`);
      }
      setIsCopied(true);
      setShareToast('Посилання на поїздку скопійовано в буфер обміну!');
      setTimeout(() => {
        setIsCopied(false);
        setShareToast(null);
      }, 3500);
    } catch {
      setShareToast('Посилання скопійовано!');
      setTimeout(() => setShareToast(null), 3500);
    }
  };

  const handleConfirmBooking = () => {
    onBook(offer.id, selectedSeats);
  };

  return (
    <div className="min-h-screen bg-[#F5F8FD] pb-24 md:pb-12">
      {/* Top sticky bar */}
      <div className="sticky top-16 z-30 bg-white/95 backdrop-blur-md border-b border-[#DFE7F1] px-4 sm:px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-[#1769F4] transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Назад до результатів</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition active:scale-95 ${
                isCopied
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
              }`}
              title="Поділитися поїздкою"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Share2 className="w-3.5 h-3.5 text-[#1769F4]" />}
              <span>{isCopied ? 'Скопійовано!' : 'Поділитися'}</span>
            </button>

            <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-[#14243B]">
              <span>Рейс #{offer.id.slice(-6)}</span>
              {isCommunity && (
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px]">
                  0% комісії
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Photo Gallery (1-8 photos) */}
        <div className="bg-white rounded-2xl border border-[#DFE7F1] p-3 overflow-hidden shadow-sm space-y-3">
          <div className="relative w-full h-64 sm:h-96 rounded-xl overflow-hidden bg-slate-900">
            <img
              src={photos[activePhotoIndex]}
              alt={offer.vehicle?.make || 'Транспорт'}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute bottom-3 right-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-xs font-semibold text-white">
              {activePhotoIndex + 1} / {photos.length}
            </div>
            {isCommunity && (
              <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold shadow-md">
                Приватна попутка Community
              </div>
            )}
          </div>

          {/* Thumbnails row */}
          {photos.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {photos.map((ph, idx) => (
                <button
                  key={idx}
                  onClick={() => setActivePhotoIndex(idx)}
                  className={`w-20 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition ${
                    activePhotoIndex === idx ? 'border-[#1769F4]' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={ph} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Title, Driver & Price Card */}
        <div className="bg-white rounded-2xl border border-[#DFE7F1] p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#14243B]">
                {offer.vehicle ? `${offer.vehicle.make} ${offer.vehicle.model}` : offer.partnerName}
              </h1>
              <p className="text-xs text-[#62718A] mt-0.5">
                {offer.vehicle ? `${offer.vehicle.year} рік випуску · ${offer.vehicle.color}` : 'Регулярне перевезення'}
              </p>
            </div>

            <div className="flex flex-col sm:items-end gap-2.5">
              <div className="text-left sm:text-right">
                <div className="text-xs font-semibold text-slate-500">Вартість внеску:</div>
                <div className="flex items-baseline sm:justify-end gap-1">
                  <span className="text-2xl sm:text-3xl font-extrabold text-[#1769F4] tabular-nums">
                    {offer.priceAmount}
                  </span>
                  <span className="text-sm font-bold text-slate-600">грн</span>
                </div>
                <div className="text-xs text-slate-500">
                  {isPerCar ? 'за весь автомобіль' : 'за 1 місце'}
                </div>
              </div>

              <button
                type="button"
                onClick={handleShare}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition active:scale-95 border ${
                  isCopied
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-blue-50 hover:bg-blue-100 text-[#1769F4] border-blue-200'
                }`}
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'Скопійовано!' : 'Поділитися поїздкою'}</span>
              </button>
            </div>
          </div>

          {/* Driver Block */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#F5F8FD]">
            <div className="flex items-center gap-3">
              <img
                src={offer.driver.avatar}
                alt={offer.driver.name}
                className="w-12 h-12 rounded-full object-cover border border-slate-200"
                referrerPolicy="no-referrer"
              />
              <div>
                <div className="flex items-center gap-1.5 font-bold text-sm text-[#14243B]">
                  <span>{offer.driver.name}</span>
                  {offer.driver.isVerified && (
                    <span title="Документи верифіковано">
                      <ShieldCheck className="w-4 h-4 text-[#16845C]" />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-[#62718A] mt-0.5">
                  <span className="text-amber-500 font-bold">★ {offer.driver.rating.toFixed(1)}</span>
                  <span>·</span>
                  <span>{offer.driver.tripsCount} успішних поїздок</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full">
                Верифікований
              </span>
            </div>
          </div>

          {/* Quick interactive widgets bar */}
          <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsFuelCalculatorOpen(true)}
              className="p-2.5 rounded-xl bg-blue-50/80 hover:bg-blue-100 text-[#1769F4] font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <Calculator className="w-4 h-4 shrink-0" />
              <span>Розрахунок пального</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSafetyModalOpen(true)}
              className="p-2.5 rounded-xl bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Центр безпеки & SOS</span>
            </button>
          </div>
        </div>

        {/* Route Timeline */}
        <div className="bg-white rounded-2xl border border-[#DFE7F1] p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-base text-[#14243B]">Маршрут та зупинки</h3>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-blue-200">
            {/* Origin */}
            <div className="relative">
              <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-[#1769F4] border-2 border-white shadow-sm" />
              <div className="font-bold text-sm text-[#14243B]">
                {new Date(offer.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {offer.origin}
              </div>
              <div className="text-xs text-[#62718A]">{offer.originAddress}</div>
            </div>

            {/* Intermediate stops if any */}
            {offer.intermediateStops && offer.intermediateStops.map((stop, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-5 top-1.5 w-2 h-2 rounded-full bg-slate-400" />
                <div className="text-xs font-semibold text-slate-700">Зупинка на трасі: {stop}</div>
              </div>
            ))}

            {/* Destination */}
            <div className="relative">
              <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-[#16845C] border-2 border-white shadow-sm" />
              <div className="font-bold text-sm text-[#14243B]">
                {new Date(offer.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {offer.destination}
              </div>
              <div className="text-xs text-[#62718A]">{offer.destinationAddress}</div>
            </div>
          </div>

          <div className="pt-2 text-xs text-[#62718A] flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>Орієнтовний час у дорозі: {Math.round(offer.durationMinutes / 60)} год {offer.durationMinutes % 60} хв ({offer.distanceKm} км)</span>
          </div>

          {/* Route preview is rendered only from backend-provided road geometry. */}
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#1769F4]" />
                <h4 className="text-xs font-extrabold text-[#14243B] dark:text-white uppercase tracking-wider">
                  Огляд маршруту
                </h4>
              </div>
            </div>

            <OfferRouteMap origin={offer.origin} destination={offer.destination} geometry={offer.routeGeometry} />

            {/* Waypoint details cards below the map */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900 flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[#1769F4] text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  А
                </span>
                <div>
                  <div className="font-bold text-[#14243B] dark:text-white">Відправлення: {offer.origin}</div>
                  <div className="text-[11px] text-[#62718A] dark:text-slate-400 truncate">{offer.originAddress}</div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900 flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[#16845C] text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  Б
                </span>
                <div>
                  <div className="font-bold text-[#14243B] dark:text-white">Прибуття: {offer.destination}</div>
                  <div className="text-[11px] text-[#62718A] dark:text-slate-400 truncate">{offer.destinationAddress}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Vehicle Amenities */}
        <div className="bg-white rounded-2xl border border-[#DFE7F1] p-5 shadow-sm space-y-3">
          <h3 className="font-bold text-base text-[#14243B]">Умови поїздки та зручності</h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs text-[#14243B]">
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 font-medium">
              <Wind className="w-4 h-4 text-[#1769F4]" />
              <span>Кондиціонер</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 font-medium">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Зарядка телефона</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 font-medium">
              <Luggage className="w-4 h-4 text-[#16845C]" />
              <span>Багаж (до 2 валіз)</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 font-medium">
              <CheckCircle2 className="w-4 h-4 text-slate-500" />
              <span>Можна з тваринами</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 font-medium">
              <CheckCircle2 className="w-4 h-4 text-slate-500" />
              <span>Дитяче крісло</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 font-medium">
              <CheckCircle2 className="w-4 h-4 text-red-500" />
              <span>Не палити в салоні</span>
            </div>
          </div>
        </div>

        {/* Booking Confirmation Box (FLOW A) */}
        <div className="bg-white rounded-2xl border-2 border-[#1769F4] p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-[#14243B]">Підтвердження бронювання</h3>
            <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
              Миттєве підтвердження
            </span>
          </div>

          {/* Seat counter */}
          {!isPerCar && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#F5F8FD]">
              <div>
                <div className="text-xs font-bold text-[#14243B]">Кількість місць:</div>
                <div className="text-[11px] text-[#62718A]">Доступно для вибору: {offer.availableSeats}</div>
              </div>
              <div className="flex items-center gap-2">
                {[1, 2, 3].filter((n) => n <= offer.availableSeats).map((num) => (
                  <button
                    key={num}
                    onClick={() => setSelectedSeats(num)}
                    className={`w-9 h-9 rounded-xl font-bold text-xs transition ${
                      selectedSeats === num
                        ? 'bg-[#1769F4] text-white shadow-sm'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Payment selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#14243B]">Спосіб оплати:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                paymentMethod === 'cash_to_driver' ? 'border-[#1769F4] bg-[#F5F8FD]' : 'border-slate-200'
              }`}>
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'cash_to_driver'}
                  onChange={() => setPaymentMethod('cash_to_driver')}
                  className="text-[#1769F4]"
                />
                <div>
                  <div className="font-bold text-[#14243B]">Готівкою водію</div>
                  <div className="text-[11px] text-[#62718A]">Оплата під час посадки</div>
                </div>
              </label>

              <label className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                paymentMethod === 'online_sandbox' ? 'border-[#1769F4] bg-[#F5F8FD]' : 'border-slate-200'
              }`}>
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'online_sandbox'}
                  onChange={() => setPaymentMethod('online_sandbox')}
                  className="text-[#1769F4]"
                />
                <div>
                  <div className="font-bold text-[#14243B]">Онлайн (Тестовий режим)</div>
                  <div className="text-[11px] text-[#62718A]">Безпечний холдер коштів</div>
                </div>
              </label>
            </div>
          </div>

          {/* Total Sum */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-xs text-[#62718A]">
                Всього до сплати ({selectedSeats} {selectedSeats === 1 ? 'місце' : 'місця'}):
              </div>
              <div className="text-2xl font-black text-[#14243B] tabular-nums">
                {totalAmount} грн
              </div>
            </div>

            <button
              onClick={handleConfirmBooking}
              className="px-8 py-3 rounded-xl bg-[#1769F4] hover:bg-[#1358CE] text-white font-bold text-sm shadow-lg shadow-[#1769F4]/20 transition active:scale-95"
            >
              Забронювати поїздку
            </button>
          </div>
        </div>

        {/* Modal if booking already succeeded */}
        {bookingSuccess && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Поїздку успішно заброньовано! Код: {bookingSuccess.bookingCode}</span>
            </div>
            <p className="text-xs text-emerald-800">
              Місця закріплено. Водій отримав ваші контакти, а ви можете переглянути квиток із QR-кодом у розділі «Мої поїздки».
            </p>
            <button
              onClick={() => onViewBooking(bookingSuccess.id)}
              className="mt-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition"
            >
              Переглянути квиток та контакти
            </button>
          </div>
        )}
        {/* Share Toast Banner */}
        {shareToast && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#081B35] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold border border-white/20 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{shareToast}</span>
          </div>
        )}
      </div>

      {/* Fuel Cost Calculator Modal */}
      <FuelCostCalculatorModal
        isOpen={isFuelCalculatorOpen}
        onClose={() => setIsFuelCalculatorOpen(false)}
        defaultOrigin={offer.origin}
        defaultDestination={offer.destination}
        defaultDistanceKm={offer.distanceKm || 475}
      />

      {/* Safety & Live Tracking Modal */}
      <SafetyTripModal
        isOpen={isSafetyModalOpen}
        onClose={() => setIsSafetyModalOpen(false)}
        tripDetails={{
          id: offer.id,
          origin: offer.origin,
          destination: offer.destination,
          driverName: offer.driver.name,
          vehicleName: `${offer.vehicle?.make || 'Toyota'} ${offer.vehicle?.model || 'Camry'}`,
          departureTime: offer.departureTime
        }}
      />
    </div>
  );
};
