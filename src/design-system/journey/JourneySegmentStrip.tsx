import { useEffect, useId, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { ChevronRight } from 'lucide-react';
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
  const scroller = useRef<HTMLDivElement>(null);
  const scrollerId = useId();
  const [scrollState, setScrollState] = useState({ overflow: false, atEnd: false });
  const pointerDrag = useRef<{ pointerId: number; startX: number; startScrollLeft: number; moved: boolean } | null>(null);
  const suppressClickUntil = useRef(0);
  const usesHorizontalTiles = items.length > 4;

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const syncScrollState = () => {
      const hidden = element.scrollWidth - element.clientWidth;
      const next = {
        // Sub-pixel flex rounding leaves a couple of stray units behind; a 44 px button must not
        // cover the last stage of the route because of them.
        overflow: hidden >= 24,
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
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  };

  // Overflow rows scroll naturally on touch and trackpads, but desktop browsers do not
  // translate a left-button drag into horizontal scrolling. Add that gesture only for
  // genuinely overflowing rows; buttons such as the scroll cue keep their normal click.
  const startPointerDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!usesHorizontalTiles || event.pointerType !== 'mouse' || event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest('button')) return;
    pointerDrag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: event.currentTarget.scrollLeft,
      moved: false,
    };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* The browser may end the pointer before capture. */ }
  };

  const movePointerDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = pointerDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(deltaX) < 4) return;
    drag.moved = true;
    event.preventDefault();
    event.currentTarget.scrollLeft = drag.startScrollLeft - deltaX;
    event.currentTarget.dataset.pointerDragging = 'true';
  };

  const finishPointerDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = pointerDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) suppressClickUntil.current = Date.now() + 250;
    pointerDrag.current = null;
    delete event.currentTarget.dataset.pointerDragging;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    } catch { /* Capture may already have been released by the browser. */ }
  };

  const suppressDragClick = (event: MouseEvent<HTMLDivElement>) => {
    if (Date.now() >= suppressClickUntil.current) return;
    suppressClickUntil.current = 0;
    event.preventDefault();
    event.stopPropagation();
  };

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
    <div className="journey-segment-tiles-viewport" data-cue-at-end={scrollState.atEnd ? 'true' : 'false'}>
      <div
        ref={scroller}
        id={scrollerId}
        className={`journey-segment-tiles journey-result-segments no-scrollbar${usesHorizontalTiles ? ' journey-segment-tiles--draggable' : ''}`}
        role="list"
        aria-label={ariaLabel}
        onPointerDown={startPointerDrag}
        onPointerMove={movePointerDrag}
        onPointerUp={finishPointerDrag}
        onPointerCancel={finishPointerDrag}
        onClickCapture={suppressDragClick}
      >
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
