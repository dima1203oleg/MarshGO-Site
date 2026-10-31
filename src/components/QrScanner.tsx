import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

import {
  detectScannerSupport,
  extractTicketToken,
  readScannerEnvironment,
  scannerCameraErrorMessage,
  scannerUnavailableMessage,
  SCAN_FRAME_MAX_WIDTH,
  SCAN_READ_INTERVAL_MS,
  shouldReadFrame,
  type ScannerGlobals,
  type ScannerSupport,
} from './qrScannerCapability';

type BarcodeLike = { rawValue?: unknown; value?: unknown };
type DetectorLike = { detect: (source: HTMLCanvasElement) => Promise<BarcodeLike[]> };
type DetectorConstructor = new (options: { formats: string[] }) => DetectorLike;

const globalScannerGlobals = (): ScannerGlobals => globalThis as unknown as ScannerGlobals;

/**
 * Live camera QR reader for the driver boarding step. Frames stay on the device
 * (video -> canvas -> BarcodeDetector); only the decoded ticket token leaves it, and the
 * server remains the sole authority that turns it into a boarding confirmation.
 */
export function QrScanner({ onToken, onClose }: { onToken: (token: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tokenRef = useRef(onToken);
  tokenRef.current = onToken;
  const [support, setSupport] = useState<ScannerSupport>(() => detectScannerSupport(readScannerEnvironment(globalScannerGlobals())));
  const [notice, setNotice] = useState(() => {
    const detected = detectScannerSupport(readScannerEnvironment(globalScannerGlobals()));
    return detected === 'ready' ? '' : scannerUnavailableMessage(detected);
  });
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    if (support !== 'ready') return;
    const Detector = globalScannerGlobals().BarcodeDetector as DetectorConstructor | undefined;
    if (!Detector) {
      setSupport('no-detector');
      setNotice(scannerUnavailableMessage('no-detector'));
      return;
    }
    let detector: DetectorLike;
    try {
      detector = new Detector({ formats: ['qr_code'] });
    } catch {
      setSupport('no-detector');
      setNotice(scannerUnavailableMessage('no-detector'));
      return;
    }

    let stopped = false;
    let stream: MediaStream | null = null;
    let frame = 0;
    let lastReadAt = 0;
    let failedReads = 0;

    const readFrame = async () => {
      if (stopped) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.videoWidth > 0 && video.readyState >= 2) {
        // Downscale before decoding: the detector is the hot path on low-RAM hardware.
        const width = Math.min(video.videoWidth, SCAN_FRAME_MAX_WIDTH);
        const height = Math.max(1, Math.round(video.videoHeight * (width / video.videoWidth)));
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (context) {
          context.drawImage(video, 0, 0, width, height);
          try {
            const decoded = await detector.detect(canvas);
            failedReads = 0;
            const token = extractTicketToken(decoded.map((barcode) => barcode?.rawValue ?? barcode?.value));
            if (token) {
              stopped = true;
              tokenRef.current(token);
              return;
            }
          } catch {
            failedReads += 1;
            if (failedReads === 3) setNotice('Розпізнавання не працює у цьому браузері. Спробуйте ще раз або вставте токен квитка вручну.');
          }
        }
      }
      if (!stopped) frame = requestAnimationFrame(readFrame);
    };

    frame = requestAnimationFrame(function next(now: number) {
      if (stopped) return;
      if (shouldReadFrame(now, lastReadAt, SCAN_READ_INTERVAL_MS)) {
        lastReadAt = now;
        void readFrame();
      } else {
        frame = requestAnimationFrame(next);
      }
    });

    void navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then(async (mediaStream) => {
        if (stopped) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = mediaStream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = mediaStream;
          await video.play().catch(() => undefined);
        }
        setStreaming(true);
      })
      .catch((error: unknown) => {
        if (stopped) return;
        setStreaming(false);
        setNotice(scannerCameraErrorMessage(error));
      });

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      const video = videoRef.current;
      if (video) video.srcObject = null;
    };
  }, [support]);

  if (support !== 'ready') {
    return (
      <div data-testid="qr-scanner-unavailable" role="status" className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">
        <p>{notice || scannerUnavailableMessage(support)}</p>
        <button type="button" onClick={onClose} className="mt-1.5 font-bold text-amber-900 underline">Вставити квиток вручну</button>
      </div>
    );
  }

  return (
    <div className="mt-2 overflow-hidden rounded-xl bg-slate-900">
      <div className="relative">
        <video ref={videoRef} data-testid="qr-scanner-video" playsInline muted className="h-48 w-full bg-slate-900 object-cover" />
        {!streaming && (
          <p className="absolute inset-0 grid place-items-center px-4 text-center text-[11px] leading-4 text-white/90">
            {notice || 'Камера увімкнюється… Дозвольте доступ, якщо браузер запитає.'}
          </p>
        )}
        <button type="button" onClick={onClose} aria-label="Закрити сканер" className="absolute right-2 top-2 rounded-lg bg-white/85 p-1.5 text-slate-700">
          <X size={15} />
        </button>
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <p className="px-3 py-2 text-[10px] leading-4 text-slate-200">
        {notice || 'Наведіть камеру на QR-код квитка пасажира. Камера вимкнеться після розпізнавання, відео нікуди не надсилається.'}
      </p>
      <button type="button" onClick={onClose} className="w-full border-t border-white/10 py-2 text-[11px] font-bold text-white">
        Сканувати не вдається — ввести вручну
      </button>
    </div>
  );
}
