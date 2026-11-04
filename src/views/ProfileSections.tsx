import { useEffect, useState } from 'react';
import {
  ArrowLeft, CheckCircle2, ChevronDown, Clock3, XCircle, Shield,
  Download, Trash2, AlertTriangle, PhoneCall, ExternalLink,
} from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { productionApi, type ApiTransportCity, type ApiVehicle, type ApiVerificationRecord } from '../services/productionApi';

export type ProfileSection = 'documents' | 'settings' | 'privacy' | 'safety' | 'help' | 'sources';

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

function SourceLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-bold text-blue-700 transition hover:bg-blue-50 dark:border-slate-700 dark:text-blue-300 dark:hover:bg-slate-800"
    >
      <ExternalLink size={14} aria-hidden="true" />
      Першоджерело
    </a>
  );
}

const gpsPermissionLabel: Record<PermissionState | 'unknown', string> = {
  granted: 'Дозвіл надано',
  prompt: 'Ще не запитували',
  denied: 'Дозвіл вимкнено',
  unknown: 'Статус невідомий',
};

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
  onExportData,
  onRequestDeletion,
  onOpenSafetyReport,
}: {
  section: ProfileSection;
  onBack: () => void;
  vehicles: ApiVehicle[];
  records: ApiVerificationRecord[];
  onLogoutAll: () => Promise<void>;
  onExportData: () => Promise<void>;
  onRequestDeletion: () => void;
  onOpenSafetyReport: () => void;
}) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [gpsPermission, setGpsPermission] = useState<PermissionState | 'unknown'>('unknown');
  const [gpsNote, setGpsNote] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState('');
  const [sourceCities, setSourceCities] = useState<ApiTransportCity[] | null>(null);
  const [sourceNote, setSourceNote] = useState('');

  useEffect(() => {
    if (section !== 'sources' || sourceCities !== null) return;
    const controller = new AbortController();
    void productionApi.transportCities(controller.signal)
      .then(setSourceCities)
      .catch(() => { if (!controller.signal.aborted) setSourceNote('Не вдалося отримати список джерел. Спробуйте ще раз пізніше.'); });
    return () => controller.abort();
  }, [section, sourceCities]);

  useEffect(() => {
    let disposed = false;
    navigator.permissions?.query({ name: 'geolocation' as PermissionName }).then((status) => {
      if (disposed) return;
      setGpsPermission(status.state);
      status.addEventListener('change', () => setGpsPermission(status.state));
    }).catch(() => undefined);
    return () => { disposed = true; };
  }, []);

  const requestGpsPermission = () => {
    setGpsNote('');
    if (!navigator.geolocation) {
      setGpsNote('Цей браузер не підтримує визначення місця.');
      return;
    }
    setGpsNote('Запитуємо дозвіл у браузера…');
    navigator.geolocation.getCurrentPosition(
      () => setGpsNote('Дозвіл надано: MARSHGO може використовувати вашу позицію для маршрутів і зустрічі.'),
      (error) => setGpsNote(error.code === error.PERMISSION_DENIED
        ? 'Ви відхилили дозвіл. Увімкніть його в налаштуваннях сайту браузера.'
        : 'Місце не визначилося. Спробуйте ще раз або введіть точку вручну.'),
      { timeout: 10000, maximumAge: 60000 },
    );
  };

  const exportPersonalData = async () => {
    setExporting(true);
    setExportNote('');
    try {
      await onExportData();
    } catch {
      setExportNote('Не вдалося сформувати файл. Спробуйте ще раз пізніше.');
    } finally {
      setExporting(false);
    }
  };

  const title: Record<ProfileSection, string> = {
    documents: 'Документи та верифікація',
    settings: 'Налаштування застосунку',
    privacy: 'Геолокація та приватність',
    safety: 'Безпека та скарги',
    help: 'Допомога та FAQ',
    sources: 'Джерела транспортних даних',
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
          className="grid h-11 w-11 place-items-center rounded-full bg-white shadow-sm dark:bg-[var(--mg-surface-tint)] dark:text-slate-200"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-extrabold text-[var(--mg-ink-primary)] dark:text-white">{title[section]}</h1>
      </div>

      {section === 'documents' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Статус перевірки ваших документів і авто. Нові документи можна подати в розділі «Мій автомобіль».
          </p>
          {records.length === 0 ? (
            <div className="rounded-2xl bg-white p-5 text-center text-sm text-slate-500 shadow-sm dark:bg-[var(--mg-surface-tint)] dark:text-slate-400">
              Документів ще не подано. Додайте авто в профілі та натисніть «Подати документи».
            </div>
          ) : (
            records.map((record) => {
              const meta = statusMeta[record.status];
              const car = vehicleName(record.vehicle_id);
              return (
                <article key={record.id} className="rounded-2xl bg-white p-4 shadow-sm dark:bg-[var(--mg-surface-tint)]">
                  <div className="flex items-center justify-between gap-2">
                    <b className="text-sm text-[var(--mg-ink-primary)] dark:text-white">{typeLabel[record.verification_type]}</b>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${meta.tone}`}>
                      <meta.Icon size={12} />
                      {meta.label}
                    </span>
                  </div>
                  {car && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{car}</p>}
                  <p className="mt-1 text-xs text-slate-400">
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
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-[var(--mg-surface-tint)]">
            <b className="text-sm text-[var(--mg-ink-primary)] dark:text-white">Тема оформлення</b>
            <p className="mb-3 mt-0.5 text-xs text-slate-500 dark:text-slate-400">Світла, темна або як у системі.</p>
            <ThemeToggle variant="segmented" />
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-[var(--mg-surface-tint)]">
            <b className="text-sm text-[var(--mg-ink-primary)] dark:text-white">Карта й навігація</b>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Перемикач «Схема / Супутник» на мапі. Перспектива 3D вмикається кнопкою орієнтації.
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-[var(--mg-surface-tint)]">
            <b className="text-sm text-[var(--mg-ink-primary)] dark:text-white">Безпека входу</b>
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
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-[var(--mg-surface-tint)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <b className="text-sm text-[var(--mg-ink-primary)] dark:text-white">Точна GPS-геолокація</b>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Використовується лише для побудови маршрутів та рандеву зустрічі. Дані не передаються рекламним мережам.
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${gpsPermission === 'granted' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : gpsPermission === 'denied' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                {gpsPermissionLabel[gpsPermission]}
              </span>
            </div>
            <p className="mt-2 text-xs leading-4 text-slate-500 dark:text-slate-400">
              Дозвіл видає браузер, а не MARSHGO. Вимкнути його можна в налаштуваннях доступу цього сайту.
            </p>
            <button
              type="button"
              onClick={requestGpsPermission}
              className="mt-3 min-h-11 w-full rounded-xl bg-blue-600 px-4 text-xs font-bold text-white transition hover:bg-blue-700"
            >
              {gpsPermission === 'granted' ? 'Перевірити доступ ще раз' : 'Надати доступ до місця'}
            </button>
            {gpsNote && <p role="status" className="mt-2 text-xs text-slate-600 dark:text-slate-300">{gpsNote}</p>}
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-[var(--mg-surface-tint)]">
            <b className="text-sm text-[var(--mg-ink-primary)] dark:text-white">Точка зустрічі зберігається тимчасово</b>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Маршрут зустрічі тримається близько двох хвилин і стирається, щойно поїздку завершено або скасовано. Після цього ваші координати ніде не залишаються.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-[var(--mg-surface-tint)]">
            <b className="text-sm text-[var(--mg-ink-primary)] dark:text-white">Керування персональними даними (GDPR / Закон України)</b>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                disabled={exporting}
                onClick={() => void exportPersonalData()}
                className="flex min-h-11 w-full items-center justify-between rounded-xl border border-slate-200 p-3 text-left text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <span className="flex items-center gap-2">
                  <Download size={16} className="text-blue-600" />
                  {exporting ? 'Готуємо файл…' : 'Завантажити копію моїх даних (JSON)'}
                </span>
                <span className="text-xs text-slate-400">Експорт</span>
              </button>
              {exportNote && <p role="status" className="text-xs text-rose-700 dark:text-rose-400">{exportNote}</p>}

              <button
                type="button"
                onClick={onRequestDeletion}
                className="flex min-h-11 w-full items-center justify-between rounded-xl border border-rose-200 p-3 text-left text-xs font-bold text-rose-700 transition hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30"
              >
                <span className="flex items-center gap-2">
                  <Trash2 size={16} className="text-rose-600" />
                  Подати запит на повне видалення профілю
                </span>
                <span className="text-xs text-rose-400">Період очікування</span>
              </button>
              <p className="text-xs leading-4 text-slate-500 dark:text-slate-400">
                Запит підтверджується окремо й має період очікування зі скасуванням. Натискання кнопки саме по собі дані не стирає.
              </p>
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
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a
                href="tel:112"
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700"
              >
                <PhoneCall size={14} />
                Викликати 112
              </a>
              <button
                type="button"
                onClick={onOpenSafetyReport}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-300 bg-white px-3 text-xs font-bold text-rose-700 shadow-sm transition hover:bg-rose-50 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800"
              >
                <Shield size={14} />
                Скарги та блокування
              </button>
            </div>
            <p className="mt-2 text-xs leading-4 text-slate-500 dark:text-slate-400">
              Скаргу надсилають із чату конкретної поїздки — там видно, на кого саме скаржаться. Окремої кнопки тривоги поза поїздкою в застосунку немає.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-[var(--mg-surface-tint)]">
            <b className="text-sm text-[var(--mg-ink-primary)] dark:text-white">Правила безпеки для попутників</b>
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
            <div key={question} className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-[var(--mg-surface-tint)]">
              <button
                aria-expanded={openFaq === index}
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
              >
                <b className="text-sm text-[var(--mg-ink-primary)] dark:text-white">{question}</b>
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
      {section === 'sources' && (
        <div className="space-y-3">
          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            Розклади, зупинки й живий рух MARSHGO бере не з повітря: нижче — відкриті джерела по кожному місту та умови їхнього використання.
          </p>
          {sourceNote && <p role="status" className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-4 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{sourceNote}</p>}
          {!sourceCities && !sourceNote && <p role="status" aria-busy="true" className="text-xs text-slate-500 dark:text-slate-400">Завантажуємо джерела…</p>}
          {sourceCities?.length === 0 && <p className="text-xs text-slate-500 dark:text-slate-400">Зараз підключених джерел немає — тож і маршрутів із реальним розкладом поки не буде.</p>}
          {sourceCities?.map((city) => {
            const fallbackHref = city.sourceUrl;
            return <div key={city.id} data-testid="profile-source-city" className="rounded-2xl bg-white p-4 shadow-sm dark:bg-[var(--mg-surface-tint)]">
              <div className="flex items-start justify-between gap-3">
                <b className="text-sm text-[var(--mg-ink-primary)] dark:text-white">{city.name}</b>
                <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">{city.routeCount} маршрутів · {city.stopCount} зупинок</span>
              </div>
              <p className="mt-1 text-xs leading-4 text-slate-500 dark:text-slate-400">
                {city.realtimeAvailable ? 'Живий рух підключений' : 'Лише статичний розклад'} · {city.licenses.length ? city.licenses.join(', ') : 'умови використання уточнюються'}
              </p>
              <ul className="mt-2 space-y-1.5">
                {city.providers.map((provider) => {
                  const href = provider.sourceRef ?? fallbackHref;
                  return <li key={`${city.id}-${provider.name}-${href ?? 'no-ref'}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-700 dark:text-slate-200">
                    <span className="min-w-0 flex-1"><b className="font-bold">{provider.name}</b><small className="block text-xs text-slate-500 dark:text-slate-400">{provider.sourceType}{provider.license ? ` · ${provider.license}` : ''}</small></span>
                    {href && <SourceLink href={href}/>}
                  </li>;
                })}
                {city.providers.length === 0 && (fallbackHref
                  ? <li><SourceLink href={fallbackHref}/></li>
                  : <li className="text-xs text-slate-500 dark:text-slate-400">Первинне джерело цього міста не опубліковане.</li>)}
              </ul>
            </div>;
          })}
        </div>
      )}
    </div>
  );
}
