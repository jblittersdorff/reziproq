import { createHash } from 'node:crypto';
import {
  defaultSegmentCriteria,
  defaultSegmentTypes,
  demoSupplierImportRows,
} from '@reziproq/shared';
import { eq, inArray, sql } from 'drizzle-orm';
import { seedDefaultCatalog } from './catalog.js';
import type { Database } from './client.js';
import {
  appUser,
  businessUnit,
  invitation,
  materialGroup,
  materialGroupMember,
  materialGroupProductGroup,
  type OrgRole,
  organization,
  organizationFeature,
  ratingAssignment,
  relationship,
  relationshipBusinessUnit,
  relationshipMaterialGroup,
  relationshipMember,
  relationshipSide,
  relationshipSpend,
  segmentationRound,
  segmentCriterion,
  segmentModel,
  segmentType,
} from './schema/index.js';
import { seedMeetings } from './seed-meetings.js';
import { seedRuleSets } from './seed-rule-sets.js';

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
  // Der Test-Lieferant arbeitet mit beiden OEMs (LIF-02); Sven und Ida sind seine Nutzer. Beim
  // Test-OEM liegt zusätzlich eine offene Einladung für eine weitere Person (LIF-01).
  ...Object.values(seedBuyers).map((buyer, index) => ({
    id: id(401 + index),
    buyerOrgId: buyer.id,
    supplierOrgId: seedSupplierOrg.id,
    status: 'active' as const,
    externalRef: null,
    spend: null,
  })),
];

/**
 * Offene Einladung beim Test-Lieferanten (LIF-01a). Der feste Token macht /einladung/<token> lokal
 * aufrufbar; in der Datenbank steht wie immer nur sein SHA-256.
 */
export const seedInvitationToken = 'demo-einladung-test-lieferant-0001';

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

/**
 * Business Units und Warengruppen (PLT-06): beim Test-OEM drei BUs und sechs Warengruppen in zwei
 * Ebenen, beim Zweit-OEM eigene, andere Werte. Ebene zwei nennt ihre Oberebene in parent.
 */
