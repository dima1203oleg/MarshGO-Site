import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Zap,
  Bookmark,
  Car,
  ChevronRight
} from 'lucide-react';

export interface TourStep {
  id: string;
  targetId: string;
  title: string;
  subtitle: string;
  description: string;
  keyPoints: string[];
  badge: string;
  icon: React.ReactNode;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'search',
    targetId: 'tour-search-form',
    title: 'Швидкий та універсальний пошук',
    subtitle: 'Крок 1: Як знаходити найкращі поїздки',
    description:
      'Введіть місто виїзду, місто прибуття, дату та кількість пасажирів. Платформа об’єднує всі доступні варіанти транспорту в одному вікні.',
    keyPoints: [
      'Попутки від попутників без комісії сервісу (0%)',
      'Кнопка «Моє місце» для швидкого GPS-визначення вашого міста',
      'Автобусні квитки, перевірені PRO-водії, таксі та трансфери'
    ],
    badge: 'Пошук рейсів',
    icon: <Search className="w-5 h-5 text-[#1769F4]" />
  },
  {
    id: 'reverse-marketplace',
    targetId: 'tour-reverse-marketplace',
    title: 'Зворотний маркетплейс (Свій бюджет)',
    subtitle: 'Крок 2: Як створити власний запит на поїздку',
    description:
      'Не знайшли відповідний час або влаштовує лише певна вартість? Опублікуйте власний запит і встановіть свій бюджет — водії самі зроблять вам зустрічні пропозиції.',
    keyPoints: [
      'Вкажіть бажану ціну та гнучкість у часі виїзду',
      'Водії, які їдуть цим маршрутом, самі відгукнуться',
      'Обирайте найкращу ціну без торгу по телефону'
    ],
    badge: 'Свій бюджет',
    icon: <Zap className="w-5 h-5 text-amber-500" />
  },
  {
    id: 'recent-favorites',
    targetId: 'tour-recent-routes',
    title: 'Недавні маршрути та Вибране',
    subtitle: 'Крок 3: Швидкий доступ до улюблених поїздок',
    description:
      'Зберігайте найважливіші маршрути для миттєвого повторного пошуку в один клік та відстежуйте нові пропозиції.',
    keyPoints: [
      'Блок недавніх пошуків на головній сторінці для швидкого кліку',
      'Значок закладки на картках рейсів для збереження у «Вибране»',
      'Підписка на сповіщення про нові рейси у Telegram або Push'
    ],
    badge: 'Збережене',
    icon: <Bookmark className="w-5 h-5 text-rose-500" />
  },
  {
    id: 'driver-mode',
    targetId: 'tour-driver-section',
    title: 'Подорожуйте як водій',
    subtitle: 'Крок 4: Як створювати маршрути та брати попутників',
    description:
      'Маєте власний автомобіль і вільні місця? Перемикайтеся на режим водія, створюйте рейси або використовуйте навігатор для пошуку попутників уздовж своєї траси.',
    keyPoints: [
      'Публікація маршруту за 1 хвилину з гнучкою ціною за місце',
      'MARSHGO Navigation автоматично знаходить попутників уздовж траси',
      'Компенсуйте витрати на пальне на 100%'
    ],
    badge: 'Для водіїв',
    icon: <Car className="w-5 h-5 text-emerald-600" />
  }
];

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateHome?: () => void;
  onNavigateDemandNew?: () => void;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  isOpen,
  onClose,
  onNavigateHome,
  onNavigateDemandNew
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  // Scroll target into view when step changes
  useEffect(() => {
    if (!isOpen) return;

    const step = TOUR_STEPS[currentStepIndex];
    if (!step) return;

    const targetEl = document.getElementById(step.targetId);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetEl.classList.add('ring-4', 'ring-[#1769F4]', 'ring-offset-4', 'transition-all');

      return () => {
        targetEl.classList.remove('ring-4', 'ring-[#1769F4]', 'ring-offset-4');
      };
    }
  }, [currentStepIndex, isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStepIndex]);

  if (!isOpen) return null;

  const currentStep = TOUR_STEPS[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem('mg_onboarding_completed', 'true');
    } catch {
      // Onboarding can still be dismissed when browser storage is unavailable.
    }
    onNavigateHome?.();
    onClose();
  };

  const handleComplete = () => {
    try {
      localStorage.setItem('mg_onboarding_completed', 'true');
    } catch {
      // Completing the tour does not depend on persistent browser storage.
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      {/* Tour Card */}
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col transform transition-all duration-300 scale-100">
        {/* Top Progress Bar */}
        <div className="w-full bg-slate-100 h-1.5 overflow-hidden">
          <div
            className="bg-[#1769F4] h-full transition-all duration-300"
            style={{ width: `${((currentStepIndex + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>

        {/* Header */}
        <div className="px-6 pt-5 pb-3 flex items-center justify-between border-b border-slate-100 bg-[#F5F8FD]">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-white shadow-xs border border-slate-200/80">
              {currentStep.icon}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1769F4] bg-blue-100/70 px-2 py-0.5 rounded-full">
                  {currentStep.badge}
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  {currentStepIndex + 1} з {TOUR_STEPS.length}
                </span>
              </div>
              <div className="text-xs font-bold text-[#62718A] mt-0.5">{currentStep.subtitle}</div>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="p-2 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition"
            title="Закрити гід"
            aria-label="Закрити гід"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-lg font-black text-[#14243B] leading-snug">
              {currentStep.title}
            </h3>
            <p className="text-xs text-[#62718A] leading-relaxed mt-2">
              {currentStep.description}
            </p>
          </div>

          {/* Key Points Bullet List */}
          <div className="bg-[#F8FAFC] border border-slate-200/70 rounded-2xl p-4 space-y-2.5">
            <div className="text-[11px] font-extrabold text-[#14243B] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#1769F4]" />
              <span>Ключові можливості:</span>
            </div>
            <ul className="space-y-2">
              {currentStep.keyPoints.map((point, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Optional Action Shortcut */}
          {currentStep.id === 'reverse-marketplace' && onNavigateDemandNew && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  handleDismiss();
                  onNavigateDemandNew();
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 text-[#1769F4] text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <span>Спробувати створити свій запит зараз</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-[#F5F8FD] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleDismiss}
            className="text-xs font-bold text-slate-400 hover:text-slate-600 transition"
          >
            Пропустити тур
          </button>

          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition flex items-center gap-1.5 shadow-2xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Назад</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2.5 rounded-xl bg-[#1769F4] hover:bg-[#1358CE] text-white text-xs font-bold shadow-md shadow-[#1769F4]/20 transition flex items-center gap-2 active:scale-95"
            >
              <span>{isLastStep ? 'Зрозуміло, розпочати!' : 'Далі'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
