import type { DueItem } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import { ChevronRightIcon } from 'lucide-react';
import { useAuth } from 'react-oidc-context';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Monogram } from '@/components/ui/monogram';
import { useMe } from '@/features/auth/use-me';
import { PromptTrigger } from '@/features/prompt/prompt-trigger';
import { routerLink } from '@/features/shell/navigation';
import { useDocumentTitle } from '@/features/shell/page-header';
import { startQueryOptions } from '@/lib/api';
import { useLocale, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
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
 * Start nach dem Login (PLT-11, NAV-05, UMB-05): Begrüßung, darunter die fälligen Aufgaben als
 * Liste mit genau einem Knopf je Zeile, dann die eigenen Lieferanten bzw. Kunden als Karten.
 * Rechts Fragefeld und Zahlen. Auf Start lässt sich nichts bearbeiten; jeder Eintrag führt zum Ort
 * der Sache, und was dort erledigt ist, verschwindet hier von selbst.
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

  useDocumentTitle(t.start.title);

  const greeting = {
    morning: t.start.greetingMorning,
    day: t.start.greetingDay,
    evening: t.start.greetingEvening,
  }[dayTime(new Date())];
  const data = query.data;
  const today = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  const relationshipHref = (id: string) => (supplierSide ? `/kunden/${id}` : `/lieferanten/${id}`);

  return (
    <div className="grid items-start gap-10 sidebar:grid-cols-3">
      {/* Zuerst im Dokument: Der Sprung-Link führt direkt zum Fragefeld (PLT-11, PLT-12). */}
      <aside className="flex flex-col gap-4 sidebar:col-start-3 sidebar:row-start-1">
        {!supplierSide && <PromptTrigger />}
        {data && (
          <dl
            aria-label={t.start.metricsLabel}
            className="grid grid-cols-2 gap-4 rounded-xl bg-card p-5"
          >
            <div className="flex flex-col-reverse gap-1">
              <dt className="text-muted-foreground text-sm">{t.start.metricDue}</dt>
              <dd
                className={cn(
                  'font-bold text-2xl tabular-nums tracking-title',
                  data.due.total > 0 && 'text-primary',
                )}
              >
                {data.due.total}
              </dd>
            </div>
            <div className="flex flex-col-reverse gap-1">
              <dt className="text-muted-foreground text-sm">
                {supplierSide ? t.start.metricCustomers : t.start.metricRelationships}
              </dt>
              <dd className="font-bold text-2xl tabular-nums tracking-title">
                {data.relationships.total}
              </dd>
            </div>
          </dl>
        )}
      </aside>
      <div className="flex min-w-0 flex-col gap-10 sidebar:col-span-2 sidebar:col-start-1 sidebar:row-start-1">
        <header className="flex flex-col gap-1">
          <p className="font-semibold text-primary text-sm">{today}</p>
          <h1 className="font-bold text-2xl tracking-title">
            {me.data ? greeting(me.data.firstName) : t.start.greetingWithoutName}
          </h1>
        </header>

        {query.isError ? (
          <ErrorState title={t.start.failed} />
        ) : !data ? (
          <LoadingState label={t.start.loading} />
        ) : (
          <>
            <section aria-labelledby="start-faellig" className="flex flex-col gap-3">
              <h2 id="start-faellig" className="font-bold text-xl tracking-title">
                {t.start.todayTitle(data.due.total)}
              </h2>
              {data.due.items.length === 0 ? (
                <EmptyState
                  title={t.start.dueEmpty}
                  description={t.start.dueEmptyHint}
                  action={routerLink({
                    href: supplierSide ? '/kunden' : '/lieferanten',
                    className: buttonVariants({ variant: 'outline' }),
                    children: supplierSide ? t.start.customersTitle : t.start.relationshipsTitle,
                  })}
                />
              ) : (
                <ol data-slot="due-list" className="overflow-hidden rounded-xl bg-card">
                  {data.due.items.map((item, index) => {
                    const what = dueTitle(t, item);
                    return (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-center gap-x-4 gap-y-2 border-border border-b px-5 py-4 last:border-b-0"
                      >
                        <Monogram name={item.supplier} />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="font-semibold">{what}</span>
                          <span className="text-muted-foreground text-sm">
                            {item.supplier} · {t.start.dueBy(formatDate(locale, item.dueDate))}
                          </span>
                        </span>
                        {routerLink({
                          href: item.href,
                          className: buttonVariants({
                            variant: index === 0 ? 'default' : 'outline',
                          }),
                          'aria-label': t.start.openItem(item.supplier, what),
                          children: t.start.open,
                        })}
                      </li>
                    );
                  })}
                </ol>
              )}
              {data.due.total > data.due.items.length &&
                routerLink({
                  href: '/start/faellig',
                  className: cn(
                    buttonVariants({ variant: 'link' }),
                    'self-start px-0 has-[>svg]:px-0',
                  ),
                  children: (
                    <>
                      {t.start.allDue(data.due.total)}
                      <ChevronRightIcon aria-hidden />
                    </>
                  ),
                })}
            </section>

            <section aria-labelledby="start-beziehungen" className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-4">
                <h2 id="start-beziehungen" className="font-bold text-xl tracking-title">
                  {supplierSide ? t.start.customersTitle : t.start.relationshipsTitle}
                </h2>
                {data.relationships.total > 0 &&
                  routerLink({
                    href: supplierSide ? '/kunden' : '/lieferanten',
                    className: cn(buttonVariants({ variant: 'link' }), 'px-0'),
                    children: t.start.all,
                  })}
              </div>
              {data.relationships.items.length === 0 ? (
                <p className="text-muted-foreground">
                  {supplierSide ? t.start.customersEmpty : t.start.relationshipsEmpty}
                </p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.relationships.items.map((item) => (
                    <li key={item.id}>
                      {routerLink({
                        href: relationshipHref(item.id),
                        className:
                          'flex h-full flex-col gap-3 rounded-xl bg-card p-5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                        children: (
                          <>
                            <Monogram name={item.name} emphasis={Boolean(item.target)} />
                            <span className="font-semibold leading-snug">{item.name}</span>
                            {item.target && (
                              <span className="text-muted-foreground text-sm">
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
            </section>
          </>
        )}
      </div>
    </div>
  );
}
