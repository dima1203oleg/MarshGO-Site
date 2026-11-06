import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const marketplace = readFileSync('src/views/ProductionMarketplace.tsx', 'utf8');

describe('driver role state', () => {
  it('announces an active driver role as status instead of a disabled action', () => {
    assert.match(marketplace, /user\.roles\.includes\('driver'\)\s*\?\s*<p role="status"/);
    assert.match(marketplace, /<BadgeCheck size=\{16\} aria-hidden="true"\/>Роль водія активна<\/p>/);
    assert.match(marketplace, /: <button onClick=\{\(\)=>void enableDriver\(\)\} disabled=\{busy\}[^>]*>Увімкнути роль водія<\/button>/);
  });

  it('uses clear Ukrainian labels for offer and demand entry points', () => {
    assert.match(marketplace, /Попутки MARSHGO/);
    assert.match(marketplace, /Запит на попутку/);
    assert.doesNotMatch(marketplace, /Зворотний маркетплейс/);
  });
});
