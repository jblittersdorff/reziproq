const regions = [
  'Alpen',
  'Baltic',
  'Donau',
  'Elbe',
  'Fjord',
  'Isar',
  'Komet',
  'Lumen',
  'Morgen',
  'Nordstern',
] as const;
const specialities = ['Elektronik', 'Präzision', 'Komponenten', 'Technik', 'Industrie'] as const;
const countries = ['DE', 'PL', 'CZ', 'IT', 'AT', 'FR', 'NL', 'ES', 'SE', 'US'] as const;

export const demoSupplierImportRows = Array.from({ length: 50 }, (_, index) => {
  const region = regions[index % regions.length];
  const speciality = specialities[Math.floor(index / regions.length)];
  const country = countries[index % countries.length];
  return {
    name: `${region} ${speciality} ${String(index + 1).padStart(2, '0')} GmbH (Demo)`,
    country,
    vatId: `${country}${String(900_000_001 + index)}`,
    externalRef: `DEMO-${String(index + 1).padStart(4, '0')}`,
    businessUnits: 'Pkw',
    materialGroups: 'Elektronik',
  };
});

export const demoSupplierImportInvalidRows = [
  {
    name: 'Fehlendes Land (Demo)',
    country: '',
    vatId: '',
    externalRef: 'DEMO-FEHLER-LAND',
    businessUnits: 'Pkw',
    materialGroups: 'Elektronik',
  },
  {
    name: 'Ungültige Umsatzsteuer (Demo)',
    country: 'DE',
    vatId: 'DE-UNGÜLTIG',
    externalRef: 'DEMO-FEHLER-UST',
    businessUnits: 'Pkw',
    materialGroups: 'Elektronik',
  },
  {
    name: 'Unbekannte Warengruppe (Demo)',
    country: 'DE',
    vatId: 'DE999000001',
    externalRef: 'DEMO-FEHLER-WARENGRUPPE',
    businessUnits: 'Pkw',
    materialGroups: 'Unbekannte Warengruppe',
  },
] as const;
