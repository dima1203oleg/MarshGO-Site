import { useState } from 'react';
import { ArrowLeft, CheckCircle2, ChevronDown, Clock3, XCircle } from 'lucide-react';
import { MapLayerSwitch } from '../components/MapLayerSwitch';
import { ThemeToggle } from '../components/ThemeToggle';
import type { ApiVehicle, ApiVerificationRecord } from '../services/productionApi';

export type ProfileSection = 'documents' | 'settings' | 'help';

const statusMeta = {
  approved: { label: 'Підтверджено', tone: 'bg-emerald-50 text-emerald-700', Icon: CheckCircle2 },
  pending: { label: 'На перевірці', tone: 'bg-amber-50 text-amber-700', Icon: Clock3 },
  rejected: { label: 'Відхилено', tone: 'bg-rose-50 text-rose-700', Icon: XCircle },
} as const;
const typeLabel: Record<ApiVerificationRecord['verification_type'], string> = {
  vehicle: 'Техпаспорт авто', driver_license: 'Посвідчення водія', identity: 'Особа', commercial: 'Комерційний перевізник',
};
const dateFormat = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium', timeZone: 'Europe/Kyiv' });

const faq: Array<[string, string]> = [
  ['Як забронювати місце?', 'Знайдіть поїздку на головній, відкрийте її та натисніть «Забронювати місце». Підтвердження з’явиться у вкладці «Поїздки».'],
  ['Як працює квиток для посадки?', 'У «Поїздках» натисніть «Показати квиток для посадки». Водій скануватиме QR або вставить підписаний токен, коли ви сядете.'],
  ['Коли відкривається обмін місцем?', 'За 15 хвилин до запланованого виїзду. До цього кнопка неактивна.'],
  ['Як скасувати бронювання?', 'У «Поїздках» натисніть «Скасувати» біля потрібної поїздки. Місце повернеться водієві автоматично.'],
  ['Як стати водієм?', 'У профілі увімкніть роль водія, додайте авто з фото та подайте документи. Після перевірки модератором можна публікувати поїздки.'],
  ['Як заблокувати користувача або поскаржитися?', 'Відкрийте чат із бронювання: угорі є кнопки «Поскаржитися» та «Заблокувати співрозмовника».'],
  ['Як отримати або видалити мої дані?', 'У профілі: «Завантажити мої дані (JSON)» та «Подати запит на видалення». Видалення має період очікування з можливістю скасування.'],
];

export function ProfileSections({ section, onBack, vehicles, records, onLogoutAll }: {
  section: ProfileSection; onBack: () => void; vehicles: ApiVehicle[]; records: ApiVerificationRecord[]; onLogoutAll: () => Promise<void>;
}) {
  const [open, setOpen] = useState<number | null>(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const title = { documents: 'Документи', settings: 'Налаштування', help: 'Допомога' }[section];
  const vehicleName = (id: string | null) => { const v = vehicles.find((item) => item.id === id); return v ? `${v.make} ${v.model}` : null; };

  return <div className="mx-auto w-full max-w-xl px-5 pb-8">
    <div className="mb-4 flex items-center gap-3"><button onClick={onBack} aria-label="Назад до профілю" className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm"><ArrowLeft size={18} /></button><h1 className="text-lg font-extrabold text-[#0E1F35]">{title}</h1></div>

    {section === 'documents' && <div className="space-y-3">
      <p className="text-xs text-slate-500">Статус перевірки ваших документів і авто. Нові документи можна подати в розділі «Мій автомобіль».</p>
      {records.length === 0 ? <div className="rounded-2xl bg-white p-5 text-center text-sm text-slate-500 shadow-sm">Документів ще не подано. Додайте авто в профілі та натисніть «Подати документи».</div>
        : records.map((record) => { const meta = statusMeta[record.status]; const car = vehicleName(record.vehicle_id); return <article key={record.id} className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2"><b className="text-sm text-[#0E1F35]">{typeLabel[record.verification_type]}</b><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${meta.tone}`}><meta.Icon size={12} />{meta.label}</span></div>
          {car && <p className="mt-1 text-xs text-slate-500">{car}</p>}
          <p className="mt-1 text-[11px] text-slate-400">Подано {dateFormat.format(new Date(record.created_at))}{record.reviewed_at ? ` · перевірено ${dateFormat.format(new Date(record.reviewed_at))}` : ''}</p>
          {record.status === 'rejected' && record.review_note && <p className="mt-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">Причина: {record.review_note}</p>}
        </article>; })}
    </div>}

    {section === 'settings' && <div className="space-y-3">
      <div className="rounded-2xl bg-white p-4 shadow-sm"><b className="text-sm text-[#0E1F35]">Тема оформлення</b><p className="mb-3 mt-0.5 text-xs text-slate-500">Світла, темна або як у системі.</p><ThemeToggle variant="segmented" /></div>
      <div className="rounded-2xl bg-white p-4 shadow-sm"><b className="text-sm text-[#0E1F35]">Режим карти</b><p className="mb-3 mt-0.5 text-xs text-slate-500">2D — планування й шари транспорту, 3D — чиста навігація, Супутник — знімки Esri. Під час навігації автоматично вмикається 3D.</p><MapLayerSwitch /></div>
      <div className="rounded-2xl bg-white p-4 shadow-sm"><b className="text-sm text-[#0E1F35]">Безпека входу</b><p className="mb-3 mt-0.5 text-xs text-slate-500">Завершити сесії на всіх пристроях, зокрема на цьому. Знадобиться новий вхід за номером.</p>
        <button disabled={busy} onClick={async () => { setBusy(true); setNote(''); try { await onLogoutAll(); } catch { setNote('Не вдалося завершити сесії. Спробуйте ще раз.'); setBusy(false); } }} className="w-full rounded-xl border border-rose-200 py-3 text-sm font-bold text-rose-700 disabled:opacity-50">{busy ? 'Завершуємо…' : 'Вийти на всіх пристроях'}</button>
        {note && <p role="status" className="mt-2 text-xs text-rose-700">{note}</p>}</div>
    </div>}

    {section === 'help' && <div className="space-y-2">
      {faq.map(([question, answer], index) => <div key={question} className="overflow-hidden rounded-2xl bg-white shadow-sm"><button aria-expanded={open === index} onClick={() => setOpen(open === index ? null : index)} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"><b className="text-sm text-[#0E1F35]">{question}</b><ChevronDown size={17} className={`shrink-0 text-slate-400 transition-transform ${open === index ? 'rotate-180' : ''}`} /></button>{open === index && <p className="px-4 pb-4 text-sm leading-6 text-slate-600">{answer}</p>}</div>)}
    </div>}
  </div>;
}
