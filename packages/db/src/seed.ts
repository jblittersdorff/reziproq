import { sql } from 'drizzle-orm';
import type { Database } from './client.js';
import {
  appUser,
  beziehung,
  beziehungKaeufer,
  organization,
  organizationFeature,
} from './schema/index.js';

// Beispieldaten für die lokale Entwicklung (PLT-02). Alle Namen sind erfunden und tragen „(Demo)“.
// Feste IDs machen das Skript wiederholbar: Ein zweiter Lauf aktualisiert, statt zu verdoppeln.

const id = (n: number) => `de300000-0000-7000-8000-${String(n).padStart(12, '0')}`;

/** Organisationen mit Käuferfunktionen (Feature buyer). */
export const seedBuyers = {
  testOem: { id: id(1), name: 'Test-OEM (Demo)', country: 'DE' },
  zweitOem: { id: id(2), name: 'Zweit-OEM (Demo)', country: 'DE' },
} as const;

/** Ein Lieferant mit eigenem Zugang, aber ohne Käuferfunktionen (PLT-02). */
export const seedSupplierOrg = { id: id(3), name: 'Test-Lieferant (Demo)', country: 'DE' } as const;

/** Je Organisation zwei Nutzer mit erfundenen IDs, z. B. für Tests der Datentrennung. */
export const seedUsers = [
  { org: seedBuyers.testOem, key: 'test-oem', people: ['Lena Berger', 'Tom Krüger'] },
  { org: seedBuyers.zweitOem, key: 'zweit-oem', people: ['Mara Vogel', 'Jonas Hahn'] },
  { org: seedSupplierOrg, key: 'test-lieferant', people: ['Sven Ludwig', 'Ida Brandt'] },
].flatMap(({ org, key, people }) =>
  people.map((name, index) => ({
    id: `demo-${key}-${index + 1}`,
    name,
    givenName: name.split(' ')[0] ?? name,
    email: `${name.split(' ')[0]?.toLowerCase()}.${key}@example.com`,
    organizationId: org.id,
  })),
);

const spendYear = 2025;
const mio = (euro: number) => Math.round(euro * 1_000_000 * 100);

const suppliers = [
  {
    name: 'Rheintal Elektronik GmbH (Demo)',
    country: 'DE',
    warengruppe: 'Elektronik',
    spend: mio(4.82),
  },
  { name: 'Silesia Guss Sp. z o.o. (Demo)', country: 'PL', warengruppe: 'Guss', spend: mio(3.15) },
  {
    name: 'Moravia Plast s.r.o. (Demo)',
    country: 'CZ',
    warengruppe: 'Kunststoff',
    spend: mio(1.94),
  },
  {
    name: 'Lombardia Fonderie S.p.A. (Demo)',
    country: 'IT',
    warengruppe: 'Guss',
    spend: mio(2.71),
  },
  {
    name: 'Nordhafen Logistik AG (Demo)',
    country: 'DE',
    warengruppe: 'Logistik',
    spend: mio(1.38),
  },
  {
    name: 'Alpen Sensorik GmbH (Demo)',
    country: 'AT',
    warengruppe: 'Elektronik',
    spend: mio(2.26),
  },
  {
    name: 'Loire Polymères SAS (Demo)',
    country: 'FR',
    warengruppe: 'Kunststoff',
    spend: mio(0.97),
  },
  {
    name: 'Pearl River Components Ltd. (Demo)',
    country: 'CN',
    warengruppe: 'Elektronik',
    spend: mio(5.64),
  },
  {
    name: 'Bajío Fundición S.A. de C.V. (Demo)',
    country: 'MX',
    warengruppe: 'Guss',
    spend: mio(1.12),
  },
  {
    name: 'Danubia Spedition Kft. (Demo)',
    country: 'HU',
    warengruppe: 'Logistik',
    spend: mio(0.74),
  },
  {
    name: 'Ostsee Kunststofftechnik GmbH (Demo)',
    country: 'DE',
    warengruppe: 'Kunststoff',
    spend: mio(1.63),
  },
  {
    name: 'Tatra Precision Cast a.s. (Demo)',
    country: 'SK',
    warengruppe: 'Guss',
    spend: mio(0.88),
  },
  {
    name: 'Iberia Cableado S.L. (Demo)',
    country: 'ES',
    warengruppe: 'Elektronik',
    spend: mio(1.47),
  },
  { name: 'Benelux Freight B.V. (Demo)', country: 'NL', warengruppe: 'Logistik', spend: mio(0.59) },
  {
    name: 'Midwest Molding Inc. (Demo)',
    country: 'US',
    warengruppe: 'Kunststoff',
    spend: mio(0.81),
  },
].map((supplier, index) => ({ ...supplier, id: id(101 + index) }));

