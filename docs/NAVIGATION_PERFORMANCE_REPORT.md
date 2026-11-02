# MARSHGO Navigation 3.0 — продуктивність

Дата аудиту: 2026-10-14.

## Виміряно

- Production Vite bundle успішно збирається після P1 правок.
- `npm run check:bundle` пройшов: 17 JavaScript chunks у межах бюджету 350 KB gzip; найбільший `maplibre-gl` chunk — 274.5 KB gzip.
- У build output `maplibre-gl` окремий chunk ~1.06 MB raw / ~286 KB gzip; worker ~510 KB raw.
- Route і transport geometry малюються MapLibre sources/layers; окремі DOM vehicle marker використовуються лише там, де потрібний власний icon/puck.
- Мікромобільні й транспортні дані завантажуються за viewport; транспортне оновлення має контрольований polling і вимикається, коли layer set порожній.
- Мапа мініатюри не створює другого постійного WebGL canvas.

## Не вимірювалося

- FPS / long frame count на iPhone 15 Pro Max, слабкому Android та desktop.
- GPU/CPU memory, battery drain, десятки хвилин безперервного GPS.
- Поведінка при втраті мережі, блокуванні екрана, background suspension і відновленні процесу на реальних телефонах.
- Tile bandwidth, cache hit rate, prefetch quality та live provider cost.

Тому ціль 60 FPS / 30 FPS fallback не сертифікована. Performance readiness лишається `BLOCKED_DEVICE_MEASUREMENTS`; не робити production claim за розміром bundle чи desktop screenshot.
