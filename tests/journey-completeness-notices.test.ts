// ТЗ-M5-P10: the results screen must say which asked-for category could not be used, and must not
// call a failed transit search "no routes here". Fixtures below are synthetic, not live feeds.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { unavailableTransportNotices } from '../src/views/journeyResultPresentation';

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
