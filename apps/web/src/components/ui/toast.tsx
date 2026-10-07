'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  tone: Tone;
  title: string;
  description?: string;
}

interface ToastApi {
  show(toast: Omit<Toast, 'id'>): void;
  success(title: string, description?: string): void;
  error(title: string, description?: string): void;
}

const ToastContext = createContext<ToastApi | null>(null);

const icons = { success: CheckCircle2, error: AlertCircle, info: Info };
const tones: Record<Tone, string> = {
  success: 'border-green-200 text-green-800',
  error: 'border-red-200 text-red-800',
  info: 'border-blue-200 text-blue-800',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = ++nextId.current;
      setToasts((all) => [...all.slice(-2), { ...toast, id }]);
      setTimeout(() => dismiss(id), toast.tone === 'error' ? 6000 : 4000);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (title, description) => show({ tone: 'success', title, description }),
      error: (title, description) => show({ tone: 'error', title, description }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {toasts.map((t) => {
          const Icon = icons[t.tone];
          return (
            <div
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className={cn('pointer-events-auto flex w-full max-w-sm gap-3 rounded-control border bg-surface p-3 shadow-lg', tones[t.tone])}
            >
              <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
              <div className="flex-1 text-ink">
                <p className="text-sm font-semibold">{t.title}</p>
                {t.description && <p className="text-sm text-ink-muted">{t.description}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} className="text-ink-muted hover:text-ink" aria-label="Dismiss">
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
