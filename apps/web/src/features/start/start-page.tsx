import type { DueItem } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import { buttonVariants } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Tile, TileActions, TileText, TileTitle } from '@/components/ui/tile';
import { useMe } from '@/features/auth/use-me';
import { PromptTrigger } from '@/features/prompt/prompt-trigger';
import { routerLink } from '@/features/shell/navigation';
import { startQueryOptions } from '@/lib/api';
import { useLocale, useT } from '@/lib/i18n';
import { dayTime } from './greeting';

export const itemLinkClass =
  'flex min-h-11 flex-col justify-center rounded-md px-2 py-1 hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

export function dueTitle(t: ReturnType<typeof useT>, item: DueItem) {
  if (item.kind === 'cycle') {
    const steps = t.workspace.cycle.steps;
    const step =
      item.detail && Object.hasOwn(steps, item.detail)
        ? steps[item.detail as keyof typeof steps]
        : (item.detail ?? '');
    return t.start.dueCycle(step);
  }
  if (item.kind === 'contribution') return t.start.dueContribution(item.detail);
  return t.start.dueRating(item.detail);
}

export function formatDate(locale: string, date: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    new Date(`${date}T00:00:00`),
  );
}

/**
 * Start nach dem Login (PLT-11, NAV-05): Begrüßung, Fragefeld und vier Kacheln mit höchstens
 * fünf Einträgen. Auf Start lässt sich nichts bearbeiten; jeder Eintrag führt zum Ort der Sache.
 */
export function StartPage() {
  const t = useT();
  const { locale } = useLocale();
  const me = useMe();
  // Lieferantenseite (LIF-02): Kunden statt Lieferanten, Fragen folgen mit QS-05.
  const supplierSide = Boolean(
    me.data?.permissions.viewCustomers && !me.data.permissions.viewBuyerAreas,
  );
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const query = useQuery({ ...startQueryOptions(accessToken), enabled: accessToken !== '' });

  useEffect(() => {
    document.title = `${t.start.title} – ${t.app.name}`;
  }, [t]);

  const greeting = {
    morning: t.start.greetingMorning,
    day: t.start.greetingDay,
    evening: t.start.greetingEvening,
  }[dayTime(new Date())];
  const data = query.data;

  return (
    <div className="flex flex-col gap-10">
      <h1 className="font-semibold text-xl">
        {me.data ? greeting(me.data.firstName) : t.start.greetingWithoutName}
      </h1>

      {!supplierSide && <PromptTrigger />}

      {query.isError ? (
        <ErrorState title={t.start.failed} />
      ) : !data ? (
        <LoadingState label={t.start.loading} />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <Tile size="lg">
            <TileTitle>{t.start.dueTitle}</TileTitle>
            {data.due.items.length === 0 ? (
              <TileText>{t.start.dueEmpty}</TileText>
            ) : (
              <ul className="flex flex-col gap-1">
                {data.due.items.map((item) => (
                  <li key={item.id}>
                    {routerLink({
                      href: item.href,
                      className: itemLinkClass,
                      children: (
                        <>
                          <span className="font-medium">{item.supplier}</span>
                          <span className="text-muted-foreground text-sm">
                            {dueTitle(t, item)} · {t.start.dueBy(formatDate(locale, item.dueDate))}
                          </span>
                        </>
                      ),
                    })}
                  </li>
                ))}
              </ul>
            )}
            {data.due.total > 0 && (
              <TileActions>
                {routerLink({
                  href: '/start/faellig',
                  className: buttonVariants({ variant: 'outline' }),
                  children: t.start.all,
                })}
              </TileActions>
            )}
          </Tile>

          <Tile size="lg">
            <TileTitle>{t.start.datesTitle}</TileTitle>
            <TileText>{t.start.comingLater}</TileText>
          </Tile>

          <Tile size="lg">
            <TileTitle>{t.start.notesTitle}</TileTitle>
            <TileText>{t.start.comingLater}</TileText>
          </Tile>

          <Tile size="lg">
            <TileTitle>
              {supplierSide ? t.start.customersTitle : t.start.relationshipsTitle}
            </TileTitle>
            {data.relationships.items.length === 0 ? (
              <TileText>
                {supplierSide ? t.start.customersEmpty : t.start.relationshipsEmpty}
              </TileText>
            ) : (
              <ul className="flex flex-col gap-1">
                {data.relationships.items.map((item) => (
                  <li key={item.id}>
                    {routerLink({
                      href: supplierSide ? `/kunden/${item.id}` : `/lieferanten/${item.id}`,
                      className: itemLinkClass,
                      children: (
                        <>
                          <span className="font-medium">{item.name}</span>
                          {item.target && (
                            <span className="ml-2 text-muted-foreground text-sm">
                              {t.start.target(item.target)}
                            </span>
                          )}
                        </>
                      ),
                    })}
                  </li>
                ))}
              </ul>
            )}
            {data.relationships.total > 0 && (
              <TileActions>
                {routerLink({
                  href: supplierSide ? '/kunden' : '/lieferanten',
                  className: buttonVariants({ variant: 'outline' }),
                  children: t.start.all,
                })}
              </TileActions>
            )}
          </Tile>
        </div>
      )}
    </div>
  );
}
