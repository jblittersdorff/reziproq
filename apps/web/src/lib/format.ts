import { countryCodes, type Money } from '@reziproq/shared';
import { useMemo } from 'react';
import { type Locale, useLocale } from './i18n';
import { formatMoney, localeTags } from './money';

/**
 * Zahlen, Daten, Beträge und Ländernamen im Format der gewählten Sprache (PLT-09), über Intl.
 * Die Währung bleibt die des Betrags: Deutsch „1.234.567 €“, Englisch „€1,234,567“.
 */
export function createFormat(locale: Locale) {
  const tag = localeTags[locale];
  const countries = new Intl.DisplayNames([locale], { type: 'region' });
  const date = new Intl.DateTimeFormat(tag, { dateStyle: 'medium' });
  const dateTime = new Intl.DateTimeFormat(tag, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const plain = new Intl.NumberFormat(tag, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return {
    locale,
    /** Ländername aus ISO-Code; ohne Code „–“ */
    country: (code: string | null) => (code ? (countries.of(code) ?? code) : '–'),
    /** Alle Länder für Auswahllisten, nach Namen in der Sprache sortiert */
    countryOptions: () =>
      countryCodes
        .map((code) => ({ code, name: countries.of(code) ?? code }))
        .sort((a, b) => a.name.localeCompare(b.name, locale)),
    date: (iso: string) => date.format(new Date(iso)),
    dateTime: (iso: string) => dateTime.format(new Date(iso)),
    /** Betrag in Cent für ein Eingabefeld, ohne Währungszeichen, z. B. „980.000“ oder „980,000“ */
    amountInput: (cents: number) => plain.format(cents / 100),
    /** Zahl mit bis zu zwei Nachkommastellen, z. B. „0,9“ */
    number: (value: number) => plain.format(value),
    money: (money: Money, options?: Parameters<typeof formatMoney>[2]) =>
      formatMoney(money, locale, options),
  };
}

export type Format = ReturnType<typeof createFormat>;

/** Formate der gewählten Sprache; wechselt mit der Sprache sofort. */
export function useFormat(): Format {
  const { locale } = useLocale();
  return useMemo(() => createFormat(locale), [locale]);
}
