import { useState } from 'react';
import { CalendarClock, CarFront, Minus, Plus, Wallet, X } from 'lucide-react';
import { productionApi, type ApiBookingChange, type ApiOffer, type ApiVehicle } from '../services/productionApi';
import { formatKyivDateTimeInput, kyivDateTimeInputToIso } from '../domain/kyivTime';

const money = (minor: number, currency = 'UAH') => new Intl.NumberFormat('uk-UA', { style: 'currency', currency, maximumFractionDigits: 0 }).format(minor / 100);
const when = (iso: string) => new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' }).format(new Date(iso));
export const offerStatusLabel: Record<string, string> = { published: 'Опубліковано', in_progress: 'У дорозі', completed: 'Завершено', cancelled: 'Скасовано' };

/**
 * Edit a published trip. Only changed fields are sent; the server decides what needs passenger approval
 * (higher price, a departure shift above 30 min, another vehicle) and what applies at once.
 */
export function OfferEditSheet({ offer, vehicles, onClose, onDone }: { offer: ApiOffer; vehicles: ApiVehicle[]; onClose: () => void; onDone: (message: string) => void }) {
  const booked = offer.total_seats - offer.available_seats;
  const [price, setPrice] = useState(String(Math.round(offer.price_per_seat_minor / 100)));
  const [departure, setDeparture] = useState(formatKyivDateTimeInput(offer.departure_at));
  const [seats, setSeats] = useState(offer.total_seats);
  const [vehicleId, setVehicleId] = useState(offer.vehicle_id ?? '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  const save = async () => {
    const input: Parameters<typeof productionApi.updateOffer>[1] = {};
    const priceMinor = Math.round(Number(price.replace(',', '.')) * 100);
    if (!Number.isFinite(priceMinor) || priceMinor < 0) { setError('Вкажіть коректну ціну.'); return; }
    if (priceMinor !== offer.price_per_seat_minor) input.pricePerSeatMinor = priceMinor;
    // The picker has minute precision: an untouched field must not turn into a "changed by seconds" departure.
    if (departure !== formatKyivDateTimeInput(offer.departure_at)) {
      const iso = kyivDateTimeInputToIso(departure);
      if (!iso) { setError('Вкажіть коректні дату й час.'); return; }
      input.departureAt = iso;
    }
    if (seats !== offer.total_seats) input.totalSeats = seats;
    if (vehicleId && vehicleId !== offer.vehicle_id) input.vehicleId = vehicleId;
    if (Object.keys(input).length === 0) { onClose(); return; }
    if (reason.trim()) input.reason = reason.trim();
    setBusy(true); setError('');
    try {
      const result = await productionApi.updateOffer(offer.id, input);
      onDone(result.approvalsRequested > 0
        ? `Поїздку оновлено. ${result.approvalsRequested} пасажир(ів) отримали запит підтвердити зміни.`
        : result.bookingsNotified > 0 ? 'Поїздку оновлено. Пасажирів повідомлено.' : 'Поїздку оновлено.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не вдалося зберегти зміни.'); }
    finally { setBusy(false); }
  };

  const cancelTrip = async () => {
    setBusy(true); setError('');
    try {
      const result = await productionApi.cancelOffer(offer.id, reason.trim() || undefined);
      onDone(result.cancelledBookings > 0 ? `Поїздку скасовано. ${result.cancelledBookings} бронювань скасовано, пасажирів повідомлено.` : 'Поїздку скасовано.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не вдалося скасувати поїздку.'); setBusy(false); }
  };

  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/50 p-3 sm:items-center">
    <section role="dialog" aria-modal="true" aria-labelledby="offer-edit-title" className="max-h-[92svh] w-full max-w-md overflow-y-auto rounded-[1.7rem] bg-white p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-slate-500">{offer.origin_name} → {offer.destination_name}</p><h2 id="offer-edit-title" className="text-lg font-extrabold">Редагувати поїздку</h2></div>
        <button type="button" onClick={onClose} aria-label="Закрити" className="grid h-9 w-9 place-items-center rounded-full bg-slate-100"><X size={17}/></button></div>
      {booked > 0 && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">Заброньовано місць: {booked}. Вища ціна, зсув часу понад 30 хв або інше авто потребують згоди кожного пасажира; нижча ціна застосовується одразу.</p>}
      <label className="mt-4 block text-xs font-bold text-slate-600"><span className="flex items-center gap-1.5"><Wallet size={14}/>Ціна за місце, грн</span>
        <input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} className="mt-1.5 w-full rounded-xl bg-slate-50 px-3 py-3 text-sm font-bold outline-none"/></label>
      <label className="mt-3 block text-xs font-bold text-slate-600"><span className="flex items-center gap-1.5"><CalendarClock size={14}/>Відправлення (Київ)</span>
        <input type="datetime-local" value={departure} onChange={(event) => setDeparture(event.target.value)} className="mt-1.5 w-full rounded-xl bg-slate-50 px-3 py-3 text-sm font-bold outline-none"/></label>
      <div className="mt-3"><p className="text-xs font-bold text-slate-600">Місць у поїздці</p>
        <div className="mt-1.5 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
          <button type="button" aria-label="Менше місць" disabled={seats <= Math.max(1, booked)} onClick={() => setSeats(seats - 1)} className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-sm disabled:opacity-30"><Minus size={16}/></button>
          <b>{seats}</b>
          <button type="button" aria-label="Більше місць" disabled={seats >= 8} onClick={() => setSeats(seats + 1)} className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-sm disabled:opacity-30"><Plus size={16}/></button>
        </div>{booked > 0 && <small className="mt-1 block text-[11px] text-slate-500">Не менше, ніж уже заброньовано ({booked}).</small>}</div>
      {vehicles.length > 1 && <label className="mt-3 block text-xs font-bold text-slate-600"><span className="flex items-center gap-1.5"><CarFront size={14}/>Автомобіль</span>
        <select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} className="mt-1.5 w-full rounded-xl bg-slate-50 px-3 py-3 text-sm font-bold outline-none">
          {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.make} {vehicle.model}{vehicle.plate ? ` · ${vehicle.plate}` : ''}</option>)}
        </select></label>}
      <label className="mt-3 block text-xs font-bold text-slate-600">Причина для пасажирів (необов’язково)
        <input value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} placeholder="Наприклад, змінилися плани" className="mt-1.5 w-full rounded-xl bg-slate-50 px-3 py-3 text-sm outline-none"/></label>
      {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
      {!confirmCancel ? <>
        <button type="button" disabled={busy} onClick={() => void save()} className="mt-4 w-full rounded-2xl bg-[#1789F4] py-3.5 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Зберігаємо…' : 'Зберегти зміни'}</button>
        <button type="button" disabled={busy} onClick={() => setConfirmCancel(true)} className="mt-2 w-full rounded-2xl border border-rose-200 py-3 text-sm font-bold text-rose-700 disabled:opacity-50">Скасувати поїздку</button>
      </> : <div role="alertdialog" aria-labelledby="offer-cancel-title" className="mt-4 rounded-2xl bg-rose-50 p-4">
        <b id="offer-cancel-title" className="block text-sm text-rose-900">Скасувати поїздку для всіх пасажирів?</b>
        <p className="mt-1 text-xs leading-5 text-rose-800">Бронювання буде скасовано, пасажири отримають сповіщення. Дію не можна відмінити.</p>
        <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" autoFocus onClick={() => setConfirmCancel(false)} className="rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700">Залишити</button>
          <button type="button" disabled={busy} onClick={() => void cancelTrip()} className="rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white disabled:opacity-50">{busy ? 'Скасовуємо…' : 'Так, скасувати'}</button></div>
      </div>}
    </section>
  </div>;
}

