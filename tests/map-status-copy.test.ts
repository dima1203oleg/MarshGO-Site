import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { mapStatusDetail, mapStatusNote } from '../src/map/mapStatusCopy';

const MAP_STATUSES = ['unconfigured', 'loading', 'available', 'degraded', 'failed'] as const;
const SUBJECTS = ['journey', 'transport', 'meet', 'preview'] as const;

/** Passenger-facing map chrome that truncates: a long label becomes "Карта без…". */
const SURFACE_FILES = [
  'src/views/JourneyRouteMapScreen.tsx',
  'src/views/JourneyActiveNavigation.tsx',
  'src/views/ProductionNavigation.tsx',
  'src/views/TransportMapView.tsx',
  'src/map/OfferRouteMap.tsx',
  'src/components/RendezvousLocationMap.tsx',
];

describe('map status copy stays human and shared', () => {
  it('says nothing when the map is fine', () => {
    assert.equal(mapStatusNote('available'), '');
    assert.equal(mapStatusDetail('available'), '');
    assert.equal(mapStatusDetail('available', 'meet'), '');
  });

  it('names every state a passenger can actually see', () => {
    for (const status of MAP_STATUSES) {
      if (status === 'available') continue;
      assert.ok(mapStatusNote(status).length > 0, `note for ${status}`);
      assert.ok(mapStatusDetail(status).length > 0, `detail for ${status}`);
    }
    assert.equal(mapStatusNote('unconfigured'), 'Карта без вулиць');
  });

  it('keeps the pill label short enough not to truncate', () => {
    for (const status of MAP_STATUSES) {
      assert.ok(mapStatusNote(status).length <= 30, `${status} note is ${mapStatusNote(status).length} chars`);
    }
  });

  it('never leaves the passenger with an unexplained empty map', () => {
    for (const status of MAP_STATUSES) {
      if (status === 'available') continue;
      for (const subject of SUBJECTS) {
        const copy = mapStatusDetail(status, subject);
        // A state where the canvas never rendered must not promise anything it
        // cannot show; only the states that did reach `load` may.
        if (status === 'loading' || status === 'failed') {
          assert.doesNotMatch(copy, /видно/, `${subject}/${status} must not promise a visible overlay`);
        } else {
          assert.match(copy, /видно/, `${subject}/${status} must say what still works`);
        }
        if (status === 'loading') assert.match(copy, /Завантажуємо/, `${subject}/loading says only what it is doing`);
        if (status === 'failed') assert.match(copy, /перевірте мережу/i, `${subject}/failed gives an action`);
      }
    }
  });

  it('keeps engineering words out of passenger copy', () => {
    const jargon = /тайл|маніфест|manifest|MARSHGO|\bстиль|базов|мапи|render|source|tile/i;
    for (const status of MAP_STATUSES) {
      for (const subject of SUBJECTS) {
        const copy = `${mapStatusNote(status)} ${mapStatusDetail(status, subject)}`;
        assert.doesNotMatch(copy, jargon, `jargon in ${subject}/${status}: ${copy}`);
      }
    }
  });

  it('routes every map surface through the one module instead of local strings', () => {
    for (const file of SURFACE_FILES) {
      const source = readFileSync(file, 'utf8');
      assert.match(source, /from '(?:\.\.\/)?map\/mapStatusCopy'|from '\.\/mapStatusCopy'/,
        `${file} must import the shared copy`);
      assert.doesNotMatch(source, /Базові тайли|Фон мапи|Стиль і підкладка|картографічних даних/,
        `${file} still carries legacy engineering copy`);
    }
  });
});
