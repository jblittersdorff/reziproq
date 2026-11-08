import { describe, expect, it } from 'vitest';
import { createSupplierDemoWorkbook } from './generate-demo.js';
import { createImportTemplate, parseImportFile } from './import-file.js';

describe('Importdateien', () => {
  it('liest UTF-8-CSV mit Komma oder Semikolon und ignoriert Vorlagenerklärungen', async () => {
    const csv = Buffer.from(
      'Name;Land;USt-IdNr.\r\n"Beispiel, GmbH";DE;DE123456789\r\n# Name: Erklärung\r\n',
      'utf8',
    );
    await expect(parseImportFile('lieferanten.csv', csv)).resolves.toMatchObject({
      headers: ['Name', 'Land', 'USt-IdNr.'],
      rows: [
        { row: 2, values: { Name: 'Beispiel, GmbH', Land: 'DE', 'USt-IdNr.': 'DE123456789' } },
      ],
    });
  });

  it('liest erzeugte Excel-Vorlagen mit Beispielzeile wieder ein', async () => {
    const template = await createImportTemplate('suppliers', 'xlsx');
    await expect(parseImportFile('lieferanten.xlsx', template)).resolves.toMatchObject({
      headers: [
        'Name',
        'Land',
        'USt-IdNr.',
        'D-U-N-S',
        'Eigene Lieferantennummer',
        'Business Units',
        'Warengruppen',
      ],
      rows: [{ row: 2, values: { Name: 'Beispiel GmbH (Demo)', Land: 'DE' } }],
    });
  });

  it('lehnt ungültige Dateitypen und ungültige UTF-8-CSV mit klaren Codes ab', async () => {
    await expect(parseImportFile('datei.txt', Buffer.from(''))).rejects.toMatchObject({
      response: { code: 'invalid_file_type' },
    });
    await expect(parseImportFile('datei.csv', Buffer.from([0xff]))).rejects.toMatchObject({
      response: { code: 'invalid_encoding' },
    });
  });

  it('lehnt mehr als 5.000 Datenzeilen ab', async () => {
    const csv = Buffer.from(
      ['Name;Land', ...Array(5001).fill('Beispiel GmbH (Demo);DE')].join('\n'),
    );
    await expect(parseImportFile('lieferanten.csv', csv)).rejects.toMatchObject({
      response: { code: 'too_many_rows' },
    });
  });

  it('erzeugt die 50-Lieferanten-Demo mit drei fehlerhaften Korrekturzeilen', async () => {
    const workbook = await createSupplierDemoWorkbook();
    const parsed = await parseImportFile('lieferanten-50.xlsx', workbook);
    expect(parsed.rows).toHaveLength(53);
    expect(parsed.rows.slice(0, 50).every((row) => row.values.Name?.endsWith('(Demo)'))).toBe(true);
    expect(parsed.rows[50]?.values.Land).toBe('');
    expect(parsed.rows[51]?.values['USt-IdNr.']).toBe('DE-UNGÜLTIG');
    expect(parsed.rows[52]?.values.Warengruppen).toBe('Unbekannte Warengruppe');
  });
});
