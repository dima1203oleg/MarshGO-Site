import {createRoot} from 'react-dom/client';
import { ProductionMarketplace } from './views/ProductionMarketplace';
import './index.css';
import './services/theme';

const rootElement = document.getElementById('root')!;
rootElement.replaceChildren();
// The release entry imports only the server-backed application. The legacy
// localStorage prototype in App.tsx is intentionally not in this module graph.
createRoot(rootElement).render(<ProductionMarketplace />);
Reflect.set(window, '__MARSHGO_BOOTED__', true);
