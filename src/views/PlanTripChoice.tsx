import { ArrowLeft, CarFront, Users } from 'lucide-react';

/** "Запланувати поїздку": the role is chosen for this trip only ("I drive" / "I want a ride"), never as a global account switch. */
export function PlanTripChoice({ onBack, onAsDriver, onAsPassenger }: { onBack: () => void; onAsDriver: () => void; onAsPassenger: () => void }) {
  return <div className="mx-auto w-full max-w-xl px-5 pb-8">
    <div className="mb-4 flex items-center gap-3">
      <button onClick={onBack} aria-label="Назад" className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm"><ArrowLeft size={18}/></button>
      <div><p className="text-xs text-slate-500">Запланувати поїздку</p><h1 className="text-xl font-extrabold">Як ви їдете?</h1></div>
    </div>
    <div className="space-y-3">
      <button type="button" onClick={onAsDriver} className="flex w-full items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-sm">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#EAF3FF] text-[#1789F4]"><CarFront size={24}/></span>
        <span><b className="block">Я їду автомобілем</b><small className="text-slate-500">Шукаю попутників: маршрут, дата й час, місця та ціна</small></span>
      </button>
      <button type="button" onClick={onAsPassenger} className="flex w-full items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-sm">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#EAF3FF] text-[#1789F4]"><Users size={24}/></span>
        <span><b className="block">Я хочу поїхати</b><small className="text-slate-500">Шукаю водія: звідки, куди, дата, час і кількість пасажирів</small></span>
      </button>
    </div>
  </div>;
}
