import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it } from 'node:test';
import { SensorySettingsPanel } from '../src/components/SensorySettingsPanel';

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');

describe('SensorySettingsPanel (ТЗ §20) renders the real persisted controls', () => {
  const html = renderToStaticMarkup(createElement(SensorySettingsPanel));

  it('shows the section title and a gesture preview that unlocks audio', () => {
    assert.match(html, /Звуки та відгук/);
    assert.match(html, /Прослухати/);
    assert.match(html, /sensory\.emit|Прослухати/);
  });

  it('exposes four switches: sounds, haptics, cinematic camera, navigation sounds', () => {
    const switches = html.match(/role="switch"/g) ?? [];
    assert.equal(switches.length, 4, 'four independent feedback switches');
    assert.match(html, /Звуки інтерфейсу/);
    assert.match(html, /Вібровідгук/);
    assert.match(html, /Кінематографічна камера/);
    assert.match(html, /Звуки навігації/);
  });

  it('exposes a labelled volume range bound to the master volume', () => {
    assert.match(html, /type="range"/);
    assert.match(html, /Гучність/);
    assert.match(html, /aria-label="Гучність звуків інтерфейсу"/);
    assert.match(html, /min="0"/);
    assert.match(html, /max="100"/);
  });

  it('exposes the three style voices as a radio group', () => {
    assert.match(html, /role="radiogroup"/);
    const radios = html.match(/role="radio"/g) ?? [];
    assert.equal(radios.length, 3);
    assert.match(html, /Збалансований/);
    assert.match(html, /Виразний/);
    assert.match(html, /Мінімальний/);
  });

  it('offers a reset and honest haptic support copy', () => {
    assert.match(html, /Скинути/);
    assert.match(html, /не підтримує вібровідгук|Вібровідгук браузера|Системний вібровідгук/);
  });

  it('keeps tap targets at least 44px and uses action tokens, not raw hex', () => {
    assert.match(html, /min-h-11/);
    assert.match(html, /var\(--mg-action\)/);
    assert.doesNotMatch(html, /#[0-9a-fA-F]{6}/);
  });
});

describe('semantic events are wired into the real production surfaces (ТЗ §3, §5–§20)', () => {
  it('transport selector emits TRANSPORT_SELECTED on tile tap', () => {
    const src = read('../src/components/TransportTypesPanel.tsx');
    assert.match(src, /sensory\.emit\(\{ type: 'TRANSPORT_SELECTED'/);
  });

  it('results panel emits sort, open and favorite events', () => {
    const src = read('../src/views/JourneyResultsPanel.tsx');
    assert.match(src, /type: 'SORT_CHANGED'/);
    assert.match(src, /type: 'RESULT_SELECTED'/);
    assert.match(src, /type: 'FAVORITE_TOGGLED'/);
    assert.match(src, /type: 'ERROR_SOFT'/);
  });

  it('route map emits segment, stop, sheet, stops, camera and favorite events', () => {
    const src = read('../src/views/JourneyRouteMapScreen.tsx');
    for (const type of ['SEGMENT_SELECTED', 'STOP_SELECTED', 'SHEET_SNAPPED', 'STOPS_EXPANDED', 'STOPS_COLLAPSED', 'CAMERA_FLIGHT_STARTED', 'CAMERA_FLIGHT_ARRIVED', 'FAVORITE_TOGGLED']) {
      assert.ok(src.includes(`type: '${type}'`), `route map must emit ${type}`);
    }
    assert.ok(!/const haptic = \(ms\)/.test(src), 'the bare vibrate helper is replaced by the unified engine');
  });

  it('marketplace emits nav, drawer, booking, pass, offer and counteroffer events', () => {
    const src = read('../src/views/ProductionMarketplace.tsx');
    for (const type of ['NAV_TAB_CHANGED', 'ACTION_DRAWER_OPENED', 'BOOKING_CONFIRMED', 'MARSH_PASS_OPENED', 'PRICE_OFFER_SENT', 'COUNTEROFFER_RECEIVED', 'ERROR_SOFT']) {
      assert.ok(src.includes(`type: '${type}'`), `marketplace must emit ${type}`);
    }
  });

  it('booking and pass sounds fire only after the server confirms', () => {
    const src = read('../src/views/ProductionMarketplace.tsx');
    const book = src.slice(src.indexOf('const book = async'), src.indexOf('const cancelTrip'));
    assert.ok(book.indexOf('await productionApi.book') < book.indexOf("type: 'BOOKING_CONFIRMED'"), 'booking sound follows the awaited API commit');
    const pass = src.slice(src.indexOf('const showBookingTicket'), src.indexOf('const loadRendezvous'));
    assert.ok(pass.indexOf('await productionApi.bookingTicket') < pass.indexOf("type: 'MARSH_PASS_OPENED'"), 'pass sound follows the awaited token fetch');
  });

  it('carpool LIVE toggle emits only after server confirm and uses driver-safe mode', () => {
    const src = read('../src/views/ProductionNavigation.tsx');
    const toggle = src.slice(src.indexOf('const toggleMatching'), src.indexOf('const pauseForResponse'));
    assert.ok(toggle.indexOf('await productionApi.setNavigationMatching') < toggle.indexOf("type: 'CARPOOL_TOGGLE_CHANGED'"));
    assert.match(src, /sensory\.setMode\('driver-safe'\)/);
    assert.match(src, /sensory\.setMode\('interactive'\)/);
  });

  it('own proposal actions are guarded so the realtime echo never doubles the sound', () => {
    const src = read('../src/views/ProductionMarketplace.tsx');
    assert.ok(src.includes('proposal.revision_number !== event.data.revision_number'));
    assert.ok(src.includes('heard >= proposal.revision_number'));
    assert.ok(src.includes('proposal.driver_id !== user.id'));
    assert.ok(src.includes("if (fromOtherParty) sensory.emit({ type: 'COUNTEROFFER_RECEIVED' })"));
  });

  it('camera arrival fires on a programmatic settle, not on rider gestures', () => {
    const adapter = read('../src/map/MapLibreAdapter.ts');
    assert.ok(adapter.includes('this.onCameraSettled?.()'), 'adapter invokes the optional settle callback');
    assert.match(adapter, /cameraFlightPending/);
    const iface = read('../src/map/MapAdapter.ts');
    assert.match(iface, /onCameraSettled\?: \(\) => void/);
    const screen = read('../src/views/JourneyRouteMapScreen.tsx');
    assert.ok(screen.includes('if (!cameraFeedbackPending.current) return;'));
    assert.ok(screen.includes("sensory.emit({ type: 'CAMERA_FLIGHT_ARRIVED' })"));
  });

  it('the settings panel is mounted in the real profile settings section', () => {
    const src = read('../src/views/ProfileSections.tsx');
    assert.match(src, /import \{ SensorySettingsPanel \}/);
    const settings = src.slice(src.indexOf("section === 'settings'"), src.indexOf("section === 'privacy'"));
    assert.match(settings, /<SensorySettingsPanel \/>/);
  });

  it('the engine is initialised once from the production main entry', () => {
    const src = read('../src/main.tsx');
    assert.match(src, /sensory\.init\(\)/);
    assert.ok(src.includes('createRoot(rootElement).render(<ProductionMarketplace />)'));
    assert.ok(src.indexOf('sensory.init()') < src.indexOf('createRoot(rootElement).render'));
  });
});