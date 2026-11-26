import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { startupDemoSession } from '@/lib/demo-session';

/**
 * DM-01 (K1-g.4): ⌥D öffnet die Demo-Regie von jeder Seite, nur in einer Demo-Sitzung. Auf dem Mac
 * liefert ⌥D ein Sonderzeichen; deshalb zählt die Taste (code), nicht das Zeichen.
 */
export function useDemoShortcut() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!startupDemoSession) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && !event.metaKey && !event.ctrlKey && event.code === 'KeyD') {
        event.preventDefault();
        void navigate({ to: '/demo' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);
}
