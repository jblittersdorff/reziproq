import { displayNameOf } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import { buttonVariants } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Monogram } from '@/components/ui/monogram';
import { Row, RowGroup } from '@/components/ui/row-group';
import { SoWhat, type SoWhatPoint } from '@/components/ui/so-what';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { useSupplier } from '@/features/suppliers/use-supplier';
import { supplierMessages } from '@/features/workspace/supplier-messages';
import { useOverview } from '@/features/workspace/use-overview';
import {
  akteHeadQueryOptions,
  assignmentQueryOptions,
  relationshipsQueryOptions,
  spendOverviewQueryOptions,
  supplierContactsQueryOptions,
  teamQueryOptions,
  touchpointsQueryOptions,
} from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useLocale, useMessages, useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { CounterpartPeopleRows } from './akte-counterpart-view';
import { unpairedContacts } from './akte-private';
import { growingSince, spendRank } from './akte-profile';
import { AkteSheet } from './akte-sheet';
import { akteSheetMessages } from './akte-sheet-messages';
import { oldPage } from './akte-view';

/**
 * Blatt Profil (AK-01, K2-c.5, Vorlage K2-Profil): Das Wichtigste aus Spend, Rang, Feedback und
 * Beziehungsnetz, Stammdaten aus dem Import, Spend je Jahr, Kontakte und das Team beider Seiten mit
 * Einladungsstand. Bearbeiten und Import führen bis zu ihren Paketen auf die bisherigen Seiten.
 */
