import { type ReactNode, useEffect } from 'react';
import { useT } from '@/lib/i18n';

/**
 * Titel und ein Satz, wofür die Seite da ist. Setzt auch den Titel des Browser-Tabs. Ein
 * Kennzeichen wie „Intern“ (NAV-09) steht neben dem Titel.
 */
export function PageHeader({
  title,
  purpose,
  badge,
}: {
  title: string;
  purpose: string;
  badge?: ReactNode;
}) {
  const t = useT();

  useEffect(() => {
    document.title = `${title} – ${t.app.name}`;
  }, [title, t.app.name]);

  return (
    <header className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="font-semibold text-xl">{title}</h1>
        {badge}
      </div>
      <p className="text-muted-foreground">{purpose}</p>
    </header>
  );
}
