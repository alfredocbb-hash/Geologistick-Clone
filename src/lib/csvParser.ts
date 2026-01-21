/**
 * CSV Parser Utilities for Shipment Import
 */

export interface CSVParseResult {
  headers: string[];
  rows: Record<string, string>[];
  delimiter: string;
  totalRows: number;
  errors: CSVParseError[];
}

export interface CSVParseError {
  row: number;
  message: string;
  data?: Record<string, string>;
}

export interface ColumnMapping {
  trackingNumber: string;
  senderName: string;
  senderEmail: string;
  recipientName: string;
  recipientAddress: string;
  recipientCity: string;
  recipientPhone: string;
  recipientLat: string;
  recipientLng: string;
  totalPrice: string;
  notes: string;
  orderNumber: string;
  tipoPago: string;
}

// Default column mappings based on the CSV format
export const DEFAULT_COLUMN_MAPPING: ColumnMapping = {
  trackingNumber: 'Pedido N°',
  senderName: 'Cliente remitente',
  senderEmail: 'email de remitentes',
  recipientName: 'DESTINATARIO',
  recipientAddress: 'Dirección',
  recipientCity: 'Ciudad',
  recipientPhone: 'Celular',
  recipientLat: 'LATITUD',
  recipientLng: 'LONGITUD',
  totalPrice: 'Total',
  notes: 'OBSERVACIONES',
  orderNumber: 'Hoja',
  tipoPago: 'Tipo Pago',
};

// Alternative column names that might be used
export const COLUMN_ALIASES: Record<keyof ColumnMapping, string[]> = {
  trackingNumber: ['Pedido N°', 'Pedido', 'Tracking', 'N° Pedido', 'Numero Pedido', 'tracking_number'],
  senderName: ['Cliente remitente', 'Remitente', 'Cliente', 'Sender', 'remitente'],
  senderEmail: ['email de remitentes', 'Email remitente', 'Email', 'email', 'Mail'],
  recipientName: ['DESTINATARIO', 'Destinatario', 'Recipient', 'Nombre destinatario', 'destinatario'],
  recipientAddress: ['Dirección', 'Direccion', 'Address', 'Domicilio', 'direccion_entrega'],
  recipientCity: ['Ciudad', 'City', 'Localidad', 'ciudad'],
  recipientPhone: ['Celular', 'Telefono', 'Teléfono', 'Phone', 'Tel', 'telefono', 'whatsapp'],
  recipientLat: ['LATITUD', 'Latitud', 'Lat', 'lat'],
  recipientLng: ['LONGITUD', 'Longitud', 'Lng', 'Long', 'lng'],
  totalPrice: ['Total', 'Precio', 'Price', 'Monto', 'precio_total'],
  notes: ['OBSERVACIONES', 'Observaciones', 'Notas', 'Notes', 'Comentarios', 'notas'],
  orderNumber: ['Hoja', 'Order', 'N° Orden', 'Numero'],
  tipoPago: ['Tipo Pago', 'tipo_pago', 'Pago', 'Forma Pago', 'payment_type'],
};

/**
 * Detect the delimiter used in the CSV file
 */
export function detectDelimiter(content: string): string {
  const firstLines = content.split('\n').slice(0, 5).join('\n');
  
  const delimiters = [';', ',', '\t', '|'];
  let maxCount = 0;
  let detectedDelimiter = ';';
  
  for (const delimiter of delimiters) {
    const count = (firstLines.match(new RegExp(`\\${delimiter}`, 'g')) || []).length;
    if (count > maxCount) {
      maxCount = count;
      detectedDelimiter = delimiter;
    }
  }
  
  return detectedDelimiter;
}

/**
 * Parse a CSV value, handling quotes
 */
