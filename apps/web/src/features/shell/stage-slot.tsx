import { createContext, type ReactNode, useContext } from 'react';
import { createPortal } from 'react-dom';

/**
 * Platz für die Bühne (PLT-10, Handschrift Bühne): oben im Inhalt, über die ganze Breite. Er liegt
 * in <main> und im Seitenfluss; Start und der Überblick eines Lieferanten füllen ihn.
 */
const StageSlotContext = createContext<HTMLElement | null>(null);

export const StageSlotProvider = StageSlotContext.Provider;

/** Zeigt die Kinder im Platz der Bühne, solange die Seite angezeigt wird. */
export function InStageSlot({ children }: { children: ReactNode }) {
  const slot = useContext(StageSlotContext);
  return slot ? createPortal(children, slot) : null;
}
