async function runPremiumPreviewChecks(page) {
  const assert = {
    ok(value, message = 'Expected truthy value') { if (!value) throw new Error(message); },
    equal(actual, expected) { if (actual !== expected) throw new Error(`Expected ${expected}, received ${actual}`); },
    deepEqual(actual, expected) { this.equal(JSON.stringify(actual), JSON.stringify(expected)); },
    notDeepEqual(actual, expected) { this.ok(JSON.stringify(actual) !== JSON.stringify(expected), 'Expected different values'); },
    match(value, pattern) { this.ok(pattern.test(value), `${value} does not match ${pattern}`); },
  };
  const base = 'http://127.0.0.1:4186/tests/premium-preview.html';
  const results = [];
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  const slider = page.getByRole('slider', { name: 'Позиція перегляду поточного етапу' });
  const play = () => page.getByRole('button', { name: 'Відтворити перегляд', exact: true }).click();
  const pause = () => page.getByRole('button', { name: 'Призупинити перегляд', exact: true }).click();
  const sample = () => page.evaluate(() => ({
    value: Number(document.querySelector('input[type=range]').value),
    center: window.__mgMap.getCenter().toArray(),
    zoom: window.__mgMap.getZoom(),
    navigation: document.querySelector('[data-navigation-stage]').dataset.navigationStage,
  }));
  const settle = () => page.waitForFunction(() => window.__mgMap && !window.__mgMap.isMoving());
  const load = async query => {
    await page.goto(base + query);
    await slider.waitFor();
    await page.waitForFunction(() => window.__mgMap?.loaded(), null, { timeout: 20000 });
  };
  const seek = async fraction => {
    const box = await slider.boundingBox();
    assert.ok(box);
    await slider.click({ position: { x: 8 + (box.width - 16) * fraction, y: box.height / 2 } });
    await settle();
  };
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await load('');
    assert.equal(await slider.count(), 1);
    assert.match(await page.getByTestId('flight-telemetry').innerText(), /Пішки\s+541\s+м/);
    assert.equal(await page.getByTestId('journey-gps-status').count(), 0);
    await play();
    await page.waitForFunction(() => Number(document.querySelector('input[type=range]').value) > 60);
    await pause();
    const paused = await sample();
    await page.waitForTimeout(600);
    assert.deepEqual(await sample(), paused);
    await play();
    await page.waitForFunction(value => Number(document.querySelector('input[type=range]').value) > value + 25, paused.value);
    await pause();
    results.push({ check: 'one slider, correct initial distance, pause/resume, no GPS diagnostic', status: 'PASS' });

    await seek(0.75);
    const forward = await sample();
    assert.ok(forward.value > 700 && forward.value < 800);
    await seek(0.25);
    const backward = await sample();
    assert.ok(backward.value > 200 && backward.value < 300);
    assert.notDeepEqual(forward.center, backward.center);
    assert.equal(forward.navigation, backward.navigation);
    await slider.press('Home');
    await settle();
    assert.equal((await sample()).value, 0);
    await slider.press('ArrowRight');
    assert.equal((await sample()).value, 1);
    results.push({ check: 'pointer seeking both ways and keyboard seeking preserve GPS stage', status: 'PASS' });

    await play();
    await page.waitForFunction(() => Number(document.querySelector('input[type=range]').value) > 40);
    await page.mouse.move(170, 250);
    await page.mouse.down();
    await page.mouse.move(250, 320, { steps: 12 });
    await page.mouse.up();
    await settle();
    assert.equal(await page.getByRole('button', { name: 'Призупинити перегляд', exact: true }).count(), 0);
    const manual = await sample();
    await page.waitForTimeout(700);
    assert.deepEqual(await sample(), manual);
    results.push({ check: 'manual map gesture pauses preview and camera stays with user', status: 'PASS' });

    await seek(0.98);
    await play();
    await page.waitForFunction(() => document.querySelector('.mg-flight-hud__label')?.textContent.includes('Поїзд TEST 45'), null, { timeout: 7000 });
    await pause();
    assert.match(await page.getByTestId('flight-telemetry').innerText(), /Поїзд TEST 45/);
    assert.equal((await sample()).navigation, '0');
    results.push({ check: 'connected next leg updates player title without moving GPS stage', status: 'PASS' });

    await load('?long=1&stage=1');
    const longInitial = await page.getByTestId('flight-telemetry').innerText();
    assert.match(longInitial, /Поїзд TEST 45/);
    assert.match(longInitial, /км/);
    await seek(0.5);
    const cruise = await sample();
    assert.ok(cruise.zoom < 12, `Intercity cruise zoom ${cruise.zoom}`);
    await slider.press('End');
    await settle();
    const dock = await sample();
    assert.ok(dock.zoom > cruise.zoom + 3);
    assert.equal(dock.value, 1000);
    results.push({ check: 'long transit label, elevated cruise and close docking', status: 'PASS', cruiseZoom: cruise.zoom, dockZoom: dock.zoom, longInitial });

    await load('?missing=1&stage=1');
    assert.equal(await slider.isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Відтворити перегляд', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: 'Наступний етап', exact: true }).click();
    assert.equal(await slider.isEnabled(), true);
    await page.getByRole('button', { name: 'Переглянути спочатку', exact: true }).click();
    assert.match(await page.getByTestId('flight-telemetry').innerText(), /Пішки/);
    results.push({ check: 'missing geometry disables preview, manual next/restart remain available', status: 'PASS' });

    await load('?gap=1&stage=1');
    await seek(0.98);
    await play();
    await page.waitForFunction(() => Number(document.querySelector('input[type=range]').value) === 1000, null, { timeout: 7000 });
    await page.waitForTimeout(700);
    assert.match(await page.getByTestId('flight-telemetry').innerText(), /Поїзд TEST 45/);
    assert.equal(await page.getByRole('button', { name: 'Призупинити перегляд', exact: true }).count(), 0);
    results.push({ check: 'disconnected next leg is not bridged automatically', status: 'PASS' });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await load('?stage=1&theme=light');
    assert.equal(await page.getByRole('button', { name: 'Відтворити перегляд', exact: true }).isDisabled(), true);
    await seek(0.5);
    assert.ok((await sample()).value > 450);
    assert.equal(await page.evaluate(() => window.__mgMap.isMoving()), false);
    results.push({ check: 'reduced motion disables autoplay but permits immediate seeking', status: 'PASS' });

    const matrix = [];
    for (const theme of ['light', 'dark']) {
      await load(`?theme=${theme}`);
      for (const [width, height] of [[320,568],[390,844],[430,932],[768,1024],[1280,800],[1440,900],[844,390]]) {
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(100);
        const metrics = await page.getByTestId('flight-telemetry').evaluate(root => {
          const box = root.getBoundingClientRect();
          return { left: box.left, right: box.right, bottom: box.bottom, screen: innerWidth, height: innerHeight,
            controls: [...root.querySelectorAll('button,input')].map(el => { const b = el.getBoundingClientRect(); return { width: b.width, height: b.height }; }),
            overflow: document.documentElement.scrollWidth > innerWidth,
          };
        });
        assert.ok(metrics.left >= 0 && metrics.right <= width && metrics.bottom <= height, JSON.stringify({ theme,width,height,metrics }));
        assert.equal(metrics.overflow, false);
        assert.ok(metrics.controls.every(c => c.width >= 44 && c.height >= 44));
        matrix.push({ theme, width, height, status: 'PASS' });
      }
    }
    results.push({ check: 'player bounds and 44px controls', status: 'PASS', matrix });
    assert.deepEqual(errors, []);
    results.push({ check: 'uncaught browser exceptions', status: 'PASS', count: errors.length });
    return { data: 'SYNTHETIC FIXTURE — not live provider/GPS evidence', results };
  } finally {
    page.off('pageerror', onError);
  }
}
