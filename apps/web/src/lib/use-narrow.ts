import { useEffect, useState } from 'react';

/** Unter 760 px öffnet eine Detailleiste als eigene Ansicht mit Zurück (LS-01, kein Popup). */
/** Umbruchpunkt der Spec (LS-01), keine Gestaltungsgröße; deshalb hier und nicht in den Tokens */
const narrowBelowPx = 760;
const narrowQuery = `(max-width: ${narrowBelowPx - 1}px)`;

export function useNarrow() {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.(narrowQuery).matches === true,
  );
  useEffect(() => {
    const media = window.matchMedia?.(narrowQuery);
    if (!media) return;
    const onChange = () => setNarrow(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return narrow;
}