// Drei Lieferanten beliefern auch den Zweit-OEM, mit eigenen Werten. So lässt sich die
// Datentrennung zeigen: Jeder Käufer sieht beim selben Lieferanten nur seine eigenen Werte.
const zweitOemSuppliers = [
  { supplier: 0, warengruppe: 'Leiterplatten', spend: mio(1.05) },
  { supplier: 2, warengruppe: 'Spritzguss', spend: mio(0.42) },
  { supplier: 4, warengruppe: 'Kontraktlogistik', spend: mio(2.9) },
];

const relationships = [
  ...suppliers.map((supplier, index) => ({
    id: id(201 + index),
    kaeuferOrgId: seedBuyers.testOem.id,
    lieferantOrgId: supplier.id,
    warengruppe: supplier.warengruppe,
    spend: supplier.spend,
  })),
  ...zweitOemSuppliers.map((entry, index) => ({
    id: id(301 + index),
    kaeuferOrgId: seedBuyers.zweitOem.id,
    lieferantOrgId: suppliers[entry.supplier]?.id ?? '',
    warengruppe: entry.warengruppe,
    spend: entry.spend,
  })),
];

export interface SeedResult {
  organizations: number;
  relationships: number;
  users: number;
}

export async function seed(db: Database, { nodeEnv }: { nodeEnv: string | undefined }) {
  if (nodeEnv === 'production') {
    throw new Error(
      'db:seed ist nur für die lokale Entwicklung und bricht bei NODE_ENV=production ab.',
    );
  }

  return db.transaction(async (tx): Promise<SeedResult> => {
    const organizations = [
      ...Object.values(seedBuyers),
      seedSupplierOrg,
      ...suppliers.map(({ id, name, country }) => ({ id, name, country })),
    ];
    await tx
      .insert(organization)
      .values(organizations)
      .onConflictDoUpdate({
        target: organization.id,
        set: { name: sql`excluded.name`, country: sql`excluded.country` },
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
        },
      });

    await tx
      .insert(beziehung)
      .values(
        relationships.map(({ id, kaeuferOrgId, lieferantOrgId }) => ({
          id,
          kaeuferOrgId,
          lieferantOrgId,
        })),
      )
      .onConflictDoNothing();

    await tx
      .insert(beziehungKaeufer)
      .values(
        relationships.map((relationship) => ({
          beziehungId: relationship.id,
          warengruppe: relationship.warengruppe,
          jahresspendCent: relationship.spend,
          spendJahr: spendYear,
          waehrung: 'EUR',
        })),
      )
      .onConflictDoUpdate({
        target: beziehungKaeufer.beziehungId,
        set: {
          warengruppe: sql`excluded.warengruppe`,
          jahresspendCent: sql`excluded.jahresspend_cent`,
          spendJahr: sql`excluded.spend_jahr`,
          waehrung: sql`excluded.waehrung`,
        },
      });

    return {
      organizations: organizations.length,
      relationships: relationships.length,
      users: seedUsers.length,
    };
  });
}
