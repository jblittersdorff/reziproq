import type { Bridge, ImpactView, PortfolioImpact } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ReceiptEuroIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { buildInitiativeBridge } from '@/components/charts/bridge';
import { PnlBridge } from '@/components/charts/pnl-bridge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StatusLine } from '@/components/ui/status-line';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useMe } from '@/features/auth/use-me';
import { useCan } from '@/features/auth/use-permissions';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { SupplierFrame } from '@/features/suppliers/supplier-frame';
import {
  bridgeQueryOptions,
  fiscalYearQueryOptions,
  portfolioImpactQueryOptions,
  saveFiscalYear,
  type TeamSide,
  validationsQueryOptions,
} from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';

// PNL-10: P&L-Brücke je Beziehung und Wirkung im Portfolio. Sicht und Geschäftsjahr stehen in der
// Adresse (?sicht=jahreswirkung|geschaeftsjahr&gj=2026). Nie eine Summe über Wirkungsarten.

export interface ImpactSearch {
  sicht?: ImpactView | undefined;
  gj?: number | undefined;
}

function useToken() {
  const auth = useAuth();
  return auth.user?.access_token ?? '';
}

function useMoney() {
  const format = useFormat();
  return {
    full: (cents: number) => format.money({ amountCents: cents, currency: 'EUR' }),
    short: (cents: number) =>
      new Intl.NumberFormat(format.locale, {
        style: 'currency',
        currency: 'EUR',
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(cents / 100),
  };
}

/** Umschalter Jahreswirkung oder Geschäftsjahr und Auswahl des Geschäftsjahrs, in der Adresse. */
function ViewControls({
  path,
  view,
  data,
}: {
  path: string;
  view: ImpactView;
  data: { fiscalYear: number; fiscalYears: number[]; fiscalYearStartMonth: number };
}) {
  const text = useT().impact.portfolio;
  const navigate = useNavigate();
  const go = (search: ImpactSearch) => void navigate({ to: path, search, replace: true });
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <SegmentedControl
        label={text.view}
        value={view}
        options={(['jahreswirkung', 'geschaeftsjahr'] as const).map((value) => ({
          value,
          label: text.views[value] ?? value,
        }))}
        onChange={(value) =>
          go(value === 'jahreswirkung' ? {} : { sicht: value, gj: data.fiscalYear })
        }
      />
      {view === 'geschaeftsjahr' && (
        <FormField label={text.fiscalYear} className="sm:w-48">
          {(field) => (
            <NativeSelect
              {...field}
              value={String(data.fiscalYear)}
              onChange={(event) => go({ sicht: view, gj: Number(event.target.value) })}
            >
              {data.fiscalYears.map((year) => (
                <option key={year} value={year}>
                  {text.fiscalYearLabel(year, data.fiscalYearStartMonth)}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
      )}
    </div>
  );
}

/** Wasserfall der EBIT-Wirkung, daneben die anderen Arten; darunter die Werte als Tabelle. */
export function BridgeSection({
  relationshipId,
  side,
  path,
  search,
  initiativeHref,
}: {
  relationshipId: string;
  side: TeamSide;
  path: string;
  search: ImpactSearch;
  initiativeHref?: (initiativeId: string) => string;
}) {
  const t = useT();
  const text = t.impact.portfolio;
  const accessToken = useToken();
  const view = search.sicht ?? 'jahreswirkung';
  const query = useQuery({
    ...bridgeQueryOptions(accessToken, relationshipId, side, view, search.gj),
    enabled: accessToken !== '',
  });
  if (query.isError) return <ErrorState title={text.failed} />;
  if (!query.data) return <LoadingState label={text.loading} />;
  return (
    <BridgeContent data={query.data} path={path} view={view} initiativeHref={initiativeHref} />
  );
}

function BridgeContent({
  data,
  path,
  view,
  initiativeHref,
}: {
  data: Bridge;
  path: string;
  view: ImpactView;
  initiativeHref?: ((initiativeId: string) => string) | undefined;
}) {
  const t = useT();
  const text = t.impact.portfolio;
  const money = useMoney();
  const steps = buildInitiativeBridge(
    data.steps.map((step) => ({
      label: step.title,
      amountCents: step.amountCents,
      maturity: step.maturity,
    })),
    text.total,
  );
  return (
    <>
      <ViewControls path={path} view={view} data={data} />
      <p className="text-muted-foreground text-sm">
        {text.viewHints[view]} {text.basis}
      </p>
      <PnlBridge
        title={text.bridgeTitle(money.full(data.ebitTotal))}
        steps={steps}
        formatAxis={money.short}
        formatDelta={(step) =>
          step.maturity
            ? `${money.short(step.deltaCents)} · ${text.maturity(step.maturity)}`
            : money.short(step.deltaCents)
        }
        empty={{ title: text.bridgeEmpty, description: text.bridgeEmptyText }}
      />
      {data.steps.length > 0 && (
        <Table>
          <caption className="sr-only">{text.stepsTable}</caption>
          <TableHeader>
            <TableRow>
              <TableHead>{text.initiative}</TableHead>
              <TableHead>{text.level}</TableHead>
              <TableHead className="text-right">{text.amount}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.steps.map((step) => (
              <TableRow key={step.initiativeId}>
                <TableCell>
                  {initiativeHref
                    ? routerLink({
                        href: initiativeHref(step.initiativeId),
                        className:
                          'font-medium hover:underline focus-visible:underline focus-visible:outline-none',
                        children: step.title,
                      })
                    : step.title}
                </TableCell>
                <TableCell>
                  {text.maturity(step.maturity)} {t.impact.levels[step.maturity]}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {money.full(step.amountCents)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {data.others.length > 0 && (
        <section aria-labelledby="bruecke-andere" className="flex flex-col gap-3">
          <h2 id="bruecke-andere" className="font-semibold text-lg">
            {text.others}
          </h2>
          <ul aria-label={text.others} className="grid gap-4 sm:grid-cols-3">
            {data.others.map((other) => (
              <li
                key={other.effectType}
                data-effect={other.effectType}
                className="flex flex-col gap-1 rounded-lg bg-card p-4"
              >
                <span className="text-muted-foreground text-sm">
                  {t.impact.effects[other.effectType]}
                </span>
                <span className="font-semibold text-xl tabular-nums">
                  {money.full(other.amountCents)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {data.excluded.length > 0 && (
        <p className="rounded-lg bg-card px-4 py-3 text-muted-foreground text-sm">
          {text.excluded}: {data.excluded.map((entry) => entry.title).join(', ')}
        </p>
      )}
    </>
  );
}

/** Lieferant › Wirkung › P&L-Brücke beim Käufer. */
export function BridgePage({
  relationshipId,
  search,
}: {
  relationshipId: string;
  search: ImpactSearch;
}) {
  const text = useT().impact.portfolio;
  return (
    <SupplierFrame
      relationshipId={relationshipId}
      area="impact"
      current={text.pageTitle}
      header={<PageHeader title={text.pageTitle} purpose={text.pagePurpose} />}
    >
      {() => (
        <BridgeSection
          relationshipId={relationshipId}
          side="buyer"
          path={`/lieferanten/${relationshipId}/wirkung/bruecke`}
          search={search}
          initiativeHref={(id) => `/lieferanten/${relationshipId}/wirkung/initiativen/${id}`}
        />
      )}
    </SupplierFrame>
  );
}

/** /wirkung: Pipeline, Portfolio je BU und Geschäftsjahr, Freigaben, Top-Beziehungen. */
export function PortfolioImpactPage({ search }: { search: ImpactSearch }) {
  const t = useT();
  const text = t.impact.portfolio;
  const canSee = useCan('wirkung.sehen');
  const accessToken = useToken();
  const view = search.sicht ?? 'jahreswirkung';
  const query = useQuery({
    ...portfolioImpactQueryOptions(accessToken, view, search.gj),
    enabled: accessToken !== '' && canSee,
  });
  return (
    <>
      <PageHeader title={text.title} purpose={text.purpose} />
      {!canSee ? (
        <EmptyState
          size="lg"
          icon={<ReceiptEuroIcon aria-hidden />}
          title={t.impact.emptyTitle}
          description={t.impact.emptyDescription}
        />
      ) : query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : (
        <PortfolioContent data={query.data} view={view} accessToken={accessToken} />
      )}
    </>
  );
}

function PortfolioContent({
  data,
  view,
  accessToken,
}: {
  data: PortfolioImpact;
  view: ImpactView;
  accessToken: string;
}) {
  const t = useT();
  const text = t.impact.portfolio;
  const money = useMoney();
  const validations = useQuery({
    ...validationsQueryOptions(accessToken),
    enabled: accessToken !== '',
  });
  const open =
    validations.data?.validations.filter((entry) => entry.status === 'requested').length ?? 0;
  const largest = Math.max(
    1,
    ...data.businessUnits.rows.flatMap((row) => row.amounts.map((amount) => Math.abs(amount))),
  );
  return (
    <>
      <ViewControls path="/wirkung" view={view} data={data} />
      <p className="text-muted-foreground text-sm">
        {text.focusCount(data.focusSuppliers)} · {text.viewHints[view]} {text.basis}
      </p>

      <section aria-labelledby="wirkung-pipeline" className="flex flex-col gap-3">
        <h2 id="wirkung-pipeline" className="font-semibold text-lg">
          {text.pipeline}
        </h2>
        {data.pipeline.length === 0 ? (
          <p className="rounded-lg bg-card px-4 py-3 text-muted-foreground">{text.pipelineEmpty}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {data.pipeline.map((entry) => (
              <div
                key={entry.effectType}
                data-effect={entry.effectType}
                className="flex flex-col gap-2 rounded-lg bg-card p-4"
              >
                <h3 className="font-medium">{t.impact.effects[entry.effectType]}</h3>
                <ol
                  aria-label={t.impact.effects[entry.effectType]}
                  className="grid grid-cols-2 gap-2 sm:grid-cols-5"
                >
                  {entry.levels.map((level) => (
                    <li key={level.level} className="flex flex-col rounded-md bg-muted px-3 py-2">
                      <span className="text-muted-foreground text-sm">
                        {text.maturity(level.level)} {t.impact.levels[level.level]}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {money.full(level.amountCents)}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
        <p className="text-muted-foreground text-sm">{text.pipelineHint}</p>
      </section>

      <section aria-labelledby="wirkung-bu" className="flex flex-col gap-3">
        <h2 id="wirkung-bu" className="font-semibold text-lg">
          {text.businessUnits}
        </h2>
        <Table>
          <caption className="sr-only">{text.businessUnits}</caption>
          <TableHeader>
            <TableRow>
              <TableHead>{t.suppliers.spendDevelopment.businessUnit}</TableHead>
              {data.businessUnits.years.map((year) => (
                <TableHead key={year} className="text-right">
                  {text.fiscalYearLabel(year, data.fiscalYearStartMonth)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.businessUnits.rows.map((row) => (
              <TableRow key={row.id ?? 'ohne'}>
                <TableCell className="font-medium">{row.name ?? text.noUnit}</TableCell>
                {row.amounts.map((amount, index) => (
                  <TableCell key={data.businessUnits.years[index]} className="text-right">
                    <span className="flex flex-col items-end gap-1">
                      <span className="tabular-nums">{money.full(amount)}</span>
                      <span
                        aria-hidden
                        className="h-1.5 rounded-full bg-[var(--chart-accent)]"
                        style={{ width: `${Math.round((Math.abs(amount) / largest) * 100)}%` }}
                      />
                    </span>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-muted-foreground text-sm">{text.businessUnitsHint}</p>
      </section>

      <section aria-labelledby="wirkung-top" className="flex flex-col gap-3">
        <h2 id="wirkung-top" className="font-semibold text-lg">
          {text.top}
        </h2>
        {data.top.length === 0 ? (
          <p className="rounded-lg bg-card px-4 py-3 text-muted-foreground">{text.topEmpty}</p>
        ) : (
          <ol aria-label={text.top} className="flex flex-col gap-2">
            {data.top.map((entry) => (
              <li
                key={entry.relationshipId}
                className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-card px-4"
              >
                {routerLink({
                  href: `/lieferanten/${entry.relationshipId}/wirkung/bruecke`,
                  className:
                    'font-medium hover:underline focus-visible:underline focus-visible:outline-none',
                  children: entry.name,
                })}
                <span className="font-semibold tabular-nums">
                  {money.full(entry.realizedCents)}
                </span>
              </li>
            ))}
          </ol>
        )}
        <p className="text-muted-foreground text-sm">{text.topHint}</p>
      </section>

      <section aria-labelledby="wirkung-freigaben" className="flex flex-col gap-3">
        <h2 id="wirkung-freigaben" className="font-semibold text-lg">
          {t.impact.validationsTitle}
        </h2>
        {routerLink({
          href: '/wirkung/freigaben',
          className:
            'flex min-h-11 items-center justify-between rounded-lg bg-card px-4 font-medium hover:underline',
          children: (
            <>
              <span>{t.impact.toValidations}</span>
              <span className="text-muted-foreground text-sm">
                {open > 0
                  ? `${open} ${t.impact.validationStatuses.requested}`
                  : t.impact.toValidationsHint}
              </span>
            </>
          ),
        })}
      </section>
    </>
  );
}

/** Einstellungen › Geschäftsjahr: Beginn je Kunde, Standard Januar. */
export function FiscalYearSettingsPage() {
  const t = useT();
  const text = t.impact.portfolio;
  const me = useMe();
  const canManage = useCan('einstellungen.verwalten');
  const accessToken = useToken();
  const query = useQuery({
    ...fiscalYearQueryOptions(accessToken),
    enabled: accessToken !== '',
  });
  return (
    <>
      <PagePath
        trail={[
          { label: t.profile.title, href: '/profil' },
          { label: t.settings.title, href: '/einstellungen' },
        ]}
        current={text.settingTitle}
      />
      <PageHeader title={text.settingTitle} purpose={text.settingPurpose} />
      {me.isError || query.isError ? (
        <ErrorState title={text.failed} />
      ) : !me.data || !query.data ? (
        <LoadingState label={text.loading} />
      ) : !canManage ? (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {t.settings.adminOnly}
        </p>
      ) : (
        <FiscalYearForm startMonth={query.data.startMonth} accessToken={accessToken} />
      )}
    </>
  );
}

function FiscalYearForm({ startMonth, accessToken }: { startMonth: number; accessToken: string }) {
  const t = useT();
  const text = t.impact.portfolio;
  const format = useFormat();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(startMonth);
  const [status, setStatus] = useState<'saved' | 'failed' | null>(null);
  const [saving, setSaving] = useState(false);
  const monthName = (m: number) =>
    new Intl.DateTimeFormat(format.locale, { month: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2000, m - 1, 1)),
    );
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      queryClient.setQueryData(
        ['geschaeftsjahr'],
        await saveFiscalYear(accessToken, { startMonth: month }),
      );
      void queryClient.invalidateQueries({ queryKey: ['wirkung-portfolio'] });
      void queryClient.invalidateQueries({ queryKey: ['bruecke'] });
      setStatus('saved');
    } catch {
      setStatus('failed');
    } finally {
      setSaving(false);
    }
  };
  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex max-w-md flex-col gap-6"
    >
      {status === 'saved' && <StatusLine message={text.saved} />}
      {status === 'failed' && <StatusLine message={text.saveFailed} tone="warning" />}
      <FormField label={text.startMonth}>
        {(field) => (
          <NativeSelect
            {...field}
            value={String(month)}
            onChange={(event) => setMonth(Number(event.target.value))}
          >
            {Array.from({ length: 12 }, (_, index) => index + 1).map((m) => (
              <option key={m} value={m}>
                {monthName(m)}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <Button className="self-start" type="submit" disabled={saving}>
        {t.settings.save}
      </Button>
    </form>
  );
}
