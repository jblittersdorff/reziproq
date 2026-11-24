import { createContext, useContext } from 'react';

/** Was Frag Reziproq beim Öffnen mitbekommt (NAV-10 2.0) */
export interface AskRequest {
  /** Frage, die sofort gestellt wird, z. B. aus einem Link */
  question?: string | undefined;
  /** NAV-10: Beziehung als Kontext, wenn die Frage auf ihrer Seite gestellt wird */
  supplier?: string | undefined;
  /** QS-05: Kunde, in dem ein Lieferanten-Nutzer sucht */
  customer?: string | undefined;
}

/** Öffnet Frag Reziproq über der aktuellen Seite (⌘K, Seitenleiste, Tab-Leiste, Fragefeld). */
export const AskContext = createContext<(request?: AskRequest) => void>(() => {});

export const useAsk = () => useContext(AskContext);
