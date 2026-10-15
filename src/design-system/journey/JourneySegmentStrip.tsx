import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { ChevronRight } from 'lucide-react';
import { TransportIcon } from '../transport/TransportIcon';

export type JourneySegmentStripItem = {
  id: string;
  mode: string;
  transportType?: string | null;
  label: string;
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
  layout = 'stacked',
}: {
  items: readonly JourneySegmentStripItem[];
  ariaLabel: string;
  activeItemId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
  layout?: 'stacked' | 'horizontal';
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const scrollerId = useId();
  const [scrollState, setScrollState] = useState({ overflow: false, atEnd: false });
  // Keep the canonical four-leg card visible on phone screens; longer chains
  // use the horizontally scrollable tiles so every leg remains reachable.
  const usesHorizontalTiles = items.length > 4;

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const syncScrollState = () => {
      const next = {
        overflow: element.scrollWidth > element.clientWidth + 2,
        atEnd: element.scrollLeft + element.clientWidth >= element.scrollWidth - 10,
      };
      setScrollState(current => current.overflow === next.overflow && current.atEnd === next.atEnd ? current : next);
    };
    syncScrollState();
    element.addEventListener('scroll', syncScrollState, { passive: true });
    window.addEventListener('resize', syncScrollState, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(syncScrollState);
    observer?.observe(element);
    for (const child of element.children) observer?.observe(child);
    return () => {
      element.removeEventListener('scroll', syncScrollState);
      window.removeEventListener('resize', syncScrollState);
      observer?.disconnect();
    };
  }, [items.length]);

  const scrollTiles = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const element = scroller.current;
    if (!element) return;
    element.scrollTo({
      left: scrollState.atEnd ? 0 : element.scrollWidth,
      behavior: 'smooth',
    });
  };

  const renderIcon = (item: JourneySegmentStripItem) => <span className="journey-segment-tile-icon" data-icon-mode={item.mode} style={{ color: item.mode === 'WALK' ? undefined : item.color }}>
    {item.mode === 'METRO'
      ? <span className="journey-metro-glyph" aria-hidden="true">М</span>
      : <TransportIcon mode={item.mode} transportType={item.transportType} size={16} strokeWidth={2.3}/>
    }
  </span>;

  const renderContent = (item: JourneySegmentStripItem) => layout === 'horizontal'
    ? <span className="journey-segment-tile-horizontal">
      {renderIcon(item)}
      <span className="journey-segment-tile-info">
        <span className="journey-segment-tile-label" title={item.label}>{item.label}</span>
        <span className="journey-segment-tile-meta" title={item.durationLabel + ' · ' + item.priceLabel}>
          <strong className="journey-segment-tile-meta-value">{item.durationLabel}</strong>
          <span aria-hidden="true"> · </span>
          <strong className="journey-segment-tile-meta-value">{item.priceLabel}</strong>
        </span>
      </span>
    </span>
    : <>
    <span className="journey-segment-tile-heading">
      {renderIcon(item)}
      <span className="journey-segment-tile-label" title={item.label}>{item.label}</span>
    </span>
    <span className="journey-segment-tile-meta" title={item.durationLabel + ' · ' + item.priceLabel}>
      <strong className="journey-segment-tile-meta-value">{item.durationLabel}</strong>
      <span aria-hidden="true"> · </span>
      <strong className="journey-segment-tile-meta-value">{item.priceLabel}</strong>
    </span>
    </>;

  return <div className={'journey-segment-strip ' + className} data-layout={layout}>
    <div className="journey-segment-ribbon" role="img" aria-label={'Кольорова шкала: ' + items.map(item => item.label + ' ' + item.durationLabel).join(', ')}>
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
    <div className={'journey-segment-tiles-viewport' + (scrollState.overflow ? ' has-overflow' : '')}>
      <div ref={scroller} id={scrollerId} className="journey-segment-tiles journey-result-segments no-scrollbar" role="list" aria-label={ariaLabel}>
        {items.map(item => {
          const selected = activeItemId === item.id;
          const tileClass = 'journey-segment-tile' + (usesHorizontalTiles ? ' journey-segment-tile--scroll' : '');
          return <div
            key={item.id}
            role="listitem"
            data-segment-tile-id={item.id}
            aria-label={item.accessibilityLabel ?? item.label + ', ' + item.durationLabel + ', ' + item.priceLabel}
            className={tileClass + (selected ? ' is-active' : '')}
            style={{ opacity: activeItemId && !selected ? .5 : 1 }}
          >
            {onSelect
              ? <button type="button" aria-pressed={selected} onClick={() => onSelect(item.id)} aria-label={'Вибрати сегмент: ' + (item.selectionLabel ?? item.label)} className="journey-segment-tile-button">
                {renderContent(item)}
              </button>
              : <div className="journey-segment-tile-content">{renderContent(item)}</div>}
          </div>;
        })}
      </div>
      {scrollState.overflow && <button
        type="button"
        aria-label={scrollState.atEnd ? 'Повернутися до початку етапів маршруту' : 'Прокрутити до наступних етапів маршруту'}
        aria-controls={scrollerId}
        onClick={scrollTiles}
        className="journey-segment-scroll-cue"
      >
        <span data-testid="segment-scroll-cue-surface"><ChevronRight size={16} className={scrollState.atEnd ? 'rotate-180' : ''} aria-hidden="true"/></span>
      </button>}
    </div>
  </div>;
}
