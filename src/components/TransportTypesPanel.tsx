import { useState } from 'react';
import { Bike, Bus, CarFront, CarTaxiFront, Footprints, KeyRound, Plane, Repeat, Ship, Ticket, TrainFront, TrainFrontTunnel, TramFront, Users, Zap, type LucideIcon } from 'lucide-react';
import { choiceFor, hasJourneySearchProvider, isAllActive, isJourneySearchSupported, providersForJourneySearch, selectAll, toggleProvider, toggleType, transportTypes, type TransportSelection, type TransportTypeId } from '../domain/transportPreferences';
import { transportGroups } from '../domain/transportCatalog';
import type { ApiTransportProviders } from '../services/productionApi';

const tileIcons: Record<TransportTypeId, LucideIcon> = {
  carpool: CarFront, taxi: CarTaxiFront, carsharing: KeyRound, car_rental: CarFront, transfer: Repeat, bus: Bus, marshrutka: Users, trolleybus: Bus, tram: TramFront, metro: TrainFront, city_train: TrainFrontTunnel, funicular: TrainFront,
  train: TrainFront, suburban_train: TrainFrontTunnel, intercity_bus: Ticket, bike: Bike, scooter: Zap, moped: Bike, plane: Plane, ferry: Ship, walk: Footprints,
};

/** Rounded square tile: unsupported or unconnected types remain visible and cannot be selected. */
function Tile({ label, Icon, selected, disabled, disabledReason, onClick }: { label: string; Icon: LucideIcon; selected: boolean; disabled: boolean; disabledReason?: string; onClick: () => void }) {
  if (disabled) return <button type="button" disabled aria-disabled="true" title={disabledReason} className="relative flex cursor-not-allowed flex-col items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-100 px-1 py-3 text-center text-[11px] font-semibold leading-tight text-slate-400"><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-200 text-slate-400"><Icon size={18}/></span>{label}</button>;
  return <button type="button" aria-pressed={selected} onClick={onClick} className={`relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 py-3 text-center text-[11px] font-semibold leading-tight transition-colors ${selected ? 'border-[#1789F4] bg-[#EAF3FF] text-[#1789F4]' : 'border-[#E5EDF7] bg-white text-[#475569] shadow-sm'}`}>
    <span className={`grid h-9 w-9 place-items-center rounded-xl ${selected ? 'bg-[#1789F4] text-white' : 'bg-[#F1F5F9] text-[#1789F4]'}`}><Icon size={18}/></span>{label}
  </button>;
}

/**
 * "Види транспорту → Провайдери". All transport types stay visible as grouped square tiles (blue = selected, neutral = not selected).
 * Providers appear below only for selected types, each type with its own group, and only those connected and covering the search area.
 */
export function TransportTypesPanel({ selection, groups, onChange }: { selection: TransportSelection; groups: ApiTransportProviders[] | null; onChange: (selection: TransportSelection) => void }) {
  const [expandedAll, setExpandedAll] = useState(false);
  const allActive = isAllActive(selection);
  const showProviders = selection.active.length > 0 && (!allActive || expandedAll);
  // Only route-engine modes are selectable. Walking is an automatic access leg; provider availability can disable a supported type for this search area.
  const isConnected = (type: TransportTypeId) => isJourneySearchSupported(type)
    && (groups === null || hasJourneySearchProvider(type, groups));
  const disabledReason = (type: TransportTypeId) => !isJourneySearchSupported(type)
    ? type === 'walk' ? 'Пішки додається автоматично до комбінованого маршруту.' : 'Цей вид ще не підтримується побудовою маршрутів.'
    : groups !== null && !isConnected(type) ? 'Немає підключеного провайдера у вибраному районі.' : undefined;
  const providersOf = (type: TransportTypeId) => providersForJourneySearch(type, groups);

  return <section aria-label="Види транспорту" className="mt-4">
    <div className="mb-0.5 flex items-center justify-between"><h2 className="text-sm font-extrabold text-[#0E1F35]">Види транспорту</h2>
      <button type="button" aria-pressed={allActive} onClick={() => onChange(allActive ? { ...selection, active: [] } : selectAll(selection))} className={`rounded-full border px-4 py-1.5 text-xs font-bold ${allActive ? 'border-[#1789F4] bg-[#1789F4] text-white' : 'border-slate-200 bg-white text-[#1789F4]'}`}>Усі</button></div>
    <p className="mb-3 text-xs leading-5 text-slate-500">{transportTypes.length} видів транспорту. Сірі плитки не входять у пошук або не мають фіда в цьому районі; пішки додається автоматично.</p>
    {transportGroups.map((group) => <div key={group} className="mb-3"><h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">{group}</h3>
      <div className="transport-mode-grid grid grid-cols-3 gap-2.5">{transportTypes.filter((type) => type.group === group).map((type) => <Tile key={type.id} label={type.label} Icon={tileIcons[type.id]} selected={selection.active.includes(type.id)} disabled={!isConnected(type.id)} disabledReason={disabledReason(type.id)} onClick={() => onChange(toggleType(selection, type.id))}/>)}</div></div>)}
    {allActive && <button type="button" onClick={() => setExpandedAll((value) => !value)} className="mt-1 text-xs font-bold text-[#1789F4]">{expandedAll ? 'Сховати провайдерів' : 'Налаштувати провайдерів'}</button>}
    {showProviders && <div className="mt-3 space-y-3" aria-label="Провайдери">
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Провайдери</h3>
      {transportTypes.filter((type) => selection.active.includes(type.id) && isConnected(type.id)).map((type) => { const providers = providersOf(type.id); const choice = choiceFor(selection, type.id);
        return <div key={type.id} className="rounded-2xl bg-[#f6f8fc] p-3"><p className="mb-2 text-xs font-extrabold text-[#0E1F35]">{type.label}</p>
          {type.id === 'walk' ? <p className="text-xs text-slate-500">Ходьба також входить у комбіновані маршрути автоматично.</p>
            : providers.length === 0 ? <p className="text-xs text-slate-500">Провайдери недоступні у цьому районі.</p>
            : <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={choice.all} onClick={() => onChange(toggleProvider(selection, type.id, 'all'))} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${choice.all ? 'border-[#1789F4] bg-[#EAF3FF] text-[#1789F4]' : 'border-[#E5EDF7] bg-white text-slate-500'}`}>{choice.all && '✓ '}Усі провайдери</button>
              {providers.map((provider) => { const checked = !choice.all && choice.ids.includes(provider.id);
                return <button key={provider.id} type="button" aria-pressed={checked} onClick={() => onChange(toggleProvider(selection, type.id, provider.id))} title={provider.cities.join(', ') || undefined} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${checked ? 'border-[#1789F4] bg-[#1789F4] text-white' : 'border-[#E5EDF7] bg-white text-slate-600'}`}>{provider.name}</button>; })}
            </div>}
        </div>; })}
    </div>}
  </section>;
}
