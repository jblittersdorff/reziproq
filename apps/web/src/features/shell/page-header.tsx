import { useEffect } from 'react';
import { useT } from '@/lib/i18n';

/** Titel und ein Satz, wofür die Seite da ist. Setzt auch den Titel des Browser-Tabs. */
export function PageHeader({ title, purpose }: { title: string; purpose: string }) {
  const t = useT();

  useEffect(() => {
    document.title = `${title} – ${t.app.name}`;
  }, [title, t.app.name]);

  return (
    <header className="flex flex-col gap-1">
      <h1 className="font-semibold text-xl">{title}</h1>
      <p className="text-muted-foreground">{purpose}</p>
    </header>
  );
}
