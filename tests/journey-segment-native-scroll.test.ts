import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const css = () => readFileSync('src/index.css', 'utf8');
const strip = () => readFileSync('src/design-system/journey/JourneySegmentStrip.tsx', 'utf8');
const ribbonCss = () => {
  const sheet = css();
  return sheet.slice(sheet.indexOf('.mg-route-ribbon {'), sheet.indexOf('.mg-route-ribbon__item'));
};
const tilesCss = () => {
  const sheet = css();
  return sheet.slice(sheet.indexOf('.journey-segment-tiles {'), sheet.indexOf('.journey-segment-tile {'));
};
const ribbonItemCss = () => {
  const sheet = css();
  return sheet.slice(sheet.indexOf('.mg-route-ribbon__item {'), sheet.indexOf('.mg-route-ribbon__pill {'));
};

describe('the transport chain is swiped, not pushed around by controls', () => {
  it('swipe-lane ownership: no overlay sits over the horizontal scroller', () => {
    assert.doesNotMatch(css(), /\.journey-segment-scroll-cue/,
      'a floating button on the right edge swallows the first fingers of a pan and steals the tap meant for a stage');
    assert.doesNotMatch(strip(), /ChevronRight|scrollTiles|\.scrollTo\(/,
      'self-made paging duplicates the native momentum scroller and fires a click the rider never meant');
  });

  it('proximity snapping keeps a fling interruptible', () => {
    assert.match(tilesCss(), /scroll-snap-type: x proximity;/);
    assert.doesNotMatch(tilesCss(), /scroll-snap-type: x mandatory;/,
      'mandatory snap drags the row back to a tile boundary while the swipe is still running');
    assert.match(tilesCss(), /overscroll-behavior-x: contain;/, 'a chain swipe must not chain into the page');
  });

  it('the edge fade is keyed to hidden content only', () => {
    const sheet = css();
    assert.match(sheet, /\.journey-segment-tiles\[data-fade-end="true"\] \{ --mg-fade-x-end: [^;]+; \}/,
      'the end fade is a flag, so it lifts once the last stage is fully visible');
    assert.match(tilesCss(), /--mg-fade-x-end: 0px;/, 'a whole row must show no fade at all');
    assert.match(strip(), /const scrolls = hidden > 10;/,
      'sub-pixel flex rounding must not be reported as hidden content');
  });

  it('keeps the momentum and clipping contract of a native scroller', () => {
    assert.match(css(), /\.journey-segment-tiles \{[\s\S]{0,200}-webkit-overflow-scrolling: touch;/,
      'iOS must coast and stay interruptible, which a hand-rolled drag has to re-implement badly');
    assert.match(ribbonCss(), /-webkit-overflow-scrolling: touch;/);
  });

  it('grows a scrolled stage to its label instead of cutting it at the floor', () => {
    assert.match(css(), /\.journey-segment-tile--scroll \{ flex: 0 0 auto; min-width: 7\.25rem; width: max-content;/,
      'a fixed 7.25rem basis truncated every feed name in a scrolled chain');
  });

  it('the stage buttons stay the only interactive targets, so keyboard and readers reach every stage', () => {
    assert.match(strip(), /role="list"[\s\S]*role="listitem"[\s\S]*<button type="button"/);
  });
});

describe('the route ribbon is its own horizontal scroller', () => {
  it('long chains scroll instead of losing their tail', () => {
    const block = ribbonCss();
    assert.match(block, /flex-wrap: nowrap;/, 'wrapping would double the ribbon and retime the sheet');
    assert.match(block, /overflow-x: auto;/, 'seven stages cannot share 358 px; a clipped tail is unreachable');
    assert.match(block, /overscroll-behavior-x: contain;/);
  });

  it('keeps room for the 44 px hit bleed the scroller would otherwise clip', () => {
    const block = ribbonCss();
    const padding = /padding-block-start: (\d+(?:\.\d+)?)px;/.exec(block);
    assert.ok(padding, 'the ribbon must pad its own scroll box');
    assert.ok(Number(padding[1]) >= 9, 'the pill extends 9px above itself; clipped hit area is not tappable');
  });

  it('sizes a stage to its own name instead of squeezing it into the scrollport', () => {
    const item = ribbonItemCss();
    assert.match(item, /flex: 1 0 auto;/,
      'a shrink of 1 divided the row into equal shares and ellipsised «Тролейбус» into «Тролей…»');
    assert.match(item, /width: max-content;/, 'the stage must be as wide as the name it carries');
    assert.doesNotMatch(item, /flex: 1 1 0%/, 'the old proportional squeeze');
    assert.match(item, /min-width: 62px;/, 'a 40-second walk still needs a tappable bar');
    assert.match(item, /max-width: 11rem;/, 'one long feed label must not push the rest of the chain off-screen');
  });

  it('shows focus inside its own box', () => {
    assert.match(css(), /\.mg-route-ribbon__pill:focus-visible \{ outline: 2px solid var\(--mg-blue\); outline-offset: -2px; \}/,
      'an outset ring is cut in half by the scroll clip at either end of the row');
  });
});
