import { countryCodes } from '@reziproq/shared';

const names = new Intl.DisplayNames(['de'], { type: 'region' });

/** Alle Länder für die Auswahlliste, nach deutschem Namen sortiert. */
export const countryOptions = countryCodes
  .map((code) => ({ code, name: names.of(code) ?? code }))
  .sort((a, b) => a.name.localeCompare(b.name, 'de'));
