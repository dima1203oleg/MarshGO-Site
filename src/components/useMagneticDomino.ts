import { useEffect, useId, useRef } from 'react';
import { sensory } from '../sensory';
import { attachMagneticDomino } from './magneticDomino';

export function useMagneticDomino(itemCount: number, enabled = true) {
  const ref = useRef<HTMLDivElement>(null);
  const ribbonId = useId();
  useEffect(() => {
    if (!enabled || !ref.current) return;
    return attachMagneticDomino(ref.current, index => sensory.emit({ type: 'DOMINO_DETENT', ribbonId, index }));
  }, [itemCount, enabled, ribbonId]);
  return ref;
}
