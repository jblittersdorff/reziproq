import { Link } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Tile, TileIcon } from '@/components/ui/tile';
import { useMe } from '@/features/auth/use-me';
import { PromptTrigger } from '@/features/prompt/prompt-trigger';
import { type Area, areas } from '@/features/shell/areas';
import { supplierSummary, useSuppliers } from '@/features/suppliers/use-suppliers';
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

      <PromptTrigger />

      <section aria-label={t.overview.areas} className="@container">
        <ul className="grid auto-rows-fr gap-4 @xl:grid-cols-2 @4xl:grid-cols-3">
          {areas.map((area) => {
            const Icon = area.icon;
            const texts = t.areas[area.key];
            return (
              <li key={area.key}>
                <Tile asChild size="lg" interactive>
                  <Link to={area.to}>
                    <TileIcon>
                      <Icon aria-hidden />
                    </TileIcon>
                    <span className="flex flex-1 flex-col gap-1">
                      <span className="font-semibold text-lg">{texts.title}</span>
                      <span className="text-muted-foreground">{texts.sentence}</span>
                    </span>
                    <span className="text-muted-foreground text-sm">
                      <AreaStatus area={area} />
                    </span>
                  </Link>
                </Tile>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/** Statuszeile einer Kachel: Kennzahl, sobald es Daten gibt, sonst das Release (PLT-11). */
function AreaStatus({ area }: { area: Area }) {
  const t = useT();
  if (area.key === 'suppliers') return <SuppliersStatus />;
  return <>{t.comingWith(area.release)}</>;
}

function SuppliersStatus() {
  const t = useT();
  const { me, allowed, data, isError } = useSuppliers();
  // Scheitert /me oder die Liste, nicht ewig „lädt …“ zeigen.
  if (me.isError || isError) return <>{t.suppliers.tileFailed}</>;
  if (!me.data) return <>{t.suppliers.loading}</>;
  if (!me.data.organization) return <>{t.suppliers.tileNoOrganization}</>;
  if (!allowed) return <>{t.suppliers.tileNoPermission}</>;
  if (!data) return <>{t.suppliers.loading}</>;
  return <>{supplierSummary(data, t)}</>;
}
