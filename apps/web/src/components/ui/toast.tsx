import { XIcon } from 'lucide-react';
import { Toast as ToastPrimitive } from 'radix-ui';
import { createContext, type ReactNode, use, useState } from 'react';

import { useT } from '@/lib/i18n';

/**
 * Kurzer Hinweis nach einer Aktion, unten rechts, verschwindet nach fünf Sekunden.
 * Screenreader lesen ihn vor; mit F8 springt der Fokus in die Hinweise.
 * Glas-Effekt wie bei allen Overlays (PLT-10).
 */
export interface ToastMessage {
  title: string;
  description?: string;
}

const ToastContext = createContext<((message: ToastMessage) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [toasts, setToasts] = useState<(ToastMessage & { id: number })[]>([]);

  const show = (message: ToastMessage) =>
    setToasts((current) => [...current, { ...message, id: Date.now() + current.length }]);
  const remove = (id: number) => setToasts((current) => current.filter((toast) => toast.id !== id));

  return (
    <ToastContext value={show}>
      <ToastPrimitive.Provider label={t.app.notifications} duration={5000}>
        {children}
        {toasts.map((toast) => (
          <ToastPrimitive.Root
            key={toast.id}
            onOpenChange={(open) => !open && remove(toast.id)}
            className="flex items-start gap-3 rounded-xl bg-popover/90 py-3 pr-2 pl-4 text-popover-foreground shadow-lg backdrop-blur data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:slide-in-from-bottom-2"
          >
            <div className="flex flex-1 flex-col gap-1 py-2">
              <ToastPrimitive.Title className="font-medium text-base">
                {toast.title}
              </ToastPrimitive.Title>
              {toast.description && (
                <ToastPrimitive.Description className="text-muted-foreground text-sm">
                  {toast.description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close
              aria-label={t.app.closeNotification}
              className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <XIcon className="size-4" aria-hidden />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed right-0 bottom-0 z-50 flex w-full max-w-sm flex-col gap-2 p-4 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext>
  );
}

/** Zeigt einen Hinweis, z. B. toast({ title: 'Gespeichert' }). */
export function useToast(): (message: ToastMessage) => void {
  const show = use(ToastContext);
  if (!show) throw new Error('useToast braucht einen ToastProvider');
  return show;
}
