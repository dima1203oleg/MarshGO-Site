import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { budgetLabel, isAppliedJourneyBudgetDraft, journeySearchBounds, MAX_JOURNEY_BUDGET_UAH, parseJourneyBudgetUah } from '../src/domain/journeySearchBounds';
import { areAllProvidersSelected, countSelectedProviders, toggleProvider, useAllProviders, type TransportSelection } from '../src/domain/transportPreferences';

const groups = [
  { transportType: 'bus', providers: [{ id: 'bus:Львівавтодор', name: 'Львівавтодор', available: true, cities: ['Львів'], sources: ['gtfs'], services: ['bus'] }] },
  { transportType: 'trolleybus', providers: [
    { id: 'trolleybus:Львівавтодор', name: 'Львівавтодор', available: true, cities: ['Львів'], sources: ['gtfs'], services: ['trolleybus'] },
    { id: 'trolleybus:Електротранс', name: 'Електротранс', available: true, cities: ['Львів'], sources: ['gtfs'], services: ['trolleybus'] },
  ] },
  { transportType: 'tram', providers: [{ id: 'tram:ghost', name: 'Ghost', available: false, cities: ['Львів'], sources: ['gtfs'], services: ['tram'] }] },
];

describe('journey search bounds from the «З»/«По»/budget controls', () => {
  it('turns «По» into a duration cap because the engine anchors on departure', () => {
    assert.deepEqual(journeySearchBounds('2026-05-15T08:00', '2026-05-15T09:30', null), { maxTotalDurationSeconds: 5400 });
  });

  it('sends nothing when the passenger leaves both bounds open', () => {
    assert.deepEqual(journeySearchBounds('2026-05-15T08:00', null, null), {});
    assert.deepEqual(journeySearchBounds('2026-05-15T08:00', null, 0), {});
  });

  it('converts the budget into minor units and keeps unknown fares unrestrained', () => {
    assert.deepEqual(journeySearchBounds('2026-05-15T08:00', null, 200), { maxPriceMinor: 20000 });
    assert.deepEqual(journeySearchBounds('2026-05-15T08:00', null, -50), {});
  });

  it('never invents a bound from an impossible or unparseable clock time', () => {
    assert.deepEqual(journeySearchBounds('2026-05-15T09:00', '2026-05-15T08:00', null), {});
    assert.deepEqual(journeySearchBounds('2026-05-15T08:00', '2026-05-15T08:00', null), {});
    // One minute is the shortest window the engine accepts, so it is sent as-is.
    assert.deepEqual(journeySearchBounds('2026-05-15T08:00', '2026-05-15T08:01', null), { maxTotalDurationSeconds: 60 });
    // Europe/Kyiv springs forward past 03:00 on 2026-03-29; that wall time does not exist.
    assert.deepEqual(journeySearchBounds('2026-03-29T03:00', '2026-03-29T04:30', null), {});
    assert.deepEqual(journeySearchBounds('not a datetime', '2026-05-15T09:00', 200), { maxPriceMinor: 20000 });
  });

  it('caps the window at the widest range the planner accepts', () => {
    assert.deepEqual(journeySearchBounds('2026-05-15T08:00', '2026-05-25T08:00', null), { maxTotalDurationSeconds: 604800 });
    assert.deepEqual(journeySearchBounds('2026-05-15T08:00', '2026-05-15T09:00', 1_000_000), { maxTotalDurationSeconds: 3600, maxPriceMinor: 100_000_000 });
  });

  it('labels an open budget as no limit rather than as free', () => {
    assert.equal(budgetLabel(null), 'Без обмеження');
    assert.equal(budgetLabel(0), 'Без обмеження');
    assert.equal(budgetLabel(300), 'До 300 грн');
  });

  it('converts a valid custom whole-UAH amount into the route-search price bound', () => {
    const budget = parseJourneyBudgetUah('450');
    assert.equal(budget, 450);
    assert.deepEqual(journeySearchBounds('2026-05-15T08:00', null, budget), { maxPriceMinor: 45_000 });
    assert.equal(parseJourneyBudgetUah(String(MAX_JOURNEY_BUDGET_UAH)), MAX_JOURNEY_BUDGET_UAH);
  });

  it('rejects blank, non-numeric, fractional, zero, negative and over-limit custom amounts', () => {
    for (const value of ['', 'abc', '1.5', '0', '-1', String(MAX_JOURNEY_BUDGET_UAH + 1)]) {
      assert.equal(parseJourneyBudgetUah(value), null, `expected ${JSON.stringify(value)} to be rejected`);
    }
  });

  it('does not search with an unapplied, invalid or blank custom budget draft', () => {
    assert.equal(isAppliedJourneyBudgetDraft('450', 450), true);
    assert.equal(isAppliedJourneyBudgetDraft('451', 450), false);
    assert.equal(isAppliedJourneyBudgetDraft('', null), false);
    assert.equal(isAppliedJourneyBudgetDraft('450', null), false);
  });
});

