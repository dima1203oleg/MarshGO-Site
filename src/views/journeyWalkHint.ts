import type { ApiJourney } from '../services/productionApi';
import { journeyLegLabel } from './journeyLegLabel';

type JourneyLeg = ApiJourney['legs'][number];

export function legLabel(leg: JourneyLeg): string {
  return `${journeyLegLabel(leg.mode, leg.transportType)}${leg.routeName ? ` ${leg.routeName}` : ''}`;
}

/**
 * Subject-first clarity: the segment card already says «Пішки», so the hint names
 * the target («До A53», «До фінішу») instead of a conversational instruction that
 * repeats the icon. Keeps the sheet dense and scannable without losing meaning.
 */
export function walkHintFor(legs: JourneyLeg[], index: number): { title: string; detail: string } | null {
  if (legs[index]?.mode !== 'WALK') return null;
  const next = legs[index + 1];
  if (next && next.mode !== 'WALK') {
    const target = next.routeName || journeyLegLabel(next.mode, next.transportType);
    return { title: `До ${target}`, detail: '' };
  }
  if (!next) return { title: 'До фінішу', detail: '' };
  return { title: 'Пішки', detail: '' };
}