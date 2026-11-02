import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isBookingSection,
  showsBookingList,
  showsSavedRoutes,
  tripsTabSubtitle,
  tripsTabs,
  type TripsSection,
} from '../src/views/tripsSections';

const allSections: TripsSection[] = ['active', 'upcoming', 'past', 'requests', 'saved'];

test('Trips exposes exactly the five canonical sections, each once', () => {
  assert.deepEqual(tripsTabs.map(([key]) => key), allSections);
  assert.equal(new Set(tripsTabs.map(([key]) => key)).size, allSections.length);
});

test('public-transit saved routes render in one section only, never in the booking tabs', () => {
  for (const section of allSections) {
    assert.equal(showsSavedRoutes(section), section === 'saved', `saved routes leaked into ${section}`);
  }
});

test('booking lists stay confined to carpool sections', () => {
  assert.deepEqual(allSections.filter(showsBookingList), ['active', 'upcoming', 'past', 'requests']);
  assert.equal(showsBookingList('saved'), false);
  assert.equal(isBookingSection('saved'), false);
  assert.equal(isBookingSection('upcoming'), true);
});

test('every section header names carpool or saved routes, not generic bookings over mixed data', () => {
  assert.equal(tripsTabSubtitle.saved, 'Збережені маршрути');
  for (const section of ['active', 'upcoming', 'past'] as const) {
    assert.match(tripsTabSubtitle[section], /бронювання MARSHGO/);
    assert.doesNotMatch(tripsTabSubtitle[section], /маршрут/i);
  }
});
