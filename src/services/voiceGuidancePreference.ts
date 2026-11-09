import { useSyncExternalStore } from 'react';

const VOICE_GUIDANCE_KEY = 'marshgo.navigation.voice';
const VOICE_GUIDANCE_EVENT = 'marshgo:voice-guidance-preference';
let sessionPreference: boolean | null = null;

function readVoiceGuidancePreference(): boolean {
  if (typeof window === 'undefined') return false;
  if (sessionPreference !== null) return sessionPreference;
  try { return window.localStorage.getItem(VOICE_GUIDANCE_KEY) === 'on'; }
  catch { return false; }
}

function subscribeVoiceGuidancePreference(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const onStorage = () => { sessionPreference = null; onChange(); };
  window.addEventListener(VOICE_GUIDANCE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(VOICE_GUIDANCE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

export function setVoiceGuidancePreference(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  sessionPreference = enabled;
  try { window.localStorage.setItem(VOICE_GUIDANCE_KEY, enabled ? 'on' : 'off'); }
  catch { /* Voice preference is optional when storage is unavailable. */ }
  window.dispatchEvent(new Event(VOICE_GUIDANCE_EVENT));
}

export function useVoiceGuidancePreference(): boolean {
  return useSyncExternalStore(subscribeVoiceGuidancePreference, readVoiceGuidancePreference, () => false);
}
