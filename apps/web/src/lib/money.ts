import type { Money } from '@reziproq/shared';
import type { Locale } from './i18n';

const localeTags: Record<Locale, string> = { de: 'de-DE', en: 'en-GB' };

export function formatMoney(
  money: Money,
  locale: Locale,
  {
    compact = false,
    signed = false,
    wholeUnits = false,
  }: {
    compact?: boolean;
    signed?: boolean;
    /** Ohne Nachkommastellen, z. B. 4.820.000 € (Spend auf Lieferantenkarten, PLT-02). */
    wholeUnits?: boolean;
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
    maximumFractionDigits: wholeUnits ? 0 : compact ? 1 : 2,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(money.amountCents / 100);
}

export function formatNumber(value: number, locale: Locale, fractionDigits = 1): string {
  return new Intl.NumberFormat(localeTags[locale], {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}
