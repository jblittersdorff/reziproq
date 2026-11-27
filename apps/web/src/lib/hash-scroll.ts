import { useEffect, useRef } from 'react';

/**
 * Springt einmal zur Sprungmarke der Adresse (`#verlauf`, `#mail-<id>`), sobald ihre Daten da sind
 * und das Ziel im Dokument steht (AK-01, K2-c.7). Inhalte laden nach dem ersten Zeichnen; der
 * Browser springt dann nicht mehr von selbst. Ohne Sprungmarke geschieht nichts.
 */
export function useHashScroll(ready: boolean) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !ready) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    const target = id ? document.getElementById(id) : null;
    if (!id) done.current = true;
    if (!target) return;
    done.current = true;
    target.scrollIntoView?.({ block: 'start' });
  });
}
