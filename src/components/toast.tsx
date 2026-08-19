import { createContext, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './ui';

interface Toast { id: number; msg: string; tone: 'ok' | 'warn' }

const ToastCtx = createContext<{ push: (msg: string, tone?: 'ok' | 'warn') => void }>({ push: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);
  const push = (msg: string, tone: 'ok' | 'warn' = 'ok') => {
    const id = idRef.current++;
    setToasts((t) => [...t.slice(-3), { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[70] space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`anim-toast flex items-center gap-2.5 px-4 py-2.5 rounded-lg border font-medium text-[12.5px] shadow-lg ${
              t.tone === 'ok'
                ? 'bg-ink-800 border-pulse-600/50 text-pulse-300'
                : 'bg-ink-800 border-signal-600/50 text-signal-300'
            }`}
          >
            <Icon name={t.tone === 'ok' ? 'check' : 'info'} size={14} /> {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
