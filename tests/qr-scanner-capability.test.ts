import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  detectScannerSupport,
  extractTicketToken,
  readScannerEnvironment,
  scannerCameraErrorMessage,
  scannerUnavailableMessage,
  SCAN_FRAME_MAX_WIDTH,
  SCAN_READ_INTERVAL_MS,
  shouldReadFrame,
} from '../src/components/qrScannerCapability';

const readyEnvironment = { secureContext: true, hasCamera: true, hasBarcodeDetector: true };

describe('QR scanner capability gating', () => {
  it('reports each missing capability instead of pretending the camera works', () => {
    assert.equal(detectScannerSupport(readyEnvironment), 'ready');
    assert.equal(detectScannerSupport({ ...readyEnvironment, secureContext: false }), 'insecure-context');
    assert.equal(detectScannerSupport({ ...readyEnvironment, hasCamera: false }), 'no-camera');
    assert.equal(detectScannerSupport({ ...readyEnvironment, hasBarcodeDetector: false }), 'no-detector');
  });

  it('reads capabilities from browser globals without throwing when they are absent', () => {
    assert.deepEqual(readScannerEnvironment({}), { secureContext: false, hasCamera: false, hasBarcodeDetector: false });
    assert.deepEqual(
      readScannerEnvironment({ isSecureContext: true, navigator: { mediaDevices: { getUserMedia: () => undefined } }, BarcodeDetector: class {} }),
      readyEnvironment,
    );
    assert.equal(detectScannerSupport(readScannerEnvironment({ isSecureContext: true, navigator: { mediaDevices: null } })), 'no-camera');
  });

  it('finds the camera where browsers actually expose it, on navigator', () => {
    // Chrome's window has isSecureContext, navigator.mediaDevices and BarcodeDetector;
    // reading getUserMedia off the global directly used to report a phantom "no camera".
    assert.equal(detectScannerSupport(readScannerEnvironment({
      isSecureContext: true,
      navigator: { mediaDevices: { getUserMedia() { return Promise.resolve({}) } } },
      BarcodeDetector: class {},
    })), 'ready');
    assert.equal(detectScannerSupport(readScannerEnvironment({ isSecureContext: true, BarcodeDetector: class {} })), 'no-camera');
  });

  it('explains every unsupported state in Ukrainian with a manual fallback', () => {
    for (const support of ['insecure-context', 'no-camera', 'no-detector'] as const) {
      const message = scannerUnavailableMessage(support);
      assert.match(message, /вставте токен квитка вручну/i);
      assert.ok(message.length > 30);
    }
    assert.equal(scannerUnavailableMessage('ready'), '');
  });

  it('maps camera permission errors to the reason the driver actually sees', () => {
    const withName = (name: string) => Object.assign(new Error(name), { name });
    assert.match(scannerCameraErrorMessage(withName('NotAllowedError')), /Доступ до камери не надано/);
    assert.match(scannerCameraErrorMessage(withName('NotReadableError')), /Камера зайнята/);
    assert.match(scannerCameraErrorMessage(withName('NotFoundError')), /Камери для сканування не знайдено/);
    assert.match(scannerCameraErrorMessage(withName('SomethingElse')), /Не вдалося увімкнути камеру/);
    assert.match(scannerCameraErrorMessage('not an error'), /Не вдалося увімкнути камеру/);
  });
});

describe('QR scanner ticket payload', () => {
  const token = 'eyJib29raW5nSWQiOiIxIn0.dGVzdC1zaWduYXR1cmU';

  it('accepts the signed two-segment token format used by POST /bookings/:id/boarding', () => {
    assert.equal(extractTicketToken([`  ${token}  `]), token);
    assert.equal(extractTicketToken([undefined, null, 'https://marshgo.example', token]), token);
  });

  it('rejects unrelated QR codes so the driver is never sent to the API with junk', () => {
    assert.equal(extractTicketToken([]), null);
    assert.equal(extractTicketToken(['   ']), null);
    assert.equal(extractTicketToken(['https://marshgo.example/offers/1']), null);
    assert.equal(extractTicketToken(['short.shortsig']), null);
    assert.equal(extractTicketToken([`${token}.extra`]), null);
    assert.equal(extractTicketToken(['plain text token']), null);
  });
});

describe('QR scanner frame cadence', () => {
  it('throttles decoding to a bounded rate', () => {
    assert.equal(shouldReadFrame(0, 0, SCAN_READ_INTERVAL_MS), true);
    assert.equal(shouldReadFrame(100, 0, SCAN_READ_INTERVAL_MS), true);
    assert.equal(shouldReadFrame(120, 100, SCAN_READ_INTERVAL_MS), false);
    assert.equal(shouldReadFrame(250, 100, SCAN_READ_INTERVAL_MS), true);
  });

  it('keeps the decode frame small enough for low-RAM devices', () => {
    assert.ok(SCAN_FRAME_MAX_WIDTH <= 800, 'decode frames must stay downscaled');
    assert.ok(SCAN_READ_INTERVAL_MS >= 100, 'decoding must not run every animation frame');
  });
});
