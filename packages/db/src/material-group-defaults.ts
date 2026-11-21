import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { materialGroupKpi, materialGroupQuestion } from './schema/index.js';

// WG-01, WG-04, WG-06: Startbestand für jeden Kunden aus seed/wg-startdaten.de.json (erzeugt aus
// docs/specs/WG-startdaten.md). Er wird als Zeilen des Kunden kopiert und ist danach je Kunde
// änderbar.

const startFile = z.object({
  kpis: z.array(
    z.object({
      dimension: z.enum(['supply', 'quality', 'cost', 'technology', 'sustainability']),
      name: z.string().min(1),
      description: z.string().nullable(),
      unit: z.string().nullable(),
    }),
  ),
  questions: z.array(
    z.object({ step: z.number().int().min(1).max(10), view: z.string().nullable(), text: z.string().min(1) }),
  ),
});

export function loadMaterialGroupDefaults() {
  return startFile.parse(
    JSON.parse(
      readFileSync(new URL('../seed/wg-startdaten.de.json', import.meta.url), 'utf8'),
    ),
  );
}

// biome-ignore lint/suspicious/noExplicitAny: wie catalog.ts, für Transaktion und Datenbank
type Executor = PgDatabase<PgQueryResultHKT, any, any>;

/**
 * Kopiert Leitfragen und Kennzahlen in eine Organisation, die noch keine hat. Hat sie schon welche,
 * bleibt alles, wie der Kunde es eingestellt hat.
 */
export async function seedMaterialGroupDefaults(tx: Executor, orgId: string): Promise<boolean> {
  const [existing] = await tx
    .select({
      questions: sql<number>`(select count(*)::int from material_group_question where org_id = ${orgId})`,
      kpis: sql<number>`(select count(*)::int from material_group_kpi where org_id = ${orgId})`,
    })
    .from(sql`(select 1) as one`);
  const defaults = loadMaterialGroupDefaults();
  let seeded = false;
  if ((existing?.questions ?? 0) === 0) {
    await tx.insert(materialGroupQuestion).values(
      defaults.questions.map((question, index) => ({
        orgId,
        step: question.step,
        view: question.view,
        text: question.text,
        position: index + 1,
      })),
    );
    seeded = true;
  }
  if ((existing?.kpis ?? 0) === 0) {
    await tx.insert(materialGroupKpi).values(defaults.kpis.map((kpi) => ({ ...kpi, orgId })));
    seeded = true;
  }
  return seeded;
}
