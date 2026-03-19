/**
 * Export data to Excel (.xlsx) format using a simple CSV-based approach
 * that Excel can open natively.
 */

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

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatValue(value: any, format?: string): string {
  if (value === null || value === undefined) return '';
  if (format === 'currency') return `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  if (format === 'percent') return `${Number(value).toFixed(1)}%`;
  if (format === 'number') return Number(value).toLocaleString('es-AR');
  return String(value);
}

export function exportToExcel({ filename, columns, data }: ExportExcelOptions) {
  // BOM for Excel to recognize UTF-8
  const BOM = '\uFEFF';
  
  // Header row
  const headerRow = columns.map(c => escapeCSV(c.header)).join(',');
  
  // Data rows
  const dataRows = data.map(row =>
    columns.map(col => escapeCSV(formatValue(row[col.key], col.format))).join(',')
  );
  
  const csvContent = BOM + [headerRow, ...dataRows].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
