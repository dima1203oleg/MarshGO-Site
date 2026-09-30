import { initialNavigationState, transition, type NavigationEffect, type NavigationEvent, type NavigationState } from './NavigationCore';

type EffectHandler = (effect: NavigationEffect, state: NavigationState) => void;

/** Small platform-neutral event store. All decisions remain in the pure FSM. */
export class NavigationStore {
  private state: NavigationState = initialNavigationState();
  private listeners = new Set<() => void>();

  constructor(private readonly runEffect: EffectHandler = () => undefined) {}

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  dispatch(event: NavigationEvent) {
    const result = transition(this.state, event);
    if (result.state !== this.state) {
      this.state = result.state;
      this.listeners.forEach((listener) => listener());
    }
    result.effects.forEach((effect) => this.runEffect(effect, this.state));
    return result;
  }
}
