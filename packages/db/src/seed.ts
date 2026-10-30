import { sql } from 'drizzle-orm';
import type { Database } from './client.js';
import { appUser, beziehung, beziehungKaeufer, organization } from './schema/index.js';

// Beispieldaten für die lokale Entwicklung (PLT-02). Alle Namen sind erfunden und tragen „(Demo)“.
// Feste IDs machen das Skript wiederholbar: Ein zweiter Lauf aktualisiert, statt zu verdoppeln.

const id = (n: number) => `de300000-0000-7000-8000-${String(n).padStart(12, '0')}`;

export const seedBuyers = {
  beispielOem: { id: id(1), name: 'Beispiel-OEM (Demo)', land: 'DE' },
  zweitOem: { id: id(2), name: 'Zweit-OEM (Demo)', land: 'DE' },
} as const;

const spendYear = 2025;
const mio = (euro: number) => Math.round(euro * 1_000_000 * 100);

const suppliers = [
  {
    name: 'Rheintal Elektronik GmbH (Demo)',
    land: 'DE',
    warengruppe: 'Elektronik',
    spend: mio(4.82),
  },
  { name: 'Silesia Guss Sp. z o.o. (Demo)', land: 'PL', warengruppe: 'Guss', spend: mio(3.15) },
  { name: 'Moravia Plast s.r.o. (Demo)', land: 'CZ', warengruppe: 'Kunststoff', spend: mio(1.94) },
  { name: 'Lombardia Fonderie S.p.A. (Demo)', land: 'IT', warengruppe: 'Guss', spend: mio(2.71) },
  { name: 'Nordhafen Logistik AG (Demo)', land: 'DE', warengruppe: 'Logistik', spend: mio(1.38) },
  { name: 'Alpen Sensorik GmbH (Demo)', land: 'AT', warengruppe: 'Elektronik', spend: mio(2.26) },
  { name: 'Loire Polymères SAS (Demo)', land: 'FR', warengruppe: 'Kunststoff', spend: mio(0.97) },
  {
    name: 'Pearl River Components Ltd. (Demo)',
    land: 'CN',
    warengruppe: 'Elektronik',
    spend: mio(5.64),
  },
  {
    name: 'Bajío Fundición S.A. de C.V. (Demo)',
    land: 'MX',
    warengruppe: 'Guss',
    spend: mio(1.12),
  },
  { name: 'Danubia Spedition Kft. (Demo)', land: 'HU', warengruppe: 'Logistik', spend: mio(0.74) },
  {
    name: 'Ostsee Kunststofftechnik GmbH (Demo)',
    land: 'DE',
    warengruppe: 'Kunststoff',
    spend: mio(1.63),
  },
  { name: 'Tatra Precision Cast a.s. (Demo)', land: 'SK', warengruppe: 'Guss', spend: mio(0.88) },
  { name: 'Iberia Cableado S.L. (Demo)', land: 'ES', warengruppe: 'Elektronik', spend: mio(1.47) },
  { name: 'Benelux Freight B.V. (Demo)', land: 'NL', warengruppe: 'Logistik', spend: mio(0.59) },
  { name: 'Midwest Molding Inc. (Demo)', land: 'US', warengruppe: 'Kunststoff', spend: mio(0.81) },
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
    kaeuferOrgId: seedBuyers.beispielOem.id,
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
  usersAssigned: number;
}

export async function seed(db: Database, { nodeEnv }: { nodeEnv: string | undefined }) {
  if (nodeEnv === 'production') {
    throw new Error(
      'db:seed ist nur für die lokale Entwicklung und bricht bei NODE_ENV=production ab.',
    );
  }

  return db.transaction(async (tx): Promise<SeedResult> => {
    const organizations = [
      ...Object.values(seedBuyers).map((buyer) => ({ ...buyer, typ: 'kaeufer' as const })),
      ...suppliers.map(({ id, name, land }) => ({ id, name, land, typ: 'lieferant' as const })),
    ];
    await tx
      .insert(organization)
      .values(organizations)
      .onConflictDoUpdate({
        target: organization.id,
        set: { name: sql`excluded.name`, typ: sql`excluded.typ`, land: sql`excluded.land` },
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

    const assigned = await tx
      .update(appUser)
      .set({ organizationId: seedBuyers.beispielOem.id })
      .returning({ id: appUser.id });

    return {
      organizations: organizations.length,
      relationships: relationships.length,
      usersAssigned: assigned.length,
    };
  });
}
