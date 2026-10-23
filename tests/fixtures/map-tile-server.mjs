// Test-only synthetic map fixture. Do not use this style or its generated tiles in production.
// Behavior is copied from the MARSHGO orchestration E2E fixture so Site tests own their runtime.
import http from 'node:http';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { URL } from 'node:url';
import { deflateSync } from 'node:zlib';

const port = Number(process.env.MAP_TILE_STUB_PORT ?? 3306);
let mode = 'success';
let requests = 0;
let loaded = 0;
let failed = 0;
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}
function createTilePng(theme) {
  const width = 256; const height = 256;
  const pixels = Buffer.alloc((width * 4 + 1) * height);
  const dark = theme.includes('DARK');
  const localRoadsX = [22, 67, 121, 182, 231];
  const localRoadsY = [18, 75, 132, 196, 245];
  const distanceToSegment = (x, y, [ax, ay], [bx, by]) => {
    const dx = bx - ax; const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const projection = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSquared));
    return Math.hypot(x - (ax + projection * dx), y - (ay + projection * dy));
  };
  const parks = [[47, 184, 31, 52], [202, 48, 38, 27], [206, 169, 27, 34]];
  const majorRoads = [
    [[-10, 88], [266, 118]],
    [[135, -10], [110, 266]],
    [[-10, 230], [266, 27]],
  ];
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1); pixels[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const park = parks.find(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1);
      let color = dark ? [7, 20, 33] : [244, 247, 250];
      if (park) color = dark ? [8, 39, 34] : [218, 235, 218];

      const localX = Math.min(...localRoadsX.map((roadX) => Math.abs(x - roadX)));
      const localY = Math.min(...localRoadsY.map((roadY) => Math.abs(y - roadY)));
      const localRoad = Math.min(localX, localY);
      if (localRoad <= 1) color = dark ? [25, 48, 69] : [207, 220, 231];
      if (localRoad <= 0) color = dark ? [35, 62, 85] : [255, 255, 255];

      const major = Math.min(...majorRoads.map(([from, to]) => distanceToSegment(x, y, from, to)));
      if (major <= 5) color = dark ? [5, 17, 29] : [205, 217, 229];
      if (major <= 3) color = dark ? [36, 63, 87] : [255, 255, 255];
      if (major <= 1) color = dark ? [47, 78, 104] : [248, 250, 252];
      const pixel = row + 1 + x * 4;
      pixels[pixel] = color[0]; pixels[pixel + 1] = color[1]; pixels[pixel + 2] = color[2]; pixels[pixel + 3] = 255;
    }
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(pixels)), pngChunk('IEND', Buffer.alloc(0))]);
}
const tilePngs = new Map();

function mapManifest() {
  const origin = `http://127.0.0.1:${port}/maps/v1.0.0`;
  return {
    schemaVersion: 1,
    mapDataVersion: 'fixture-v1.0.0',
    styleVersion: 'fixture-v1.0.0',
    mapDataUrl: `${origin}/data.json`,
    styles: Object.fromEntries(['MARSHGO_LIGHT', 'MARSHGO_DARK', 'MARSHGO_3D_LIGHT', 'MARSHGO_3D_DARK'].map((theme) => [theme, `${origin}/styles/${theme}.json`])),
  };
}

function mapStyle(theme) {
  const dark = theme.includes('DARK');
  const origin = `http://127.0.0.1:${port}`;
  return {
    version: 8,
    name: `MARSHGO E2E ${theme}`,
    sources: { 'marshgo-basemap': { type: 'raster', tiles: [`${origin}/tiles/${theme}/{z}/{x}/{y}.png`], tileSize: 256, attribution: 'MARSHGO deterministic visual fixture' } },
    layers: [
      { id: 'marshgo-background', type: 'background', paint: { 'background-color': dark ? '#071421' : '#F4F7FA' } },
      { id: 'marshgo-basemap', type: 'raster', source: 'marshgo-basemap' },
    ],
  };
}

const server = http.createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Cache-Control', 'no-store');
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/health') {
    response.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
    return;
  }
  if (url.pathname === '/__test/mode') {
    const nextMode = url.searchParams.get('value');
    if (nextMode !== 'success' && nextMode !== 'mixed') {
      response.writeHead(400).end('mode must be success or mixed');
      return;
    }
    mode = nextMode;
    requests = 0;
    loaded = 0;
    failed = 0;
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ mode }));
    return;
  }
  if (url.pathname === '/__test/stats') {
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ mode, requests, loaded, failed }));
    return;
  }
  if (url.pathname === '/maps/v1.0.0/manifest.json') {
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(mapManifest()));
    return;
  }
  const styleMatch = url.pathname.match(/^\/maps\/v1\.0\.0\/styles\/(MARSHGO_(?:3D_)?(?:LIGHT|DARK))\.json$/);
  if (styleMatch) {
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(mapStyle(styleMatch[1])));
    return;
  }
  if (url.pathname === '/maps/v1.0.0/data.json') {
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ version: 1, fixture: true }));
    return;
  }
  const tileMatch = url.pathname.match(/^\/tiles\/(?:([A-Z0-9_]+)\/)?\d+\/\d+\/\d+\.png$/);
  if (tileMatch) {
    requests += 1;
    if (mode === 'mixed' && requests % 2 === 0) {
      failed += 1;
      response.writeHead(503, { 'Content-Type': 'text/plain' }).end('isolated E2E tile failure');
      return;
    }
    loaded += 1;
    const theme = tileMatch[1] ?? 'MARSHGO_LIGHT';
    if (!tilePngs.has(theme)) tilePngs.set(theme, createTilePng(theme));
    response.writeHead(200, { 'Content-Type': 'image/png' }).end(tilePngs.get(theme));
    return;
  }
  response.writeHead(404).end('not found');
});

server.listen(port, '127.0.0.1');
