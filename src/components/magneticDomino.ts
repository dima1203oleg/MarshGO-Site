export const DOMINO_PHYSICS = Object.freeze({
  dragThreshold: 7,
  projectionMs: 160,
  maxProjectionViewports: 1.5,
  feedbackIntervalMs: 95,
  settleDelayMs: 140,
});

export function dominoAnchors(offsets: readonly number[], maxScroll: number): number[] {
  return offsets.map(offset => Math.max(0, Math.min(maxScroll, offset)));
}

export function nearestDominoIndex(anchors: readonly number[], position: number): number {
  if (!anchors.length) return -1;
  let nearest = 0;
  for (let index = 1; index < anchors.length; index += 1) {
    if (Math.abs(anchors[index] - position) < Math.abs(anchors[nearest] - position)) nearest = index;
  }
  return nearest;
}

export function projectedDominoPosition(position: number, velocity: number, viewport: number, maxScroll: number): number {
  const limit = viewport * DOMINO_PHYSICS.maxProjectionViewports;
  const momentum = Math.max(-limit, Math.min(limit, velocity * DOMINO_PHYSICS.projectionMs));
  return Math.max(0, Math.min(maxScroll, position + momentum));
}

export function attachMagneticDomino(element: HTMLElement, onDetent: (index: number) => void): () => void {
  let items: HTMLElement[] = [];
  let anchors: number[] = [];
  let activeIndex = -1;
  let armed = false;
  let pointer: { id: number; x: number; y: number; left: number; lastX: number; time: number; velocity: number; dragging: boolean } | null = null;
  let suppressClick = false;
  let feedbackAt = -Infinity;
  let settleTimer = 0;
  let frame = 0;
  let nativeSnap = element.style.scrollSnapType;

  const paint = (index: number) => {
    items.forEach((item, itemIndex) => {
      item.dataset.dominoPosition = itemIndex === index ? 'capture' : Math.abs(itemIndex - index) === 1 ? 'neighbor' : 'rest';
    });
    element.dataset.dominoIndex = String(index);
  };
  const measure = () => {
    items = Array.from(element.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
    const first = items[0]?.offsetLeft ?? 0;
    anchors = dominoAnchors(items.map(item => item.offsetLeft - first), Math.max(0, element.scrollWidth - element.clientWidth));
    activeIndex = nearestDominoIndex(anchors, element.scrollLeft);
    paint(activeIndex);
  };
  const cancelAnimation = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    element.style.scrollSnapType = nativeSnap;
  };
  const settle = () => {
    if (pointer?.dragging || frame) return;
    armed = false;
    element.dataset.dominoPhase = 'settled';
  };
  const scroll = () => {
    const next = nearestDominoIndex(anchors, element.scrollLeft);
    if (next !== activeIndex) {
      activeIndex = next;
      paint(next);
      const now = performance.now();
      if (armed && next >= 0 && now - feedbackAt >= DOMINO_PHYSICS.feedbackIntervalMs) {
        feedbackAt = now;
        onDetent(next);
      }
    }
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(settle, DOMINO_PHYSICS.settleDelayMs);
  };
  const animateTo = (target: number) => {
    cancelAnimation();
    const start = element.scrollLeft;
    const duration = parseFloat(getComputedStyle(element).getPropertyValue('--mg-dur-base')) || 260;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || Math.abs(target - start) < 1) {
      element.scrollLeft = target;
      scroll();
      settle();
      return;
    }
    const started = performance.now();
    nativeSnap = element.style.scrollSnapType;
    element.style.scrollSnapType = 'none';
    element.dataset.dominoPhase = 'capture';
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      element.scrollLeft = start + (target - start) * (1 - (1 - progress) ** 3);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else {
        frame = 0;
        element.style.scrollSnapType = nativeSnap;
        scroll();
        settle();
      }
    };
    frame = requestAnimationFrame(tick);
  };
  const down = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0) return;
    cancelAnimation();
    window.clearTimeout(settleTimer);
    armed = false;
    suppressClick = false;
    element.dataset.dominoPhase = 'touch';
    if (event.pointerType !== 'mouse') return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, left: element.scrollLeft, lastX: event.clientX, time: performance.now(), velocity: 0, dragging: false };
  };
  const move = (event: PointerEvent) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (!pointer.dragging) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > DOMINO_PHYSICS.dragThreshold) { pointer = null; return; }
      if (Math.abs(dx) < DOMINO_PHYSICS.dragThreshold || element.scrollWidth <= element.clientWidth) return;
      pointer.dragging = true;
      armed = true;
      element.setPointerCapture(event.pointerId);
      element.style.scrollSnapType = 'none';
    }
    event.preventDefault();
    const now = performance.now();
    pointer.velocity = (pointer.lastX - event.clientX) / Math.max(1, now - pointer.time);
    pointer.lastX = event.clientX;
    pointer.time = now;
    element.dataset.dominoPhase = 'drag';
    element.scrollLeft = pointer.left - dx;
  };
  const end = (event: PointerEvent) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const previous = pointer;
    pointer = null;
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    if (!previous.dragging) { settle(); return; }
    suppressClick = event.type !== 'pointercancel';
    const velocity = performance.now() - previous.time > 80 ? 0 : previous.velocity;
    const target = event.type === 'pointercancel' ? element.scrollLeft : projectedDominoPosition(element.scrollLeft, velocity, element.clientWidth, element.scrollWidth - element.clientWidth);
    animateTo(anchors[nearestDominoIndex(anchors, target)] ?? 0);
  };
  const touchMove = () => { armed = true; element.dataset.dominoPhase = 'drag'; };
  const wheel = (event: WheelEvent) => {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) && !event.shiftKey) return;
    cancelAnimation();
    armed = true;
    element.dataset.dominoPhase = 'momentum';
  };
  const click = (event: MouseEvent) => {
    if (suppressClick) {
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    cancelAnimation();
    armed = false;
    settle();
  };
  const key = (event: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const focused = items.findIndex(item => item === document.activeElement || item.contains(document.activeElement));
    const current = focused < 0 ? activeIndex : focused;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : Math.max(0, Math.min(items.length - 1, current + (event.key === 'ArrowRight' ? 1 : -1)));
    if (next < 0) return;
    event.preventDefault();
    event.stopPropagation();
    armed = true;
    const target = items[next].matches('button') ? items[next] : items[next].querySelector<HTMLElement>('button');
    target?.focus({ preventScroll: true });
    animateTo(anchors[next]);
  };
  element.addEventListener('scroll', scroll, { passive: true });
  element.addEventListener('scrollend', settle);
  element.addEventListener('pointerdown', down);
  element.addEventListener('pointermove', move);
  element.addEventListener('pointerup', end);
  element.addEventListener('pointercancel', end);
  element.addEventListener('touchmove', touchMove, { passive: true });
  element.addEventListener('wheel', wheel, { passive: true });
  element.addEventListener('click', click, true);
  element.addEventListener('keydown', key);
  const observer = new ResizeObserver(measure);
  observer.observe(element);
  Array.from(element.children).forEach(child => observer.observe(child));
  measure();
  return () => {
    cancelAnimation();
    if (pointer && element.hasPointerCapture(pointer.id)) element.releasePointerCapture(pointer.id);
    pointer = null;
    window.clearTimeout(settleTimer);
    observer.disconnect();
    element.removeEventListener('scroll', scroll);
    element.removeEventListener('scrollend', settle);
    element.removeEventListener('pointerdown', down);
    element.removeEventListener('pointermove', move);
    element.removeEventListener('pointerup', end);
    element.removeEventListener('pointercancel', end);
    element.removeEventListener('touchmove', touchMove);
    element.removeEventListener('wheel', wheel);
    element.removeEventListener('click', click, true);
    element.removeEventListener('keydown', key);
  };
}
