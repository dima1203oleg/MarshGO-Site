// ТЗ-M5-P10: the results screen must say which asked-for category could not be used, and must not
// call a failed transit search "no routes here". Fixtures below are synthetic, not live feeds.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { providerErrorNotices, unavailableTransportNotices } from '../src/views/journeyResultPresentation';

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

// Synthetic provider messages from the API contract; these tests do not claim live-feed verification.
const scheduleFallback = 'Львівавтодор — розклад (GTFS): GTFS-Realtime відхилено (оновлення тимчасово недоступні); використовується розклад';
const pedestrianRejection = 'Частину варіантів відхилено: фактичний час або відстань пішохідного шляху не дозволяє здійснити маршрут.';
const feedUnavailable = 'Львівавтодор — розклад (GTFS): розклад тимчасово недоступний';
const transitSearchFailed = 'GTFS-пошук тимчасово недоступний: черга заповнена; інші типи маршрутів перевіряються окремо';

describe('provider error notices', () => {
  it('keeps schedule fallback and rejected-candidate explanations as caution, not outage', () => {
    const notices = providerErrorNotices([scheduleFallback, pedestrianRejection]);
    assert.deepEqual(notices.map(notice => notice.tone), ['amber', 'amber']);
    assert.match(notices[0]!.text, /використовується розклад/);
  });

  it('deduplicates sentences and emits only one terminal period', () => {
    const notices = providerErrorNotices([pedestrianRejection, `${pedestrianRejection} `, '', '  ']);
    assert.equal(notices.length, 1);
    assert.match(notices[0]!.text, /маршрут\.$/);
    assert.doesNotMatch(notices[0]!.text, /\.\./);
  });

  it('keeps the outage severity only for provider data that did not arrive', () => {
    const notices = providerErrorNotices([pedestrianRejection, feedUnavailable, transitSearchFailed]);
    assert.deepEqual(notices.map(notice => notice.tone), ['amber', 'rose', 'rose']);
    assert.equal(providerErrorNotices([scheduleFallback])[0]!.tone, 'amber');
  });
});
