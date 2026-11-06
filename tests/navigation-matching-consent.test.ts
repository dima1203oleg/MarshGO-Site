import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const navigationSource = readFileSync(new URL('../src/views/ProductionNavigation.tsx', import.meta.url), 'utf8');
const onboardingSource = readFileSync(new URL('../src/components/OnboardingSlides.tsx', import.meta.url), 'utf8');

describe('navigation passenger-matching consent', () => {
  it('does not enable passenger matching when navigation starts', () => {
    const startIndex = navigationSource.indexOf('const start = async');
    const endIndex = navigationSource.indexOf('// Immediate start without intermediate page');
    assert.ok(startIndex >= 0 && endIndex > startIndex, 'navigation start handler boundaries exist');
    const start = navigationSource.slice(startIndex, endIndex);
    assert.match(start, /setMatchingEnabled\(false\)/);
    assert.doesNotMatch(start, /setNavigationMatching\(created\.id,\s*true\)/);
    assert.doesNotMatch(navigationSource, /AUTO_MATCHING_KEY|autoMatchingPreferred/);
  });

  it('offers a separate explicit switch and describes it in onboarding', () => {
    assert.match(navigationSource, /onClick=\{\(\) => void toggleMatching\(\)\}/);
    assert.match(navigationSource, /setNavigationMatching\(session\.id, next\)/);
    assert.match(onboardingSource, /окремо увімкни пошук уздовж маршруту/);
  });
});
