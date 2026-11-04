import { useEffect, useState } from 'react';

/** Renders the signed boarding token as a scannable QR code; the text token stays available beside it. */
export function TicketQr({ token }: { token: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setDataUrl(null);
    setFailed(false);
    import('qrcode').then(({ default: QRCode }) => QRCode.toDataURL(token, { errorCorrectionLevel: 'M', margin: 1, width: 224 }))
      .then((url) => { if (active) setDataUrl(url); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [token, attempt]);

  // An empty box beside «Покажіть цей QR-код водієві» left the passenger guessing at the boarding step.
  if (failed) return <div className="mx-auto mt-2 max-w-[16rem] rounded-xl bg-amber-50 p-3 text-center text-xs font-semibold leading-4 text-amber-800">
    QR-код не вдалося побудувати. Спробуйте ще раз або покажіть водієві текстовий токен.
    <button type="button" onClick={() => setAttempt(value => value + 1)} className="mt-2 min-h-11 w-full rounded-lg bg-amber-700 px-3 text-xs font-bold text-white">Спробувати ще раз</button>
  </div>;

  if (!dataUrl) return <div aria-busy="true" className="mx-auto mt-2 h-56 w-56 animate-pulse rounded-xl border border-slate-100 bg-slate-100"><span className="sr-only">Готуємо QR-код квитка</span></div>;

  return <img src={dataUrl} alt="QR-код квитка для посадки" width={224} height={224} className="mx-auto mt-2 rounded-xl border border-slate-100 bg-white p-2" />;
}
