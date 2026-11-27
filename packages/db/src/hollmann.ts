import { inArray, sql } from 'drizzle-orm';
import type { Database } from './client.js';
import { seedAkte, seedAktePrivate, seedAkteRules } from './hollmann-akte.js';
import { seedMorning } from './hollmann-morgen.js';
import { seedPortfolio } from './hollmann-portfolio.js';
import { seedCommitments } from './hollmann-zusagen.js';
import {
  appUser,
  materialGroup,
  materialGroupMember,
  meeting,
  organization,
  organizationFeature,
  orgSetting,
  relationship,
  relationshipMaterialGroup,
  relationshipMember,
  relationshipSide,
  relationshipSpend,
  supplierContact,
  supplierDomain,
} from './schema/index.js';

// DM-01, E-K0-04, G-10 (K1-b.3): der Demo-Mandant Hollmann Antriebe. Ein eigener Mandant neben den
// Test-Mandanten der automatischen Tests, nur synthetische Personen und Zahlen. Die Zahlen folgen den
// Bildvorlagen (Beziehungen: 16 Beziehungen, 30,1 Mio. € Spend 2026, Rheintal 4,2 Mio. €), damit
// Board und App dasselbe zeigen. Feste IDs und Upserts: pnpm demo:hollmann darf beliebig oft laufen.
// Den Stand der Drehbücher (Erledigt, Kurz prüfen, Mappen, Signale) legt die Demo-Regie an (K1-g).

/** Feste IDs im eigenen Bereich, getrennt von den Test-Mandanten (de300000-…) */
const nid = (n: number) => `4e0a0000-0000-7000-8000-${String(n).padStart(12, '0')}`;

/**
 * Sperre für Tests, die Hollmann in die gemeinsame Testdatenbank spielen (API und E2E): feste IDs,
 * also immer nur eine Datei zur Zeit (pg_advisory_lock mit diesem Schlüssel)
 */
export const hollmannLockKey = 41_011_123;

/** DM-01: Start jeder Vorführung, Mo 23.11.2026, 07:30 in Berlin */
export const hollmannStart = new Date('2026-11-23T06:30:00.000Z');
const actor = 'system:hollmann';

export const hollmann = {
  org: { id: nid(1), name: 'Hollmann Antriebe', country: 'DE' },
  halder: { id: nid(2), name: 'Halder Maschinenbau', country: 'DE' },
} as const;

type Role = 'admin' | 'member' | 'viewer';
interface Person {
  id: string;
  name: string;
  givenName: string;
  email: string;
  orgId: string;
  orgRole: Role;
}
const person = (
  slug: string,
  name: string,
  givenName: string,
  domain: string,
  orgId: string,
  orgRole: Role = 'member',
): Person => ({
  id: `${domain.split('.')[0]}-${slug}`,
  name,
  givenName,
  email: `${slug}@${domain}`,
  orgId,
  orgRole,
});

/** Personen von Hollmann (DM-01); IDs lesbar, z. B. /demo/als/hollmann-jan-luka */
export const hollmannPeople = {
  janLuka: person(
    'jan-luka',
    'Jan-Luka von Blittersdorff',
    'Jan-Luka',
    'hollmann.example',
    hollmann.org.id,
  ),
  saraOst: person('sara-ost', 'Sara Ost', 'Sara', 'hollmann.example', hollmann.org.id, 'admin'),
  maraWeiss: person('mara-weiss', 'Mara Weiß', 'Mara', 'hollmann.example', hollmann.org.id),
  jonasFeld: person('jonas-feld', 'Jonas Feld', 'Jonas', 'hollmann.example', hollmann.org.id),
  idaRoth: person('ida-roth', 'Ida Roth', 'Ida', 'hollmann.example', hollmann.org.id),
  tomBerg: person('tom-berg', 'Tom Berg', 'Tom', 'hollmann.example', hollmann.org.id),
  paulHahn: person('paul-hahn', 'Paul Hahn', 'Paul', 'hollmann.example', hollmann.org.id),
  maxKlein: person('max-klein', 'Max Klein', 'Max', 'hollmann.example', hollmann.org.id),
} as const;

