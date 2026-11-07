import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const read = (path: string) => readFile(resolve(dirname(fileURLToPath(import.meta.url)), path), 'utf8');

test('current city is in the global header and startup GPS is permission-gated', async () => {
  const [marketplace, city, map] = await Promise.all([
    read('../src/views/ProductionMarketplace.tsx'), read('../src/components/CurrentCitySelector.tsx'), read('../src/views/TransportMapView.tsx'),
  ]);
  const headerStart = marketplace.indexOf('const header =');
  const headerEnd = marketplace.indexOf('const searchForm =', headerStart);
  const header = marketplace.slice(headerStart, headerEnd);
  assert.ok(header.indexOf('MARSH') < header.indexOf('<CurrentCitySelector'), 'selector belongs after the brand');
  assert.ok(header.indexOf('<CurrentCitySelector') < header.indexOf('setTab(\'chat\')'), 'selector belongs before chat and notifications');
  assert.doesNotMatch(marketplace + city, /home-city-pill/);
  assert.match(marketplace, /navigator\.permissions\.query\(\{ name: 'geolocation'/);
  assert.match(marketplace, /canAutoDetectCity\(currentCityRef\.current, permission\.state\)/);
  assert.doesNotMatch(map, /navigator\.geolocation\.getCurrentPosition/);
  assert.doesNotMatch(map, /setCityId\('kyiv'\)/);
});

test('empty MarshPass promotion contains no fabricated route, commission, or ticket CTA', async () => {
  const hero = await read('../src/views/HomeHero.tsx');
  const promo = hero.slice(hero.indexOf('home-marshpass-promo'), hero.indexOf('</button>}', hero.indexOf('home-marshpass-promo')));
  assert.match(hero, /home-marshpass-promo/);
  assert.match(hero, /onOpenTrips/);
  assert.doesNotMatch(promo, /Львів|Куди завгодно|0% комісії|Отримати квиток|home-city-pill/);
});

test('ticket status gates QR and carries real booking identity and driver', async () => {
  const [ticket, marketplace] = await Promise.all([read('../src/views/MarshPassTicket.tsx'), read('../src/views/ProductionMarketplace.tsx')]);
  assert.match(ticket, /\['confirmed', 'boarding'\]\.includes\(status\)/);
  assert.match(ticket, /canBoard \? <div[\s\S]{0,220}<TicketQr token=\{token\}/);
  assert.match(marketplace, /bookingReference=\{ticketBooking\.id\.slice\(0, 8\)\.toUpperCase\(\)\}/);
  assert.match(marketplace, /driverName=\{ticketBooking\.driver_name\}/);
  assert.match(marketplace, /const currentBooking = currentBookings\.find/);
});
