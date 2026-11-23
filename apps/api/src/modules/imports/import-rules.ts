import {
  type ColumnMap,
  type ImportBatchKind,
  type ImportField,
  importFields,
  parseImportAmount,
  requiredImportFields,
} from '@reziproq/shared';
import { normalizeHeader } from '../suppliers/import-file.js';

// KI-15: Regeln des Imports, die nur der Code anwendet. Beträge, Währungen und Daten liest nur der
// Code; das Modell sieht sie, gibt sie aber nie zurück.

/** Überschriften, die der Code ohne Modell einem Feld zuordnet */
const headerAliases: Record<ImportField, string[]> = {
  externalNumber: [
    'lieferantennummer',
    'lieferantennr',
    'kreditor',
    'kreditorennummer',
    'kreditornummer',
    'eigenelieferantennummer',
    'suppliernumber',
    'vendor',
    'vendornumber',
    'vendorid',
    'lifnr',
  ],
  name: ['name', 'lieferant', 'lieferantenname', 'firma', 'suppliername', 'vendorname', 'name1'],
  city: ['ort', 'stadt', 'city'],
  country: ['land', 'country', 'laenderschluessel', 'countrycode'],
  vatId: ['ustidnr', 'ustid', 'vatid', 'vatnumber', 'umsatzsteuerid', 'stceg'],
  duns: ['duns', 'dunsnummer', 'dunsnumber'],
  sourceSystem: ['quellsystem', 'system', 'sourcesystem', 'mandant'],
  bookingDate: ['buchungsdatum', 'belegdatum', 'datum', 'bookingdate', 'postingdate', 'date'],
  year: ['jahr', 'geschaeftsjahr', 'year', 'fiscalyear'],
  amount: ['betrag', 'betragineur', 'nettobetrag', 'amount', 'netamount', 'wert', 'spend'],
  currency: ['waehrung', 'wahrung', 'currency', 'waers'],
  erpMaterialGroup: ['materialgruppe', 'warengruppe', 'materialgroup', 'matkl'],
  account: ['konto', 'sachkonto', 'account', 'glaccount', 'hkont'],
  description: ['text', 'beschreibung', 'bezeichnung', 'kurztext', 'description', 'positionstext'],
};

/** Vorschlag für die Zuordnung der Spalten nur aus den Überschriften */
export function suggestColumnMap(headers: string[], kind: ImportBatchKind): ColumnMap {
  const map: ColumnMap = {};
  const used = new Set<string>();
  for (const field of importFields[kind]) {
    const header = headers.find(
      (entry) => !used.has(entry) && headerAliases[field].includes(normalizeHeader(entry)),
    );
    map[field] = header ?? null;
    if (header) used.add(header);
  }
  return map;
}

/** Felder, die ein Vorschlag des Modells setzen darf: nur bekannte Felder und vorhandene Spalten */
export function cleanColumnMap(
  map: ColumnMap,
  headers: string[],
  kind: ImportBatchKind,
): ColumnMap {
  const clean: ColumnMap = {};
  for (const field of importFields[kind]) {
    const header = map[field];
    clean[field] = header && headers.includes(header) ? header : null;
  }
  return clean;
}

export function missingRequired(map: ColumnMap, kind: ImportBatchKind) {
  const fields = [...requiredImportFields[kind]];
  const missing: string[] = fields.filter((field) => !map[field]);
  // Für Spend braucht es eine Kennung des Lieferanten und das Jahr (Spalte oder Buchungsdatum).
  if (kind === 'spend') {
    if (!map.externalNumber && !map.name && !map.vatId) missing.push('externalNumber');
    if (!map.year && !map.bookingDate) missing.push('year');
  }
  return missing;
}

export interface NormalizedRow {
  name: string | null;
  externalNumber: string | null;
  sourceSystem: string;
  city: string | null;
  country: string | null;
  vatId: string | null;
  duns: string | null;
  amountCents: number | null;
  currency: string | null;
  year: number | null;
  erpMaterialGroup: string | null;
  account: string | null;
  description: string | null;
}

const value = (raw: Record<string, string>, map: ColumnMap, field: ImportField) => {
  const header = map[field];
  const text = header ? (raw[header] ?? '').trim() : '';
  return text === '' ? null : text;
};

