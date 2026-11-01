import { inArray, sql } from 'drizzle-orm';
import type { Database } from './client.js';
import {
  appUser,
  type OrgRole,
  organization,
  organizationFeature,
  relationship,
  relationshipMember,
  relationshipSide,
  relationshipSpend,
} from './schema/index.js';

// Beispieldaten für die lokale Entwicklung (PLT-02, PLT-03). Alle Namen sind erfunden und tragen „(Demo)“.
// Feste IDs machen das Skript wiederholbar: Ein zweiter Lauf aktualisiert, statt zu verdoppeln.

const id = (n: number) => `de300000-0000-7000-8000-${String(n).padStart(12, '0')}`;

/** Organisationen mit Käuferfunktionen (Feature buyer). */
export const seedBuyers = {
  testOem: { id: id(1), name: 'Test-OEM (Demo)', country: 'DE' },
  zweitOem: { id: id(2), name: 'Zweit-OEM (Demo)', country: 'DE' },
} as const;

/** Ein Lieferant mit eigenem Zugang, aber ohne Käuferfunktionen (PLT-02). */
export const seedSupplierOrg = { id: id(3), name: 'Test-Lieferant (Demo)', country: 'DE' } as const;

/**
 * Erfundene Nutzer je Organisation mit Rolle (PLT-05): je OEM ein Admin, ein Nutzer mit
 * Controlling und ein Leser; beim Test-Lieferanten ein Admin und ein Nutzer.
 */
export const seedUsers = [
  {
    org: seedBuyers.testOem,
    key: 'test-oem',
    people: [
      ['Lena Berger', 'admin', false],
      ['Tom Krüger', 'member', true],
      ['Nina Roth', 'viewer', false],
    ],
  },
  {
    org: seedBuyers.zweitOem,
    key: 'zweit-oem',
    people: [
      ['Mara Vogel', 'admin', false],
      ['Jonas Hahn', 'member', true],
      ['Eva Lang', 'viewer', false],
    ],
  },
  {
    org: seedSupplierOrg,
    key: 'test-lieferant',
    people: [
      ['Sven Ludwig', 'admin', false],
      ['Ida Brandt', 'member', false],
    ],
  },
].flatMap(({ org, key, people }) =>
  (people as [string, OrgRole, boolean][]).map(([name, orgRole, isControlling], index) => ({
    id: `demo-${key}-${index + 1}`,
    name,
    givenName: name.split(' ')[0] ?? name,
    email: `${name.split(' ')[0]?.toLowerCase()}.${key}@example.com`,
    organizationId: org.id,
    orgRole,
    isControlling,
    // Rollen sind gesetzt; der Login übernimmt keine Rollen aus Zitadel mehr.
    rolesImportedAt: new Date(0),
  })),
);

const mio = (euro: number) => Math.round(euro * 1_000_000 * 100);

const suppliers = [
  {
    name: 'Rheintal Elektronik GmbH (Demo)',
    country: 'DE',
    spend: mio(4.82),
  },
  { name: 'Silesia Guss Sp. z o.o. (Demo)', country: 'PL', spend: mio(3.15) },
  {
    name: 'Moravia Plast s.r.o. (Demo)',
    country: 'CZ',
    spend: mio(1.94),
  },
  {
    name: 'Lombardia Fonderie S.p.A. (Demo)',
    country: 'IT',
    spend: mio(2.71),
  },
  {
    name: 'Nordhafen Logistik AG (Demo)',
    country: 'DE',
    spend: mio(1.38),
  },
  {
    name: 'Alpen Sensorik GmbH (Demo)',
    country: 'AT',
    spend: mio(2.26),
  },
  {
    name: 'Loire Polymères SAS (Demo)',
    country: 'FR',
    spend: mio(0.97),
  },
  {
    name: 'Pearl River Components Ltd. (Demo)',
    country: 'CN',
    spend: mio(5.64),
  },
  {
    name: 'Bajío Fundición S.A. de C.V. (Demo)',
    country: 'MX',
    spend: mio(1.12),
  },
  {
    name: 'Danubia Spedition Kft. (Demo)',
    country: 'HU',
    spend: mio(0.74),
  },
  {
    name: 'Ostsee Kunststofftechnik GmbH (Demo)',
    country: 'DE',
    spend: mio(1.63),
  },
  {
    name: 'Tatra Precision Cast a.s. (Demo)',
    country: 'SK',
    spend: mio(0.88),
  },
  {
    name: 'Iberia Cableado S.L. (Demo)',
    country: 'ES',
    spend: mio(1.47),
  },
  { name: 'Benelux Freight B.V. (Demo)', country: 'NL', spend: mio(0.59) },
  {
    name: 'Midwest Molding Inc. (Demo)',
    country: 'US',
    spend: mio(0.81),
  },
].map((supplier, index) => ({
  ...supplier,
  id: id(101 + index),
  // Erfundene USt-IdNr. mit Länderkürzel, damit PLT-03b denselben Lieferanten wiederfindet.
  vatId: `${supplier.country}9${String(10_000_001 + index)}`,
}));

