import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { CloseIcon, ShieldCheckIcon } from './icons';

type ToastTone = 'success' | 'danger';

interface Toast {
  readonly id: number;
  readonly tone: ToastTone;
  readonly title: string;
  readonly description?: string;
}

interface ToastApi {
  readonly success: (title: string, description?: string) => void;
  readonly error: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const TOAST_LIFETIME_MS = 5000;

/** Notifications that outlive a page change — "Customer created" still shows after redirecting to the new record. */
export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const push = useCallback(
    (tone: ToastTone, title: string, description?: string) => {
      const id = nextId.current;
      nextId.current += 1;
      setToasts((current) => [...current, { id, tone, title, description }]);
      window.setTimeout(() => dismiss(id), TOAST_LIFETIME_MS);
    },
    [dismiss],
  );
  const api = useMemo<ToastApi>(() => ({ success: (title, description) => push('success', title, description), error: (title, description) => push('danger', title, description) }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed top-20 right-4 z-50 flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((toast) => (
          <div key={toast.id} role="status" className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface p-4 shadow-lg">
            <span className={cn('mt-0.5', toast.tone === 'success' ? 'text-success' : 'text-danger')}>
              <ShieldCheckIcon size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{toast.title}</p>
              {toast.description ? <p className="mt-0.5 text-sm text-ink-muted">{toast.description}</p> : null}
            </div>
            <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(toast.id)} className="rounded text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-brand">
              <CloseIcon size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>');
  return api;
}
