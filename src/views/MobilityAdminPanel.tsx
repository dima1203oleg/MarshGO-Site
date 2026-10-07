import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Activity, Pause, Plus, Power, RefreshCw, Trash2 } from 'lucide-react';
import { productionApi, type ApiMobilityAudit, type ApiMobilityProvider } from '../services/productionApi';

const healthMeta = { healthy: ['🟢', 'Працює', 'bg-emerald-50 text-emerald-700'], degraded: ['🟡', 'Частково', 'bg-amber-50 text-amber-800'], offline: ['🔴', 'Недоступний', 'bg-rose-50 text-rose-700'], unknown: ['⚪', 'Не перевірено', 'bg-slate-100 text-slate-600'] } as const;
const typeLabels: Record<string, string> = { public_transit: 'Громадський транспорт', bike: 'Велосипеди', ebike: 'E-bike', scooter: 'Самокати', moped: 'Мопеди', carsharing: 'Каршерінг', taxi: 'Таксі', carpool: 'Carpool', on_demand: 'On-demand', other: 'Інше' };
const accessLabels: Record<string, string> = { open: 'Відкритий', requires_credentials: 'REQUIRES_CREDENTIALS', requires_partner_access: 'REQUIRES_PARTNER_ACCESS', insecure_endpoint: 'ЛИШЕ HTTP' };
const actionLabels: Record<string, string> = { 'mobility.provider.deleted': 'видалив провайдера', 'mobility.provider.created': 'створив провайдера', 'mobility.provider.updated': 'змінив провайдера', 'mobility.provider.tested': 'перевірив підключення' };
const dateFormat = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Kyiv' });

