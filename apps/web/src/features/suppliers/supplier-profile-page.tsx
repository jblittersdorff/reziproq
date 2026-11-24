import type { SupplierDetail } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { ChartCard, ChartColumns } from '@/components/ui/chart-card';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { PageTitle } from '@/components/ui/page-title';
import { SettingsGroup, SettingsLinkRow, SettingsRow } from '@/components/ui/settings-group';
import { SoWhat, type SoWhatPoint } from '@/components/ui/so-what';
import { StatusLine } from '@/components/ui/status-line';
import { VisibilityBadge } from '@/components/ui/visibility-badge';
import { AuditHistory } from '@/features/audit/audit-history';
import { useCan } from '@/features/auth/use-permissions';
import { AssignmentSection } from '@/features/master-data/assignment';
import { routerLink } from '@/features/shell/navigation';
import { useDocumentTitle } from '@/features/shell/page-header';
import { supplierMessages } from '@/features/workspace/supplier-messages';
import { useOverview } from '@/features/workspace/use-overview';
import { endSupplier, spendOverviewQueryOptions, supplierContactsQueryOptions } from '@/lib/api';
import { useFlash } from '@/lib/flash';
import { useFormat } from '@/lib/format';
import { useLocale, useMessages, useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { ProfileFinanceSections } from './profile-finance';
import { SupplierFrame } from './supplier-frame';
import { useRefreshSupplier, useSupplier } from './use-supplier';

/**
 * Profil und Spend eines Lieferanten (NAV-10 1.1, Vorlage `L-Profil.dc.html`; PLT-03b): Titel mit
 * „nur eure Seite“, „Das Wichtigste“, Stammdaten, Kontakte und Spend je Jahr. Darunter, wie die
 * Specs es verlangen und die Vorlage nicht zeigt: eigene Werte, Zuordnung (PLT-06), Beziehung
 * beenden mit Bestätigung auf der Seite, Finanzen (SPL-05) und der Verlauf (PLT-08).
 */
export function SupplierProfilePage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const { accessToken } = useSupplier(relationshipId);
  const refresh = useRefreshSupplier();
  const [message, hideMessage] = useFlash();
  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);
  // Global darf die Person bearbeiten; ob an dieser Beziehung, sagt das Detail (Teamrolle).
  const mayEdit = useCan('lieferanten.bearbeiten');
  const text = useMessages(supplierMessages).profile;
  useDocumentTitle(text.title);

  const end = async () => {
    setFailed(false);
    try {
      await endSupplier(accessToken, relationshipId);
      refresh(relationshipId);
      setEnded(true);
    } catch {
      setFailed(true);
    }
  };

  return (
    <SupplierFrame relationshipId={relationshipId} area="strategy" current={text.title}>
      {(supplier) => {
        const statusLabel = {
          draft: t.suppliers.statusDraft,
          active: t.suppliers.statusActive,
          ended: t.suppliers.statusEnded,
        }[supplier.status];
        const base = `/lieferanten/${relationshipId}/strategie`;
        return (
          <>
            <PageTitle
              title={text.title}
              where={<VisibilityBadge visibility="internal" label={text.privateLabel} />}
              aside={
                supplier.permissions.edit &&
                routerLink({
                  href: `${base}/profil/bearbeiten`,
                  className: buttonVariants({ variant: 'secondary' }),
                  children: text.edit,
                })
              }
            />
            {message && <StatusLine message={message} onHidden={hideMessage} />}
            <ProfileTop relationshipId={relationshipId} supplier={supplier} />
            {ended && (
              <StatusLine message={t.suppliers.endedMessage} onHidden={() => setEnded(false)} />
            )}
            {failed && (
              <p role="alert" className="text-destructive">
                {t.suppliers.saveFailed}
              </p>
            )}

            <SettingsGroup title={t.suppliers.ownValues}>
              <SettingsRow label={t.suppliers.displayName}>
                <span className="text-base">{supplier.name}</span>
              </SettingsRow>
              <SettingsRow label={t.suppliers.externalRef}>
                <span className="text-base">{supplier.externalRef ?? '–'}</span>
              </SettingsRow>
              <SettingsRow label={t.suppliers.notes}>
                <span className="whitespace-pre-wrap text-base">{supplier.notes ?? '–'}</span>
              </SettingsRow>
              <SettingsRow label={t.suppliers.status}>
                <Badge variant={supplier.status === 'active' ? 'success' : 'neutral'}>
                  {statusLabel}
                </Badge>
              </SettingsRow>
              <SettingsLinkRow
                href={`/lieferanten/${relationshipId}/beziehung/team`}
                label={t.team.link}
                renderLink={routerLink}
              />
            </SettingsGroup>
            <p className="-mt-4 px-4 text-muted-foreground text-sm">{t.suppliers.ownValuesHint}</p>

            <AssignmentSection relationshipId={relationshipId} />

            {mayEdit && !supplier.permissions.edit && (
              <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
                {t.team.readOnly}
              </p>
            )}
            {/* Bearbeiten steht oben im Kopf („Profil bearbeiten“, Zweitknopf). */}
            {supplier.permissions.edit && (
              <div className="flex flex-wrap items-start gap-3">
                {supplier.status !== 'ended' && (
                  <ConfirmButton
                    question={t.suppliers.endQuestion}
                    confirmLabel={t.suppliers.endConfirm}
                    cancelLabel={t.suppliers.cancel}
                    onConfirm={() => void end()}
                  >
                    {t.suppliers.end}
                  </ConfirmButton>
                )}
              </div>
            )}

            <ProfileFinanceSections relationshipId={relationshipId} />

            <section aria-labelledby="lieferant-verlauf" className="flex flex-col gap-4">
              <h2 id="lieferant-verlauf" className="font-semibold text-lg">
                {t.suppliers.history}
              </h2>
              <AuditHistory
                objectType="relationship,relationship_side,relationship_spend,relationship_assignment,supplier_profile,supplier_executive,supplier_financial"
                objectId={relationshipId}
              />
            </section>
          </>
        );
      }}
    </SupplierFrame>
  );
}

