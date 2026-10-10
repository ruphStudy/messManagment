'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { THEME_LABELS, THEME_PREFERENCES, type ThemePreference } from '@mess/shared';
import { cn } from '@/lib/cn';
import { useTheme } from '@/lib/theme';

const ICONS: Record<ThemePreference, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

/** Light / Dark / System segmented control (icon + label; the selected one is marked, not only coloured). */
export function ThemeSelector({ compact = false }: { compact?: boolean }) {
  const { preference, setPreference } = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className={cn('flex gap-1 rounded-control border border-border bg-canvas p-1', compact && 'w-full')}>
      {THEME_PREFERENCES.map((p) => {
        const Icon = ICONS[p];
        const on = preference === p;
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setPreference(p)}
            className={cn('flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-[0.5rem] px-3 text-sm font-medium', on ? 'bg-surface text-ink shadow-sm ring-1 ring-border' : 'text-ink-muted hover:text-ink')}
          >
            <Icon className="size-4" aria-hidden />
            {THEME_LABELS[p]}
            {on && <span className="sr-only">(selected)</span>}
          </button>
        );
      })}
    </div>
  );
}
