'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_THEME, isThemePreference, resolveTheme, THEME_STORAGE_KEY, type ThemePreference } from '@mess/shared';

interface ThemeState {
  preference: ThemePreference;
  resolved: 'light' | 'dark';
  setPreference(p: ThemePreference): void;
}

const Ctx = createContext<ThemeState | null>(null);
const media = () => (typeof window === 'undefined' ? null : window.matchMedia('(prefers-color-scheme: dark)'));

function readStored(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(v) ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Runs before React (in <head>) so the first paint already has the right theme — no light flash. */
export const THEME_BOOT_SCRIPT = `try{var p=localStorage.getItem('${THEME_STORAGE_KEY}');var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}`;

/** One theme for every web area (mess, student, admin, auth): toggles `dark` on <html>; tokens do the rest. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<ThemePreference>(DEFAULT_THEME);
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    setPref(readStored());
    const m = media();
    if (!m) return;
    setSystemDark(m.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, []);

  const resolved = resolveTheme(preference, systemDark);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  }, [resolved]);

  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, p);
    } catch {
      // Private mode / blocked storage: still applies for this visit.
    }
  }, []);

  const value = useMemo(() => ({ preference, resolved, setPreference }), [preference, resolved, setPreference]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