// Drei Lieferanten beliefern auch den Zweit-OEM, mit eigenen Werten. So lässt sich die
// Datentrennung zeigen: Jeder Käufer sieht beim selben Lieferanten nur seine eigenen Werte.
const zweitOemSuppliers = [
  { supplier: 0, externalRef: 'ZW-4711', spend: mio(1.05) },
  { supplier: 2, externalRef: 'ZW-4712', spend: mio(0.42) },
  { supplier: 4, externalRef: 'ZW-4713', spend: mio(2.9) },
];

/** Alle Demo-Beziehungen; der Spend gilt für das letzte volle Jahr. */
const relationships = [
  ...suppliers.map((supplier, index) => ({
    id: id(201 + index),
    buyerOrgId: seedBuyers.testOem.id,
    supplierOrgId: supplier.id,
    status: 'active' as const,
    externalRef: `L-${10_001 + index}`,
    spend: supplier.spend as number | null,
  })),
  ...zweitOemSuppliers.map((entry, index) => ({
    id: id(301 + index),
    buyerOrgId: seedBuyers.zweitOem.id,
    supplierOrgId: suppliers[entry.supplier]?.id ?? '',
    status: 'active' as const,
    externalRef: entry.externalRef,
    spend: entry.spend as number | null,
  })),
  // Der Test-Lieferant ist bei beiden OEMs angelegt, aber noch nicht eingeladen (LIF-01).
  ...Object.values(seedBuyers).map((buyer, index) => ({
    id: id(401 + index),
    buyerOrgId: buyer.id,
    supplierOrgId: seedSupplierOrg.id,
    status: 'draft' as const,
    externalRef: null,
    spend: null,
  })),
];

/**
 * Teams für die ersten fünf Lieferanten des Test-OEM (PLT-05): Lena als SRO, Tom als Sponsor,
 * Nina als Mitglied; beim fünften ist Nina Leserin, damit der Schreibschutz sichtbar ist.
 */
const seedTeams = relationships.slice(0, 5).flatMap((entry, index) => [
  {
    relationshipId: entry.id,
    userId: 'demo-test-oem-1',
    teamRole: 'sro' as const,
    function: 'purchasing' as const,
  },
  {
    relationshipId: entry.id,
    userId: 'demo-test-oem-2',
    teamRole: 'sponsor' as const,
    function: 'quality' as const,
  },
  {
    relationshipId: entry.id,
    userId: 'demo-test-oem-3',
    teamRole: index === 4 ? ('viewer' as const) : ('member' as const),
    function: 'logistics' as const,
  },
]);

/** Das Vorjahr weicht je Lieferant etwas ab, damit eine Entwicklung sichtbar ist. */
const previousYear = (spend: number, index: number) =>
  Math.round(spend * (0.86 + (index % 5) * 0.06));

export interface SeedResult {
  organizations: number;
  relationships: number;
  users: number;
}

