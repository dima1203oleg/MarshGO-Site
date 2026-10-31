export type ScannerSupport = 'ready' | 'insecure-context' | 'no-camera' | 'no-detector';

export type ScannerEnvironment = {
  secureContext: boolean;
  hasCamera: boolean;
  hasBarcodeDetector: boolean;
};

export type ScannerGlobals = {
  isSecureContext?: boolean;
  navigator?: { mediaDevices?: { getUserMedia?: unknown } | null } | null;
  BarcodeDetector?: unknown;
};

/** Browser `getUserMedia` is only exposed on HTTPS/localhost, so an http page reports no camera rather than a phantom grant prompt. */
export function readScannerEnvironment(globals: ScannerGlobals): ScannerEnvironment {
  return {
    secureContext: globals.isSecureContext === true,
    hasCamera: typeof globals.navigator?.mediaDevices?.getUserMedia === 'function',
    hasBarcodeDetector: typeof globals.BarcodeDetector === 'function',
  };
}

export function detectScannerSupport(environment: ScannerEnvironment): ScannerSupport {
  if (!environment.secureContext) return 'insecure-context';
  if (!environment.hasCamera) return 'no-camera';
  if (!environment.hasBarcodeDetector) return 'no-detector';
  return 'ready';
}

/** Server tickets are `base64url.base64url` (see POST /bookings/:id/boarding), so any other payload is not a MarshGO ticket. */
export const TICKET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/;

export function extractTicketToken(values: readonly (unknown)[]): string | null {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const candidate = value.trim();
    if (TICKET_TOKEN_PATTERN.test(candidate)) return candidate;
  }
  return null;
}

export const SCAN_READ_INTERVAL_MS = 150;
export const SCAN_FRAME_MAX_WIDTH = 640;

export function shouldReadFrame(nowMs: number, lastReadMs: number, intervalMs = SCAN_READ_INTERVAL_MS): boolean {
  return lastReadMs === 0 || nowMs - lastReadMs >= intervalMs;
}

export function scannerUnavailableMessage(support: ScannerSupport): string {
  switch (support) {
    case 'insecure-context':
      return 'Камера доступна лише за HTTPS. Відкрийте застосунок за захищеним посиланням або вставте токен квитка вручну.';
    case 'no-camera':
      return 'Пристрій не надає камеру для сканування. Вставте токен квитка вручну.';
    case 'no-detector':
      return 'Цей браузер не вміє розпізнавати QR-код. Вставте токен квитка вручну.';
    case 'ready':
      return '';
  }
}

export function scannerCameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Доступ до камери не надано. Дозвольте його в налаштуваннях браузера або вставте токен квитка вручну.';
    case 'NotReadableError':
    case 'AbortError':
      return 'Камера зайнята іншою програмою. Закрийте її та спробуйте ще раз або вставте токен вручну.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Камери для сканування не знайдено. Вставте токен квитка вручну.';
    default:
      return 'Не вдалося увімкнути камеру. Спробуйте ще раз або вставте токен квитка вручну.';
  }
}
