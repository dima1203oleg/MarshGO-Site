import { useEffect, useState } from 'react';

/** Renders the signed boarding token as a scannable QR code; the text token stays available beside it. */
export function TicketQr({ token }: { token: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    import('qrcode').then(({ default: QRCode }) => QRCode.toDataURL(token, { errorCorrectionLevel: 'M', margin: 1, width: 224 }))
      .then((url) => { if (active) setDataUrl(url); })
      .catch(() => { if (active) setDataUrl(null); });
    return () => { active = false; };
  }, [token]);
  if (!dataUrl) return null;
  return <img src={dataUrl} alt="QR-код квитка для посадки" width={224} height={224} className="mx-auto mt-2 rounded-xl border border-slate-100 bg-white p-2" />;
}
