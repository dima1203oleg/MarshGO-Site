import {createRoot} from 'react-dom/client';
import { ProductionMarketplace } from './views/ProductionMarketplace';
import { isRideshareSimulatorRequest } from './demoEntry';
import './index.css';
import './services/theme';

const rootElement = document.getElementById('root')!;
rootElement.replaceChildren();
// The release entry imports only the server-backed application. The legacy
// localStorage prototype in App.tsx is intentionally not in this module graph.
if (
  import.meta.env.DEV &&
  import.meta.env.VITE_DEMO_MODE === 'true' &&
  isRideshareSimulatorRequest(window.location.search, {
    isDev: Boolean(import.meta.env.DEV),
    demoEnabled: import.meta.env.VITE_DEMO_MODE === 'true',
  })
) {
  void import('./demoEntryView').then(({ mountRideshareDemo }) => mountRideshareDemo(rootElement));
} else {
  createRoot(rootElement).render(<ProductionMarketplace />);
}
Reflect.set(window, '__MARSHGO_BOOTED__', true);
