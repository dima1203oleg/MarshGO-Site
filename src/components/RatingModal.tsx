import React, { useState } from 'react';
import { X, Star, CheckCircle2 } from 'lucide-react';
import { Booking } from '../types';

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking;
  onSubmitReview: (bookingId: string, rating: number, comment: string, tags: string[]) => void;
}

export const RatingModal: React.FC<RatingModalProps> = ({
  isOpen,
  onClose,
  booking,
  onSubmitReview
}) => {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['Пунктуальність', 'Комфортне водіння']);

  if (!isOpen) return null;

  const availableTags = [
    'Пунктуальність',
    'Чисте авто',
    'Комфортне водіння',
    'Ввічливий',
    'Приємна розмова',
    'Швидка поїздка',
    'Гарна музика'
  ];

  const ratingDescriptions: Record<number, string> = {
    1: 'Дуже незадоволений (1/5)',
    2: 'Є зауваження (2/5)',
    3: 'Нормально (3/5)',
    4: 'Добре, все сподобалось (4/5)',
    5: 'Чудово! Рекомендую всім (5/5)'
  };

  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitReview(booking.id, rating, comment, selectedTags);
    onClose();
  };

  const activeScore = hoverRating || rating;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="p-5 bg-[#081B35] text-white flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-base">Оцінити поїздку</h3>
            <p className="text-xs text-slate-300">
              {booking.origin} → {booking.destination}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition"
            aria-label="Закрити"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Target user info */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#F5F8FD] border border-slate-200">
            <img
              src={booking.vehiclePhoto}
              alt=""
              className="w-12 h-12 rounded-xl object-cover border border-slate-200"
              referrerPolicy="no-referrer"
            />
            <div className="text-xs">
              <span className="text-slate-500">Водій:</span>
              <div className="font-extrabold text-sm text-[#14243B]">{booking.driverName}</div>
              <div className="text-slate-500 text-[11px]">{booking.vehicleSummary}</div>
            </div>
          </div>

          {/* Interactive 5 Stars */}
          <div className="text-center space-y-2">
            <label className="block text-xs font-bold text-[#14243B]">
              Як пройшла ваша спільна поїздка?
            </label>

            <div className="flex items-center justify-center gap-2 py-1">
              {[1, 2, 3, 4, 5].map((starIndex) => (
                <button
                  type="button"
                  key={starIndex}
                  onMouseEnter={() => setHoverRating(starIndex)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(starIndex)}
                  className="p-1.5 focus:outline-none transition-transform hover:scale-110 active:scale-95"
                  aria-label={`Оцінити на ${starIndex} зірок`}
                >
                  <Star
                    className={`w-8 h-8 transition-colors ${
                      starIndex <= activeScore
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-200'
                    }`}
                  />
                </button>
              ))}
            </div>

            <p className="text-xs font-bold text-amber-600">
              {ratingDescriptions[activeScore]}
            </p>
          </div>

          {/* Compliment / Tags */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#14243B]">
              Що вам найбільше сподобалось?
            </label>
            <div className="flex flex-wrap gap-1.5">
              {availableTags.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    type="button"
                    key={tag}
                    onClick={() => handleToggleTag(tag)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                      isSelected
                        ? 'bg-[#1769F4] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comment text */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#14243B]">
              Коментар або відгук (за бажанням):
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Поділіться враженнями від поїздки, щоб допомогти іншим користувачам..."
              className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1769F4] resize-none"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
            >
              Пізніше
            </button>
            <button
              type="submit"
              className="w-2/3 py-2.5 rounded-xl bg-[#1769F4] hover:bg-[#1358CE] text-white text-xs font-extrabold shadow-md shadow-[#1769F4]/20 transition flex items-center justify-center gap-2 active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Зберегти відгук</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
