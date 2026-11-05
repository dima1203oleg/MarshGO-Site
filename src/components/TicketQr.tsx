import { useEffect, useState } from 'react';

/** Renders the signed boarding token as a scannable QR code; the text token stays available beside it. */
export function TicketQr({ token, size = 224 }: { token: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setDataUrl(null);
    setFailed(false);
    import('qrcode').then(({ default: QRCode }) => QRCode.toDataURL(token, { errorCorrectionLevel: 'M', margin: 1, width: size }))
      .then((url) => { if (active) setDataUrl(url); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [token, attempt, size]);

  // An empty box beside «Покажіть цей QR-код водієві» left the passenger guessing at the boarding step.
  if (failed) return <div style={{ width: size }} className="rounded-[var(--mg-radius-md)] bg-amber-50 p-2 text-center text-[12px] font-semibold leading-4 text-amber-900">
    QR-код не вдалося побудувати. Покажіть водієві текстовий токен.
    <button type="button" onClick={() => setAttempt(value => value + 1)} className="mt-1.5 min-h-11 w-full rounded-[var(--mg-radius-sm)] bg-amber-700 px-2 text-[12px] font-bold text-white">Спробувати ще раз</button>
  </div>;

  if (!dataUrl) return <div aria-busy="true" style={{ width: size, height: size }} className="animate-pulse rounded-[var(--mg-radius-md)] border border-[var(--pass-stroke)]/25 bg-[var(--pass-stroke)]/10"><span className="sr-only">Готуємо QR-код квитка</span></div>;

  return <img src={dataUrl} alt="QR-код квитка для посадки" width={size} height={size} className="rounded-[var(--mg-radius-md)] bg-white" />;
}
