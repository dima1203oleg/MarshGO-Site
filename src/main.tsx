import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const rootElement = document.getElementById('root')!;
rootElement.replaceChildren();
createRoot(rootElement).render(<App />);
Reflect.set(window, '__MARSHGO_BOOTED__', true);
