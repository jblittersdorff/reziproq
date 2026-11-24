import { Link } from '@tanstack/react-router';
import { CompassIcon } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n';

/** Freundliche Seite für unbekannte Adressen mit dem Weg zurück zu Start. */
export function NotFoundPage() {
  const t = useT();

  useEffect(() => {
    document.title = `${t.notFound.title} – ${t.app.name}`;
  }, [t]);

  return (
    <section className="flex flex-col items-center gap-4 rounded-lg bg-card shadow-card px-6 py-16 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-paper text-muted-foreground">
        <CompassIcon className="size-10" aria-hidden />
      </div>
      <div className="flex max-w-sm flex-col gap-1">
        <h1 className="text-section tracking-section">{t.notFound.title}</h1>
        <p className="text-muted-foreground">{t.notFound.description}</p>
      </div>
      <Button asChild>
        <Link to="/">{t.notFound.back}</Link>
      </Button>
    </section>
  );
}