/** Mobility Control Center: connect, test, enable/disable and audit transport data sources without code changes. */
export function MobilityAdminPanel() {
  const [providers, setProviders] = useState<ApiMobilityProvider[]>([]);
  const [audit, setAudit] = useState<ApiMobilityAudit[]>([]);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [logsFor, setLogsFor] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', city: '', providerType: 'bike', sourceType: 'gbfs', feedUrl: '' });

  const load = useCallback(async () => {
    try { const [list, log] = await Promise.all([productionApi.mobilityProviders(), productionApi.mobilityAudit()]); setProviders(list); setAudit(log); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Не вдалося завантажити провайдерів.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const run = async (id: string, action: () => Promise<unknown>, done: string) => {
    setBusyId(id); setMessage('');
    try { await action(); setMessage(done); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Дія не виконана.'); }
    finally { setBusyId(null); }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setMessage('');
    try { await productionApi.createMobilityProvider(form); setAdding(false); setForm({ ...form, name: '', feedUrl: '' }); setMessage('Провайдера додано (вимкнений). Перевірте підключення, потім увімкніть.'); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Не вдалося додати провайдера.'); }
  };

  return <section className="mt-6" aria-label="Центр керування мобільністю">
    <div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-blue-600">Адміністрування</p><h2 className="text-lg font-extrabold">Центр керування мобільністю</h2></div>
      <button type="button" onClick={() => setAdding((value) => !value)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#1789F4] px-3 py-2 text-xs font-bold text-white"><Plus size={14}/>Додати</button></div>
    {message && <p role="status" className="mb-3 rounded-xl bg-blue-50 p-3 text-xs text-blue-800">{message}</p>}
    {adding && <form onSubmit={submit} className="mb-4 space-y-2 rounded-2xl bg-white p-4 shadow-sm">
      <input required minLength={2} placeholder="Назва провайдера" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl bg-[#f6f8fc] p-3 text-sm"/>
      <input required minLength={2} placeholder="Місто" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full rounded-xl bg-[#f6f8fc] p-3 text-sm"/>
      <div className="grid grid-cols-2 gap-2">
        <select value={form.providerType} onChange={(e) => setForm({ ...form, providerType: e.target.value })} className="rounded-xl bg-[#f6f8fc] p-3 text-sm">{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select value={form.sourceType} onChange={(e) => setForm({ ...form, sourceType: e.target.value })} className="rounded-xl bg-[#f6f8fc] p-3 text-sm">{['gbfs', 'gtfs', 'gtfs_rt', 'gofs', 'rest', 'json', 'csv', 'graphql', 'websocket', 'marshgo'].map((value) => <option key={value} value={value}>{value.toUpperCase()}</option>)}</select>
      </div>
      <input required type="url" placeholder="https://… (URL фіду)" value={form.feedUrl} onChange={(e) => setForm({ ...form, feedUrl: e.target.value })} className="w-full rounded-xl bg-[#f6f8fc] p-3 text-sm"/>
      <button type="submit" className="w-full rounded-xl bg-[#0E1F35] py-3 text-sm font-bold text-white">Зберегти (вимкнений)</button>
      <p className="text-[11px] text-slate-400">Лише публічні https-адреси. Ключі API на сервері поки не зберігаються.</p>
    </form>}
    {providers.length === 0 ? <p className="rounded-2xl bg-white p-4 text-sm text-slate-500 shadow-sm">Провайдерів ще немає. Додайте перший GBFS- або GTFS-фід.</p> : <div className="space-y-3">
      {providers.map((provider) => { const [dot, label, tone] = healthMeta[provider.health]; const counts = provider.last_report.counts ?? {}; return <article key={provider.id} className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><b className="block truncate text-sm text-[#0E1F35]">{provider.name}</b><p className="text-[11px] text-slate-500">{provider.city} · {typeLabels[provider.provider_type] ?? provider.provider_type} · {provider.source_type.toUpperCase()} · пріоритет {provider.priority}</p></div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${tone}`}>{dot} {label}</span></div>
        <p className="mt-2 text-[11px] text-slate-500">{provider.status === 'enabled' ? 'Увімкнено' : provider.status === 'paused' ? 'Призупинено' : 'Вимкнено'}{provider.last_checked_at ? ` · перевірено ${dateFormat.format(new Date(provider.last_checked_at))}` : ''}{Object.keys(counts).length ? ` · ${[counts.vehicles && `${counts.vehicles} ТЗ`, counts.stations && `${counts.stations} станцій`, counts.stops && `${counts.stops} зупинок`, counts.routes && `${counts.routes} маршрутів`].filter(Boolean).join(', ')}` : ''}{provider.last_report.responseMs ? ` · ${provider.last_report.responseMs} мс` : ''}</p>
        {provider.last_error && <p className="mt-1 text-[11px] text-rose-600">{provider.last_error}</p>}
        {provider.access !== 'open' && <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">{accessLabels[provider.access]}</p>}
        {(provider.coverage || provider.license || provider.update_frequency) && <p className="mt-1 text-[10px] leading-4 text-slate-400">{[provider.coverage, provider.update_frequency && `оновлення: ${provider.update_frequency}`, provider.license && `ліцензія: ${provider.license}`].filter(Boolean).join(' · ')}</p>}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" disabled={busyId === provider.id} onClick={() => void run(provider.id, () => productionApi.testMobilityProvider(provider.id), 'Перевірку / синхронізацію завершено.')} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-xs font-bold text-slate-700 disabled:opacity-50"><Activity size={13}/>Перевірити / Sync</button>
          <button type="button" disabled={busyId === provider.id || (provider.status !== 'enabled' && provider.access !== 'open')} onClick={() => void run(provider.id, () => productionApi.updateMobilityProvider(provider.id, { status: provider.status === 'enabled' ? 'disabled' : 'enabled' }), provider.status === 'enabled' ? 'Провайдера вимкнено.' : 'Провайдера увімкнено.')} className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold text-white disabled:opacity-40 ${provider.status === 'enabled' ? 'bg-rose-600' : 'bg-emerald-600'}`}><Power size={13}/>{provider.status === 'enabled' ? 'Вимкнути' : 'Увімкнути'}</button>
          <button type="button" disabled={busyId === provider.id || provider.status !== 'enabled'} onClick={() => void run(provider.id, () => productionApi.updateMobilityProvider(provider.id, { status: 'paused' }), 'Провайдера призупинено.')} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"><Pause size={13}/>Призупинити</button>
          <button type="button" onClick={() => setLogsFor(logsFor === provider.id ? null : provider.id)} aria-expanded={logsFor === provider.id} className="rounded-xl border border-slate-200 py-2 text-xs font-bold text-slate-700">Логи</button>
        </div>
        {logsFor === provider.id && <div className="mt-2 rounded-xl bg-[#f6f8fc] p-3 text-[11px] text-slate-600"><ul className="space-y-1">{(provider.last_report.checks ?? []).map((check) => <li key={check.name}>{check.ok ? '✓' : '✗'} <b>{check.name}</b>{check.detail ? ` — ${check.detail}` : ''}</li>)}{(provider.last_report.checks ?? []).length === 0 && <li>Перевірок ще не було.</li>}</ul>
          <div className="mt-2 flex items-center gap-2"><label className="text-[10px] font-bold text-slate-500">Пріоритет<input type="number" min={1} max={1000} defaultValue={provider.priority} onBlur={(event) => { const value = Number(event.target.value); if (Number.isInteger(value) && value !== provider.priority) void run(provider.id, () => productionApi.updateMobilityProvider(provider.id, { priority: value }), 'Пріоритет змінено.'); }} className="ml-2 w-20 rounded-lg bg-white p-1.5 text-xs"/></label>
            <button type="button" onClick={() => { if (window.confirm(`Видалити «${provider.name}» з реєстру?`)) void run(provider.id, () => productionApi.deleteMobilityProvider(provider.id), 'Провайдера видалено.'); }} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-bold text-rose-600"><Trash2 size={12}/>Видалити</button></div></div>}
      </article>; })}
    </div>}
    <div className="mt-4 flex items-center justify-between"><h3 className="text-sm font-extrabold">Журнал дій</h3><button type="button" onClick={() => void load()} aria-label="Оновити журнал" className="grid h-8 w-8 place-items-center rounded-full bg-white shadow-sm"><RefreshCw size={14}/></button></div>
    <ul className="mt-2 space-y-1.5">{audit.slice(0, 8).map((row) => <li key={row.id} className="rounded-xl bg-white px-3 py-2 text-[11px] text-slate-600 shadow-sm"><b className="text-slate-800">{row.actor ?? 'Система'}</b> {actionLabels[row.action] ?? row.action} · {dateFormat.format(new Date(row.created_at))}</li>)}{audit.length === 0 && <li className="text-[11px] text-slate-400">Дій ще не було.</li>}</ul>
  </section>;
}
