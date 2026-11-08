import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { catalogSetup, formatCatalogItem, ruleCatalogItem } from './schema/index.js';

// PLB-01: Der Standardkatalog liegt als seed/catalog.de.json und seed/catalog.en.json vor. Die
// deutsche Datei trägt Aufbau und Text, die englische nur Texte mit denselben Schlüsseln.

const level = z.number().int().min(1).max(3);
const germanFile = z.object({
  rules: z.array(
    z.object({
      key: z.string(),
      kind: z.enum(['right', 'obligation']),
      group: z.enum(['cost', 'protection', 'collaboration', 'growth']),
      counterpart: z.string().nullable(),
      minImpactLevel: level,
      title: z.string().min(1),
      description: z.string().min(1),
    }),
  ),
  formats: z.array(
    z.object({
      key: z.string(),
      level: z.enum(['executive', 'management', 'operational']),
      cadence: z.enum(['monthly', 'quarterly', 'semiannual', 'annual', 'on_demand']),
      minImpactLevel: level,
      forQualityLevels: z.array(level),
      name: z.string().min(1),
      purpose: z.string().min(1),
    }),
  ),
});
const englishFile = z.object({
  rules: z.array(
    z.object({ key: z.string(), title: z.string().min(1), description: z.string().min(1) }),
  ),
  formats: z.array(
    z.object({ key: z.string(), name: z.string().min(1), purpose: z.string().min(1) }),
  ),
});

const read = (language: 'de' | 'en') =>
  JSON.parse(readFileSync(new URL(`../seed/catalog.${language}.json`, import.meta.url), 'utf8'));

/** Beide Sprachen zusammengeführt; scheitert, wenn eine Sprache einen Eintrag nicht hat. */
export function loadDefaultCatalog() {
  const de = germanFile.parse(read('de'));
  const en = englishFile.parse(read('en'));
  const english = <T extends { key: string }>(list: T[], key: string): T => {
    const found = list.find((entry) => entry.key === key);
    if (!found) throw new Error(`catalog.en.json: Eintrag ${key} fehlt`);
    return found;
  };
  if (en.rules.length !== de.rules.length || en.formats.length !== de.formats.length) {
    throw new Error('catalog.en.json und catalog.de.json haben nicht dieselben Einträge');
  }
  return {
    rules: de.rules.map((rule) => {
      const translated = english(en.rules, rule.key);
      return {
        ...rule,
        title: { de: rule.title, en: translated.title },
        description: { de: rule.description, en: translated.description },
      };
    }),
    formats: de.formats.map((format) => {
      const translated = english(en.formats, format.key);
      return {
        ...format,
        name: { de: format.name, en: translated.name },
        purpose: { de: format.purpose, en: translated.purpose },
      };
    }),
  };
}

// biome-ignore lint/suspicious/noExplicitAny: Transaktion oder Verbindung, Mandanten-Session oder Eigentümer
type Executor = PgDatabase<PgQueryResultHKT, any, any>;

/**
 * Kopiert den Standardkatalog einmalig in eine Käuferorganisation (PLB-01). Gibt false zurück,
 * wenn die Organisation ihn schon hat; gelöschte Einträge kommen also nicht zurück.
 */
export async function seedDefaultCatalog(tx: Executor, orgId: string): Promise<boolean> {
  const inserted = await tx
    .insert(catalogSetup)
    .values({ orgId })
    .onConflictDoNothing()
    .returning({ orgId: catalogSetup.orgId });
  if (inserted.length === 0) return false;

  const catalog = loadDefaultCatalog();
  const rows = await tx
    .insert(ruleCatalogItem)
    .values(
      catalog.rules.map((rule, index) => ({
        orgId,
        key: rule.key,
        kind: rule.kind,
        group: rule.group,
        title: rule.title,
        description: rule.description,
        minImpactLevel: rule.minImpactLevel,
        position: index + 1,
      })),
    )
    .returning({ id: ruleCatalogItem.id, key: ruleCatalogItem.key });
  const idOf = new Map(rows.map((row) => [row.key, row.id]));
  for (const rule of catalog.rules) {
    const counterpart = rule.counterpart ? idOf.get(rule.counterpart) : undefined;
    const id = idOf.get(rule.key);
    if (counterpart && id) {
      await tx
        .update(ruleCatalogItem)
        .set({ counterpartId: counterpart })
        .where(eq(ruleCatalogItem.id, id));
    }
  }
  await tx.insert(formatCatalogItem).values(
    catalog.formats.map((format, index) => ({
      orgId,
      key: format.key,
      name: format.name,
      purpose: format.purpose,
      level: format.level,
      cadence: format.cadence,
      minImpactLevel: format.minImpactLevel,
      forQualityLevels: format.forQualityLevels,
      position: index + 1,
    })),
  );
  return true;
}
