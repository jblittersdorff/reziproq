import { createContext, type ReactNode, useContext } from 'react';
import { createPortal } from 'react-dom';

/**
 * Platz für die lokale Leiste direkt unter der globalen Leiste, über die ganze Breite (NAV-06).
 * Der Rahmen stellt den Platz bereit; eine Seite wie der Arbeitsbereich eines Lieferanten füllt
 * ihn. Er liegt im Seitenfluss, ist also kein Overlay.
 */
const LocalBarSlotContext = createContext<HTMLElement | null>(null);

export const LocalBarSlotProvider = LocalBarSlotContext.Provider;

/** Zeigt die Kinder im Platz der lokalen Leiste, solange die Seite angezeigt wird. */
export function InLocalBarSlot({ children }: { children: ReactNode }) {
  const slot = useContext(LocalBarSlotContext);
  return slot ? createPortal(children, slot) : null;
}
