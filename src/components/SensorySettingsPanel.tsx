import { Film, Navigation, Play, RotateCcw, Sparkles, Vibrate, Volume2 } from 'lucide-react';
import { sensory, useInteractionPreferences } from '../sensory';
import type { SensoryStyle } from '../sensory';

const styleOptions: Array<{ id: SensoryStyle; label: string; hint: string }> = [
  { id: 'balanced', label: 'Збалансований', hint: 'Помірний відгук для щоденних поїздок.' },
  { id: 'expressive', label: 'Виразний', hint: 'Повніша гучність і акценти для преміального відчуття.' },
  { id: 'minimal', label: 'Мінімальний', hint: 'Лише найважливіше, тихіше й стриманіше.' },
];

function SwitchRow({ label, hint, checked, disabled, onChange }: {
  label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: (next: boolean) => void;
}) {
  return (
    <label className={`flex min-h-11 min-w-0 items-center gap-3 rounded-xl px-1 py-1 text-sm ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5'}`}>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-tight text-[var(--mg-ink-primary)] dark:text-white">{label}</span>
        {hint && <span className="mt-0.5 block text-xs font-normal leading-4 text-slate-500 dark:text-slate-400">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" aria-label={label} checked={checked} disabled={disabled} onChange={() => onChange(!checked)} className="peer sr-only" />
      <span aria-hidden="true" className="relative h-6 w-11 shrink-0 rounded-full bg-slate-300 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-[var(--mg-action)] peer-checked:after:translate-x-5 peer-disabled:bg-slate-200 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--mg-blue)] dark:bg-slate-700 dark:peer-disabled:bg-slate-800" />
    </label>
  );
}

export function SensorySettingsPanel() {
  const { prefs, reducedMotion, hapticsSupported, hapticsNative, setPreferences, resetPreferences } = useInteractionPreferences();
  const hapticsNote = hapticsNative
    ? 'Системний вібровідгук пристрою.'
    : hapticsSupported
      ? 'Вібровідгук браузера (може відрізнятися від системного).'
      : 'Цей пристрій або браузер не підтримує вібровідгук.';

  return (
    <div className="@container rounded-2xl bg-white p-4 shadow-sm dark:bg-[var(--mg-surface-tint)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <b className="text-sm text-[var(--mg-ink-primary)] dark:text-white">Звуки та відгук</b>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Короткі звуки й вібрація підтверджують дії. Налаштування зберігаються на цьому пристрої.
          </p>
        </div>
        <button
          type="button"
          onClick={() => sensory.emit({ type: 'RESULT_SELECTED', journeyId: 'sensory-preview' })}
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-bold text-[var(--mg-blue-ink)] transition hover:bg-blue-50 dark:border-slate-700 dark:text-blue-300 dark:hover:bg-slate-800"
        >
          <Play size={14} aria-hidden="true" />
          Прослухати
        </button>
      </div>

      <div className="mt-3 space-y-1">
        <SwitchRow
          label="Звуки інтерфейсу"
          hint="Один короткий звук на підтверджену дію."
          checked={prefs.soundsEnabled}
          onChange={(next) => setPreferences({ soundsEnabled: next })}
        />
        <div className={`px-1 py-1 ${prefs.soundsEnabled ? '' : 'opacity-50'}`}>
          <div className="flex items-center gap-3">
            <Volume2 size={18} className="shrink-0 text-[var(--mg-blue)]" aria-hidden="true" />
            <label htmlFor="sensory-volume" className="min-w-0 flex-1 text-sm font-semibold text-[var(--mg-ink-primary)] dark:text-white">
              Гучність
              <span className="ml-2 text-xs font-bold text-slate-500 dark:text-slate-400">{Math.round(prefs.volume * 100)}%</span>
            </label>
          </div>
          <input
            id="sensory-volume"
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(prefs.volume * 100)}
            disabled={!prefs.soundsEnabled}
            onChange={(event) => setPreferences({ volume: Number(event.target.value) / 100 })}
            aria-label="Гучність звуків інтерфейсу"
            className="mt-2 h-11 w-full cursor-pointer accent-[var(--mg-action)] disabled:cursor-not-allowed"
          />
        </div>
        <SwitchRow
          label="Вібровідгук"
          hint={hapticsNote}
          checked={prefs.hapticsEnabled}
          disabled={!hapticsSupported}
          onChange={(next) => setPreferences({ hapticsEnabled: next })}
        />
        <SwitchRow
          label="Кінематографічна камера"
          hint="Плавні польоти камери на мапі маршруту."
          checked={prefs.cinematicCamera}
          onChange={(next) => setPreferences({ cinematicCamera: next })}
        />
        <SwitchRow
          label="Звуки навігації"
          hint="Звукові підказки під час покрокової навігації."
          checked={prefs.navigationSounds}
          onChange={(next) => setPreferences({ navigationSounds: next })}
        />
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="shrink-0 text-[var(--mg-blue)]" aria-hidden="true" />
          <b className="text-xs font-bold text-[var(--mg-ink-primary)] dark:text-white">Стиль відгуку</b>
        </div>
        <div role="radiogroup" aria-label="Стиль звукового відгуку" className="mt-2 grid grid-cols-1 gap-1 rounded-xl bg-slate-100 p-1 @min-xs:grid-cols-3 dark:bg-slate-800">
          {styleOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={prefs.style === option.id}
              onClick={() => setPreferences({ style: option.id })}
              className={`min-h-11 rounded-lg px-2 text-xs font-bold transition ${prefs.style === option.id ? 'bg-[var(--mg-action)] text-white shadow-sm' : 'text-slate-600 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-700/60'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          {styleOptions.find((option) => option.id === prefs.style)?.hint}
        </p>
      </div>

      {reducedMotion && (
        <p role="status" className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--mg-surface-tint)] p-2.5 text-xs leading-5 text-[var(--mg-ink-secondary)]">
          <Navigation size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          Система просить зменшити рух: анімації спрощено, а польоти камери вимкнено. Звуки й вібрація лишаються за вашим вибором.
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
        <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          {hapticsNative ? <Vibrate size={14} aria-hidden="true" /> : <Film size={14} aria-hidden="true" />}
          {hapticsNative ? 'Нативний відгук увімкнено' : 'Веб-відгук'}
        </span>
        <button
          type="button"
          onClick={() => resetPreferences()}
          className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RotateCcw size={14} aria-hidden="true" />
          Скинути
        </button>
      </div>
    </div>
  );
}