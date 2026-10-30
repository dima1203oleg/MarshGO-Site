import { createRoot } from 'react-dom/client';
import { RideshareLifecycleSimulator } from './components/RideshareLifecycleSimulator';

export function mountRideshareDemo(rootElement: HTMLElement): void {
  createRoot(rootElement).render(<RideshareLifecycleSimulator />);
}
