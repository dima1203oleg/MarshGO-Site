import { ArrowLeftRight, ChevronRight, Coins, Heart, Scale, Timer } from 'lucide-react';
import type { ApiJourneyStrategy } from '../../services/productionApi';
import { formatJourneyDuration } from '../../views/journeyResultPresentation';
import { JourneySegmentStrip, type JourneySegmentStripItem } from './JourneySegmentStrip';

export type CanonicalRouteLipProps = {
  journeyId: string;
  totalDurationSeconds: number;
  totalPriceMinor: number | null;
  currency?: string | null;
  priceStatus?: 'ESTIMATED' | 'LOCKED' | 'DYNAMIC' | 'UNKNOWN';
  hasUnknownPrice?: boolean;
  transferCount: number;
  strategy?: ApiJourneyStrategy;
  segments: readonly JourneySegmentStripItem[];
  selectedSegmentId?: string | null;
  favorite?: boolean;
  availabilityStatus?: string;
  actionLabel: string;
  actionExpanded?: boolean;
  className?: string;
  onSegmentSelect?: (id: string) => void;
  onOpenDetails?: () => void;
  onFavoriteChange?: (favorite: boolean) => void;
};

const strategyLabels: Record<ApiJourneyStrategy, string> = {
  BALANCED: 'Оптимальний', FASTEST: 'Найшвидший', CHEAPEST: 'Найдешевший',
  PREMIUM: 'Преміум', RELIABLE: 'Надійний', CUSTOM: 'Власні умови',
};

export function formatCanonicalRoutePrice(minor: number | null, currency: string, status: CanonicalRouteLipProps['priceStatus'], unknown = false) {
  if (unknown || minor === null || !Number.isSafeInteger(minor) || status === 'UNKNOWN') return '—';
  const amount = minor / 100;
  const formatted = currency.toUpperCase() === 'UAH'
    ? `${new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(amount)}\u00a0₴`
    : new Intl.NumberFormat('uk-UA', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  return status === 'LOCKED' ? formatted : `≈ ${formatted}`;
}

export function CanonicalRouteLip({
  journeyId, totalDurationSeconds, totalPriceMinor, currency = 'UAH', priceStatus = 'ESTIMATED',
  hasUnknownPrice = false, transferCount, strategy, segments, selectedSegmentId = null,
  favorite = false, availabilityStatus = 'UNKNOWN', actionLabel, actionExpanded,
  className = '', onSegmentSelect, onOpenDetails, onFavoriteChange,
}: CanonicalRouteLipProps) {
  const StrategyIcon = strategy === 'FASTEST' ? Timer : strategy === 'CHEAPEST' ? Coins : Scale;
  const totalPrice = formatCanonicalRoutePrice(totalPriceMinor, currency ?? 'UAH', priceStatus, hasUnknownPrice);

  return <section
    data-canonical-route-lip={journeyId}
    data-availability={availabilityStatus}
    data-price-status={priceStatus}
    className={`canonical-route-lip ${className}`}
    aria-label={`Маршрут: ${formatJourneyDuration(totalDurationSeconds)}, ${totalPrice === '—' ? 'ціна невідома' : totalPrice}`}
  >
    <div className="canonical-route-lip-heading journey-result-header">
      <div className="canonical-route-lip-metrics journey-result-key-metrics">
        <strong data-testid="canonical-route-duration" className="canonical-route-lip-duration journey-result-duration">{formatJourneyDuration(totalDurationSeconds)}</strong>
        <span className="canonical-route-lip-divider" aria-hidden="true"/>
        <strong data-testid="canonical-route-price" className={`canonical-route-lip-price journey-result-total-price${totalPrice === '—' ? ' is-unknown' : ''}`}>{totalPrice}</strong>
      </div>
      <div className="canonical-route-lip-actions">
        {strategy && <span className={`canonical-route-lip-badge canonical-route-lip-strategy strategy-${strategy.toLowerCase()}`} aria-label={strategyLabels[strategy]} title={strategyLabels[strategy]}>
          <StrategyIcon size={16} aria-hidden="true"/>
        </span>}
        <span className="canonical-route-lip-badge canonical-route-lip-transfers" aria-label={`${transferCount} ${transferCount === 1 ? 'пересадка' : 'пересадок'}`} title="Кількість змін транспорту">
          <ArrowLeftRight size={14} aria-hidden="true"/><span>{transferCount}</span>
        </span>
        {onFavoriteChange && <button type="button" className="canonical-route-lip-button" aria-label={favorite ? 'Видалити маршрут зі збережених' : 'Зберегти маршрут'} aria-pressed={favorite} onClick={() => onFavoriteChange(!favorite)} onPointerDown={event => event.stopPropagation()}>
          <Heart size={18} fill={favorite ? 'currentColor' : 'none'} className={favorite ? 'text-rose-500' : ''} aria-hidden="true"/>
        </button>}
        <button type="button" className="canonical-route-lip-button canonical-route-lip-open" aria-label={actionLabel} aria-expanded={actionExpanded} disabled={!onOpenDetails} onClick={onOpenDetails} onPointerDown={event => event.stopPropagation()}>
          <ChevronRight size={19} className={actionExpanded ? 'rotate-90' : ''} aria-hidden="true"/>
        </button>
      </div>
    </div>
    <JourneySegmentStrip
      items={segments}
      ariaLabel="Послідовність етапів маршруту"
      layout="horizontal"
      activeItemId={selectedSegmentId}
      onSelect={onSegmentSelect}
      className="canonical-route-lip-strip"
    />
  </section>;
}
