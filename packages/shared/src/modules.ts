import { z } from 'zod';

// UX-20: Module je Organisation (Tabelle org_module). Ohne Zeile gilt der Standard. Claims, Risiko
// und Vertrag sind in Release 1.1 für alle aus; ein Modul, das aus ist, hat keine Route, keinen
// Menüpunkt, keine Karte, keine Zeile und keinen Termin.
export const orgModuleKeys = [
  'claims',
  'risk',
  'contract',
  'value_finder',
  'category_strategy',
] as const;
export type OrgModuleKey = (typeof orgModuleKeys)[number];

export const defaultOrgModules: Record<OrgModuleKey, boolean> = {
  claims: false,
  risk: false,
  contract: false,
  value_finder: true,
  category_strategy: true,
};

export const orgModulesSchema = z.object({
  claims: z.boolean(),
  risk: z.boolean(),
  contract: z.boolean(),
  value_finder: z.boolean(),
  category_strategy: z.boolean(),
});
export type OrgModules = z.infer<typeof orgModulesSchema>;

/** Standard mit den gespeicherten Zeilen überschrieben */
export function resolveOrgModules(rows: { module: string; enabled: boolean }[]): OrgModules {
  const result = { ...defaultOrgModules };
  for (const row of rows) {
    if ((orgModuleKeys as readonly string[]).includes(row.module)) {
      result[row.module as OrgModuleKey] = row.enabled;
    }
  }
  return result;
}
