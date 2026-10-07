import { useState } from 'react';
import { CarFront } from 'lucide-react';

/** Shows the driver's vehicle photo, falling back to the neutral placeholder when it is missing or fails to load. */
export function VehiclePhoto({ url, alt, className = 'aspect-[16/8]' }: { url?: string | null; alt: string; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (url && failedUrl !== url) return <img src={url} alt={alt} loading="lazy" onError={() => setFailedUrl(url)} className={`${className} w-full object-cover`} />;
  return <div className={`${className} grid w-full place-items-center bg-gradient-to-br from-blue-100 via-slate-100 to-sky-100 text-blue-700`}><div className="flex flex-col items-center gap-2"><CarFront size={42} /><span className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-semibold text-slate-600">Фото авто не додано</span></div></div>;
}
