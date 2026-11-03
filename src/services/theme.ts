// Theme Service for MARSHGO - Manages light/dark mode and persistence

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'mg_theme';

/** Normalize a stored value into the theme contract; anything unknown stays light, as init did before. */
export function resolveThemeMode(saved: string | null | undefined): ThemeMode {
  return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'light';
}

/** Resolve a mode against the OS scheme. Only "system" (Авто) follows the OS; stored light/dark wins. */
export function resolveIsDark(mode: ThemeMode, systemPrefersDark: boolean): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return systemPrefersDark;
}

class ThemeService {
  private currentTheme: ThemeMode = 'light';
  private listeners: Set<(theme: ThemeMode, isDark: boolean) => void> = new Set();

  constructor() {
    this.init();
  }

  private init() {
    try {
      this.currentTheme = resolveThemeMode(localStorage.getItem(STORAGE_KEY));
    } catch {
      this.currentTheme = 'light';
    }

    this.applyTheme();

    // Listen for OS system theme changes if set to system
    if (typeof window !== 'undefined' && window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.currentTheme === 'system') {
          this.applyTheme();
          this.notify();
        }
      });
    }
  }

  public getTheme(): ThemeMode {
    return this.currentTheme;
  }

  public isDark(): boolean {
    const systemPrefersDark = typeof window !== 'undefined' && !!window.matchMedia
      && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return resolveIsDark(this.currentTheme, systemPrefersDark);
  }

  public setTheme(theme: ThemeMode): void {
    this.currentTheme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Theme still changes in memory when storage is unavailable.
    }

    this.applyTheme();
    this.notify();
  }

  public toggle(): void {
    const nextTheme: ThemeMode = this.isDark() ? 'light' : 'dark';
    this.setTheme(nextTheme);
  }

  public applyTheme(): void {
    if (typeof document === 'undefined') return;

    const isDarkMode = this.isDark();
    const root = document.documentElement;

    if (isDarkMode) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }

    // Update meta theme-color for mobile status bar
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', isDarkMode ? '#040D1B' : '#081B35');
    }
  }

  public subscribe(callback: (theme: ThemeMode, isDark: boolean) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify(): void {
    const isDark = this.isDark();
    this.listeners.forEach((listener) => listener(this.currentTheme, isDark));
  }
}

export const themeService = new ThemeService();
