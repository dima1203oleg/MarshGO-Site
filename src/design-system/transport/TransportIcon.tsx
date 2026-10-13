import { getTransportModeVisual } from './transportModeRegistry';

export function TransportIcon({
  mode,
  transportType,
  size = 20,
  strokeWidth = 2.2,
  className,
}: {
  mode: string;
  transportType?: string | null;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const { icon: Icon } = getTransportModeVisual(mode, transportType);
  return <Icon size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true"/>;
}