/** What the driver changed, shown on the passenger's booking with an explicit choice. Declining is a free cancellation. */
export function PendingChangeCard({ change, currency, onDecided }: { change: ApiBookingChange; currency: string; onDecided: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [error, setError] = useState('');
  const { summary } = change;
  const rows: Array<[string, string, string]> = [];
  if (summary.departure) rows.push(['Відправлення', when(summary.departure.old), when(summary.departure.new)]);
  if (summary.price) rows.push(['Ціна за місце', money(summary.price.old, currency), money(summary.price.new, currency)]);
  if (summary.vehicle) rows.push(['Автомобіль', summary.vehicle.old, summary.vehicle.new]);
  if (summary.seats) rows.push(['Місць у поїздці', String(summary.seats.old), String(summary.seats.new)]);
  const decide = async (accept: boolean) => {
    setBusy(true); setError('');
    try {
      if (accept) { await productionApi.acceptBookingChange(change.id); onDecided('Зміни прийнято. Бронювання діє на нових умовах.'); }
      else { await productionApi.rejectBookingChange(change.id); onDecided('Ви відмовилися від змін. Бронювання скасовано без штрафу.'); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не вдалося зберегти рішення.'); setBusy(false); }
  };
  return <section aria-label="Водій змінив умови поїздки" className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
    <b className="block text-sm text-amber-900">Водій змінив умови поїздки</b>
    <dl className="mt-2 space-y-1.5">{rows.map(([label, before, after]) => <div key={label} className="grid grid-cols-[1fr_auto] gap-2 text-xs"><dt className="text-amber-900/80">{label}</dt>
      <dd className="text-right"><span className="text-slate-500 line-through">{before}</span> → <b className="text-[#0E1F35]">{after}</b></dd></div>)}</dl>
    {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
    {!confirmDecline ? <div className="mt-3 grid grid-cols-2 gap-2">
      <button type="button" disabled={busy} onClick={() => void decide(true)} className="rounded-xl bg-[#1789F4] py-2.5 text-xs font-bold text-white disabled:opacity-50">Погодитися</button>
      <button type="button" disabled={busy} onClick={() => setConfirmDecline(true)} className="rounded-xl border border-amber-300 bg-white py-2.5 text-xs font-bold text-amber-900 disabled:opacity-50">Відмовитися</button>
    </div> : <div className="mt-3 rounded-xl bg-white p-3"><p className="text-xs text-slate-700">Відмова скасує бронювання без штрафу, місце повернеться водію.</p>
      <div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => setConfirmDecline(false)} className="rounded-xl border border-slate-200 py-2 text-xs font-bold">Назад</button>
        <button type="button" disabled={busy} onClick={() => void decide(false)} className="rounded-xl bg-rose-600 py-2 text-xs font-bold text-white disabled:opacity-50">Так, відмовитися</button></div></div>}
  </section>;
}
