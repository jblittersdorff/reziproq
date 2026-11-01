import { useEffect, useState } from 'react';

// Rückmeldung nach dem Speichern (NAV-04): Eine Formularseite merkt sich die Meldung, die Seite
// danach zeigt sie einmal als Rückmeldezeile. Nur im Speicher, nichts im Browser-Speicher.

let pending: string | null = null;

export const flash = {
  set(message: string) {
    pending = message;
  },
};

/**
 * Liest die Meldung beim ersten Zeichnen und vergisst sie danach; [Meldung, ausblenden].
 * Vergessen erst nach dem Einhängen: Im StrictMode zeichnet React zweimal.
 */
export function useFlash(): [string | null, () => void] {
  const [message, setMessage] = useState(() => pending);
  useEffect(() => {
    pending = null;
  }, []);
  return [message, () => setMessage(null)];
}
