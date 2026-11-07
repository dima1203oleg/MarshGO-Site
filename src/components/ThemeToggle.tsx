import React, { useState, useEffect } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { themeService, ThemeMode } from '../services/theme';

interface ThemeToggleProps {
  variant?: 'button' | 'segmented';
  className?: string;
}

type ThemeOption = { mode: ThemeMode; label: string; Icon: typeof Sun; iconClass: string };

const themeOptions: ThemeOption[] = [
  { mode: 'light', label: 'Світла', Icon: Sun, iconClass: 'text-amber-500' },
  { mode: 'dark', label: 'Темна', Icon: Moon, iconClass: 'text-sky-400' },
  { mode: 'system', label: 'Авто', Icon: Monitor, iconClass: 'text-slate-400' },
];

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
      <div
        role="group"
        aria-label="Тема оформлення"
        className={`flex items-center gap-1 rounded-xl border border-slate-200 bg-[#F5F8FD] p-1 text-xs dark:border-slate-700 dark:bg-[var(--mg-surface-elevated)] ${className}`}
      >
        {themeOptions.map(({ mode, label, Icon, iconClass }) => {
          const active = theme === mode;
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={active}
              onClick={() => themeService.setTheme(mode)}
              className={`mg-press flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 font-bold transition-colors duration-[var(--mg-dur-fast)] ${
                active
                  ? 'bg-white text-[#14243B] shadow-xs dark:bg-[var(--mg-surface-secondary)] dark:text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${iconClass}`} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => themeService.toggle()}
      title={isDark ? 'Увімкнути світлу тему' : 'Увімкнути темну тему (Нічний режим)'}
      aria-label="Перемикач теми"
      className={`mg-press relative grid h-11 w-11 place-items-center rounded-lg text-slate-300 transition-colors duration-[var(--mg-dur-fast)] hover:bg-white/10 hover:text-white active:scale-95 ${className}`}
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-amber-400 animate-spin-slow" />
      ) : (
        <Moon className="w-5 h-5 text-sky-300" />
      )}
    </button>
  );
};
