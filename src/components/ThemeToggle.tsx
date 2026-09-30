import React, { useState, useEffect } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { themeService, ThemeMode } from '../services/theme';

interface ThemeToggleProps {
  variant?: 'button' | 'segmented';
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = 'button',
  className = ''
}) => {
  const [theme, setTheme] = useState<ThemeMode>(themeService.getTheme());
  const [isDark, setIsDark] = useState<boolean>(themeService.isDark());

  useEffect(() => {
    return themeService.subscribe((newTheme, dark) => {
      setTheme(newTheme);
      setIsDark(dark);
    });
  }, []);

  if (variant === 'segmented') {
    return (
      <div className={`flex items-center p-1 bg-[#F5F8FD] dark:bg-[#122542] rounded-xl border border-slate-200 dark:border-slate-700 text-xs ${className}`}>
        <button
          type="button"
          onClick={() => themeService.setTheme('light')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
            theme === 'light'
              ? 'bg-white dark:bg-[#0D1E36] text-[#14243B] dark:text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Sun className="w-3.5 h-3.5 text-amber-500" />
          <span>Світла</span>
        </button>

        <button
          type="button"
          onClick={() => themeService.setTheme('dark')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
            theme === 'dark'
              ? 'bg-white dark:bg-[#0D1E36] text-[#14243B] dark:text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Moon className="w-3.5 h-3.5 text-sky-400" />
          <span>Темна (Ніч)</span>
        </button>

        <button
          type="button"
          onClick={() => themeService.setTheme('system')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
            theme === 'system'
              ? 'bg-white dark:bg-[#0D1E36] text-[#14243B] dark:text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Monitor className="w-3.5 h-3.5 text-slate-400" />
          <span>Авто</span>
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => themeService.toggle()}
      title={isDark ? 'Увімкнути світлу тему' : 'Увімкнути темну тему (Нічний режим)'}
      aria-label="Перемикач теми"
      className={`relative p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition active:scale-95 flex items-center justify-center ${className}`}
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-amber-400 animate-spin-slow" />
      ) : (
        <Moon className="w-5 h-5 text-sky-300" />
      )}
    </button>
  );
};
