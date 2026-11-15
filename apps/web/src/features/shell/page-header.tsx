import { type ReactNode, useEffect } from 'react';
import { useT } from '@/lib/i18n';

/** Setzt den Titel des Browser-Tabs, z. B. für Seiten mit Bühne statt Seitenkopf. */
export function useDocumentTitle(title: string) {
  const t = useT();
  useEffect(() => {
    document.title = `${title} – ${t.app.name}`;
  }, [title, t.app.name]);
}

/**
 * Titel und ein Satz, wofür die Seite da ist. Setzt auch den Titel des Browser-Tabs. Ein
 * Kennzeichen wie „Intern“ (NAV-09) steht neben dem Titel. Größen der Designsprache: work 36 px
 * für Seiten unter einer Leiste (Lieferant, Kunde, Ablauf), list 42 px für Listenseiten;
 * auf Telefonbreite eine Stufe kleiner.
 */
export function PageHeader({
  title,
  purpose,
  badge,
  size = 'work',
}: {
  title: string;
  /** Fehlt nur, solange die Seite lädt oder nicht geladen werden konnte. */
  purpose?: string;
  badge?: ReactNode;
  size?: 'work' | 'list';
}) {
  useDocumentTitle(title);

  return (
    <header className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1
          className={
            size === 'list'
              ? 'text-balance text-title-work tracking-title-work sm:text-title sm:tracking-title-lg'
              : 'text-balance text-figure tracking-section sm:text-title-work sm:tracking-title-work'
          }
        >
          {title}
        </h1>
        {badge}
      </div>
      {purpose && <p className="max-w-190 text-base text-muted-foreground">{purpose}</p>}
    </header>
  );
}
