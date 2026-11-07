// Theme Service for MARSHGO - Manages light/dark mode and persistence

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'mg_theme';

/**
 * The owner set dark as the product default: a first run paints dark, and only an explicit choice
 * in Profile (light or system) changes it. The boot shell in index.html reads the same rule.
 */
const DEFAULT_THEME: ThemeMode = 'dark';

class ThemeService {
  private currentTheme: ThemeMode = DEFAULT_THEME;
  private listeners: Set<(theme: ThemeMode, isDark: boolean) => void> = new Set();

  constructor() {
    this.init();
  }

  private init() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      this.currentTheme = saved === 'light' || saved === 'dark' || saved === 'system' ? saved : DEFAULT_THEME;
    } catch {
      this.currentTheme = DEFAULT_THEME;
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
    if (this.currentTheme === 'dark') return true;
    if (this.currentTheme === 'light') return false;
    return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
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
      metaThemeColor.setAttribute('content', isDarkMode ? '#071521' : '#F2F7FB');
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
