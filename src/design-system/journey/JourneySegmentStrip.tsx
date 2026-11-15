import { useEffect } from 'react';
import { useMagneticDomino } from '../../components/useMagneticDomino';
import { TransportIcon } from '../transport/TransportIcon';

export type JourneySegmentStripItem = {
  id: string;
  mode: string;
  transportType?: string | null;
  label: string;
  /** Feed route number rendered as the canonical «№48» pill; absent keeps the mode word. */
  badge?: string | null;
  selectionLabel?: string;
  accessibilityLabel?: string;
  durationSeconds: number;
  durationLabel: string;
  priceLabel: string;
  color: string;
};

export function JourneySegmentStrip({
  items,
  ariaLabel,
  activeItemId,
  onSelect,
  className = '',
}: {
  items: readonly JourneySegmentStripItem[];
  ariaLabel: string;
  activeItemId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const scroller = useMagneticDomino(items.length);
  const usesHorizontalTiles = items.length > 4;

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const syncEdgeFade = () => {
      const hidden = element.scrollWidth - element.clientWidth;
      // Sub-pixel flex rounding leaves a couple of stray units behind; fading for those would slice
      // a row that is actually whole.
      const scrolls = hidden > 10;
      // Written to the DOM rather than React state: a fling changes scrollLeft every frame and a
      // state update would re-render the card, and with it the route sheet, 60 times a second.
      element.dataset.fadeStart = String(scrolls && element.scrollLeft > 2);
      element.dataset.fadeEnd = String(scrolls && element.scrollLeft + element.clientWidth < element.scrollWidth - 2);
    };
    syncEdgeFade();
    element.addEventListener('scroll', syncEdgeFade, { passive: true });
    window.addEventListener('resize', syncEdgeFade, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(syncEdgeFade);
    observer?.observe(element);
    for (const child of element.children) observer?.observe(child);
    return () => {
      element.removeEventListener('scroll', syncEdgeFade);
      window.removeEventListener('resize', syncEdgeFade);
      observer?.disconnect();
    };
  }, [items.length]);

  const renderContent = (item: JourneySegmentStripItem) => {
    const showPrice = Boolean(item.priceLabel) && item.mode !== 'WALK';
    return <>
      <span className="journey-segment-tile-heading">
        <span className="journey-segment-tile-icon" data-icon-mode={item.mode} style={{ color: item.mode === 'WALK' ? undefined : item.color }}>
          {item.mode === 'METRO'
            ? <span className="journey-metro-glyph" aria-hidden="true">М</span>
            : <TransportIcon mode={item.mode} transportType={item.transportType} size={16} strokeWidth={2.3}/>
          }
        </span>
        {item.badge
          ? <span className="journey-segment-tile-badge" style={{ ['--segment-color' as string]: item.color }} title={item.label}>{item.badge}</span>
          : <span className="journey-segment-tile-label" title={item.label}>{item.label}</span>}
      </span>
      <span className="journey-segment-tile-meta" title={showPrice ? item.durationLabel + ' · ' + item.priceLabel : item.durationLabel}>
        <strong className="journey-segment-tile-meta-value">{item.durationLabel}</strong>
        {showPrice && <>
          <span aria-hidden="true"> · </span>
          <strong className="journey-segment-tile-meta-value">{item.priceLabel}</strong>
        </>}
      </span>
    </>;
  };

  return <div className={'journey-segment-strip ' + className}>
    <div data-testid="journey-transit-thread" className="journey-segment-ribbon" role="img" aria-label={'Кольорова шкала: ' + items.map(item => item.label + ' ' + item.durationLabel).join(', ')}>
      {items.map(item => <span
        key={item.id}
        data-segment-mode={item.mode}
        data-journey-strip-segment-id={item.id}
        title={item.label + ' · ' + item.durationLabel}
        style={{
          flex: Math.max(1, item.durationSeconds) + ' 1 0%',
          backgroundColor: item.color,
          filter: activeItemId && activeItemId !== item.id ? 'brightness(.55) saturate(.65)' : activeItemId === item.id ? 'brightness(1.16)' : undefined,
        }}
      />)}
    </div>
    <div className="journey-segment-tiles-viewport">
      <div ref={scroller} className="journey-segment-tiles journey-result-segments mg-domino no-scrollbar" data-domino-pattern="ribbon" tabIndex={0} role="list" aria-label={ariaLabel}>
        {items.map(item => {
          const selected = activeItemId === item.id;
          const tileClass = 'journey-segment-tile' + (usesHorizontalTiles ? ' journey-segment-tile--scroll' : '');
          return <div
            key={item.id}
            role="listitem"
            data-segment-tile-id={item.id}
            aria-label={item.accessibilityLabel ?? (item.priceLabel && item.mode !== 'WALK' ? item.label + ', ' + item.durationLabel + ', ' + item.priceLabel : item.label + ', ' + item.durationLabel)}
            className={tileClass + (selected ? ' is-active' : '')}
            style={{ opacity: activeItemId && !selected ? .5 : 1 }}
          >
            {onSelect
              ? <button type="button" aria-pressed={selected} onClick={() => onSelect(item.id)} aria-label={'Вибрати сегмент: ' + (item.selectionLabel ?? item.label)} className="journey-segment-tile-button mg-press-subtle">
                {renderContent(item)}
              </button>
              : <div className="journey-segment-tile-content">{renderContent(item)}</div>}
          </div>;
        })}
      </div>
    </div>
  </div>;
}
