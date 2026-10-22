'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ToastType = 'info' | 'success' | 'warning' | 'error';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// A coloured edge on a paper slip, so the message itself stays high-contrast.
const edgeMap: Record<ToastType, string> = {
  success: 'border-l-[var(--success)]',
  error: 'border-l-[var(--danger)]',
  warning: 'border-l-[var(--warning)]',
  info: 'border-l-[var(--carbon)]',
};

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', durationMs?: number) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev, { id, message, type }]);
      // Longer messages and errors stay up long enough to read.
      const ms = durationMs ?? (type === 'error' || message.length > 60 ? 6000 : 3000);
      if (ms > 0) setTimeout(() => removeToast(id), ms);
    },
    [removeToast],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Polite live region for routine messages; errors use role="alert". */}
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-4 bottom-28 sm:left-auto sm:right-6 flex flex-col items-stretch sm:items-end gap-2 z-[2000] pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : undefined}
            onClick={() => removeToast(t.id)}
            className={`pointer-events-auto bg-white text-[var(--text)] border border-[var(--border)] border-l-4 ${edgeMap[t.type]} rounded-md px-4 py-3 shadow-lg cursor-pointer text-sm sm:max-w-[380px] animate-[fadeIn_0.15s_ease]`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