export async function seed(
  db: Database,
  { nodeEnv, now = new Date() }: { nodeEnv: string | undefined; now?: Date },
) {
  if (nodeEnv === 'production') {
    throw new Error(
      'db:seed ist nur für die lokale Entwicklung und bricht bei NODE_ENV=production ab.',
    );
  }

  return db.transaction(async (tx): Promise<SeedResult> => {
    const organizations = [
      ...Object.values(seedBuyers),
      seedSupplierOrg,
      ...suppliers.map(({ id, name, country, vatId }) => ({ id, name, country, vatId })),
    ];
    await tx
      .insert(organization)
      .values(organizations)
      .onConflictDoUpdate({
        target: organization.id,
        set: {
          name: sql`excluded.name`,
          country: sql`excluded.country`,
          vatId: sql`excluded.vat_id`,
        },
      });

    // Käuferfunktionen nur für die beiden OEMs; der Test-Lieferant bekommt sie nicht.
    await tx
      .insert(organizationFeature)
      .values(
        Object.values(seedBuyers).map((buyer) => ({
          organizationId: buyer.id,
          feature: 'buyer' as const,
        })),
      )
      .onConflictDoNothing();

    await tx
      .insert(appUser)
      .values(seedUsers)
      .onConflictDoUpdate({
        target: appUser.id,
        set: {
          name: sql`excluded.name`,
          givenName: sql`excluded.given_name`,
          email: sql`excluded.email`,
          organizationId: sql`excluded.organization_id`,
          orgRole: sql`excluded.org_role`,
          isControlling: sql`excluded.is_controlling`,
          rolesImportedAt: sql`excluded.roles_imported_at`,
        },
      });

    await tx
      .insert(relationship)
      .values(
        relationships.map(({ id, buyerOrgId, supplierOrgId, status }) => ({
          id,
          buyerOrgId,
          supplierOrgId,
          status,
        })),
      )
      .onConflictDoUpdate({ target: relationship.id, set: { status: sql`excluded.status` } });

    // Eigene Nummer je Käufer; die andere Seite sieht sie nie (org_private).
    await tx
      .insert(relationshipSide)
      .values(
        relationships
          .filter((entry) => entry.externalRef !== null)
          .map((entry) => ({
            relationshipId: entry.id,
            orgId: entry.buyerOrgId,
            externalRef: entry.externalRef,
          })),
      )
      .onConflictDoUpdate({
        target: [relationshipSide.relationshipId, relationshipSide.orgId],
        set: { externalRef: sql`excluded.external_ref` },
      });

    // Spend für die zwei letzten vollen Jahre, gerechnet vom heutigen Datum.
    const lastYear = now.getFullYear() - 1;
    await tx
      .insert(relationshipSpend)
      .values(
        relationships.flatMap((entry, index) =>
          entry.spend === null
            ? []
            : [
                { year: lastYear - 1, amountCents: previousYear(entry.spend, index) },
                { year: lastYear, amountCents: entry.spend },
              ].map((value) => ({
                ...value,
                relationshipId: entry.id,
                currency: 'EUR',
                source: 'seed' as const,
              })),
        ),
      )
      .onConflictDoUpdate({
        target: [relationshipSpend.relationshipId, relationshipSpend.year],
        set: { amountCents: sql`excluded.amount_cents`, source: sql`excluded.source` },
      });

    // Teams neu setzen statt ergänzen, damit Änderungen aus der Oberfläche nicht kollidieren.
    const teamRelationships = [...new Set(seedTeams.map((member) => member.relationshipId))];
    await tx
      .delete(relationshipMember)
      .where(inArray(relationshipMember.relationshipId, teamRelationships));
    await tx
      .insert(relationshipMember)
      .values(seedTeams.map((member) => ({ ...member, orgId: seedBuyers.testOem.id })));

    return {
      organizations: organizations.length,
      relationships: relationships.length,
      users: seedUsers.length,
    };
  });
}
