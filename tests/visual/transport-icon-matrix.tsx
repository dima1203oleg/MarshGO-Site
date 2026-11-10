import { createRoot } from 'react-dom/client';
import { canonicalTransportTypes, transportModes } from '../../src/domain/transportCatalog';
import { getTransportModeVisual } from '../../src/design-system/transport/transportModeRegistry';

const root = document.getElementById('root');
if (!root) throw new Error('Missing transport icon matrix root');
const requestedSize = Number(new URLSearchParams(window.location.search).get('size'));
const iconSize = [16, 20, 24, 32].includes(requestedSize) ? requestedSize : 32;

const tiles = canonicalTransportTypes.map((id) => {
  const mode = transportModes.find((item) => item.id === id);
  const { icon: Icon } = getTransportModeVisual(id);
  return <div key={id} className="icon-tile" role="img" aria-label={mode?.label ?? id} data-transport-icon={id}><Icon size={iconSize} strokeWidth={2.1} aria-hidden="true"/></div>;
});

createRoot(root).render(<main><div className="icon-grid" aria-label="Транспортні піктограми 4 на 3">{tiles}</div></main>);
