import { z } from 'zod';

export const importTypes = ['suppliers', 'spend', 'business-units', 'contacts'] as const;
export type ImportType = (typeof importTypes)[number];

export const importRowStatuses = ['new', 'changed', 'unchanged', 'invalid'] as const;
export type ImportRowStatus = (typeof importRowStatuses)[number];

export const importIssueCodes = [
  'required',
  'too_long',
  'invalid_country',
  'invalid_vat_id',
  'invalid_duns',
  'invalid_year',
  'invalid_amount',
  'invalid_currency',
  'unknown_supplier',
  'duplicate_key',
  'identity_conflict',
  'read_only_relationship',
  'unknown_business_unit',
  'unknown_material_group',
  'missing_column',
  'invalid_email',
] as const;
export type ImportIssueCode = (typeof importIssueCodes)[number];

export const importPreviewRowSchema = z.object({
  row: z.number().int().positive(),
  status: z.enum(importRowStatuses),
  values: z.record(z.string(), z.string()),
  issues: z.array(
    z.object({
      field: z.string(),
      code: z.enum(importIssueCodes),
      value: z.string().optional(),
    }),
  ),
  changes: z.array(
    z.object({
      field: z.string(),
      before: z.string(),
      after: z.string(),
    }),
  ),
});
export type ImportPreviewRow = z.infer<typeof importPreviewRowSchema>;

export const importSummarySchema = z.object({
  new: z.number().int().nonnegative(),
  changed: z.number().int().nonnegative(),
  unchanged: z.number().int().nonnegative(),
  invalid: z.number().int().nonnegative(),
});
export type ImportSummary = z.infer<typeof importSummarySchema>;

export const importPreviewSchema = z.object({
  type: z.enum(importTypes),
  rows: z.array(importPreviewRowSchema),
  summary: importSummarySchema,
});
export type ImportPreview = z.infer<typeof importPreviewSchema>;

export const importResultSchema = z.object({
  type: z.enum(importTypes),
  summary: importSummarySchema,
});
export type ImportResult = z.infer<typeof importResultSchema>;

/**
 * Parses an unlabelled German or English monetary value without guessing ambiguous separators.
 * The returned value is always an integer number of cents.
 */
export function parseImportAmount(value: string): number | null {
  const text = value.trim().replace(/[\s€$£]/g, '');
  if (!text || !/^\d[\d.,]*$/.test(text)) return null;

  const commas = [...text.matchAll(/,/g)].length;
  const dots = [...text.matchAll(/\./g)].length;
  let integer = '';
  let fraction = '';

  if (commas > 0 && dots > 0) {
    const decimal = text.lastIndexOf(',') > text.lastIndexOf('.') ? ',' : '.';
    const group = decimal === ',' ? '.' : ',';
    const parts = text.split(decimal);
    if (parts.length !== 2 || !/^\d{1,2}$/.test(parts[1] ?? '')) return null;
    if (!isGroupedInteger(parts[0] ?? '', group)) return null;
    integer = (parts[0] ?? '').replaceAll(group, '');
    fraction = parts[1] ?? '';
  } else if (commas + dots > 0) {
    const separator = commas > 0 ? ',' : '.';
    const parts = text.split(separator);
    if (parts.length > 2 && parts.slice(1).every((part) => /^\d{3}$/.test(part))) {
      if (!isGroupedInteger(text, separator)) return null;
      integer = text.replaceAll(separator, '');
    } else {
      if (parts.length !== 2 || !/^\d{1,2}$/.test(parts[1] ?? '')) return null;
      integer = parts[0] ?? '';
      fraction = parts[1] ?? '';
    }
  } else {
    integer = text;
  }

  if (!/^\d+$/.test(integer) || !/^\d{0,2}$/.test(fraction)) return null;
  const cents = Number(integer) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

function isGroupedInteger(value: string, separator: string): boolean {
  const escaped = separator === '.' ? '\\.' : ',';
  return new RegExp(`^\\d{1,3}(?:${escaped}\\d{3})+$`).test(value);
}