const groups = {
  lp: { id: nid(101), code: 'LP', name: 'Leiterplatten', lead: hollmannPeople.saraOst.id },
  gu: { id: nid(102), code: 'GU', name: 'Guss', lead: hollmannPeople.paulHahn.id },
  dt: { id: nid(103), code: 'DT', name: 'Drehteile', lead: hollmannPeople.tomBerg.id },
  el: { id: nid(104), code: 'EL', name: 'Elektronik', lead: hollmannPeople.tomBerg.id },
  ku: { id: nid(105), code: 'KU', name: 'Kunststoff', lead: hollmannPeople.maxKlein.id },
  se: { id: nid(106), code: 'SE', name: 'Sensorik', lead: hollmannPeople.tomBerg.id },
  lo: { id: nid(107), code: 'LO', name: 'Logistik', lead: hollmannPeople.maxKlein.id },
  vp: { id: nid(108), code: 'VP', name: 'Verpackung', lead: hollmannPeople.maxKlein.id },
  ka: { id: nid(109), code: 'KA', name: 'Kabel', lead: hollmannPeople.tomBerg.id },
} as const;
type GroupKey = keyof typeof groups;

interface Supplier {
  key: string;
  id: string;
  relationshipId: string;
  name: string;
  country: string;
  group: GroupKey;
  /** Spend 2026 in Cent (Vorlage Beziehungen) */
  spend2026: number;
  sro: string;
  externalRef: string;
}
const mio = (value: number) => Math.round(value * 100_000_000);
const supplier = (
  n: number,
  key: string,
  name: string,
  country: string,
  group: GroupKey,
  spend: number,
  sro: Person,
): Supplier => ({
  key,
  id: nid(200 + n),
  relationshipId: nid(300 + n),
  name,
  country,
  group,
  spend2026: mio(spend),
  sro: sro.id,
  externalRef: `L-${String(70000 + n * 7)}`,
});

const { janLuka, tomBerg, paulHahn, maxKlein } = hollmannPeople;

/**
 * Die 16 Beziehungen von Hollmann. Acht stehen in der Vorlage Beziehungen mit Warengruppe, Land und
 * Spend; die übrigen acht zusammen mit 7,3 Mio. € (Nordwerk Guss, Baltic Logistics, Hanse Verpackung
 * „und 5 weitere“, aus DM-01 ergänzt). Jan-Luka ist SRO von sechs („Meine · 6“).
 */
export const hollmannSuppliers: readonly Supplier[] = [
  supplier(1, 'rheintal', 'Rheintal Elektronik', 'DE', 'lp', 4.2, janLuka),
  supplier(2, 'silesia', 'Silesia Guss', 'PL', 'gu', 3.15, janLuka),
  supplier(3, 'kessler', 'Kessler Präzision', 'DE', 'dt', 1.6, janLuka),
  supplier(4, 'pearlRiver', 'Pearl River Components', 'CN', 'el', 5.64, tomBerg),
  supplier(5, 'alpenKunststoff', 'Alpen Kunststofftechnik', 'AT', 'ku', 1.3, janLuka),
  supplier(6, 'lombardia', 'Lombardia Fonderie', 'IT', 'gu', 2.71, paulHahn),
  supplier(7, 'alpenSensorik', 'Alpen Sensorik', 'AT', 'se', 2.26, tomBerg),
  supplier(8, 'moravia', 'Moravia Plast', 'CZ', 'ku', 1.94, janLuka),
  supplier(9, 'nordwerk', 'Nordwerk Guss', 'DE', 'gu', 1.6, janLuka),
  supplier(10, 'baltic', 'Baltic Logistics', 'LT', 'lo', 1.1, maxKlein),
  supplier(11, 'hanse', 'Hanse Verpackung', 'DE', 'vp', 0.6, maxKlein),
  supplier(12, 'saar', 'Saar Circuits', 'DE', 'lp', 1.4, paulHahn),
  supplier(13, 'donau', 'Donau Print', 'DE', 'lp', 0.5, paulHahn),
  supplier(14, 'moldau', 'Moldau PCB', 'CZ', 'lp', 0.9, paulHahn),
  supplier(15, 'weser', 'Weser PCB', 'DE', 'lp', 0.7, paulHahn),
  supplier(16, 'elbe', 'Elbe Kabelwerk', 'DE', 'ka', 0.5, tomBerg),
];

