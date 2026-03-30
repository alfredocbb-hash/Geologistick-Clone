/**
 * Export data to Excel (.xlsx) format using the xlsx library
 */
import * as XLSX from 'xlsx';

interface ExcelColumn {
  header: string;
  key: string;
  format?: 'number' | 'currency' | 'percent' | 'text';
}

interface ExportExcelOptions {
  filename: string;
  sheetName?: string;
  columns: ExcelColumn[];
  data: Record<string, any>[];
}

function formatValue(value: any, format?: string): string | number {
  if (value === null || value === undefined) return '';
  if (format === 'currency') return Number(value);
  if (format === 'percent') return Number(value) / 100;
  if (format === 'number') return Number(value);
  return String(value);
}

export function exportToExcel({ filename, sheetName = 'Reporte', columns, data }: ExportExcelOptions) {
  // Build header row
  const headers = columns.map(c => c.header);
  
  // Build data rows
  const rows = data.map(row =>
    columns.map(col => formatValue(row[col.key], col.format))
  );

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths based on header length and data
  ws['!cols'] = columns.map((col, i) => {
    const maxDataLen = Math.max(
      col.header.length,
      ...data.slice(0, 50).map(row => String(row[col.key] ?? '').length)
    );
    return { wch: Math.min(Math.max(maxDataLen + 4, 12), 30) };
  });

  // Apply currency format to currency columns
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = 1; R <= range.e.r; R++) {
    for (let C = 0; C <= range.e.c; C++) {
      const col = columns[C];
      if (!col) continue;
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (!cell) continue;
      if (col.format === 'currency') {
        cell.t = 'n';
        cell.z = '$#,##0.00';
      } else if (col.format === 'percent') {
        cell.t = 'n';
        cell.z = '0.0%';
      } else if (col.format === 'number') {
        cell.t = 'n';
        cell.z = '#,##0';
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
