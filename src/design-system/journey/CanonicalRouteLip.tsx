import type { ReactNode } from 'react';
import { JourneySegmentStrip, type JourneySegmentStripItem } from './JourneySegmentStrip';

/** Shared route summary used by journey cards and every route-map sheet snap. */
export function CanonicalRouteLip({
  durationLabel,
  durationTitle,
  durationClassName = '',
  priceLabel,
  priceAccessibleLabel,
  priceClassName = '',
  priceUnavailable = false,
  priceCaption,
  distanceLabel,
  durationNote,
  actions,
  actionsClassName = '',
  summaryRowClassName = '',
  items,
  ariaLabel,
  activeItemId,
  onSelect,
  summaryNote,
  className = '',
  stripClassName = '',
  density = 'compact',
}: {
  durationLabel: string;
  durationTitle?: string;
  durationClassName?: string;
  priceLabel: string;
  priceAccessibleLabel: string;
  priceClassName?: string;
  priceUnavailable?: boolean;
  priceCaption?: ReactNode;
  distanceLabel?: string;
  durationNote?: ReactNode;
  actions: ReactNode;
  actionsClassName?: string;
  summaryRowClassName?: string;
  items: readonly JourneySegmentStripItem[];
  ariaLabel: string;
  activeItemId?: string | null;
  onSelect?: (id: string) => void;
  summaryNote?: ReactNode;
  className?: string;
  stripClassName?: string;
  density?: 'compact' | 'sheet';
}) {
  const sheet = density === 'sheet';
  // In compact density the price cannot share the duration line: the four action controls plus the
  // duration and its waiting note already consume the full 393 px card, so a side-by-side price
  // column overflowed its own box and painted underneath the buttons.
  const priceColumn = <span className={sheet ? 'flex min-w-0 flex-col leading-tight' : 'mt-1 flex min-w-0 items-baseline gap-2 leading-tight'}>
    <strong aria-label={priceAccessibleLabel} className={`truncate ${sheet ? 'font-extrabold text-[15px]' : 'font-black text-[20px]'} tabular-nums ${priceUnavailable ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'} ${priceClassName}`}>{priceLabel}</strong>
    {priceCaption}
    {distanceLabel && <span className="truncate text-[10px] font-semibold text-slate-500 dark:text-slate-400">{distanceLabel}</span>}
  </span>;
  return <div data-testid="canonical-route-lip" className={className}>
    <div className={`${sheet ? 'flex min-w-0 items-center justify-between gap-2 py-2' : 'flex min-w-0 items-start justify-between gap-2'} ${summaryRowClassName}`}>
      <div className={`flex min-w-0 flex-1 items-center ${sheet ? 'gap-2' : 'gap-2'}`}>
        <span className={`flex min-w-0 flex-col leading-tight ${sheet ? '' : 'shrink-0'}`}>
          <strong data-testid="canonical-route-duration" title={durationTitle} className={`font-black leading-6 tracking-tight tabular-nums text-slate-900 dark:text-white ${sheet ? 'text-[21px]' : 'text-[22px]'} ${durationClassName}`}>{durationLabel}</strong>
          {durationNote}
        </span>
        {sheet && <><span aria-hidden="true" className="h-7 w-px shrink-0 bg-slate-200 dark:bg-[#294258]"/>{priceColumn}</>}
      </div>
      <div className={actionsClassName}>{actions}</div>
    </div>
    {!sheet && priceColumn}
    {summaryNote}
    {items.length > 0 && <JourneySegmentStrip
      items={items}
      ariaLabel={ariaLabel}
      activeItemId={activeItemId}
      onSelect={onSelect}
      className={stripClassName}
    />}
  </div>;
}
