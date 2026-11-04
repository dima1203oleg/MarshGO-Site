import { strict as assert } from 'node:assert';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { test } from 'node:test';

function reachableTsxFiles(entry: string): string[] {
  const seen = new Set<string>();
  const extensions = ['', '.tsx', '.ts', '/index.tsx', '/index.ts'];

  function resolveLocal(fromFile: string, spec: string): string | null {
    const base = resolve(dirname(fromFile), spec);
    for (const ext of extensions) {
      const candidate = base + ext;
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        return candidate;
      }
    }
    return null;
  }

  function walk(filePath: string): void {
    if (seen.has(filePath)) return;
    seen.add(filePath);
    const source = readFileSync(filePath, 'utf8');
    for (const match of source.matchAll(/(?:from|import\()\s*['"](\.[^'"]+)['"]/g)) {
      const target = resolveLocal(filePath, match[1]);
      if (target && /\.tsx?$/.test(target)) {
        walk(target);
      }
    }
  }

  walk(resolve(entry));
  return [...seen].filter((filePath) => filePath.endsWith('.tsx')).map((filePath) => relative(process.cwd(), filePath));
}

test('W1 (а): у живих .tsx-файлах тривалості переходів беруться лише з токенів --mg-dur-*', () => {
  const liveFiles = reachableTsxFiles('src/views/ProductionMarketplace.tsx');
  assert.ok(liveFiles.length >= 25, 'граф живих модулів має охоплювати основний інтерфейс');
  const offenders = liveFiles.flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .flatMap((line, index) => (/\bduration-\d/.test(line) ? [`${file}:${index + 1}`] : [])),
  );
  assert.deepEqual(offenders, []);
});

test('W1 (б): реєстр --mg-radius-*, --mg-z-* і --mg-stagger-step визначено в src/index.css і використано', () => {
  const css = readFileSync('src/index.css', 'utf8');
  const requiredTokens = [
    '--mg-radius-sm',
    '--mg-radius-md',
    '--mg-radius-lg',
    '--mg-radius-xl',
    '--mg-radius-2xl',
    '--mg-radius-3xl',
    '--mg-radius-sheet',
    '--mg-radius-pill',
    '--mg-z-base',
    '--mg-z-raised',
    '--mg-z-control',
    '--mg-z-sticky',
    '--mg-z-overlay',
    '--mg-z-scrim',
    '--mg-z-scrim-raised',
    '--mg-z-picker-scrim',
    '--mg-z-map-control',
    '--mg-z-map-chip',
    '--mg-z-sheet',
    '--mg-z-sheet-raised',
    '--mg-z-lifecycle',
    '--mg-z-nav-backdrop',
    '--mg-z-nav-chrome',
    '--mg-z-nav-sheet',
    '--mg-z-modal',
    '--mg-stagger-step',
  ];

  for (const token of requiredTokens) {
    assert.match(css, new RegExp(`${token}\\s*:`), `токен ${token} має бути оголошений у src/index.css`);
  }

  const allSources = [css, ...reachableTsxFiles('src/views/ProductionMarketplace.tsx').map((file) => readFileSync(file, 'utf8'))].join('\n');
  for (const token of [
    '--mg-radius-md',
    '--mg-radius-lg',
    '--mg-radius-xl',
    '--mg-radius-2xl',
    '--mg-radius-3xl',
    '--mg-radius-sheet',
    '--mg-radius-pill',
    '--mg-z-base',
    '--mg-z-raised',
    '--mg-z-sticky',
    '--mg-z-overlay',
    '--mg-z-scrim',
    '--mg-z-scrim-raised',
    '--mg-z-picker-scrim',
    '--mg-z-map-control',
    '--mg-z-map-chip',
    '--mg-z-nav-backdrop',
    '--mg-z-nav-chrome',
    '--mg-z-nav-sheet',
    '--mg-z-modal',
    '--mg-stagger-step',
  ]) {
    assert.match(allSources, new RegExp(`var\\(${token}\\)`), `токен ${token} має використовуватися у викликах`);
  }
});

test('W1 (в): entrance-утиліти присутні в src/index.css і захищені глобальним prefers-reduced-motion', () => {
  const css = readFileSync('src/index.css', 'utf8');
  for (const cls of ['.mg-rise', '.mg-pop', '.mg-fade', '.mg-stagger', '.mg-press', '.mg-live-dot']) {
    assert.ok(css.includes(cls), `клас ${cls} має бути присутній у src/index.css`);
  }
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,160}animation-duration:\s*\.01ms !important/,
    'глобальний guard prefers-reduced-motion має гасити анімації',
  );
});

test('W2 (а): src/styles/motion.css підключено з src/index.css і містить примітиви M1–M8 із захистом reduced-motion', () => {
  const indexCss = readFileSync('src/index.css', 'utf8');
  assert.match(indexCss, /@import\s+["']\.\/styles\/motion\.css["'];/, 'src/index.css має імпортувати ./styles/motion.css');
  const motionCss = readFileSync('src/styles/motion.css', 'utf8');
  for (const selector of [
    '.animate-spin-slow',
    '.mg-press-subtle',
    '.mg-swap-spin',
    '.mg-accordion-grid',
    '.mg-stagger-list',
    '.mg-pill-switch',
    '.mg-sheet-spring',
    '.mg-live-pulse',
    '.mg-route-flow',
  ]) {
    assert.ok(motionCss.includes(selector), `src/styles/motion.css має визначати ${selector}`);
  }
  assert.match(
    motionCss,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation:\s*none !important/,
    'src/styles/motion.css має вимикати циклічні анімації в режимі prefers-reduced-motion',
  );
});

test('W2 (б): програмні виклики scrollIntoView та scrollTo у живих модулях враховують prefers-reduced-motion', () => {
  const files = [
    'src/views/JourneyRouteMapScreen.tsx',
    'src/design-system/journey/JourneySegmentStrip.tsx',
    'src/components/DepartureDateTimePicker.tsx',
  ];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(
      source,
      /behavior:\s*['"]smooth['"]/,
      `${file} не повинен викликати scroll із безумовним behavior: 'smooth'`,
    );
    assert.match(
      source,
      /prefers-reduced-motion:\s*reduce/,
      `${file} має перевіряти prefers-reduced-motion перед плавним прокручуванням`,
    );
  }
});

test('W2 (в): JourneyRouteMapScreen і JourneyResultsPanel дотримуються мінімального кегля 12px (0 входжень text-[10px]/text-[11px])', () => {
  for (const file of ['src/views/JourneyRouteMapScreen.tsx', 'src/views/JourneyResultsPanel.tsx']) {
    const source = readFileSync(file, 'utf8');
    const undersized = [...source.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)]
      .filter((m) => Number(m[1]) < 12)
      .map((m) => `${file} -> ${m[0]}`);
    assert.deepEqual(undersized, []);
  }
});

test('W3a: основні клієнтські екрани дотримуються мінімального кегля 12px (0 входжень text-[9..11px])', () => {
  const coreFiles = [
    'src/views/ProductionMarketplace.tsx',
    'src/views/HomeHero.tsx',
    'src/views/ProfileSections.tsx',
    'src/design-system/journey/SavedJourneyCard.tsx',
    'src/design-system/ui/StatusBadge.tsx',
    'src/components/DepartureDateTimePicker.tsx',
    'src/components/OnboardingSlides.tsx',
  ];
  for (const file of coreFiles) {
    const source = readFileSync(file, 'utf8');
    const undersized = [...source.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)]
      .filter((m) => Number(m[1]) < 12)
      .map((m) => `${file} -> ${m[0]}`);
    assert.deepEqual(undersized, []);
  }
});