const seedBusinessUnits = [
  { id: id(501), orgId: seedBuyers.testOem.id, name: 'Pkw', code: 'PKW' },
  { id: id(502), orgId: seedBuyers.testOem.id, name: 'Nutzfahrzeuge', code: 'NFZ' },
  { id: id(503), orgId: seedBuyers.testOem.id, name: 'Ersatzteile', code: 'ET' },
  { id: id(511), orgId: seedBuyers.zweitOem.id, name: 'Landtechnik', code: 'LT' },
  { id: id(512), orgId: seedBuyers.zweitOem.id, name: 'Baumaschinen', code: 'BM' },
];
const seedMaterialGroups = [
  { id: id(601), orgId: seedBuyers.testOem.id, name: 'Elektronik', code: 'EL', parentId: null },
  { id: id(602), orgId: seedBuyers.testOem.id, name: 'Sensorik', code: 'EL-SE', parentId: id(601) },
  { id: id(603), orgId: seedBuyers.testOem.id, name: 'Kabel', code: 'EL-KA', parentId: id(601) },
  { id: id(604), orgId: seedBuyers.testOem.id, name: 'Guss', code: 'GU', parentId: null },
  { id: id(605), orgId: seedBuyers.testOem.id, name: 'Kunststoff', code: 'KU', parentId: null },
  { id: id(606), orgId: seedBuyers.testOem.id, name: 'Logistik', code: 'LO', parentId: null },
  { id: id(611), orgId: seedBuyers.zweitOem.id, name: 'Elektrik', code: 'E', parentId: null },
  {
    id: id(612),
    orgId: seedBuyers.zweitOem.id,
    name: 'Kabelbäume',
    code: 'E-KB',
    parentId: id(611),
  },
  { id: id(613), orgId: seedBuyers.zweitOem.id, name: 'Mechanik', code: 'M', parentId: null },
];
/** WG-01: Lead, Beschreibung, Produktgruppen und Team für die Oberebenen des Test-OEM. */
const seedGroupDetails: Record<number, { lead: string; description: string }> = {
  601: { lead: 'demo-test-oem-1', description: 'Elektronische Bauteile und Baugruppen.' },
  604: { lead: 'demo-test-oem-2', description: 'Guss aus Aluminium und Eisen.' },
  605: { lead: 'demo-test-oem-1', description: 'Spritzguss und technische Kunststoffe.' },
  606: { lead: 'demo-test-oem-2', description: 'Transport und Lagerung.' },
};
const seedProductGroups = [
  { id: id(651), materialGroupId: id(601), name: 'Leiterplatten', position: 1 },
  { id: id(652), materialGroupId: id(601), name: 'Steuergeräte', position: 2 },
  { id: id(653), materialGroupId: id(604), name: 'Aluminiumguss', position: 1 },
  { id: id(654), materialGroupId: id(604), name: 'Grauguss', position: 2 },
  { id: id(655), materialGroupId: id(605), name: 'Spritzgussteile', position: 1 },
].map((group) => ({ ...group, orgId: seedBuyers.testOem.id }));
const seedGroupMembers = [
  { id: id(661), materialGroupId: id(601), userId: 'demo-test-oem-1', role: 'lead' as const },
  { id: id(662), materialGroupId: id(601), userId: 'demo-test-oem-2', role: 'buyer' as const },
  { id: id(663), materialGroupId: id(601), userId: 'demo-test-oem-3', role: 'function' as const },
  { id: id(664), materialGroupId: id(604), userId: 'demo-test-oem-2', role: 'lead' as const },
  { id: id(665), materialGroupId: id(605), userId: 'demo-test-oem-1', role: 'lead' as const },
  { id: id(666), materialGroupId: id(606), userId: 'demo-test-oem-2', role: 'lead' as const },
].map((member) => ({ ...member, orgId: seedBuyers.testOem.id }));
/** Haupt-Warengruppe je Lieferant des Test-OEM, in der Reihenfolge der Lieferanten oben. */
const testOemPrimary = [601, 604, 605, 604, 606, 602, 605, 601, 604, 606, 605, 604, 603, 606, 605];
/** Zuordnung je Beziehung: BUs, Warengruppen und die Haupt-Warengruppe zuerst. */
const seedAssignments: { relationshipId: string; units: number[]; groups: number[] }[] = [
  ...testOemPrimary.map((primary, index) => ({
    relationshipId: id(201 + index),
    units: index % 4 === 0 ? [501, 503] : [501 + (index % 3)],
    // Sensorik-Lieferanten liefern auch allgemeine Elektronik.
    groups: primary === 602 ? [602, 601] : [primary],
  })),
  { relationshipId: id(301), units: [511], groups: [611] },
  { relationshipId: id(302), units: [511, 512], groups: [613] },
  { relationshipId: id(303), units: [512], groups: [612, 611] },
  // Der Test-Lieferant ist bei beiden OEMs angelegt.
  { relationshipId: id(401), units: [501], groups: [601] },
  { relationshipId: id(402), units: [512], groups: [611] },
];

/** Das Vorjahr weicht je Lieferant etwas ab, damit eine Entwicklung sichtbar ist. */
const previousYear = (spend: number, index: number) =>
  Math.round(spend * (0.86 + (index % 5) * 0.06));

export interface SeedResult {
  organizations: number;
  relationships: number;
  users: number;
  manySuppliers: number;
}

