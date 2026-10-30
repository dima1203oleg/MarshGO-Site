import { useState } from 'react';
import {
  ArrowLeft, CheckCircle2, ChevronDown, Clock3, XCircle, Shield,
  Download, Trash2, AlertTriangle, PhoneCall,
} from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import type { ApiVehicle, ApiVerificationRecord } from '../services/productionApi';

export type ProfileSection = 'documents' | 'settings' | 'privacy' | 'safety' | 'help';

const statusMeta = {
  approved: { label: 'Підтверджено', tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300', Icon: CheckCircle2 },
  pending: { label: 'На перевірці', tone: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300', Icon: Clock3 },
  rejected: { label: 'Відхилено', tone: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300', Icon: XCircle },
} as const;

const typeLabel: Record<ApiVerificationRecord['verification_type'], string> = {
  vehicle: 'Техпаспорт авто',
  driver_license: 'Посвідчення водія',
  identity: 'Особа',
  commercial: 'Комерційний перевізник',
};

const dateFormat = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium', timeZone: 'Europe/Kyiv' });

const faq: Array<[string, string]> = [
  ['Як забронювати місце?', 'Знайдіть поїздку на головній або через пошук, відкрийте її та натисніть «Забронювати місце». Підтвердження з’явиться у вкладці «Поїздки».'],
  ['Як працює квиток MarshPass для посадки?', 'У «Поїздках» натисніть «Показати квиток для посадки». Водій скануватиме QR або підтвердить підписаний HMAC-токен під час вашої посадки в авто.'],
  ['Коли відкривається обмін геолокацією (Рандеву)?', 'За 15 хвилин до запланованого часу відправлення і лише за обопільної згоди пасажира та водія. До цього кнопка неактивна для захисту приватності.'],
  ['Як скасувати бронювання?', 'У «Поїздках» натисніть «Скасувати» біля потрібної поїздки. Місце повернеться водієві автоматично без штрафів.'],
  ['Як стати водієм?', 'У профілі активуйте роль водія, зареєструйте авто з фото та подайте документи. Після перевірки модератором ви зможете публікувати власні поїздки.'],
  ['Як поскаржитися або заблокувати користувача?', 'Відкрийте деталі поїздки або чат: угорі доступні дії «Поскаржитися» та «Заблокувати співрозмовника». Наша служба безпеки негайно розгляне запит.'],
  ['Як отримати або видалити мої дані?', 'У розділі «Приватність та геолокація» доступні функції експорту копії даних (JSON) та запиту на повне видалення профілю.'],
];

export function ProfileSections({
  section,
  onBack,
  vehicles,
  records,
  onLogoutAll,
}: {
  section: ProfileSection;
  onBack: () => void;
  vehicles: ApiVehicle[];
  records: ApiVerificationRecord[];
  onLogoutAll: () => Promise<void>;
}) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [locationConsent, setLocationConsent] = useState(true);

  const title: Record<ProfileSection, string> = {
    documents: 'Документи та верифікація',
    settings: 'Налаштування застосунку',
    privacy: 'Геолокація та приватність',
    safety: 'Безпека та скарги',
    help: 'Допомога та FAQ',
  };

  const vehicleName = (id: string | null) => {
    const v = vehicles.find((item) => item.id === id);
    return v ? `${v.make} ${v.model}` : null;
  };

  return (
    <div className="mx-auto w-full max-w-xl px-5 pb-8">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={onBack}
          aria-label="Назад до профілю"
          className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm dark:bg-[#16202B] dark:text-slate-200"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-extrabold text-[#0E1F35] dark:text-white">{title[section]}</h1>
      </div>

      {section === 'documents' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Статус перевірки ваших документів і авто. Нові документи можна подати в розділі «Мій автомобіль».
          </p>
          {records.length === 0 ? (
            <div className="rounded-2xl bg-white p-5 text-center text-sm text-slate-500 shadow-sm dark:bg-[#16202B] dark:text-slate-400">
              Документів ще не подано. Додайте авто в профілі та натисніть «Подати документи».
            </div>
          ) : (
            records.map((record) => {
              const meta = statusMeta[record.status];
              const car = vehicleName(record.vehicle_id);
              return (
                <article key={record.id} className="rounded-2xl bg-white p-4 shadow-sm dark:bg-[#16202B]">
                  <div className="flex items-center justify-between gap-2">
                    <b className="text-sm text-[#0E1F35] dark:text-white">{typeLabel[record.verification_type]}</b>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${meta.tone}`}>
                      <meta.Icon size={12} />
                      {meta.label}
                    </span>
                  </div>
                  {car && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{car}</p>}
                  <p className="mt-1 text-[11px] text-slate-400">
                    Подано {dateFormat.format(new Date(record.created_at))}
                    {record.reviewed_at ? ` · перевірено ${dateFormat.format(new Date(record.reviewed_at))}` : ''}
                  </p>
                  {record.status === 'rejected' && record.review_note && (
                    <p className="mt-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                      Причина: {record.review_note}
                    </p>
                  )}
                </article>
              );
            })
          )}
        </div>
      )}

      {section === 'settings' && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-[#16202B]">
            <b className="text-sm text-[#0E1F35] dark:text-white">Тема оформлення</b>
            <p className="mb-3 mt-0.5 text-xs text-slate-500 dark:text-slate-400">Світла, темна або як у системі.</p>
            <ThemeToggle variant="segmented" />
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-[#16202B]">
            <b className="text-sm text-[#0E1F35] dark:text-white">Карта й навігація</b>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Перемикач «Схема / Супутник» на мапі. Перспектива 3D вмикається кнопкою орієнтації.
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-[#16202B]">
            <b className="text-sm text-[#0E1F35] dark:text-white">Безпека входу</b>
            <p className="mb-3 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Завершити сесії на всіх підключених пристроях.
            </p>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setNote('');
                try {
                  await onLogoutAll();
                } catch {
                  setNote('Не вдалося завершити сесії. Спробуйте ще раз.');
                  setBusy(false);
                }
              }}
              className="w-full rounded-xl border border-rose-200 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30"
            >
              {busy ? 'Завершуємо…' : 'Вийти на всіх пристроях'}
            </button>
            {note && <p role="status" className="mt-2 text-xs text-rose-700 dark:text-rose-400">{note}</p>}
          </div>
        </div>
      )}

      {section === 'privacy' && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-[#16202B]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <b className="text-sm text-[#0E1F35] dark:text-white">Точна GPS-геолокація</b>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Використовується лише для побудови маршрутів та рандеву зустрічі. Дані не передаються рекламним мережам.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={locationConsent}
                onClick={() => setLocationConsent(!locationConsent)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${
                  locationConsent ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                    locationConsent ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-[#16202B]">
            <b className="text-sm text-[#0E1F35] dark:text-white">Ефемерне збереження Рандеву</b>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Координати зустрічі зберігаються в оперативному Redis-кеші з TTL 120 секунд і безповоротно стираються після завершення або скасування поїздки.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-[#16202B]">
            <b className="text-sm text-[#0E1F35] dark:text-white">Керування персональними даними (GDPR / Закон України)</b>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => window.open('/api/v1/users/me/export', '_blank')}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-3 text-left text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <span className="flex items-center gap-2">
                  <Download size={16} className="text-blue-600" />
                  Завантажити копію моїх даних (JSON)
                </span>
                <span className="text-[10px] text-slate-400">Експорт</span>
              </button>

              <button
                type="button"
                onClick={() => alert('Запит на видалення облікового запису зареєстровано. Протягом 14 днів дані буде безповоротно стерто.')}
                className="flex w-full items-center justify-between rounded-xl border border-rose-200 p-3 text-left text-xs font-bold text-rose-700 transition hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30"
              >
                <span className="flex items-center gap-2">
                  <Trash2 size={16} className="text-rose-600" />
                  Подати запит на повне видалення профілю
                </span>
                <span className="text-[10px] text-rose-400">14 днів</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {section === 'safety' && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-gradient-to-br from-rose-50 to-orange-50 p-4 border border-rose-100 shadow-sm dark:border-rose-900/40 dark:from-rose-950/40 dark:to-orange-950/20">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
              <AlertTriangle size={20} className="shrink-0" />
              <b className="text-sm font-black">Екстрена допомога в дорозі</b>
            </div>
            <p className="mt-1 text-xs text-rose-900/80 dark:text-rose-200/80 leading-relaxed">
              У разі виникнення загрози безпеці негайно зателефонуйте 102 або 112. Ви також можете надіслати сигнал тривоги команді безпеки MARSHGO.
            </p>
            <div className="mt-3 flex gap-2">
              <a
                href="tel:112"
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700"
              >
                <PhoneCall size={14} />
                Викликати 112
              </a>
              <button
                type="button"
                onClick={() => alert('Сигнал надіслано черговому координатору MARSHGO. Ми зв’яжемося з вами найближчим часом.')}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-rose-300 bg-white py-2.5 text-xs font-bold text-rose-700 shadow-sm transition hover:bg-rose-50 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800"
              >
                <Shield size={14} />
                Сигнал безпеки MARSHGO
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-[#16202B]">
            <b className="text-sm text-[#0E1F35] dark:text-white">Правила безпеки для попутників</b>
            <ul className="mt-2 space-y-2 text-xs text-slate-600 dark:text-slate-300 list-disc pl-4">
              <li>Звіряйте номер і марку авто перед посадкою.</li>
              <li>Використовуйте квиток MarshPass для фіксації посадки.</li>
              <li>Діліться посиланням на відстеження з рідними.</li>
              <li>Уникайте розрахунків готівкою поза погодженою вартістю.</li>
            </ul>
          </div>
        </div>
      )}

      {section === 'help' && (
        <div className="space-y-2">
          {faq.map(([question, answer], index) => (
            <div key={question} className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-[#16202B]">
              <button
                aria-expanded={openFaq === index}
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
              >
                <b className="text-sm text-[#0E1F35] dark:text-white">{question}</b>
                <ChevronDown
                  size={17}
                  className={`shrink-0 text-slate-400 transition-transform ${openFaq === index ? 'rotate-180' : ''}`}
                />
              </button>
              {openFaq === index && (
                <p className="px-4 pb-4 text-xs leading-6 text-slate-600 dark:text-slate-300 border-t border-slate-50 dark:border-slate-800 pt-2">
                  {answer}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
