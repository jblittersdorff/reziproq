import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoSupplierImportInvalidRows, demoSupplierImportRows } from '@reziproq/shared';
import ExcelJS from 'exceljs';
import { templateHeaders } from './import-file.js';

const outputPath = fileURLToPath(
  new URL('../../../../../docs/demo/lieferanten-50.xlsx', import.meta.url),
);

export async function createSupplierDemoWorkbook() {
  const definitions = templateHeaders('suppliers');
  const headers = definitions.map(([header]) => header);
  const rows = [...demoSupplierImportRows, ...demoSupplierImportInvalidRows].map((supplier) => [
    supplier.name,
    supplier.country,
    supplier.vatId,
    '',
    supplier.externalRef,
    supplier.businessUnits,
    supplier.materialGroups,
  ]);
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Lieferanten');
  worksheet.addRow(headers);
  definitions.forEach(([header, explanation], index) => {
    const cell = worksheet.getCell(1, index + 1);
    cell.font = { bold: true };
    cell.note = explanation;
    worksheet.getColumn(index + 1).width = Math.min(Math.max(header.length + 4, 20), 40);
  });
  worksheet.addTable({
    name: 'LieferantenDemo',
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: headers.map((name) => ({ name, filterButton: true })),
    rows,
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const buffer = await createSupplierDemoWorkbook();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buffer);
  console.log(`Demo-Importdatei geschrieben: ${outputPath}`);
}
