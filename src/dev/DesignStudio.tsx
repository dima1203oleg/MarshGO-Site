import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Copy, Eye, RotateCw, X } from 'lucide-react';
import type { ThemeMode } from '../services/theme';

const viewports = {
  iphone: { label: 'iPhone', width: 390, height: 844 },
  compact: { label: 'Компактний', width: 375, height: 667 },
  tablet: { label: 'Планшет', width: 820, height: 1080 },
  desktop: { label: 'Desktop', width: 1280, height: 900 },
} as const;

const screens = [
  { label: 'Головна', path: '/' },
  { label: 'Пошук', path: '/search' },
  { label: 'Карта', path: '/map' },
  { label: 'Навігація', path: '/navigate' },
  { label: 'Поїздки', path: '/trips' },
  { label: 'Профіль', path: '/profile' },
] as const;

type Viewport = keyof typeof viewports;
type InspectedElement = { selector: string; tag: string; text: string };

function elementSelector(element: HTMLElement): string {
  if (element.id) return `#${element.id}`;
  const testId = element.getAttribute('data-testid');
  if (testId) return `[data-testid="${testId}"]`;
  return element.tagName.toLowerCase();
}

export function DesignStudio() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [viewport, setViewport] = useState<Viewport>('iphone');
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try { return (localStorage.getItem('mg_theme') as ThemeMode | null) ?? 'light'; } catch { return 'light'; }
  });
  const [picking, setPicking] = useState(false);
  const [inspected, setInspected] = useState<InspectedElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [apiState, setApiState] = useState<'checking' | 'available' | 'unavailable'>('checking');
  const [frameRevision, setFrameRevision] = useState(0);

  useEffect(() => {
    if (!picking) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setPicking(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [picking]);

  useEffect(() => {
    let current = true;
    const check = async () => {
      try {
        const response = await fetch('/healthz', { cache: 'no-store' });
        if (current) setApiState(response.ok ? 'available' : 'unavailable');
      } catch {
        if (current) setApiState('unavailable');
      }
    };
    void check();
    return () => { current = false; };
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!picking || !doc) return;
    const previous = doc.querySelector<HTMLElement>('[data-marshgo-studio-picked]');
    previous?.removeAttribute('data-marshgo-studio-picked');
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || target.nodeType !== 1 || target === doc.documentElement || target === doc.body) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      doc.querySelector<HTMLElement>('[data-marshgo-studio-picked]')?.removeAttribute('data-marshgo-studio-picked');
      target.setAttribute('data-marshgo-studio-picked', 'true');
      const text = (target.getAttribute('aria-label') || target.innerText || target.textContent || '').replace(/\s+/g, ' ').trim();
      setInspected({ selector: elementSelector(target), tag: target.tagName.toLowerCase(), text: text.slice(0, 140) });
      setPicking(false);
    };
    const style = doc.createElement('style');
    style.dataset.marshgoStudio = 'picker';
    style.textContent = '[data-marshgo-studio-picked="true"]{outline:3px solid #1677ff!important;outline-offset:2px!important;cursor:crosshair!important}';
    doc.head.append(style);
    doc.addEventListener('click', handleClick, true);
    doc.documentElement.style.cursor = 'crosshair';
    return () => {
      doc.removeEventListener('click', handleClick, true);
      doc.documentElement.style.cursor = '';
      style.remove();
    };
  }, [picking, frameRevision]);

  const openScreen = (path: string) => {
    const frame = frameRef.current;
    if (!frame) return;
    frame.src = path;
    setInspected(null);
  };

  const changeTheme = (next: ThemeMode) => {
    setTheme(next);
    try { localStorage.setItem('mg_theme', next); } catch { /* The current preview can still be reloaded. */ }
    frameRef.current?.contentWindow?.location.reload();
  };

  const copySelector = async () => {
    if (!inspected) return;
    await navigator.clipboard.writeText(inspected.selector);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const currentViewport = viewports[viewport];
  const formattedBuildTime = __MARSHGO_BUILD_METADATA__.builtAt === 'unavailable'
    ? 'Невідомо'
    : new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(__MARSHGO_BUILD_METADATA__.builtAt));

  return <main className="fixed inset-0 z-[1000] flex flex-col overflow-hidden bg-[#eef2f7] text-slate-900">
    <header className="z-10 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-6">
      <div className="mr-auto min-w-44">
        <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-blue-600">MARSHGO · Design Studio</p>
        <p className="text-sm font-bold">Реальний застосунок · локальний preview</p>
      </div>
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
        <span>Екран</span>
        <select aria-label="Розмір preview" value={viewport} onChange={(event) => setViewport(event.target.value as Viewport)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800">
          {Object.entries(viewports).map(([key, value]) => <option key={key} value={key}>{value.label} · {value.width} × {value.height}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
        <span>Тема</span>
        <select aria-label="Тема застосунку" value={theme} onChange={(event) => changeTheme(event.target.value as ThemeMode)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800">
          <option value="light">Світла</option><option value="dark">Темна</option><option value="system">Системна</option>
        </select>
      </label>
      <button type="button" onClick={() => { setInspected(null); frameRef.current?.contentWindow?.location.reload(); }} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600" aria-label="Перезавантажити preview" title="Перезавантажити"><RotateCw size={16}/></button>
      <a href="/" target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white">Відкрити окремо <ArrowUpRight size={14}/></a>
    </header>

    <section className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 overflow-y-auto border-b border-slate-200 bg-white p-4 lg:w-72 lg:border-b-0 lg:border-r lg:p-5">
        <div>
          <h1 className="text-sm font-extrabold">Екрани застосунку</h1>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">Відкриваються сторінки з канонічного React/Vite-коду. Доступність даних залежить від підключеного API.</p>
          <nav className="mt-3 grid grid-cols-3 gap-2 lg:grid-cols-2" aria-label="Екрани MARSHGO">
            {screens.map((screen) => <button key={screen.path} type="button" onClick={() => openScreen(screen.path)} className="rounded-lg border border-slate-200 px-2.5 py-2 text-left text-xs font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50">{screen.label}</button>)}
          </nav>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2"><h2 className="text-xs font-extrabold">Стан preview</h2><span className="rounded-full bg-blue-100 px-2 py-1 text-[9px] font-bold uppercase text-blue-800">LOCAL</span></div>
          <dl className="mt-2 space-y-1.5 text-[10px] leading-4 text-slate-600">
            <div className="flex justify-between gap-2"><dt>Гілка</dt><dd className="max-w-40 truncate font-mono text-right">{__MARSHGO_BUILD_METADATA__.branch || 'невідомо'}</dd></div>
            <div className="flex justify-between gap-2"><dt>Git SHA</dt><dd className="font-mono">{__MARSHGO_BUILD_METADATA__.sha}</dd></div>
            <div className="flex justify-between gap-2"><dt>Робоче дерево</dt><dd>{__MARSHGO_BUILD_METADATA__.dirty ? 'є незакомічені зміни' : 'чисте'}</dd></div>
            <div className="flex justify-between gap-2"><dt>Vite запущено</dt><dd>{formattedBuildTime}</dd></div>
            <div className="flex justify-between gap-2"><dt>API</dt><dd className={apiState === 'available' ? 'font-bold text-emerald-700' : apiState === 'unavailable' ? 'font-bold text-amber-700' : ''}>{apiState === 'available' ? 'локальний API доступний' : apiState === 'unavailable' ? 'недоступний · без live-даних' : 'перевіряємо…'}</dd></div>
            <div className="flex justify-between gap-2"><dt>Джерело</dt><dd>React/Vite · {currentViewport.width} px</dd></div>
          </dl>
          {apiState === 'unavailable' && <p className="mt-2 border-t border-slate-200 pt-2 text-[10px] leading-4 text-amber-800">Це локальний інтерфейс без під’єднаного backend. Не показуємо синтетичні live-маршрути або GPS.</p>}
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
          <div className="flex items-center gap-2"><Eye size={15} className="text-blue-700"/><h2 className="text-xs font-extrabold text-blue-950">Вибір елемента</h2></div>
          <p className="mt-1 text-[10px] leading-4 text-blue-900">Натисніть «Обрати елемент», потім клацніть реальний елемент у preview. Його опис і селектор можна скопіювати до задачі для Codex.</p>
          <button type="button" aria-pressed={picking} onClick={() => setPicking((value) => !value)} className={`mt-2 w-full rounded-lg px-3 py-2 text-xs font-bold ${picking ? 'bg-slate-900 text-white' : 'bg-blue-600 text-white'}`}>{picking ? 'Скасувати вибір' : 'Обрати елемент'}</button>
          {inspected && <div className="mt-2 rounded-lg bg-white p-2.5 text-[10px] leading-4 text-slate-700"><div className="flex items-start justify-between gap-2"><b>{inspected.tag}</b><button type="button" onClick={() => { setInspected(null); frameRef.current?.contentDocument?.querySelector('[data-marshgo-studio-picked]')?.removeAttribute('data-marshgo-studio-picked'); }} aria-label="Очистити вибір"><X size={13}/></button></div><code className="mt-1 block break-all font-mono text-blue-700">{inspected.selector}</code>{inspected.text && <p className="mt-1 line-clamp-3">{inspected.text}</p>}<button type="button" onClick={() => void copySelector()} className="mt-2 inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-bold">{copied ? <Check size={12}/> : <Copy size={12}/>} {copied ? 'Скопійовано' : 'Копіювати селектор'}</button></div>}
        </div>
      </aside>

      <div className="relative flex min-h-0 flex-1 items-start justify-center overflow-auto p-3 sm:p-6">
        <div className="mb-8 overflow-hidden rounded-[2rem] border-[8px] border-slate-900 bg-white shadow-[0_24px_70px_rgba(15,23,42,.22)] ring-1 ring-black/10" style={{ width: currentViewport.width, height: currentViewport.height, flex: '0 0 auto' }}>
          <iframe ref={frameRef} src="/" title="MARSHGO real application preview" onLoad={() => setFrameRevision((value) => value + 1)} style={{ width: currentViewport.width, height: currentViewport.height, border: 0, background: '#fff' }} />
        </div>
        {picking && <p className="pointer-events-none fixed bottom-5 left-1/2 z-[1002] -translate-x-1/2 rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white shadow-lg">Клацніть елемент у застосунку · Esc скасовує</p>}
      </div>
    </section>
  </main>;
}
