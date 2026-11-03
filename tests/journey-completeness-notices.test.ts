// ТЗ-M5-P10: the results screen must say which asked-for category could not be used, and must not
// call a failed transit search "no routes here". Fixtures below are synthetic, not live feeds.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { providerErrorNotices, stopWalkReachNotice, unavailableTransportNotices } from '../src/views/journeyResultPresentation';

const unavailable = (mode: string, reason: string, requested = true) => ({ mode, available: false, requested, reason });

describe('completeness notices', () => {
  it('names every requested category the corridor could not serve', () => {
    const notices = unavailableTransportNotices([], [], {
      modesUnavailable: [
        unavailable('marshrutka', 'no_routed_provider_in_corridor'),
        unavailable('metro', 'no_source_declares_this_category'),
        unavailable('taxi', 'no_source_declares_this_category', false),
      ],
    });
    assert.deepEqual(notices.map((notice) => notice.mode), ['marshrutka', 'metro']);
    assert.match(notices[0]!.text, /Маршрутки: у цьому коридорі немає жодного підключеного розкладу/);
    assert.match(notices[1]!.text, /Метро: жодне підключене джерело не оголошує цей вид транспорту/);
  });

  it('wordes a thrown transit search as unverified instead of absent', () => {
    const [notice] = unavailableTransportNotices([], [], {
      modesUnavailable: [unavailable('bus', 'transit_search_failed')],
    });
    assert.match(notice!.text, /не вдалося перевірити/);
    assert.doesNotMatch(notice!.text, /немає маршрутів/);
  });

  it('lets the server block win per category instead of printing the same mode twice', () => {
    const notices = unavailableTransportNotices(
      ['transportType:tram:no-routed-provider-in-corridor'],
      ['transportType:tram:no-routed-provider-in-corridor'],
      { modesUnavailable: [unavailable('tram', 'transit_search_failed')] },
    );
    assert.equal(notices.length, 1);
    assert.match(notices[0]!.text, /не вдалося перевірити/);
  });

  it('still reads the preference tokens when the server sends no completeness block', () => {
    const notices = unavailableTransportNotices(
      ['transportType:trolleybus:no-provider-configured'],
      ['transportType:trolleybus:no-provider-configured'],
    );
    assert.equal(notices.length, 1);
    assert.match(notices[0]!.text, /Тролейбуси: немає жодного підключеного джерела/);
  });
});

// EMPTY-HONESTY-1: a mid-block pin with no stop inside the walk radius is a reachability fact,
// not "no routes exist". Fixtures below are synthetic (the 1244 m value mirrors a real Lviv measurement).
describe('stop walk reach notice', () => {
  const token = 'no_stop_within_walking_distance';

  it('stays silent when the blocked-reason token is absent', () => {
    assert.equal(stopWalkReachNotice([], { nearestOriginStopMeters: 1244 }), null);
    assert.equal(stopWalkReachNotice(['walking_routing_unavailable'], {}), null);
    assert.equal(stopWalkReachNotice(), null);
  });

  it('names both sides when both distances arrived', () => {
    const text = stopWalkReachNotice([token], { nearestOriginStopMeters: 850, nearestDestinationStopMeters: 1244 });
    assert.equal(text, 'Поруч немає зупинки в межах пішого доступу: найближча — 850 м від початку і 1,2 км від призначення. Перемістіть точку ближче до зупинки — тоді розкладні рейси зможуть зʼявитися.');
  });

  it('mentions only the side whose distance is present', () => {
    const text = stopWalkReachNotice([token], { nearestDestinationStopMeters: 1244 });
    assert.match(text!, /1,2 км від призначення/);
    assert.doesNotMatch(text!, /від початку/);
    const originOnly = stopWalkReachNotice([token], { nearestOriginStopMeters: 1244, nearestDestinationStopMeters: null });
    assert.match(originOnly!, /1,2 км від початку/);
    assert.doesNotMatch(originOnly!, /від призначення/);
  });

  it('gives the advice without any distance when no numbers arrived', () => {
    const text = stopWalkReachNotice([token], { nearestOriginStopMeters: null });
    assert.equal(text, 'Перемістіть точку ближче до зупинки — тоді розкладні рейси зможуть зʼявитися.');
    assert.doesNotMatch(stopWalkReachNotice([token])!, /км|від початку|від призначення/);
    assert.doesNotMatch(stopWalkReachNotice([token], { nearestOriginStopMeters: Number.NaN })!, /NaN/);
  });

  it('never claims routes do not exist — it says the stop is out of walk reach', () => {
    const text = stopWalkReachNotice([token], { nearestDestinationStopMeters: 1244 })!;
    assert.doesNotMatch(text, /маршрутів (немає|не існує)|немає маршрутів/);
    assert.match(text, /в межах пішого доступу/);
  });
});

// Synthetic strings copied from a live Lviv search response; they are fixtures, not live evidence.
const scheduleFallback = 'Львівавтодор — розклад (GTFS): GTFS-Realtime відхилено (оновлення тимчасово недоступні); використовується розклад';
const pedestrianRejection = 'Частину варіантів відхилено: фактичний час або відстань пішохідного шляху не дозволяє здійснити маршрут.';
const routerBudget = 'Пішохідний маршрутизатор обмежив пошук 32 маршрутами; частину альтернатив не перевірено.';

describe('provider error notices', () => {
  it('keeps each provider fact on its own line instead of one umbrella outage claim', () => {
    const notices = providerErrorNotices([scheduleFallback, pedestrianRejection, routerBudget]);
    assert.equal(notices.length, 3);
    assert.ok(!notices.some(notice => /Деякі розклади тимчасово недоступні/.test(notice.text)));
    assert.equal(notices[0]!.tone, 'amber');
    assert.match(notices[0]!.text, /використовується розклад/);
  });

  it('never doubles a terminal period and never keeps an empty or repeated line', () => {
    const notices = providerErrorNotices([pedestrianRejection, `${pedestrianRejection} `, '', '  ']);
    assert.equal(notices.length, 1);
    assert.doesNotMatch(notices[0]!.text, /\.\.|[.;]\.$/);
    assert.match(notices[0]!.text, /маршрут\.$/);
  });

  it('reserves the failure tone for errors that did not fall back to the printed schedule', () => {
    const [notice] = providerErrorNotices([routerBudget]);
    assert.equal(notice!.tone, 'rose');
  });
});
