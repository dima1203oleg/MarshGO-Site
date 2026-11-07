import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

test('journey search failures are announced as errors with a non-color cue', () => {
  const view = read('src/views/ProductionMarketplace.tsx');
  assert.match(view, /else if \(needsSignIn\) setStatusMessage\([^\n]+, true\)/);
  assert.match(view, /else setStatusMessage\(message \|\| 'Не вдалося побудувати маршрут\.', true\)/);
  assert.match(view, /role=\{statusIsError \? 'alert' : 'status'\}/);
  assert.match(view, /statusIsError && <AlertCircle[^>]*aria-hidden="true"/);
  assert.match(view, /statusIsError && <span className="sr-only">Помилка: <\/span>/);
});

test('error feedback tokens meet WCAG AA for normal text in light and dark themes', () => {
  const css = read('src/styles/feedback.css');
  const token = (block: string, name: string) => new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(block)?.[1];
  const darkBlock = css.split('html.dark')[1] ?? '';
  const lightInk = token(css.split('html.dark')[0], '--mg-feedback-error-ink');
  const lightSurface = token(css.split('html.dark')[0], '--mg-feedback-error-surface');
  const darkInk = token(darkBlock, '--mg-feedback-error-ink');
  const darkSurface = token(darkBlock, '--mg-feedback-error-surface');
  assert.ok(lightInk && lightSurface && darkInk && darkSurface);
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
      .map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) => {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (high + 0.05) / (low + 0.05);
  };
  assert.ok(contrast(lightInk, lightSurface) >= 4.5);
  assert.ok(contrast(darkInk, darkSurface) >= 4.5);
  assert.doesNotMatch(css, /!important/);
});
