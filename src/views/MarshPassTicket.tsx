import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, ChevronLeft, Clock3, MoreHorizontal, Ticket, Timer } from 'lucide-react';
import { TicketQr } from '../components/TicketQr';
import { formatJourneyDuration } from './journeyResultPresentation';
import { seatsLabel } from '../domain/plural';

const dayFormat = new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: 'long' });
const timeFormat = new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' });

/** The route headline is a city pair; the street-level part moves to a quiet sub-line instead of slicing the place name. */
const cityPart = (name: string) => (name.split(',')[0]?.trim() || name);
const detailPart = (name: string) => name.split(',').slice(1).map((part) => part.trim()).filter(Boolean).join(', ');

export type MarshPassTicketProps = {
  originName: string;
  destinationName: string;
  departureAt: string;
  arrivalAt?: string | null;
  durationSeconds?: number | null;
  priceLabel: string;
  seatCount: number;
  status: string;
  bookingReference: string;
  driverName: string;
  token: string;
  onClose: () => void;
  onRefresh?: () => void;
  onCancelBooking?: () => void;
};

/** A boarding pass keeps its own navy contract in both themes, so its palette is scoped here rather than inherited from the page. */
export function MarshPassTicket({ originName, destinationName, departureAt, arrivalAt, durationSeconds, priceLabel, seatCount, status, bookingReference, driverName, token, onClose, onRefresh, onCancelBooking }: MarshPassTicketProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [tokenRevealed, setTokenRevealed] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const departure = new Date(departureAt);
  const arrival = arrivalAt ? new Date(arrivalAt) : null;
  const hasDeparture = !Number.isNaN(departure.getTime());
  const hasArrival = Boolean(arrival && !Number.isNaN(arrival.getTime()));
  const durationLabel = durationSeconds && durationSeconds > 0 ? formatJourneyDuration(durationSeconds) : '';
  const canBoard = ['confirmed', 'boarding'].includes(status) && Boolean(token.trim());
  const statusLabel: Record<string, string> = {
    confirmed: 'Бронювання підтверджено',
    boarding: 'Посадка дозволена',
    in_progress: 'Поїздка триває',
    completed: 'Поїздку завершено',
    cancelled: 'Скасовано',
    expired: 'Термін дії минув',
  };
  const ticketStatus = statusLabel[status] ?? 'Статус бронювання оновлено';
  const statusTone = status === 'confirmed' || status === 'boarding'
    ? 'text-[var(--pass-confirm)] bg-[var(--pass-confirm-surface)] border-[var(--pass-confirm)]/45'
    : 'text-[var(--pass-ink-muted)] bg-[var(--pass-stroke)]/10 border-[var(--pass-stroke)]/35';
  const actions = [onRefresh ? { key: 'refresh', label: 'Оновити квиток', run: onRefresh } : null,
    onCancelBooking ? { key: 'cancel', label: 'Скасувати поїздку', run: onCancelBooking } : null].filter(Boolean) as Array<{ key: string; label: string; run: () => void }>;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (menuOpen) setMenuOpen(false); else onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen, onClose]);

  return <div className="marsh-pass-ticket fixed inset-0 z-[var(--mg-z-modal)] flex flex-col bg-[var(--pass-screen)]" role="dialog" aria-modal="true" aria-label={`Квиток попутника ${originName} — ${destinationName}`}>
    <header className="flex items-center justify-between gap-3 px-3 pb-1 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <button ref={closeRef} type="button" onClick={onClose} aria-label="Назад до поїздок" className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--pass-screen-ink)] transition active:scale-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mg-blue)]">
        <ChevronLeft aria-hidden className="h-6 w-6" strokeWidth={2.4} />
      </button>
      <p className="font-display text-base font-bold tracking-[.2em] text-[var(--pass-screen-ink)]">MARSH PASS</p>
      <div className="relative">
        <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-haspopup="menu" disabled={actions.length === 0} aria-label="Дії з квитком" className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--pass-screen-ink)] transition active:scale-[.97] disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mg-blue)]">
          <MoreHorizontal aria-hidden className="h-6 w-6" strokeWidth={2.4} />
        </button>
        {menuOpen && <menu role="menu" className="absolute right-0 top-11 z-[var(--mg-z-control)] w-52 overflow-hidden rounded-[var(--mg-radius-lg)] border border-[var(--mg-border-subtle)] bg-[var(--mg-surface-primary)] py-1 shadow-[var(--mg-card-shadow)]">
          {actions.map((action) => <button key={action.key} type="button" role="menuitem" onClick={() => { setMenuOpen(false); action.run(); }} className="min-h-11 w-full px-4 text-left text-sm font-semibold text-[var(--mg-ink-primary)] transition hover:bg-[var(--mg-surface-tint)]">
            {action.label}
          </button>)}
        </menu>}
      </div>
    </header>

    <div className="flex-1 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
      <article className="relative mx-auto max-w-[26rem] overflow-hidden rounded-[var(--mg-radius-3xl)] border-[1.5px] border-[var(--pass-stroke)] bg-[var(--pass-surface)] px-5 pb-6 pt-5">
        <svg aria-hidden viewBox="0 0 220 120" className="pointer-events-none absolute -bottom-2 right-0 h-[132px] w-[220px] opacity-[.22]">
          <path d="M0 96 C52 74 96 108 148 82 S212 62 220 74" fill="none" stroke="var(--pass-stroke)" strokeWidth="1.2" />
          <path d="M0 108 C58 86 104 118 156 94 S214 78 220 88" fill="none" stroke="var(--pass-stroke)" strokeWidth="1.2" />
          <path d="M12 120 C64 100 110 128 162 106" fill="none" stroke="var(--pass-stroke)" strokeWidth="1.2" />
        </svg>

        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-[var(--mg-radius-md)] bg-[linear-gradient(145deg,var(--pass-badge-top),var(--pass-badge-bottom))] text-base font-extrabold text-white">M</span>
            <span className="text-[15px] font-bold tracking-[.04em] text-[var(--pass-ink)]">MARSHGO</span>
          </div>
          <span className={`flex items-center gap-1.5 rounded-[var(--mg-radius-pill)] border px-2.5 py-1 text-xs font-bold ${statusTone}`}>
            {canBoard && <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5"><path d="M3 8.5 6.2 11.7 13 4.9" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            {ticketStatus}
          </span>
        </div>

        <div className="relative mt-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-[34px] font-extrabold leading-none tracking-[.01em] text-[var(--pass-ink)]">MARSH PASS</h2>
            <p className="mt-2 text-[15px] font-semibold text-[var(--pass-ink-secondary)]">Квиток попутчика</p>
          </div>
          <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--mg-radius-md)] border border-[var(--pass-stroke)]/30 bg-[var(--pass-stroke)]/10 text-[var(--pass-stroke)]"><Ticket className="h-5 w-5" strokeWidth={1.8} /></span>
        </div>

        <div className="relative mt-6">
          <div className="flex items-end justify-between gap-3">
            <p className="min-w-0 flex-1 truncate text-[22px] font-bold leading-tight text-[var(--pass-ink)]" title={originName} aria-label={`Звідки: ${originName}`}>{cityPart(originName)}</p>
            <p className="min-w-0 flex-1 truncate text-right text-[22px] font-bold leading-tight text-[var(--pass-ink)]" title={destinationName} aria-label={`Куди: ${destinationName}`}>{cityPart(destinationName)}</p>
          </div>
          {(detailPart(originName) || detailPart(destinationName)) && <p className="mt-1.5 flex items-start justify-between gap-3 text-[12px] font-semibold leading-4 text-[var(--pass-ink-muted)]">
            <span className="min-w-0 flex-1 truncate">{detailPart(originName) || ' '}</span>
            <span className="min-w-0 flex-1 truncate text-right">{detailPart(destinationName) || ' '}</span>
          </p>}
          <div aria-hidden className="marsh-pass-ticket__route-track mt-2.5 flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--pass-stroke)]" />
            <span className="h-[2px] flex-1 rounded-full bg-[var(--pass-track)]" />
            <ArrowRight className="h-4 w-4 shrink-0 text-[var(--pass-stroke)]" strokeWidth={1.8} />
            <span className="h-[2px] flex-1 rounded-full bg-[var(--pass-track)]" />
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--pass-stroke)]" />
          </div>
        </div>

        <div className="relative mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[15px] font-semibold text-[var(--pass-ink)]">
          {hasDeparture && <span className="flex min-w-0 items-center gap-2">
            <CalendarDays aria-hidden className="h-[18px] w-[18px] text-[var(--pass-stroke)]" strokeWidth={2} />
            {dayFormat.format(departure)} · {timeFormat.format(departure)}
          </span>}
          {hasArrival && <><span aria-hidden className="h-4 w-px bg-[var(--pass-stroke)]/40" /><span className="flex items-center gap-2"><Clock3 aria-hidden className="h-[18px] w-[18px] text-[var(--pass-stroke)]" strokeWidth={2} />Прибуття {timeFormat.format(arrival!)}</span></>}
        </div>
        {durationLabel && <p className="relative mt-3 flex items-center justify-center gap-2 text-[15px] font-bold text-[var(--pass-ink)]">
          <Timer aria-hidden className="h-[18px] w-[18px] text-[var(--pass-stroke)]" strokeWidth={2} />
          {durationLabel}
        </p>}

        <div className="relative my-5 border-t border-dashed border-[var(--pass-stroke)]/55">
          <span aria-hidden className="absolute -left-5 -top-3 h-6 w-6 rounded-full border-[1.5px] border-[var(--pass-stroke)] bg-[var(--pass-screen)]" />
          <span aria-hidden className="absolute -right-5 -top-3 h-6 w-6 rounded-full border-[1.5px] border-[var(--pass-stroke)] bg-[var(--pass-screen)]" />
        </div>

        <div className="relative flex flex-wrap items-center gap-4">
          {canBoard ? <div className="shrink-0 rounded-[var(--mg-radius-lg)] bg-white p-2"><TicketQr token={token} size={124} /></div> : <div role="status" className="grid min-h-[124px] min-w-[124px] place-items-center rounded-[var(--mg-radius-lg)] border border-dashed border-[var(--pass-stroke)]/50 px-3 text-center text-xs font-semibold text-[var(--pass-ink-muted)]">QR недоступний для поточного статусу</div>}
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-[var(--pass-ink-secondary)]">Попутка · {seatsLabel(seatCount)}</p>
            <p className="mt-1 whitespace-nowrap text-[26px] font-extrabold leading-none text-[var(--pass-ink)]">{priceLabel}</p>
            {driverName && <p className="mt-2 truncate text-xs font-semibold text-[var(--pass-ink-secondary)]">Водій: {driverName}</p>}
            <p className="mt-2 break-all text-xs font-semibold text-[var(--pass-ink-muted)]">Бронювання № {bookingReference}</p>
            <p className="mt-2 text-[13px] font-semibold text-[var(--pass-ink-muted)]">{canBoard ? 'QR для посадки' : 'Зверніться до розділу поїздок, щоб оновити статус'}</p>
          </div>
        </div>

        <div className="relative mt-4">
          <button
            type="button"
            data-testid="booking-ticket-token-reveal"
            aria-expanded={tokenRevealed}
            disabled={!canBoard}
            onClick={() => setTokenRevealed((revealed) => !revealed)}
            className="min-h-11 w-full rounded-[var(--mg-radius-md)] border border-[var(--pass-stroke)]/45 bg-[var(--pass-stroke)]/10 px-3 text-[13px] font-bold text-[var(--pass-ink)] transition active:scale-[.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pass-stroke)]"
          >
            {canBoard ? (tokenRevealed ? 'Сховати текстовий токен' : 'Немає камери? Показати текстовий токен') : 'Текстовий токен недоступний'}
          </button>
          {tokenRevealed && canBoard && <code data-testid="booking-ticket-token" className="mt-2 block max-h-24 overflow-auto break-all rounded-[var(--mg-radius-md)] bg-[var(--pass-stroke)]/10 p-3 text-[12px] leading-4 text-[var(--pass-ink)]">
            {token}
          </code>}
        </div>
      </article>
    </div>
  </div>;
}
