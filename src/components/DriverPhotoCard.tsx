import { useState } from 'react';
import { Camera, UserRound } from 'lucide-react';
import { productionApi } from '../services/productionApi';

/** The driver's face photo: required to drive, belongs to the person (vehicles keep their own photos). Passengers don't need it. */
export function DriverPhotoCard({ photoUrl, isDriver, onChange }: { photoUrl: string | null | undefined; isDriver: boolean; onChange: (url: string | null, message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const upload = async (file: File) => {
    setBusy(true); setError('');
    try { const result = await productionApi.uploadDriverPhoto(file); onChange(result.driver_photo_url, 'Фото водія збережено.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не вдалося завантажити фото.'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true); setError('');
    try { await productionApi.deleteDriverPhoto(); onChange(null, 'Фото водія видалено.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не вдалося видалити фото.'); }
    finally { setBusy(false); }
  };
  return <section aria-label="Фото водія" className="mt-4 rounded-[1.4rem] bg-white p-4 shadow-sm">
    <div className="flex items-center gap-4">
      <span className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-[#EAF3FF] text-[#1789F4]">
        {photoUrl ? <img src={photoUrl} alt="Фото водія" className="h-full w-full object-cover"/> : <UserRound size={30}/>}
      </span>
      <div className="min-w-0 flex-1"><h2 className="font-extrabold">Фото водія</h2>
        <p className="mt-0.5 text-xs leading-5 text-slate-500">{photoUrl ? 'Пасажири бачать це фото у ваших поїздках.' : isDriver ? 'Обов’язкове для водія: чітке фото обличчя. Фото авто додаються окремо.' : 'Потрібне лише тим, хто возить пасажирів.'}</p></div>
    </div>
    {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700">{error}</p>}
    <div className="mt-3 flex gap-2">
      <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#EAF3FF] py-2.5 text-xs font-bold text-[#1789F4]"><Camera size={15}/>{busy ? 'Зачекайте…' : photoUrl ? 'Замінити фото' : 'Додати фото обличчя'}
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="user" disabled={busy} className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = ''; }}/></label>
      {photoUrl && <button type="button" disabled={busy} onClick={() => void remove()} className="rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600 disabled:opacity-50">Видалити</button>}
    </div>
  </section>;
}