export async function seed(
  db: Database,
  {
    nodeEnv,
    now = new Date(),
    many = false,
  }: { nodeEnv: string | undefined; now?: Date; many?: boolean },
) {
  if (nodeEnv === 'production') {
    throw new Error(
      'db:seed ist nur für die lokale Entwicklung und bricht bei NODE_ENV=production ab.',
    );
  }

  return db.transaction(async (tx): Promise<SeedResult> => {
    const manySuppliers = many
      ? demoSupplierImportRows.map((supplier, index) => ({
          ...supplier,
          id: id(1001 + index),
        }))
      : [];
    const manyRelationships = manySuppliers.map((supplier, index) => ({
      id: id(2001 + index),
      buyerOrgId: seedBuyers.testOem.id,
      supplierOrgId: supplier.id,
      status: 'draft' as const,
      externalRef: supplier.externalRef,
      spend: null,
    }));
    const allRelationships = [...relationships, ...manyRelationships];
    const organizations = [
      ...Object.values(seedBuyers),
      seedSupplierOrg,
      ...suppliers.map(({ id, name, country, vatId }) => ({ id, name, country, vatId })),
      ...manySuppliers.map(({ id, name, country, vatId }) => ({ id, name, country, vatId })),
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

    const buyerOrganizations = await tx
      .select({ orgId: organizationFeature.organizationId })
      .from(organizationFeature)
      .where(eq(organizationFeature.feature, 'buyer'));
    for (const { orgId } of buyerOrganizations) {
      const versions = await tx
        .select({ version: segmentModel.version, status: segmentModel.status })
        .from(segmentModel)
        .where(eq(segmentModel.orgId, orgId));
      if (versions.some((model) => model.status === 'active' || model.status === 'draft')) continue;

      const version = Math.max(0, ...versions.map((model) => model.version)) + 1;
      const [model] = await tx
        .insert(segmentModel)
        .values({
          orgId,
          version,
          status: 'active',
          lowMax: 33,
          midMax: 66,
          createdAt: now,
          activatedAt: now,
        })
        .returning({ id: segmentModel.id });
      if (!model)
        throw new Error(`Segmentmodell für Organisation ${orgId} konnte nicht angelegt werden.`);

      await tx
        .insert(segmentCriterion)
        .values(defaultSegmentCriteria.map((criterion) => ({ ...criterion, modelId: model.id })));
      await tx
        .insert(segmentType)
        .values(defaultSegmentTypes.map((type) => ({ ...type, modelId: model.id })));
    }

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
        allRelationships.map(({ id, buyerOrgId, supplierOrgId, status }) => ({
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
        allRelationships
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
        allRelationships.flatMap((entry, index) =>
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
        target: [
          relationshipSpend.relationshipId,
          relationshipSpend.year,
          relationshipSpend.kind,
          relationshipSpend.businessUnitId,
          relationshipSpend.materialGroupId,
        ],
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

    // PLB-01: Standardkatalog für Spielregeln und Formate; einmalig je Käufer.
    for (const buyer of Object.values(seedBuyers)) await seedDefaultCatalog(tx, buyer.id);

    // LIF-01a: Lena ist SRO beim Test-Lieferanten und hat seinen Key Account Manager eingeladen.
    const invitedRelationship = id(401);
    await tx
      .insert(relationshipMember)
      .values({
        relationshipId: invitedRelationship,
        orgId: seedBuyers.testOem.id,
        userId: 'demo-test-oem-1',
        teamRole: 'sro',
        function: 'purchasing',
      })
      .onConflictDoNothing();
    await tx
      .insert(invitation)
      .values({
        id: id(901),
        relationshipId: invitedRelationship,
        orgId: seedBuyers.testOem.id,
        email: 'kim.test-lieferant@example.com',
        message: 'Hallo Kim, wir möchten die Zusammenarbeit gern in Reziproq führen.',
        tokenHash: createHash('sha256').update(seedInvitationToken).digest('hex'),
        invitedBy: 'demo-test-oem-1',
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      })
      .onConflictDoUpdate({
        target: invitation.id,
        set: {
          expiresAt: sql`excluded.expires_at`,
          acceptedAt: null,
          acceptedUserId: null,
          revokedAt: null,
        },
      });

    // Business Units und Warengruppen (PLT-06); Oberebenen vor ihren Untergruppen.
    await tx
      .insert(businessUnit)
      .values(seedBusinessUnits)
      .onConflictDoUpdate({
        target: businessUnit.id,
        set: { name: sql`excluded.name`, code: sql`excluded.code`, active: true },
      });
    for (const level of [false, true]) {
      const groups = seedMaterialGroups.filter((group) => (group.parentId !== null) === level);
      await tx
        .insert(materialGroup)
        .values(groups)
        .onConflictDoUpdate({
          target: materialGroup.id,
          set: { name: sql`excluded.name`, code: sql`excluded.code`, active: true },
        });
    }
    // WG-01: Lead, Beschreibung, Produktgruppen und Team
    for (const [key, detail] of Object.entries(seedGroupDetails)) {
      await tx
        .update(materialGroup)
        .set({ leadUserId: detail.lead, description: detail.description })
        .where(eq(materialGroup.id, id(Number(key))));
    }
    await tx.insert(materialGroupProductGroup).values(seedProductGroups).onConflictDoNothing();
    await tx.insert(materialGroupMember).values(seedGroupMembers).onConflictDoNothing();
    // Zuordnungen neu setzen, wie die Teams.
    const assigned = seedAssignments.map((entry) => entry.relationshipId);
    await tx
      .delete(relationshipBusinessUnit)
      .where(inArray(relationshipBusinessUnit.relationshipId, assigned));
    await tx
      .delete(relationshipMaterialGroup)
      .where(inArray(relationshipMaterialGroup.relationshipId, assigned));
    await tx.insert(relationshipBusinessUnit).values(
      seedAssignments.flatMap((entry) =>
        entry.units.map((unit) => ({
          relationshipId: entry.relationshipId,
          businessUnitId: id(unit),
        })),
      ),
    );
    await tx.insert(relationshipMaterialGroup).values(
      seedAssignments.flatMap((entry) =>
        entry.groups.map((group, index) => ({
          relationshipId: entry.relationshipId,
          materialGroupId: id(group),
          isPrimary: index === 0,
        })),
      ),
    );

    // Eine laufende Bewertungsrunde (SEG-03) für zehn Lieferanten des Test-OEM. Nur beim ersten
    // Lauf: Eine später geschlossene Runde nimmt keine neuen Zuordnungen mehr an.
    const roundId = id(7001);
    const [existingRound] = await tx
      .select({ id: segmentationRound.id })
      .from(segmentationRound)
      .where(eq(segmentationRound.id, roundId));
    if (!existingRound) {
      const due = new Date(now);
      due.setDate(due.getDate() + 30);
      await tx.insert(segmentationRound).values({
        id: roundId,
        orgId: seedBuyers.testOem.id,
        name: 'Segmentierung (Demo)',
        dueDate: due.toISOString().slice(0, 10),
        status: 'open',
        modelVersion: 1,
        createdBy: 'demo-test-oem-1',
        startedAt: now,
      });
      const roundSuppliers = seedAssignments.slice(0, 10);
      await tx.insert(ratingAssignment).values(
        roundSuppliers.flatMap((entry, index) => [
          {
            roundId,
            relationshipId: entry.relationshipId,
            businessUnitId: id(entry.units[0] ?? 501),
            materialGroupId: id(entry.groups[0] ?? 601),
            function: 'purchasing' as const,
            raterUserId: 'demo-test-oem-1',
          },
          ...(index < 5
            ? [
                {
                  roundId,
                  relationshipId: entry.relationshipId,
                  businessUnitId: id(entry.units[0] ?? 501),
                  materialGroupId: id(entry.groups[0] ?? 601),
                  function: 'quality' as const,
                  raterUserId: 'demo-test-oem-2',
                },
              ]
            : []),
        ]),
      );
    }

    // PLB-03 und SEG-10: drei Fokuslieferanten des Test-OEM mit Spielregeln; beim Test-Lieferanten
    // geteilt, damit Sven und Ida sie in ihrem Arbeitsbereich sehen.
    await seedRuleSets(
      tx,
      seedBuyers.testOem.id,
      'demo-test-oem-1',
      'Lena Berger',
      [
        {
          relationshipId: id(201),
          ist: [3, 2],
          soll: [3, 3],
          status: 'approved',
          focusReason: 'Größter Spend in der Elektronik, Schlüssel für die neue Plattform.',
        },
        {
          relationshipId: id(202),
          ist: [2, 1],
          soll: [2, 3],
          status: 'draft',
          focusReason: 'Lieferprobleme im letzten Jahr; die Zusammenarbeit soll stabil werden.',
        },
        {
          relationshipId: id(401),
          ist: [2, 2],
          soll: [3, 2],
          status: 'shared',
          focusReason: 'Neuer strategischer Partner für Antriebstechnik.',
        },
      ],
      now,
    );

    // QBR-01: beim Test-Lieferanten ein abgeschlossenes und ein kommendes Quartalsreview.
    await seedMeetings(tx, {
      relationshipId: id(401),
      buyerOrgId: seedBuyers.testOem.id,
      supplierOrgId: seedSupplierOrg.id,
      pastId: id(901),
      nextId: id(902),
      actionIds: [id(911), id(912), id(913)],
      createdBy: 'demo-test-oem-1',
      createdByName: 'Lena Berger',
      now,
    });

    return {
      organizations: organizations.length,
      relationships: allRelationships.length,
      users: seedUsers.length,
      manySuppliers: manySuppliers.length,
    };
  });
}
