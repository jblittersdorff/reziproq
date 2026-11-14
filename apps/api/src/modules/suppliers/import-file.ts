import { Readable } from 'node:stream';
import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';

export interface ParsedImportFile {
  headers: string[];
  rows: { row: number; values: Record<string, string> }[];
}

export async function parseImportFile(fileName: string, buffer: Buffer): Promise<ParsedImportFile> {
  const extension = fileName.toLocaleLowerCase('en').split('.').at(-1);
  if (extension !== 'csv' && extension !== 'xlsx') {
    throw new BadRequestException({
      code: 'invalid_file_type',
      message: 'Nur CSV und XLSX sind erlaubt.',
    });
  }
  if (buffer.byteLength === 0) {
    throw new BadRequestException({ code: 'empty_file', message: 'Die Datei ist leer.' });
  }

  if (extension === 'csv') return parseCsv(buffer);
  return parseXlsx(buffer);
}

async function parseXlsx(buffer: Buffer): Promise<ParsedImportFile> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.read(Readable.from([buffer]));
  } catch (error) {
    if (error instanceof Error) {
      throw new BadRequestException({
        code: 'invalid_file',
        message: 'Die Excel-Datei kann nicht gelesen werden.',
      });
    }
    throw error;
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new BadRequestException({
      code: 'empty_file',
      message: 'Die Datei enthält kein Tabellenblatt.',
    });
  }
  const matrix: string[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      values[column - 1] = cellValue(cell.value);
    });
    matrix.push(values);
  });
  return parsedMatrix(matrix);
}

function cellValue(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object' && 'richText' in value) {
    return value.richText.map((part) => part.text).join('');
  }
  throw new BadRequestException({
    code: 'unsupported_cell',
    message: 'Formeln und Datumszellen werden in Importdateien nicht unterstützt.',
  });
}

function parseCsv(buffer: Buffer): ParsedImportFile {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '');
  } catch {
    throw new BadRequestException({
      code: 'invalid_encoding',
      message: 'Die CSV-Datei muss als UTF-8 gespeichert sein.',
    });
  }

  const firstLine = text.split(/\r?\n/).find((line) => line.trim() && !isCommentLine(line));
  if (!firstLine) {
    throw new BadRequestException({
      code: 'empty_file',
      message: 'Die Datei enthält keine Daten.',
    });
  }
  const delimiter = delimiterOf(firstLine);
  const matrix = parseDelimitedText(text, delimiter);
  return parsedMatrix(matrix);
}

function delimiterOf(line: string): ',' | ';' {
  let quoted = false;
  let commas = 0;
  let semicolons = 0;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && character === ',') commas += 1;
    else if (!quoted && character === ';') semicolons += 1;
  }
  return semicolons > commas ? ';' : ',';
}

function parseDelimitedText(text: string, delimiter: ',' | ';'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && character === delimiter) {
      row.push(cell);
      cell = '';
    } else if (!quoted && (character === '\n' || character === '\r')) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== '') && !isCommentLine(row[0] ?? '')) {
        rows.push(row);
      }
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  if (quoted) {
    throw new BadRequestException({
      code: 'invalid_csv',
      message: 'Die CSV-Datei enthält ein nicht geschlossenes Anführungszeichen.',
    });
  }
  row.push(cell);
  if (row.some((value) => value.trim() !== '') && !isCommentLine(row[0] ?? '')) {
    rows.push(row);
  }
  return rows;
}

function isCommentLine(value: string) {
  return value.trimStart().startsWith('# ');
}

function parsedMatrix(matrix: string[][]): ParsedImportFile {
  const [headerRow, ...dataRows] = matrix;
  const headers = (headerRow ?? []).map((header) => header.trim());
  if (headers.length === 0 || headers.some((header) => !header)) {
    throw new BadRequestException({
      code: 'invalid_header',
      message: 'Spaltenüberschriften fehlen.',
    });
  }
  const normalizedHeaders = headers.map(normalizeHeader);
  if (new Set(normalizedHeaders).size !== normalizedHeaders.length) {
    throw new BadRequestException({
      code: 'duplicate_header',
      message: 'Die Datei enthält doppelte Spaltenüberschriften.',
    });
  }
  if (dataRows.length > 5000) {
    throw new BadRequestException({
      code: 'too_many_rows',
      message: 'Eine Datei darf höchstens 5.000 Datenzeilen enthalten.',
    });
  }
  return {
    headers,
    rows: dataRows.map((values, index) => ({
      row: index + 2,
      values: Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ''])),
    })),
  };
}

export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLocaleLowerCase('de')
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]/g, '');
}

type TemplateColumn = readonly [header: string, explanation: string, example: string];

