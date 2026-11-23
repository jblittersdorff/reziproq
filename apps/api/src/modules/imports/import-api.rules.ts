import type { ApiObjectType } from '@reziproq/shared';

/**
 * IN-07: Datenmodell der Import-API je Objektart, für Datei und API gleich. Heute übernimmt
 * Reziproq Lieferantenstamm und Spend; die Felder heißen wie im Modell der Spec.
 */
export interface ApiField {
  /** Feld im Import aus KI-15 (Spalte der Zeile) */
  target: string | null;
  required?: boolean;
  check?: 'period' | 'amount' | 'currency' | 'country';
}

export const apiModel: Partial<Record<ApiObjectType, Record<string, ApiField>>> = {
  supplier: {
    external_number: { target: 'externalNumber', required: true },
    name: { target: 'name', required: true },
    country: { target: 'country', required: true, check: 'country' },
    vat_id: { target: 'vatId' },
    duns: { target: 'duns' },
    // Konzernverbund: angenommen, ordnet heute die Prüfung im Import zu
    parent_external_number: { target: null },
  },
  spend: {
    supplier_external_number: { target: 'externalNumber', required: true },
    period: { target: 'period', required: true, check: 'period' },
    amount: { target: 'amount', required: true, check: 'amount' },
    currency: { target: 'currency', required: true, check: 'currency' },
    material_group: { target: 'erpMaterialGroup' },
    account: { target: 'account' },
    // Business Unit: angenommen; die Aufteilung je Business Unit folgt mit dem Spend-Modell (SPL-04)
    business_unit: { target: null },
  },
};

export const apiKinds = { supplier: 'supplier_master', spend: 'spend' } as const;

export interface ApiRowError {
  row: number;
  field: string;
  reason: string;
}

const text = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') return value.trim() || null;
  return null;
};

/**
 * Eine Zeile der API prüfen und in die Spalten des Imports übersetzen. Beträge als Dezimalzahl mit
 * Punkt, Monate als YYYY-MM. Felder außerhalb des Modells kommen in ignored.
 */
export function mapApiRow(
  type: ApiObjectType,
  row: Record<string, unknown>,
  rowNo: number,
  ignored: Set<string>,
): { raw: Record<string, string> } | { errors: ApiRowError[] } {
  const model = apiModel[type] ?? {};
  const raw: Record<string, string> = {};
  const errors: ApiRowError[] = [];
  for (const field of Object.keys(row)) if (!(field in model)) ignored.add(field);
  for (const [field, spec] of Object.entries(model)) {
    const given = row[field];
    const value = text(given);
    if (given !== undefined && given !== null && value === null && given !== '') {
      errors.push({ row: rowNo, field, reason: 'Wert ungültig' });
      continue;
    }
    if (value === null) {
      if (spec.required) errors.push({ row: rowNo, field, reason: 'Pflichtfeld fehlt' });
      continue;
    }
    if (spec.check === 'period' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
      errors.push({ row: rowNo, field, reason: 'Datum ungültig, erwartet YYYY-MM' });
      continue;
    }
    if (spec.check === 'amount' && !/^\d+(\.\d{1,2})?$/.test(value)) {
      errors.push({ row: rowNo, field, reason: 'Betrag ungültig, erwartet Dezimalzahl mit Punkt' });
      continue;
    }
    if (spec.check === 'currency' && !/^[A-Z]{3}$/.test(value)) {
      errors.push({ row: rowNo, field, reason: 'Währung ungültig, erwartet ISO 4217' });
      continue;
    }
    if (spec.check === 'country' && !/^[A-Z]{2}$/.test(value)) {
      errors.push({ row: rowNo, field, reason: 'Land ungültig, erwartet ISO 3166' });
      continue;
    }
    if (spec.target) raw[spec.target] = value;
  }
  if (type === 'supplier' && !text(row.vat_id) && !text(row.duns)) {
    errors.push({ row: rowNo, field: 'vat_id', reason: 'vat_id oder duns fehlt' });
  }
  if (type === 'spend' && !text(row.material_group) && !text(row.account)) {
    errors.push({ row: rowNo, field: 'material_group', reason: 'material_group oder account fehlt' });
  }
  if (errors.length > 0) return { errors };
  // Monat als Buchungsdatum, damit der Import aus KI-15 das Jahr kennt
  if (raw.period) raw.bookingDate = `${raw.period}-01`;
  return { raw };
}

/** Spalten des Imports für Lieferungen der API: jede Spalte heißt wie ihr Feld */
export function apiColumnMap(type: ApiObjectType): Record<string, string> {
  const map: Record<string, string> = {};
  for (const spec of Object.values(apiModel[type] ?? {})) {
    if (spec.target && spec.target !== 'period') map[spec.target] = spec.target;
  }
  if (type === 'spend') map.bookingDate = 'bookingDate';
  return map;
}

/** Feld zu einem Fehler aus der Verarbeitung im Import (KI-15) */
export function fieldOfImportError(type: ApiObjectType, error: string): string {
  if (/Betrag/.test(error)) return 'amount';
  if (/Währung/.test(error)) return 'currency';
  if (/Jahr|Datum/.test(error)) return 'period';
  if (/Land/.test(error)) return 'country';
  if (/Name/.test(error)) return 'name';
  return type === 'spend' ? 'supplier_external_number' : 'external_number';
}
