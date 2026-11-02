import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Maneuver } from '../shared/navigation/contracts';
import { dueAnnouncement, formatGuidanceDistance, instructionText, nextGuidance, prepareGuidance, voiceLine } from '../src/navigation/guidance';

// A straight road east along 49.84°N with one right turn into «вулиця Городоцька», then arrival.
const route: Array<[number, number]> = Array.from({ length: 11 }, (_, index) => [24.0 + index * 0.001, 49.84]);
const step = (id: string, type: Maneuver['type'], at: number, extra: Partial<Maneuver> = {}): Maneuver => ({ id, type, location: route[at], distanceMeters: 0, durationSeconds: 0, ...extra });
const maneuvers = [step('0', 'DEPART', 0, { streetName: 'проспект Свободи' }), step('1', 'TURN', 6, { modifier: 'RIGHT', streetName: 'вулиця Городоцька' }), step('2', 'ARRIVE', 10)];

describe('turn-by-turn guidance', () => {
  const prepared = prepareGuidance(route, maneuvers);
  it('finds the next manoeuvre ahead and measures the distance along the road', () => {
    const state = nextGuidance(prepared, route[2])!;
    assert.equal(state.next?.id, '1');
    assert.ok(Math.abs(state.distanceMeters - 287) < 5, `≈4 segments of ~72 m, got ${state.distanceMeters}`);
    assert.equal(state.currentStreet, 'проспект Свободи');
  });
  it('moves on to the arrival once the turn is behind', () => {
    const state = nextGuidance(prepared, route[8])!;
    assert.equal(state.next?.type, 'ARRIVE');
    assert.equal(state.currentStreet, 'вулиця Городоцька');
  });
  it('speaks Ukrainian instructions with rounded distances', () => {
    assert.equal(instructionText(maneuvers[1]), 'Поверніть праворуч на вулиця Городоцька');
    assert.equal(instructionText(step('r', 'ROUNDABOUT', 3, { exitNumber: 2 })), 'На колі 2-й з’їзд');
    assert.equal(instructionText(step('u', 'TURN', 3, { modifier: 'UTURN' })), 'Розверніться');
    assert.equal(formatGuidanceDistance(287), '300 м');
    assert.equal(formatGuidanceDistance(1260), '1,3 км');
    assert.equal(formatGuidanceDistance(12), 'зараз');
    assert.equal(voiceLine(maneuvers[1], 300), 'Через 300 метрів поверніть праворуч на вулиця Городоцька');
    assert.equal(voiceLine(maneuvers[1], 20), 'Зараз поверніть праворуч на вулиця Городоцька');
    assert.equal(voiceLine(maneuvers[2], 10), 'Ви прибули до пункту призначення');
  });
  it('announces each checkpoint once and never replays a farther one later', () => {
    const spoken = new Set<string>();
    const first = dueAnnouncement(150, spoken, '1')!;
    assert.deepEqual(first, ['1:near', '1:far']);
    first.forEach((id) => spoken.add(id));
    assert.equal(dueAnnouncement(120, spoken, '1'), null);
    assert.deepEqual(dueAnnouncement(30, spoken, '1'), ['1:now', '1:near', '1:far']);
    assert.equal(dueAnnouncement(1500, new Set(), '1'), null);
  });
});
