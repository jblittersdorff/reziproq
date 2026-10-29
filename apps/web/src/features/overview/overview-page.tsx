import { Link } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useMe } from '@/features/auth/use-me';
import { areas } from '@/features/shell/areas';
import { useT } from '@/lib/i18n';
import { dayTime } from './greeting';

/** Startseite nach dem Login: Begrüßung, Platz für das Prompt-Fenster, sechs Bereichskacheln. */
export function OverviewPage() {
  const t = useT();
  const me = useMe();

  useEffect(() => {
    document.title = `${t.overview.title} – ${t.app.name}`;
  }, [t]);

  const greeting = {
    morning: t.overview.greetingMorning,
    day: t.overview.greetingDay,
    evening: t.overview.greetingEvening,
  }[dayTime(new Date())];

  return (
    <div className="flex flex-col gap-10">
      <h1 className="font-semibold text-xl">
        {me.data ? greeting(me.data.firstName) : t.overview.greetingWithoutName}
      </h1>

      {/* Platz für das Prompt-Fenster (PLT-12); bis dahin bewusst leer, kein totes Eingabefeld. */}
      <div data-slot="prompt-platz" />

      <section aria-label={t.overview.areas} className="@container">
        <ul className="grid auto-rows-fr gap-4 @xl:grid-cols-2 @4xl:grid-cols-3">
          {areas.map((area) => {
            const Icon = area.icon;
            const texts = t.areas[area.key];
            return (
              <li key={area.key}>
                <Link
                  to={area.to}
                  className="flex h-full flex-col gap-4 rounded-xl bg-muted p-6 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex size-11 items-center justify-center rounded-full bg-background text-primary">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <span className="flex flex-1 flex-col gap-1">
                    <span className="font-semibold text-lg">{texts.title}</span>
                    <span className="text-muted-foreground">{texts.sentence}</span>
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {t.comingWith(area.release)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