describe('provider choice summary', () => {
  const selection: TransportSelection = { active: ['bus', 'trolleybus', 'tram'], providers: {} };

  it('counts every connected provider while the choice is still open', () => {
    assert.equal(countSelectedProviders(selection, ['bus', 'trolleybus', 'tram'], groups), 3);
    assert.equal(areAllProvidersSelected(selection, ['bus', 'trolleybus', 'tram']), true);
  });

  it('counts only the picked providers that are actually connected', () => {
    const picked = toggleProvider(toggleProvider(selection, 'trolleybus', 'trolleybus:Електротранс'), 'tram', 'tram:ghost');
    // bus still takes everything (1), trolleybus keeps its single pick, and the offline tram feed adds nothing.
    assert.equal(countSelectedProviders(picked, ['bus', 'trolleybus', 'tram'], groups), 2);
    assert.equal(areAllProvidersSelected(picked, ['bus', 'trolleybus', 'tram']), false);
  });

  it('«Вибрати всі» reopens every listed category without touching the rest', () => {
    const picked = toggleProvider(selection, 'bus', 'bus:Львівавтодор');
    const reopened = useAllProviders(picked, ['trolleybus']);
    assert.deepEqual(reopened.providers.bus, { all: false, ids: ['bus:Львівавтодор'] });
    assert.equal(areAllProvidersSelected(reopened, ['bus']), false);
    assert.equal(countSelectedProviders(reopened, ['bus', 'trolleybus'], groups), 3);
  });

  it('reports none selected when the coverage probe has not answered yet', () => {
    assert.equal(countSelectedProviders(selection, ['bus', 'trolleybus'], null), 0);
  });
});

describe('«Без пересадок» direct-only control', () => {
  it('direct-only sends maxTransfers=0 so the engine keeps exactly one transit leg', () => {
    assert.deepEqual(journeySearchBounds('2026-05-15T08:00', null, null, true), { maxTransfers: 0 });
  });

  it('direct-only combines with duration and budget bounds without dropping them', () => {
    assert.deepEqual(journeySearchBounds('2026-05-15T08:00', '2026-05-15T09:30', 200, true), { maxTotalDurationSeconds: 5400, maxPriceMinor: 20000, maxTransfers: 0 });
  });

  it('leaves transfers unconstrained when the checkbox is off', () => {
    assert.deepEqual(journeySearchBounds('2026-05-15T08:00', null, null, false), {});
    assert.deepEqual(journeySearchBounds('2026-05-15T08:00', null, null), {});
  });

  it('the search form offers the checkbox and wires it into the request', () => {
    const marketplace = readFileSync('src/views/ProductionMarketplace.tsx', 'utf8');
    assert.match(marketplace, /const \[journeyDirectOnly, setJourneyDirectOnly\] = useState\(false\)/, 'the control starts unchecked');
    assert.match(marketplace, /type="checkbox" checked=\{journeyDirectOnly\} onChange=\{\(event\) => setJourneyDirectOnly\(event\.target\.checked\)\}/, 'the checkbox owns the state');
    assert.match(marketplace, /Без пересадок/, 'the passenger sees the direct-only wording');
    assert.match(marketplace, /journeySearchBounds\(journeyDeparture, journeyArrivalBy, journeyBudgetUah, journeyDirectOnly\)/, 'the request must carry the control, or it does nothing');
  });
});
