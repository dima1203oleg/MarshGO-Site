import { Check } from 'lucide-react';
import { filterModes, toggleMode, defaultSelection, type FilterModeId, type TransportSelection } from '../domain/transportPreferences';

/** "Як хочете їхати?": multi-select chips. Modes without a connected provider stay visible but disabled, with the reason. */
export function TransportFilter({ selection, available, onChange }: { selection: TransportSelection; available: Set<FilterModeId>; onChange: (selection: TransportSelection) => void }) {
  return <fieldset className="mt-3 rounded-2xl bg-[#f6f8fc] p-3"><legend className="px-1 text-xs font-bold text-[#0E1F35]">Як хочете їхати?</legend>
    <div className="flex flex-wrap gap-2">
      <button type="button" aria-pressed={selection.all} onClick={() => onChange(defaultSelection)} className={`inline-flex items-center gap-1 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${selection.all ? 'border-[#1789F4] bg-[#1789F4] text-white' : 'border-[#E5EDF7] bg-white text-slate-600'}`}>{selection.all && <Check size={12}/>}Усі</button>
      {filterModes.map((mode) => { const enabled = available.has(mode.id); const active = !selection.all && selection.modes.includes(mode.id);
        return <button key={mode.id} type="button" disabled={!enabled} aria-pressed={active} title={enabled ? undefined : 'Немає підключеного провайдера у вашому регіоні'} onClick={() => onChange(toggleMode(selection, mode.id))}
          className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${active ? 'border-[#1789F4] bg-[#EAF3FF] text-[#1789F4]' : selection.all && enabled ? 'border-[#BBD7FB] bg-white text-[#0E1F35]' : 'border-[#E5EDF7] bg-white text-slate-500'} disabled:cursor-not-allowed disabled:opacity-45`}>{mode.label}</button>; })}
    </div>
    <p className="mt-2 text-[10px] text-slate-400">Можна обрати кілька. Недоступні види вимкнені: для них ще немає підключеного джерела даних.</p>
  </fieldset>;
}