const byKey = (key: string) => {
  const found = hollmannSuppliers.find((entry) => entry.key === key);
  if (!found) throw new Error(`Lieferant ${key} fehlt`);
  return found;
};
const rheintal = byKey('rheintal');
const saar = byKey('saar');

/** Ansprechpartner der Lieferanten (DM-01); Rheintal hat fünf, Saar Circuits einen Key Account */
export const supplierPeople = {
  kimKaiser: person('kim-kaiser', 'Kim Kaiser', 'Kim', 'rheintal.example', rheintal.id, 'admin'),
  tomWeber: person('tom-weber', 'Tom Weber', 'Tom', 'rheintal.example', rheintal.id),
  leaBrandt: person('lea-brandt', 'Lea Brandt', 'Lea', 'rheintal.example', rheintal.id),
  miaKuhn: person('mia-kuhn', 'Mia Kuhn', 'Mia', 'rheintal.example', rheintal.id),
  nilsOtt: person('nils-ott', 'Nils Ott', 'Nils', 'rheintal.example', rheintal.id),
  lenaSchuster: person('lena-schuster', 'Lena Schuster', 'Lena', 'saar.example', saar.id, 'admin'),
  henrikLang: person(
    'henrik-lang',
    'Henrik Lang',
    'Henrik',
    'halder.example',
    hollmann.halder.id,
    'admin',
  ),
} as const;

/** Halder Maschinenbau: zweiter Kunde von Rheintal in Reziproq, eigene Akte, kein Querfluss */
const halderRelationshipId = nid(399);

const meetings = [
  {
    id: nid(501),
    relationshipId: rheintal.relationshipId,
    type: 'jbp' as const,
    title: 'JBP Rheintal 2027',
    // Fr 04.12.2026, 10:00 bis 12:00 in Berlin (Drehbuch K3: Präsentation 10:30, Ende 12:05)
    startsAt: new Date('2026-12-04T09:00:00.000Z'),
    durationMinutes: 120,
    location: 'Hollmann, Werk Mannheim',
    visibility: 'shared' as const,
  },
  {
    id: nid(502),
    relationshipId: rheintal.relationshipId,
    type: 'other' as const,
    title: 'Abstimmung Musterteile Starrflex',
    startsAt: new Date('2026-11-23T13:00:00.000Z'),
    durationMinutes: 30,
    location: null,
    visibility: 'shared' as const,
  },
  {
    id: nid(503),
    relationshipId: byKey('silesia').relationshipId,
    type: 'escalation' as const,
    title: 'Lieferverzug Gussteile',
    startsAt: new Date('2026-11-25T09:00:00.000Z'),
    durationMinutes: 45,
    location: null,
    visibility: 'shared' as const,
  },
  {
    id: nid(504),
    relationshipId: byKey('kessler').relationshipId,
    type: 'quarterly_review' as const,
    title: 'Quartalsgespräch Kessler',
    startsAt: new Date('2026-11-26T08:00:00.000Z'),
    durationMinutes: 60,
    location: null,
    visibility: 'shared' as const,
  },
];

export interface HollmannResult {
  organizations: number;
  people: number;
  relationships: number;
  spend2026Cents: number;
}