/**
 * Oberer Teil nach Vorlage L-Profil: „Das Wichtigste“ aus Spend, Warengruppe und Feedback,
 * Stammdaten und Kontakte nebeneinander, darunter Spend je Jahr als Säulen.
 */
function ProfileTop({
  relationshipId,
  supplier,
}: {
  relationshipId: string;
  supplier: SupplierDetail;
}) {
  const t = useT();
  const messages = useMessages(supplierMessages);
  const text = messages.profile;
  const format = useFormat();
  const { locale } = useLocale();
  const { accessToken } = useSupplier(relationshipId);
  const enabled = accessToken !== '';
  const spend = useQuery({ ...spendOverviewQueryOptions(accessToken, relationshipId), enabled });
  const contacts = useQuery({
    ...supplierContactsQueryOptions(accessToken, relationshipId),
    enabled,
  });
  const overview = useOverview(relationshipId);
  const base = `/lieferanten/${relationshipId}`;
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const signed = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
    signDisplay: 'exceptZero',
  });
  const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const figures = overview.data?.figures;
  const kpis = spend.data?.kpis ?? null;
  const actual = (spend.data?.years ?? []).filter((year) => year.kind === 'actual').slice(-4);
  const currency = spend.data?.currency ?? 'EUR';
  const max = Math.max(1, ...actual.map((year) => year.amountCents));
  const money = (cents: number) =>
    formatMoney({ amountCents: cents, currency }, locale, { compact: true });
  // Jahre in Folge mit Wachstum, vom jüngsten Jahr zurück
  let growing = 0;
  for (let index = actual.length - 1; index > 0; index -= 1) {
    const year = actual[index];
    const before = actual[index - 1];
    if (!year || !before || year.year !== before.year + 1 || year.amountCents <= before.amountCents)
      break;
    growing += 1;
  }
  const share = figures?.groupShare
    ? `${percent.format(figures.groupShare.basisPoints / 10_000)} ${messages.figures.share(figures.groupShare.group)}`
    : null;
  const points: SoWhatPoint[] = [];
  if (kpis?.changeBasisPoints !== null && kpis?.changeBasisPoints !== undefined) {
    points.push({
      key: 'spend',
      status: kpis.changeBasisPoints >= 0 ? text.good : text.info,
      tone: kpis.changeBasisPoints >= 0 ? 'success' : 'neutral',
      text: text.spendPoint(signed.format(kpis.changeBasisPoints / 10_000), share),
      href: `${base}/strategie/warengruppen`,
    });
  }
  if (figures?.feedbackGap) {
    points.push({
      key: 'gap',
      status: text.gap,
      tone: Math.abs(figures.feedbackGap.delta) >= 0.5 ? 'danger' : 'warning',
      text: text.gapPoint(
        t.settings.survey.dimensions[figures.feedbackGap.dimension] ??
          figures.feedbackGap.dimension,
        decimal.format(Math.abs(figures.feedbackGap.delta)),
      ),
      href: `${base}/beziehung/feedback`,
    });
  }
  points.push({
    key: 'info',
    status: text.info,
    tone: 'neutral',
    text: text.infoPoint(supplier.externalRef, format.date(supplier.createdAt)),
  });
  const statement =
    growing >= 2
      ? text.growing(supplier.name, growing)
      : kpis
        ? text.spendOf(supplier.name, money(kpis.amount.amountCents), kpis.year)
        : text.noSpend(supplier.name);
  const groups = supplier.materialGroups ?? [];
  const rows: [string, string][] = [
    [t.suppliers.name, supplier.organizationName],
    [t.suppliers.country, format.country(supplier.country)],
    [t.suppliers.vatId, supplier.vatId ?? '–'],
    [t.suppliers.duns, supplier.duns ?? '–'],
    [
      text.groups,
      groups.length > 0
        ? groups
            .map((group, index) => (index === 0 ? `${group} (${text.primary})` : group))
            .join(' · ')
        : '–',
    ],
    [t.suppliers.externalRef, supplier.externalRef ?? '–'],
    [text.since, format.date(supplier.createdAt)],
    ...(supplier.endedAt
      ? [[t.suppliers.endedAt, format.date(supplier.endedAt)] as [string, string]]
      : []),
  ];

  return (
    <>
      <SoWhat
        heading={text.summaryLabel}
        statement={statement}
        points={points.slice(0, 3)}
        renderLink={routerLink}
      />
      <div className="grid gap-5.5 wide:grid-cols-2">
        <section
          aria-labelledby="stammdaten"
          className="flex min-w-0 flex-col gap-3.5 rounded-lg bg-card px-5.5 py-5"
        >
          <h2 id="stammdaten" className="font-display font-semibold text-lg tracking-section">
            {text.masterData}
          </h2>
          <dl className="flex flex-col divide-y divide-row-line">
            {rows.map(([label, value]) => (
              <div
                key={label}
                className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 py-2.5"
              >
                <dt className="text-detail text-input-border">{label}</dt>
                <dd className="min-w-0 text-base [overflow-wrap:anywhere]">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-chip text-input-border">{t.suppliers.masterDataHint}</p>
        </section>
        <section
          aria-labelledby="kontakte"
          className="flex min-w-0 flex-col gap-3.5 rounded-lg bg-card px-5.5 py-5"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="kontakte" className="font-display font-semibold text-lg tracking-section">
              {text.contacts}
            </h2>
            {routerLink({
              href: '/lieferanten/importieren',
              className:
                'inline-flex min-h-11 items-center font-semibold text-detail text-petrol no-underline hover:text-petrol-dark',
              children: text.import,
            })}
          </div>
          {(contacts.data ?? []).length === 0 ? (
            <p className="text-muted-foreground">{contacts.data ? text.contactsEmpty : ''}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-row-line">
              {(contacts.data ?? []).slice(0, 6).map((contact) => (
                <li
                  key={contact.id}
                  className="flex min-h-14 items-center justify-between gap-3 py-2"
                >
                  <span className="flex min-w-0 flex-col">
                    <b className="truncate font-semibold text-ink text-row">{contact.name}</b>
                    <span className="truncate text-detail text-input-border">
                      {[contact.position, contact.email].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {contact.function && <Badge variant="neutral">{contact.function}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <ChartCard
        label={text.spend}
        title={
          kpis ? `${money(kpis.amount.amountCents)} · ${kpis.year}` : text.noSpend(supplier.name)
        }
        source={text.spendSource(share)}
        link={{ label: text.allEntries, href: `${base}/strategie/spend` }}
        renderLink={routerLink}
      >
        {actual.length > 0 && (
          <ChartColumns
            label={text.spendColumns}
            items={actual.map((year) => ({
              key: String(year.year),
              label: String(year.year),
              value: money(year.amountCents),
              share: year.amountCents / max,
            }))}
          />
        )}
        {supplier.permissions.edit &&
          routerLink({
            href: `${base}/strategie/spend/neu`,
            className: buttonVariants({ variant: 'secondary', className: 'self-start' }),
            children: text.addYear,
          })}
      </ChartCard>
    </>
  );
}
