import type { Money } from '@reziproq/shared';
import type { Locale } from './i18n';

export const localeTags: Record<Locale, string> = { de: 'de-DE', en: 'en-GB' };

export function formatMoney(
  money: Money,
  locale: Locale,
  {
    compact = false,
    signed = false,
    wholeUnits = false,
    fractionDigits,
  }: {
    compact?: boolean;
    signed?: boolean;
    /** Ohne Nachkommastellen, z. B. 4.820.000 € (Spend auf Lieferantenkarten, PLT-02). */
    wholeUnits?: boolean;
    /** Höchstens so viele Nachkommastellen, z. B. 2 für „3,15 Mio. €“ (BZ-01) */
    fractionDigits?: number;
  } = {},
): string {
  if (!Number.isInteger(money.amountCents)) {
    throw new Error('Geldbeträge müssen ganze Cent sein');
  }
  return new Intl.NumberFormat(localeTags[locale], {
    style: 'currency',
    currency: money.currency,
    notation: compact ? 'compact' : 'standard',
    minimumFractionDigits: wholeUnits ? 0 : undefined,
    maximumFractionDigits: fractionDigits ?? (wholeUnits ? 0 : compact ? 1 : 2),
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(money.amountCents / 100);
}

export function formatNumber(value: number, locale: Locale, fractionDigits = 1): string {
  return new Intl.NumberFormat(localeTags[locale], {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}