function parseCSVValue(value: string): string {
  if (!value) return '';
  
  // Remove surrounding quotes
  value = value.trim();
  if ((value.startsWith('"') && value.endsWith('"')) || 
      (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  
  // Handle escaped quotes
  value = value.replace(/""/g, '"');
  
  return value.trim();
}

/**
 * Parse a CSV line, handling quoted values with embedded delimiters
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(parseCSVValue(current));
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add the last value
  result.push(parseCSVValue(current));
  
  return result;
}

/**
 * Auto-detect column mapping from headers
 */
export function autoDetectColumnMapping(headers: string[]): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {};
  
  const normalizedHeaders = headers.map(h => h.trim().toLowerCase());
  
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const normalizedAlias = alias.toLowerCase();
      const headerIndex = normalizedHeaders.findIndex(h => 
        h === normalizedAlias || 
        h.includes(normalizedAlias) ||
        normalizedAlias.includes(h)
      );
      
      if (headerIndex !== -1) {
        (mapping as any)[key] = headers[headerIndex];
        break;
      }
    }
  }
  
  return mapping;
}

/**
 * Parse CSV content into structured data
 */
export function parseCSV(content: string): CSVParseResult {
  const errors: CSVParseError[] = [];
  
  // Normalize line endings
  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Detect delimiter
  const delimiter = detectDelimiter(content);
  
  // Split into lines, filter empty
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    return {
      headers: [],
      rows: [],
      delimiter,
      totalRows: 0,
      errors: [{ row: 0, message: 'El archivo está vacío' }],
    };
  }
  
  // Parse headers and trim them to avoid whitespace issues
  const headers = parseCSVLine(lines[0], delimiter).map(h => h.trim());
  
  // Parse rows
  const rows: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line, delimiter);
    
    if (values.length !== headers.length) {
      errors.push({
        row: i + 1,
        message: `La fila tiene ${values.length} columnas pero se esperaban ${headers.length}`,
      });
    }
    
    // Create row object with trimmed headers as keys
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    rows.push(row);
  }
  
  return {
    headers,
    rows,
    delimiter,
    totalRows: rows.length,
    errors,
  };
}

/**
 * Validate a row for required fields
 */
export function validateRow(
  row: Record<string, string>, 
  mapping: Partial<ColumnMapping>,
  rowIndex: number
): CSVParseError | null {
  // Check for tracking number or order number
  const trackingNumber = row[mapping.trackingNumber || ''] || row[mapping.orderNumber || ''];
  if (!trackingNumber) {
    return {
      row: rowIndex,
      message: 'Falta número de tracking o pedido',
      data: row,
    };
  }
  
  // Check for recipient name
  const recipientName = row[mapping.recipientName || ''];
  if (!recipientName) {
    return {
      row: rowIndex,
      message: 'Falta nombre del destinatario',
      data: row,
    };
  }
  
  // Check for address
  const address = row[mapping.recipientAddress || ''];
  if (!address) {
    return {
      row: rowIndex,
      message: 'Falta dirección de entrega',
      data: row,
    };
  }
  
  return null;
}

/**
 * Parse price from string, handling different formats
 */
export function parsePrice(value: string): number {
  if (!value) return 0;
  
  // Remove currency symbols and whitespace
  let cleaned = value.replace(/[^\d.,-]/g, '').trim();
  
  // Handle comma as decimal separator (European format)
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    cleaned = cleaned.replace(',', '.');
  } else if (cleaned.includes(',') && cleaned.includes('.')) {
    // Remove thousands separator
    cleaned = cleaned.replace(',', '');
  }
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Parse coordinates from string
 */
export function parseCoordinate(value: string): number | null {
  if (!value) return null;
  
  // Remove whitespace and handle comma as decimal
  const cleaned = value.trim().replace(',', '.');
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? null : parsed;
}

/**
 * Clean and format phone number
 */
export function cleanPhoneNumber(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Ensure it starts with country code for Argentina
  if (cleaned.startsWith('15')) {
    cleaned = '549' + cleaned.substring(2);
  } else if (cleaned.startsWith('0')) {
    cleaned = '54' + cleaned.substring(1);
  } else if (!cleaned.startsWith('+') && !cleaned.startsWith('54')) {
    cleaned = '54' + cleaned;
  }
  
  return cleaned;
}
