import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const homeHero = readFileSync(new URL('../src/views/HomeHero.tsx', import.meta.url), 'utf8');
const marketplace = readFileSync(new URL('../src/views/ProductionMarketplace.tsx', import.meta.url), 'utf8');

/** Titles of the four home tiles, in rendered array order. */
const tileTitles = (source: string): string[] => {
  const start = source.indexOf('const actions = [');
  assert.ok(start >= 0, 'home tile array not found');
  const block = source.slice(start, source.indexOf('] as const;', start));
  return [...block.matchAll(/[{,]\s*title:\s*'([^']+)'/g)].map((m) => m[1]);
};

const menuBlock = (source: string): string => {
  const start = source.indexOf('const createMenu =');
  assert.ok(start >= 0, 'create menu not found');
  return source.slice(start, source.indexOf('const renderBottomTab', start));
};

describe('MARSHGO v4.1 home tiles and central action menu', () => {
  it('renders the four home tiles in the contract order', () => {
    assert.deepEqual(tileTitles(homeHero), ['Навігація', 'Опублікувати поїздку', 'Карта транспорту', 'Знайти маршрут']);
  });

  it('offers the four contract actions in the contract order', () => {
    const titles = [...menuBlock(marketplace).matchAll(/label:\s*'([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(titles, ['Навігація', 'Карта транспорту', 'Опублікувати поїздку', 'Знайти маршрут']);
  });

  it('keeps the existing passenger demand action reachable, not deleted', () => {
    assert.match(menuBlock(marketplace), /Створити запит/);
    assert.match(menuBlock(marketplace), /setTab\('demand'\)/);
  });

  it('closes on Escape, on a click outside, and exposes dialog semantics', () => {
    assert.match(marketplace, /if \(event\.key === 'Escape'\) \{ setShowCreateMenu\(false\); return; \}/);
    assert.match(menuBlock(marketplace), /event\.target === event\.currentTarget\) setShowCreateMenu\(false\)/);
    assert.match(menuBlock(marketplace), /role="dialog" aria-modal="true"/);
  });

  it('places the create dialog above the dock and keeps keyboard focus inside it', () => {
    const block = menuBlock(marketplace);
    assert.match(block, /z-\[var\(--mg-z-modal\)\]/, 'the dock must not cover the passenger create action');
    assert.match(block, /pb-\[calc\(var\(--mg-global-nav-clearance\)\+1\.25rem\)\]/, 'the mobile dialog should sit above the dock with a clear gap');
    assert.match(block, /ref=\{createMenuRef\} tabIndex=\{-1\} role="dialog"/);
    assert.match(marketplace, /if \(!dialog\.contains\(active\)\) \{ event\.preventDefault\(\); \(event\.shiftKey \? last : first\)\.focus\(\); \}/);
    assert.match(marketplace, /event\.shiftKey && active === first/);
    assert.match(marketplace, /!event\.shiftKey && active === last/);
    assert.match(marketplace, /createMenuTriggerRef\.current\?\.focus\(\)/, 'closing the dialog restores focus to its trigger');
  });

  it('every menu action reaches a real screen instead of a stub', () => {
    const block = menuBlock(marketplace);
    for (const tab of ['navigation', 'map', 'search', 'demand']) {
      assert.match(block, new RegExp(`setTab\\('${tab}'\\)`), `menu must route to tab ${tab}`);
    }
    assert.match(block, /Опублікувати поїздку'[^\n]*pick: publishDriverTrip/, 'publish must reach the driver form through the shared guard');
    const guard = marketplace.slice(marketplace.indexOf('const publishDriverTrip'), marketplace.indexOf('const homeScreen'));
    assert.match(guard, /setTab\('offer-new'\)/, 'publish must route to the driver form');
    assert.match(guard, /setTab\('profile'\)/, 'driver-role guard must redirect to the profile role screen');
  });

  it('marks the central button as a dialog trigger for assistive tech', () => {
    assert.match(marketplace, /aria-haspopup="dialog" aria-expanded=\{showCreateMenu\}/);
  });
});
