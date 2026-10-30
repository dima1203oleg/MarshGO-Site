import { Radio, CalendarClock, Clock, AlertTriangle, Ban } from 'lucide-react';

export type TransportTelemetryStatus = 'live' | 'scheduled' | 'estimated' | 'stale' | 'unavailable';

const statusConfig: Record<TransportTelemetryStatus, {
  label: string;
  toneClass: string;
  icon: typeof Radio;
  pulse?: boolean;
}> = {
  live: {
    label: 'Live GPS',
    toneClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    icon: Radio,
    pulse: true,
  },
  scheduled: {
    label: 'За розкладом',
    toneClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
    icon: CalendarClock,
  },
  estimated: {
    label: 'Оцінка',
    toneClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    icon: Clock,
  },
  stale: {
    label: 'Дані застаріли',
    toneClass: 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800',
    icon: AlertTriangle,
  },
  unavailable: {
    label: 'Недоступно',
    toneClass: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    icon: Ban,
  },
};

export function StatusBadge({
  status,
  label,
  className = '',
  size = 'md',
}: {
  status: TransportTelemetryStatus;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const isSm = size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-bold leading-none select-none ${config.toneClass} ${
        isSm ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[11px]'
      } ${className}`}
      aria-label={`Статус транспорту: ${label ?? config.label}`}
    >
      <Icon
        size={isSm ? 10 : 13}
        className={`shrink-0 ${config.pulse ? 'motion-safe:animate-pulse' : ''}`}
        aria-hidden="true"
      />
      <span>{label ?? config.label}</span>
    </span>
  );
}