export function ProfileSheet({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const text = useMessages(akteSheetMessages);
  const profile = text.profile;
  const legacy = useMessages(supplierMessages).profile;
  const accessToken = useToken();
  const enabled = accessToken !== '';
  const supplier = useSupplier(relationshipId);
  const head = useQuery({ ...akteHeadQueryOptions(accessToken, relationshipId), enabled });
  const assignment = useQuery({ ...assignmentQueryOptions(accessToken, relationshipId), enabled });
  const contacts = useQuery({
    ...supplierContactsQueryOptions(accessToken, relationshipId),
    enabled,
  });
  const format = useFormat();
  const data = supplier.data;
  const name = head.data ? displayNameOf(head.data.name).name : (data?.name ?? '');
  const groups = assignment.data
    ? [...assignment.data.materialGroups]
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
        .map((group, index) =>
          index === 0 && group.isPrimary ? `${group.name} (${legacy.primary})` : group.name,
        )
    : (data?.materialGroups ?? []);
  const units = assignment.data?.businessUnits.map((unit) => unit.name) ?? [];
  const list = contacts.data ?? [];

  return (
    <AkteSheet
      relationshipId={relationshipId}
      title={profile.title}
      subtitle={data ? profile.subtitle(data.organizationName) : undefined}
    >
      {supplier.isError ? (
        <ErrorState title={text.failed} />
      ) : !data ? (
        <LoadingState label={text.loading} />
      ) : (
        <div className="flex flex-col gap-5.5">
          <Summary relationshipId={relationshipId} name={name} />
          <RowGroup id="stammdaten" label={profile.masterData}>
            <Row
              title={data.organizationName}
              detail={[
                data.country ? format.country(data.country) : null,
                data.vatId ? profile.vat(data.vatId) : null,
                data.duns ? profile.duns(data.duns) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              wrap
            />
            {groups.length > 0 && <Row title={profile.groups} detail={groups.join(' · ')} wrap />}
            {units.length > 0 && <Row title={profile.units} detail={units.join(' · ')} wrap />}
            <Row
              title={profile.externalRef(data.externalRef)}
              detail={profile.since(format.date(data.createdAt))}
              wrap
            />
          </RowGroup>
          <SpendYears relationshipId={relationshipId} />
          <RowGroup id="kontakte" label={profile.contacts(name, list.length)}>
            {contacts.isError ? (
              <Row title={text.failed} />
            ) : !contacts.data ? (
              <Row title={text.loading} />
            ) : list.length === 0 ? (
              <Row title={profile.noContacts} detail={profile.noContactsText} wrap />
            ) : (
              list.map((contact) => (
                <Row
                  key={contact.id}
                  lead={<Monogram name={contact.name} tone="petrol" />}
                  title={contact.name}
                  detail={[contact.position ?? contact.function, contact.email]
                    .filter(Boolean)
                    .join(' · ')}
                  wrap
                />
              ))
            )}
          </RowGroup>
          <RowGroup id="team" label={profile.team}>
            <OwnTeam relationshipId={relationshipId} />
            <CounterpartPeopleRows relationshipId={relationshipId} name={name} />
          </RowGroup>
          <div className="flex flex-wrap gap-2">
            {data.permissions.edit &&
              routerLink({
                href: oldPage(relationshipId, '/strategie/profil/bearbeiten'),
                className: buttonVariants({ variant: 'secondary' }),
                children: profile.edit,
              })}
            {routerLink({
              href: '/lieferanten/importieren',
              className: buttonVariants({ variant: 'secondary' }),
              children: profile.import,
            })}
          </div>
          <p className="text-muted-foreground text-sm">{t.suppliers.masterDataHint}</p>
        </div>
      )}
    </AkteSheet>
  );
}

/** Das Wichtigste: Wachstum und Rang nach Spend, dazu Spend zum Vorjahr, Feedback und Draht (G-6) */
function Summary({ relationshipId, name }: { relationshipId: string; name: string }) {
  const t = useT();
  const text = useMessages(akteSheetMessages).profile;
  const messages = useMessages(supplierMessages);
  const legacy = messages.profile;
  const { locale } = useLocale();
  const accessToken = useToken();
  const enabled = accessToken !== '';
  const spend = useQuery({ ...spendOverviewQueryOptions(accessToken, relationshipId), enabled });
  const list = useQuery({ ...relationshipsQueryOptions(accessToken), enabled });
  const network = useQuery({
    ...touchpointsQueryOptions(accessToken, relationshipId, 'buyer'),
    enabled,
  });
  const overview = useOverview(relationshipId);
  const kpis = spend.data?.kpis ?? null;
  const currency = spend.data?.currency ?? 'EUR';
  const money = (cents: number) =>
    formatMoney({ amountCents: cents, currency }, locale, { compact: true });
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const signed = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
    signDisplay: 'exceptZero',
  });
  const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const rank = list.data ? spendRank(list.data.rows, relationshipId) : null;
  const since = spend.data ? growingSince(spend.data.years) : null;
  const statement =
    kpis && rank
      ? text.statement(name, since, money(kpis.amount.amountCents), rank)
      : kpis
        ? legacy.spendOf(name, money(kpis.amount.amountCents), kpis.year)
        : legacy.noSpend(name);
  const figures = overview.data?.figures;
  const share = figures?.groupShare
    ? `${percent.format(figures.groupShare.basisPoints / 10_000)} ${messages.figures.share(figures.groupShare.group)}`
    : null;
  const points: SoWhatPoint[] = [];
  if (kpis?.changeBasisPoints !== null && kpis?.changeBasisPoints !== undefined) {
    points.push({
      key: 'spend',
      status: kpis.changeBasisPoints >= 0 ? legacy.good : legacy.info,
      tone: kpis.changeBasisPoints >= 0 ? 'success' : 'neutral',
      text: legacy.spendPoint(signed.format(kpis.changeBasisPoints / 10_000), share),
    });
  }
  if (figures?.feedbackGap) {
    points.push({
      key: 'feedback',
      status: legacy.gap,
      tone: Math.abs(figures.feedbackGap.delta) >= 0.5 ? 'danger' : 'warning',
      text: legacy.gapPoint(
        t.settings.survey.dimensions[figures.feedbackGap.dimension] ??
          figures.feedbackGap.dimension,
        decimal.format(Math.abs(figures.feedbackGap.delta)),
      ),
    });
  }
  const unpaired = network.data ? unpairedContacts(network.data) : [];
  if (unpaired.length > 0) {
    points.push({
      key: 'draht',
      status: legacy.gap,
      tone: 'warning',
      text: text.noWire(unpaired.slice(0, 2)),
      href: `/beziehungen/${relationshipId}?sicht=privat#netz`,
    });
  }
  return (
    <SoWhat
      heading={text.heading}
      statement={statement}
      points={points.slice(0, 3)}
      renderLink={routerLink}
    />
  );
}

/** Spend je Jahr: die letzten vier Ist-Jahre, ältestes zuerst (Vorlage K2-Profil) */
function SpendYears({ relationshipId }: { relationshipId: string }) {
  const all = useMessages(akteSheetMessages);
  const text = all.profile;
  const { locale } = useLocale();
  const accessToken = useToken();
  const spend = useQuery({
    ...spendOverviewQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
  const currency = spend.data?.currency ?? 'EUR';
  const years = (spend.data?.years ?? [])
    .filter((entry) => entry.kind === 'actual')
    .sort((a, b) => a.year - b.year)
    .slice(-4);
  return (
    <RowGroup id="spend" label={text.spend}>
      {spend.isError ? (
        <Row title={all.failed} />
      ) : !spend.data ? (
        <Row title={all.loading} />
      ) : years.length === 0 ? (
        <Row title={text.noSpend} />
      ) : (
        years.map((entry) => (
          <Row
            key={entry.year}
            title={String(entry.year)}
            value={formatMoney({ amountCents: entry.amountCents, currency }, locale, {
              compact: true,
            })}
          />
        ))
      )}
    </RowGroup>
  );
}

/** Euer Team: Personen mit Rolle in Klammern, Rollen sieht nur die eigene Seite */
function OwnTeam({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const all = useMessages(akteSheetMessages);
  const text = all.profile;
  const accessToken = useToken();
  const team = useQuery({
    ...teamQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
  if (team.isError) return <Row title={all.failed} />;
  if (!team.data) return <Row title={all.loading} />;
  const members = team.data.members;
  const names = members
    .map((member) =>
      member.teamRole === 'member'
        ? member.name
        : `${member.name} (${t.team.roles[member.teamRole] ?? member.teamRole})`,
    )
    .join(', ');
  return (
    <Row
      href={oldPage(relationshipId, '/beziehung/team')}
      title={text.ownTeam(members.length)}
      detail={text.ownTeamDetail(names)}
      wrap
      renderLink={routerLink}
    />
  );
}
