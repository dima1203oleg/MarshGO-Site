import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const css = () => readFileSync('src/index.css', 'utf8');

describe('segment strip scroll cue never covers a stage tile', () => {
  it('reserves the cue gutter on the viewport instead of after the last tile', () => {
    const sheet = css();
    assert.match(
      sheet,
      /\.journey-segment-tiles-viewport:has\(> \.journey-segment-scroll-cue\) \{ padding-right: 2\.9rem; \}/,
      'the scrollport must end before the floating 44 px button',
    );
    assert.doesNotMatch(
      sheet,
      /\.journey-segment-tiles:has\(\+ \.journey-segment-scroll-cue\) \{ padding-inline-end/,
      'padding the scroller only adds empty space at the very end, so mid-scroll the button still sits over the third stage',
    );
  });

  it('keeps the cue a 44 px target so the reserved gutter is honest', () => {
    const sheet = css();
    const cue = sheet.slice(sheet.indexOf('.journey-segment-scroll-cue {'));
    assert.match(cue.slice(0, 400), /width: 2\.75rem;/, 'the cue button must stay a 44 px touch target');
    assert.match(cue.slice(0, 400), /height: 2\.75rem;/, 'the cue button must stay a 44 px touch target');
  });
});