/** pnpm demo:hollmann: legt den Demo-Mandanten an oder bringt ihn auf den Stand des Seeds. */
export async function seedHollmann(
  db: Database,
  { nodeEnv }: { nodeEnv: string | undefined },
): Promise<HollmannResult> {
  if (nodeEnv === 'production') {
    throw new Error(
      'demo:hollmann ist nur für Vorführungen und bricht bei NODE_ENV=production ab.',
    );
  }
  return db.transaction(async (tx) => {
    // K1-g.1: Erst alles der Demo leeren (auch, was in Vorführungen entstanden ist), dann frisch
    // einspielen; zum Schluss hält „start“ genau diesen Stand fest, den das Zurücksetzen lädt.
    await tx.execute(sql`select app_demo_leeren(${hollmann.org.id}::uuid)`);
    const supplierOrgs = hollmannSuppliers.map(({ id, name, country }) => ({
      id,
      name,
      country,
    }));
    const orgs = [hollmann.org, hollmann.halder, ...supplierOrgs].map((org) => ({
      ...org,
      isDemo: true,
      demoNow: hollmannStart,
    }));
    await tx
      .insert(organization)
      .values(orgs.map((org) => ({ ...org, aiMode: 'replay' as const })))
      .onConflictDoUpdate({
        target: organization.id,
        set: {
          name: sql`excluded.name`,
          country: sql`excluded.country`,
          isDemo: true,
          demoNow: hollmannStart,
        },
      });
    await tx
      .insert(organizationFeature)
      .values([
        { organizationId: hollmann.org.id, feature: 'buyer' as const },
        { organizationId: hollmann.halder.id, feature: 'buyer' as const },
      ])
      .onConflictDoNothing();

    const people = [...Object.values(hollmannPeople), ...Object.values(supplierPeople)];
    await tx
      .insert(appUser)
      .values(
        people.map((entry) => ({
          id: entry.id,
          name: entry.name,
          givenName: entry.givenName,
          email: entry.email,
          organizationId: entry.orgId,
          orgRole: entry.orgRole,
          rolesImportedAt: hollmannStart,
        })),
      )
      .onConflictDoUpdate({
        target: appUser.id,
        set: {
          name: sql`excluded.name`,
          givenName: sql`excluded.given_name`,
          email: sql`excluded.email`,
          organizationId: sql`excluded.organization_id`,
          orgRole: sql`excluded.org_role`,
        },
      });

    const relationships = [
      ...hollmannSuppliers.map((entry) => ({
        id: entry.relationshipId,
        buyerOrgId: hollmann.org.id,
        supplierOrgId: entry.id,
      })),
      { id: halderRelationshipId, buyerOrgId: hollmann.halder.id, supplierOrgId: rheintal.id },
    ];
    await tx
      .insert(relationship)
      .values(relationships.map((entry) => ({ ...entry, status: 'active' as const })))
      .onConflictDoUpdate({ target: relationship.id, set: { status: sql`excluded.status` } });
    await tx
      .insert(relationshipSide)
      .values(
        hollmannSuppliers.map((entry) => ({
          relationshipId: entry.relationshipId,
          orgId: hollmann.org.id,
          externalRef: entry.externalRef,
        })),
      )
      .onConflictDoUpdate({
        target: [relationshipSide.relationshipId, relationshipSide.orgId],
        set: { externalRef: sql`excluded.external_ref` },
      });

    // Spend 2026 wie in der Vorlage, 2025 etwas darunter (Jahresvergleich)
    await tx
      .insert(relationshipSpend)
      .values(
        hollmannSuppliers.flatMap((entry, index) =>
          [
            { year: 2026, amountCents: entry.spend2026 },
            {
              year: 2025,
              amountCents: Math.round((entry.spend2026 * (90 + (index % 7))) / 100),
            },
          ].map((value) => ({
            ...value,
            relationshipId: entry.relationshipId,
            currency: 'EUR',
            source: 'seed' as const,
          })),
        ),
      )
      .onConflictDoUpdate({
        target: [
          relationshipSpend.relationshipId,
          relationshipSpend.year,
          relationshipSpend.kind,
          relationshipSpend.businessUnitId,
          relationshipSpend.materialGroupId,
        ],
        set: { amountCents: sql`excluded.amount_cents`, source: sql`excluded.source` },
      });

    // Teams neu setzen: SRO je Beziehung, Sponsorin Mara Weiß bei den strategischen, Ida Roth
    // (Qualität) und Jonas Feld (Leiterplatten) als Mitglieder; beim Lieferanten Rheintal und Saar.
    const relationshipIds = relationships.map((entry) => entry.id);
    await tx
      .delete(relationshipMember)
      .where(inArray(relationshipMember.relationshipId, relationshipIds));
    const hollmannTeam = hollmannSuppliers.flatMap((entry) => [
      {
        relationshipId: entry.relationshipId,
        orgId: hollmann.org.id,
        userId: entry.sro,
        teamRole: 'sro' as const,
      },
      ...(['rheintal', 'silesia'].includes(entry.key)
        ? [
            {
              relationshipId: entry.relationshipId,
              orgId: hollmann.org.id,
              userId: hollmannPeople.maraWeiss.id,
              teamRole: 'sponsor' as const,
            },
          ]
        : []),
      ...(['rheintal', 'silesia', 'kessler'].includes(entry.key)
        ? [
            {
              relationshipId: entry.relationshipId,
              orgId: hollmann.org.id,
              userId: hollmannPeople.idaRoth.id,
              teamRole: 'member' as const,
            },
          ]
        : []),
      ...(entry.group === 'lp'
        ? [
            {
              relationshipId: entry.relationshipId,
              orgId: hollmann.org.id,
              userId: hollmannPeople.jonasFeld.id,
              teamRole: 'member' as const,
            },
          ]
        : []),
    ]);
    const supplierTeam = [
      {
        relationshipId: rheintal.relationshipId,
        orgId: rheintal.id,
        userId: supplierPeople.kimKaiser.id,
        teamRole: 'sponsor' as const,
        // K2-c.2: Kim Kaiser ist für Hollmann sichtbar („Team beider Seiten“, Vorlage L-Ueberblick)
        visibility: 'shared' as const,
        memberName: supplierPeople.kimKaiser.name,
      },
      {
        relationshipId: rheintal.relationshipId,
        orgId: rheintal.id,
        userId: supplierPeople.tomWeber.id,
        teamRole: 'sro' as const,
      },
      {
        relationshipId: rheintal.relationshipId,
        orgId: rheintal.id,
        userId: supplierPeople.leaBrandt.id,
        teamRole: 'member' as const,
      },
      {
        relationshipId: rheintal.relationshipId,
        orgId: rheintal.id,
        userId: supplierPeople.miaKuhn.id,
        teamRole: 'member' as const,
      },
      {
        relationshipId: rheintal.relationshipId,
        orgId: rheintal.id,
        userId: supplierPeople.nilsOtt.id,
        teamRole: 'member' as const,
      },
      {
        relationshipId: saar.relationshipId,
        orgId: saar.id,
        userId: supplierPeople.lenaSchuster.id,
        teamRole: 'sro' as const,
      },
      {
        relationshipId: halderRelationshipId,
        orgId: hollmann.halder.id,
        userId: supplierPeople.henrikLang.id,
        teamRole: 'sro' as const,
      },
      {
        relationshipId: halderRelationshipId,
        orgId: rheintal.id,
        userId: supplierPeople.tomWeber.id,
        teamRole: 'sro' as const,
      },
    ];
    await tx.insert(relationshipMember).values([...hollmannTeam, ...supplierTeam]);

    // Warengruppen als Kerndaten je Lieferant (CLAUDE.md); Strategien kommen erst mit K6 (G-9)
    await tx
      .insert(materialGroup)
      .values(
        Object.values(groups).map((group) => ({
          id: group.id,
          orgId: hollmann.org.id,
          name: group.name,
          code: group.code,
          leadUserId: group.lead,
          ...(group.code === 'LP' ? { commodityManagerUserId: hollmannPeople.jonasFeld.id } : {}),
        })),
      )
      .onConflictDoUpdate({
        target: materialGroup.id,
        set: {
          name: sql`excluded.name`,
          leadUserId: sql`excluded.lead_user_id`,
          commodityManagerUserId: sql`excluded.commodity_manager_user_id`,
        },
      });
    await tx.delete(materialGroupMember).where(
      inArray(
        materialGroupMember.materialGroupId,
        Object.values(groups).map((group) => group.id),
      ),
    );
    await tx.insert(materialGroupMember).values([
      ...Object.values(groups).map((group, index) => ({
        id: nid(150 + index),
        orgId: hollmann.org.id,
        materialGroupId: group.id,
        userId: group.lead,
        role: 'lead' as const,
      })),
      {
        id: nid(170),
        orgId: hollmann.org.id,
        materialGroupId: groups.lp.id,
        userId: hollmannPeople.jonasFeld.id,
        role: 'commodity_manager' as const,
      },
      {
        id: nid(171),
        orgId: hollmann.org.id,
        materialGroupId: groups.lp.id,
        userId: janLuka.id,
        role: 'buyer' as const,
      },
    ]);
    await tx
      .insert(relationshipMaterialGroup)
      .values(
        hollmannSuppliers.map((entry, index) => ({
          id: nid(400 + index),
          relationshipId: entry.relationshipId,
          materialGroupId: groups[entry.group].id,
          isPrimary: true,
        })),
      )
      .onConflictDoUpdate({
        target: relationshipMaterialGroup.id,
        set: { materialGroupId: sql`excluded.material_group_id`, isPrimary: true },
      });

    // Termine der Woche und der JBP Rheintal (Drehbuch K1 und K3)
    await tx
      .insert(meeting)
      .values(
        meetings.map((entry) => ({
          ...entry,
          ownerOrgId: hollmann.org.id,
          status: 'planned' as const,
          createdBy: janLuka.id,
          createdByName: janLuka.name,
          createdAt: hollmannStart,
        })),
      )
      .onConflictDoUpdate({
        target: meeting.id,
        set: {
          title: sql`excluded.title`,
          startsAt: sql`excluded.starts_at`,
          durationMinutes: sql`excluded.duration_minutes`,
          status: sql`excluded.status`,
        },
      });

    // Im Demo eingeschaltet (DM-01): Termin-Briefing (KI-07), Transkripte mit Betriebsvereinbarung
    const settings = [
      { key: 'ai_workers' as const, value: { meeting_brief: { enabled: true } } },
      { key: 'transcripts_enabled' as const, value: true },
      { key: 'works_agreement_confirmed_at' as const, value: hollmannStart.toISOString() },
      { key: 'works_agreement_confirmed_by' as const, value: hollmannPeople.saraOst.id },
    ];
    await tx
      .insert(orgSetting)
      .values(settings.map((entry) => ({ ...entry, orgId: hollmann.org.id, updatedBy: actor })))
      .onConflictDoUpdate({
        target: [orgSetting.orgId, orgSetting.key],
        set: { value: sql`excluded.value`, updatedBy: actor },
      });

    // Domains der Lieferanten (IN-03, K1-g.4): Mails und Einladungen finden darüber ihre Beziehung,
    // etwa das Signal „Mail von Kim Kaiser“ der Regie
    const domains: [string, string][] = [
      ['rheintal', 'rheintal.example'],
      ['silesia', 'silesia.example'],
      ['kessler', 'kessler.example'],
      ['nordwerk', 'nordwerk.example'],
      ['moravia', 'moravia.example'],
      ['alpenKunststoff', 'alpen-kunststoff.example'],
      ['saar', 'saar.example'],
    ];
    await tx.insert(supplierDomain).values(
      domains.map(([key, domain], index) => ({
        id: nid(700 + index),
        orgId: hollmann.org.id,
        relationshipId: byKey(key).relationshipId,
        domain,
        source: 'manual' as const,
      })),
    );

    // Ansprechpartner der Lieferanten aus Sicht von Hollmann (DM-01): Rheintal und Saar Circuits
    const contacts: [string, { name: string; email: string }, string | null][] = [
      ['rheintal', supplierPeople.kimKaiser, 'Geschäftsführerin'],
      ['rheintal', supplierPeople.tomWeber, 'Key Account'],
      ['rheintal', supplierPeople.leaBrandt, null],
      ['rheintal', supplierPeople.miaKuhn, null],
      ['rheintal', supplierPeople.nilsOtt, 'Qualität'],
      ['saar', supplierPeople.lenaSchuster, 'Key Account'],
    ];
    await tx.insert(supplierContact).values(
      contacts.map(([key, entry, role], index) => ({
        id: nid(720 + index),
        relationshipId: byKey(key).relationshipId,
        name: entry.name,
        email: entry.email,
        function: role,
      })),
    );

    // Drehbuch K1 „Morgen mit Reziproq“ (K1-g.3): Fokus, Erledigt und Kurz prüfen von Jan-Luka
    const contact = (entry: { id: string; name: string; email: string }) => ({
      id: entry.id,
      name: entry.name,
      email: entry.email,
    });
    await seedMorning(tx, {
      nid,
      orgId: hollmann.org.id,
      janLuka: { id: janLuka.id, name: janLuka.name },
      supplier: (key) => {
        const found = byKey(key);
        return { orgId: found.id, relationshipId: found.relationshipId, name: found.name };
      },
      rheintalPeople: {
        nilsOtt: contact(supplierPeople.nilsOtt),
        tomWeber: contact(supplierPeople.tomWeber),
        leaBrandt: contact(supplierPeople.leaBrandt),
        miaKuhn: contact(supplierPeople.miaKuhn),
      },
      jbpMeetingId: nid(501),
    });
    // Zusagen 2026 zwischen Hollmann und Rheintal (K2-a.5): Quote 90 zu 78 %, sechs offene
    const person = (entry: { id: string; name: string }) => ({ id: entry.id, name: entry.name });
    await seedCommitments(tx, {
      nid,
      hollmannOrgId: hollmann.org.id,
      rheintal: { orgId: rheintal.id, relationshipId: rheintal.relationshipId },
      janLuka: person(janLuka),
      hollmann: {
        idaRoth: person(hollmannPeople.idaRoth),
        jonasFeld: person(hollmannPeople.jonasFeld),
        saraOst: person(hollmannPeople.saraOst),
      },
      rheintalPeople: {
        kimKaiser: person(supplierPeople.kimKaiser),
        tomWeber: person(supplierPeople.tomWeber),
        nilsOtt: person(supplierPeople.nilsOtt),
        leaBrandt: person(supplierPeople.leaBrandt),
        miaKuhn: person(supplierPeople.miaKuhn),
      },
    });
    // Akte Rheintal, Sicht Gemeinsam (K2-c.1): Scorecard am Plan 2026 nach L-Ueberblick
    await seedAkte(tx, {
      nid,
      hollmannOrgId: hollmann.org.id,
      hollmannName: hollmann.org.name,
      rheintal: {
        orgId: rheintal.id,
        relationshipId: rheintal.relationshipId,
        name: rheintal.name,
      },
      plan2026: nid(850),
      janLuka: person(janLuka),
      idaRoth: person(hollmannPeople.idaRoth),
      kimKaiser: person(supplierPeople.kimKaiser),
      tomWeber: person(supplierPeople.tomWeber),
    });
    // Akte Rheintal, Sicht Nur für dich (K2-c.3): Gesprächspaare und Notizen nach K2-Akte-Privat
    await seedAktePrivate(tx, {
      nid,
      hollmannOrgId: hollmann.org.id,
      relationshipId: rheintal.relationshipId,
      janLuka: person(janLuka),
      saraOst: person(hollmannPeople.saraOst),
      jonasFeld: person(hollmannPeople.jonasFeld),
      idaRoth: person(hollmannPeople.idaRoth),
      tomBerg: person(hollmannPeople.tomBerg),
      // Ansprechpartner von Rheintal wie oben unter supplier_contact (nid 721 bis 723)
      contacts: {
        tomWeber: { id: nid(721), name: supplierPeople.tomWeber.name },
        leaBrandt: { id: nid(722), name: supplierPeople.leaBrandt.name },
        miaKuhn: { id: nid(723), name: supplierPeople.miaKuhn.name },
      },
    });
    // Akte Rheintal, Spielregeln „Strategisch“ geteilt (K2-c.5): Blatt Spielregeln, Pflichten in
    // Von Rheintal, Plan und Spielregeln in Gemeinsam
    await seedAkteRules(tx, {
      nid,
      hollmannOrgId: hollmann.org.id,
      relationshipId: rheintal.relationshipId,
      saraOst: person(hollmannPeople.saraOst),
      typeDescription:
        'Hohes Versorgungsrisiko und hoher Wertbeitrag: gemeinsam planen und entwickeln.',
    });
    // Portfolio für die Seite Lieferanten (K2-b.2): Segmentmodell 2 × 2, 46 Lieferanten,
    // Segmente, Fokus, Runde 2027 mit Kessler, Zusagequoten und offene Zusagen
    await seedPortfolio(tx, {
      nid,
      hollmannOrgId: hollmann.org.id,
      people: {
        janLuka: person(janLuka),
        saraOst: person(hollmannPeople.saraOst),
        idaRoth: person(hollmannPeople.idaRoth),
        jonasFeld: person(hollmannPeople.jonasFeld),
      },
      supplier: (key) => {
        const found = byKey(key);
        return {
          orgId: found.id,
          relationshipId: found.relationshipId,
          name: found.name,
          sro: found.sro,
        };
      },
    });
    await tx.execute(sql`select app_demo_schnappschuss(${hollmann.org.id}::uuid, 'start')`);
    return {
      organizations: orgs.length,
      people: people.length,
      relationships: relationships.length,
      spend2026Cents: hollmannSuppliers.reduce((total, entry) => total + entry.spend2026, 0),
    };
  });
}
