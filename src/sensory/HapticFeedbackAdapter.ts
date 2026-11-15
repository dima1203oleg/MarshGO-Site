/**
 * MARSHGO Sensory 6.0 — HapticFeedbackAdapter (ТЗ §16).
 *
 * Semantic haptics, platform-honest. On the native iOS shell the Capacitor Haptics
 * bridge drives UIKit/Core Haptics (selection feedback for discrete lists, impact
 * and notification generators for actions). On the web we feature-detect the
 * Vibration API. Where neither exists (iOS Safari without the shell) this is a
 * no-op: we never claim a vibration that did not happen and never block the UI.
 */
import type { HapticKind } from './sensoryEvents';

interface CapacitorHaptics {
  impact?: (options: { style: string }) => Promise<void> | void;
  selection?: () => Promise<void> | void;
  notification?: (options: { type: string }) => Promise<void> | void;
  vibrate?: (options: { duration: number }) => Promise<void> | void;
}

function nativeHaptics(): CapacitorHaptics | null {
  if (typeof window === 'undefined') return null;
  const cap = (window as unknown as { Capacitor?: { Plugins?: Record<string, unknown> } }).Capacitor;
  const plugin = cap?.Plugins?.Haptics as CapacitorHaptics | undefined;
  return plugin && typeof plugin === 'object'
    && [plugin.selection, plugin.impact, plugin.notification, plugin.vibrate].some(method => typeof method === 'function') ? plugin : null;
}

function webVibrate(): ((pattern: number | number[]) => boolean) | null {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return null;
  return navigator.vibrate.bind(navigator);
}

const WEB_PATTERN: Record<HapticKind, number[]> = {
  selection: [8],
  light: [10],
  medium: [18],
  success: [12, 40, 12],
  warning: [20, 60, 20],
  transient: [6],
};

export class HapticFeedbackAdapter {
  /** True only when a real haptic path exists on this device. */
  isSupported(): boolean {
    return nativeHaptics() !== null || webVibrate() !== null;
  }

  /** True when the native iOS/Android shell bridge is available. */
  isNative(): boolean {
    return nativeHaptics() !== null;
  }

  fire(kind: HapticKind): boolean {
    const native = nativeHaptics();
    if (native) {
      try {
        switch (kind) {
          case 'selection':
            if (native.selection) { void Promise.resolve(native.selection()).catch(() => undefined); return true; }
            break;
          case 'light':
          case 'transient':
            if (native.impact) { void Promise.resolve(native.impact({ style: 'LIGHT' })).catch(() => undefined); return true; }
            break;
          case 'medium':
            if (native.impact) { void Promise.resolve(native.impact({ style: 'MEDIUM' })).catch(() => undefined); return true; }
            break;
          case 'success':
            if (native.notification) { void Promise.resolve(native.notification({ type: 'SUCCESS' })).catch(() => undefined); return true; }
            break;
          case 'warning':
            if (native.notification) { void Promise.resolve(native.notification({ type: 'WARNING' })).catch(() => undefined); return true; }
            break;
        }
        if (native.vibrate) { void Promise.resolve(native.vibrate({ duration: WEB_PATTERN[kind][0] })).catch(() => undefined); return true; }
      } catch {
        return false;
      }
    }
    const vibrate = webVibrate();
    if (vibrate) {
      try { return vibrate(WEB_PATTERN[kind]); } catch { return false; }
    }
    return false;
  }
}

export const hapticAdapter = new HapticFeedbackAdapter();