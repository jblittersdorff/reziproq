import { useEffect, useRef, useState } from 'react';

/** So lange folgt die Seite dem Ziel, während darüber noch Inhalte laden */
const followMs = 2000;

/**
 * Springt zur Sprungmarke der Adresse (`#verlauf`, `#mail-<id>`), sobald ihre Daten da sind und das
 * Ziel im Dokument steht (AK-01, K2-c.7). Inhalte laden nach dem ersten Zeichnen; der Browser
 * springt dann nicht mehr von selbst. Laden danach noch Abschnitte darüber, schieben sie das Ziel
 * nach unten: Bis die Person selbst scrollt oder tippt, höchstens zwei Sekunden lang, folgt die Seite
 * dem Ziel. Ohne Sprungmarke geschieht nichts.
 */
export function useHashScroll(ready: boolean) {
  const searched = useRef(false);
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (searched.current || !ready) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    const element = id ? document.getElementById(id) : null;
    if (!id) searched.current = true;
    if (!element) return;
    searched.current = true;
    setTarget(element);
  });

  useEffect(() => {
    if (!target) return;
    const jump = () => target.scrollIntoView?.({ block: 'start' });
    jump();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(jump);
    const stop = () => observer.disconnect();
    observer.observe(document.body);
    const timer = window.setTimeout(stop, followMs);
    const events = ['wheel', 'touchstart', 'keydown'] as const;
    for (const event of events) window.addEventListener(event, stop, { passive: true });
    return () => {
      window.clearTimeout(timer);
      stop();
      for (const event of events) window.removeEventListener(event, stop);
    };
  }, [target]);
}