/** Jahr aus Buchungsdatum (TT.MM.JJJJ, JJJJ-MM-TT) oder Jahresspalte */
function yearOf(date: string | null, year: string | null): number | null {
  if (year && /^\d{4}$/.test(year)) return Number(year);
  if (!date) return null;
  const german = date.match(/^\d{1,2}\.\d{1,2}\.(\d{4})$/);
  if (german) return Number(german[1]);
  const iso = date.match(/^(\d{4})-\d{2}-\d{2}/);
  return iso ? Number(iso[1]) : null;
}

/**
 * Eine Zeile lesen. Fehler: Pflichtfeld leer, Betrag nicht lesbar, Jahr fehlt, Fremdwährung ohne
 * Kurs. Kurse gibt es noch nicht im System; deshalb ist jede Fremdwährung ein Fehler „Kurs fehlt“.
 */
export function normalizeRow(
  raw: Record<string, string>,
  map: ColumnMap,
  kind: ImportBatchKind,
): { normalized: NormalizedRow; error: string | null } {
  const amountText = value(raw, map, 'amount');
  const currency = (value(raw, map, 'currency') ?? 'EUR').toUpperCase();
  const normalized: NormalizedRow = {
    name: value(raw, map, 'name'),
    externalNumber: value(raw, map, 'externalNumber'),
    sourceSystem: value(raw, map, 'sourceSystem') ?? 'erp',
    city: value(raw, map, 'city'),
    country: value(raw, map, 'country')?.toUpperCase() ?? null,
    vatId: value(raw, map, 'vatId')?.replace(/\s+/g, '').toUpperCase() ?? null,
    duns: value(raw, map, 'duns')?.replace(/\D/g, '') || null,
    amountCents: amountText ? parseImportAmount(amountText) : null,
    currency,
    year: yearOf(value(raw, map, 'bookingDate'), value(raw, map, 'year')),
    erpMaterialGroup: value(raw, map, 'erpMaterialGroup'),
    account: value(raw, map, 'account'),
    description: value(raw, map, 'description'),
  };
  let error: string | null = null;
  if (!normalized.name && !normalized.externalNumber && !normalized.vatId) {
    error = 'Lieferant fehlt';
  } else if (kind === 'supplier_master' && !normalized.name) {
    error = 'Name leer';
  } else if (
    kind === 'supplier_master' &&
    (!normalized.country || !/^[A-Z]{2}$/.test(normalized.country))
  ) {
    error = 'Land fehlt oder ist kein Ländercode';
  } else if (kind === 'spend' && !amountText) {
    error = 'Betrag leer';
  } else if (kind === 'spend' && normalized.amountCents === null) {
    error = 'Betrag nicht lesbar';
  } else if (kind === 'spend' && normalized.year === null) {
    error = 'Jahr oder Buchungsdatum fehlt';
  } else if (kind === 'spend' && !/^[A-Z]{3}$/.test(currency)) {
    error = 'Währung nicht lesbar';
  } else if (kind === 'spend' && currency !== 'EUR') {
    error = `Währung ${currency} ohne Kurs`;
  }
  return { normalized, error };
}

const legalForms =
  /\b(gmbh|ag|kg|ohg|kgaa|se|ug|co|gmbh & co|e\.?k|sp\.? ?z\.? ?o\.? ?o|s\.?a|s\.?r\.?l|s\.?p\.?a|b\.?v|n\.?v|ltd|limited|inc|corp|llc|plc|oy|ab|as|a\/s|kft|s\.?r\.?o|oddzial|niederlassung|zweigniederlassung|branch|vertriebs|holding)\b\.?/g;

/** Name für den Vergleich: klein, ohne Rechtsform, Satzzeichen und Doppelleerzeichen */
export function nameKey(name: string): string {
  return name
    .toLocaleLowerCase('de')
    .replaceAll('&', ' ')
    .replace(legalForms, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Namensstamm für Konzernverbünde: das erste Wort mit mindestens vier Zeichen */
export function nameStem(name: string): string | null {
  return (
    nameKey(name)
      .split(' ')
      .find((word) => word.length >= 4) ?? null
  );
}