export function templateHeaders(
  type: 'suppliers' | 'spend' | 'business-units' | 'contacts',
  locale: 'de' | 'en' = 'de',
): readonly TemplateColumn[] {
  const english = locale === 'en';
  switch (type) {
    case 'suppliers':
      return [
        [
          'Name',
          english ? 'Required: supplier name.' : 'Pflicht: Name des Lieferanten.',
          'Beispiel GmbH (Demo)',
        ],
        [
          english ? 'Country' : 'Land',
          english
            ? 'Required: ISO country code, for example DE.'
            : 'Pflicht: ISO-Ländercode, zum Beispiel DE.',
          'DE',
        ],
        [
          english ? 'VAT ID' : 'USt-IdNr.',
          english
            ? 'Optional: VAT identification number.'
            : 'Optional: Umsatzsteuer-Identifikationsnummer.',
          'DE123456789',
        ],
        [
          'D-U-N-S',
          english ? 'Optional: exactly nine digits.' : 'Optional: genau neun Ziffern.',
          '123456789',
        ],
        [
          english ? 'Own supplier number' : 'Eigene Lieferantennummer',
          english
            ? 'Optional: your unique number in the ERP.'
            : 'Optional: deine eindeutige Nummer im ERP.',
          'L-10001',
        ],
        [
          'Business Units',
          english
            ? 'Optional: names separated by semicolons.'
            : 'Optional: Namen, durch Semikolon getrennt.',
          'Pkw; Ersatzteile',
        ],
        [
          english ? 'Material groups' : 'Warengruppen',
          english
            ? 'Optional: names separated by semicolons; the first is the primary group.'
            : 'Optional: Namen, durch Semikolon getrennt; die erste ist die Haupt-Warengruppe.',
          'Elektronik; Sensorik',
        ],
      ];
    case 'spend':
      return [
        [
          english ? 'Own supplier number' : 'Eigene Lieferantennummer',
          english
            ? 'Required: number from your supplier list.'
            : 'Pflicht: Nummer aus deiner Lieferantenliste.',
          'L-10001',
        ],
        [
          english ? 'Year' : 'Jahr',
          english ? 'Required: calendar year from 2000.' : 'Pflicht: Kalenderjahr ab 2000.',
          '2025',
        ],
        [
          english ? 'Amount' : 'Betrag',
          english
            ? 'Required: German or English number format.'
            : 'Pflicht: Betrag in deutschem oder englischem Zahlenformat.',
          '1.234,56',
        ],
        [
          english ? 'Currency' : 'Währung',
          english
            ? 'Optional: ISO-4217 code, defaults to EUR.'
            : 'Optional: ISO-4217-Code, Standard EUR.',
          'EUR',
        ],
        [
          english ? 'Type' : 'Art',
          english
            ? 'Optional: Actual or Plan, defaults to Actual.'
            : 'Optional: Ist oder Plan, Standard Ist.',
          english ? 'Actual' : 'Ist',
        ],
        [
          'Business Unit',
          english
            ? 'Optional: one Business Unit; empty applies to the whole supplier.'
            : 'Optional: eine Business Unit; leer gilt für den ganzen Lieferanten.',
          'Pkw',
        ],
        [
          english ? 'Material group' : 'Warengruppe',
          english
            ? 'Optional: one material group; empty applies to the whole supplier.'
            : 'Optional: eine Warengruppe; leer gilt für den ganzen Lieferanten.',
          'Elektronik',
        ],
      ];
    case 'business-units':
      return [
        [
          'Name',
          english ? 'Required: Business Unit name.' : 'Pflicht: Name der Business Unit.',
          'Pkw',
        ],
        [
          'Code',
          english
            ? 'Optional: unique Business Unit code.'
            : 'Optional: eindeutiger Code der Business Unit.',
          'BU-01',
        ],
      ];
    case 'contacts':
      return [
        [
          english ? 'Own supplier number' : 'Eigene Lieferantennummer',
          english
            ? 'Required: number from your supplier list.'
            : 'Pflicht: Nummer aus deiner Lieferantenliste.',
          'L-10001',
        ],
        [
          'Name',
          english
            ? 'Required: business contact name.'
            : 'Pflicht: Name des geschäftlichen Kontakts.',
          'Anna Beispiel',
        ],
        [
          english ? 'Email' : 'E-Mail',
          english ? 'Required: business email address.' : 'Pflicht: geschäftliche E-Mail-Adresse.',
          'anna.beispiel@example.com',
        ],
        [
          english ? 'Function' : 'Funktion',
          english ? 'Optional: contact function.' : 'Optional: Funktion des Kontakts.',
          'Purchasing',
        ],
        ['Position', english ? 'Optional: job title.' : 'Optional: berufliche Position.', 'Buyer'],
      ];
  }
}

export async function createImportTemplate(
  type: 'suppliers' | 'spend' | 'business-units' | 'contacts',
  format: 'csv' | 'xlsx',
  locale: 'de' | 'en' = 'de',
): Promise<Buffer> {
  const definitions = templateHeaders(type, locale);
  const headers = definitions.map(([header]) => header);
  const example = definitions.map(([, , value]) => value);

  if (format === 'csv') {
    const quoteCell = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const lines = [
      headers.map(quoteCell).join(';'),
      example.map(quoteCell).join(';'),
      ...definitions.map(([header, explanation]) => `# ${header}: ${explanation}`),
    ];
    return Buffer.from(`${lines.join('\r\n')}\r\n`, 'utf8');
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Import');
  worksheet.addRow(headers);
  worksheet.addRow(example);
  definitions.forEach(([header, explanation], index) => {
    const cell = worksheet.getCell(1, index + 1);
    cell.font = { bold: true };
    cell.note = explanation;
    worksheet.getColumn(index + 1).width = Math.min(Math.max(header.length + 4, 20), 40);
  });
  worksheet.addTable({
    name: 'ImportVorlage',
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: headers.map((name) => ({ name, filterButton: true })),
    rows: [example],
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
