import {createRoot} from 'react-dom/client';
import { ProductionMarketplace } from './views/ProductionMarketplace';
import './index.css';
import './services/theme';

const rootElement = document.getElementById('root')!;
rootElement.replaceChildren();
const root = createRoot(rootElement);
const isDesignStudio = import.meta.env.DEV && new URLSearchParams(window.location.search).get('studio') === '1';

if (isDesignStudio) {
  void import('./dev/DesignStudio').then(({ DesignStudio }) => root.render(<DesignStudio />));
} else {
  // The release entry imports only the server-backed application. The legacy
  // localStorage prototype in App.tsx is intentionally not in this module graph.
  root.render(<ProductionMarketplace />);
}
Reflect.set(window, '__MARSHGO_BOOTED__', true);
