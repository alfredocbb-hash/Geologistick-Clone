/**
 * OCR text parser for Argentine shipping labels.
 * Extracts address, city, and postal code from raw OCR output.
 */

export interface OCRExtractedData {
  direccion: string | null;
  localidad: string | null;
  codigoPostal: string | null;
  nombreDestinatario: string | null;
}

/**
 * Clean OCR text: remove junk characters, normalize whitespace
 */
function cleanText(raw: string): string {
  return raw
    .replace(/[^\w\sáéíóúñüÁÉÍÓÚÑÜ.,\-#°\/()]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract postal code (4-digit Argentine CP)
 */
function extractPostalCode(text: string): string | null {
  // Try patterns: "CP 1234", "C.P. 1234", "CP: 1234", "(1234)"
  const patterns = [
    /(?:C\.?P\.?\s*:?\s*)(\d{4})/i,
    /\((\d{4})\)/,
    /(?:^|\s)([A-Z]\d{4}[A-Z]{3})(?:\s|$)/i, // CPA format like B1636FDA
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }

  // Look for standalone 4-digit number that could be a CP
  const standaloneCP = text.match(/(?:^|\s)(\d{4})(?:\s|$)/);
  if (standaloneCP) {
    const num = parseInt(standaloneCP[1]);
    if (num >= 1000 && num <= 9999) {
      return standaloneCP[1];
    }
  }

  return null;
}

/**
 * Extract street address (e.g. "Av. San Martín 1234", "Calle 45 N° 678")
 */
function extractAddress(text: string): string | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Pattern: street name + number
  const addressPatterns = [
    // "Av. Something 1234" or "Calle Something 1234"
    /(?:Av\.?|Avda\.?|Avenida|Calle|Bv\.?|Blvd\.?|Boulevar|Pasaje|Pje\.?|Diagonal|Diag\.?)\s+[A-ZÁÉÍÓÚÑa-záéíóúñ\s.]+\s+\d{1,5}/i,
    // "Something 1234" (word + number at end)
    /[A-ZÁÉÍÓÚÑa-záéíóúñ][A-ZÁÉÍÓÚÑa-záéíóúñ\s.]{2,}\s+\d{1,5}(?:\s|$)/i,
    // "1234 Something" (number + street)
    /\d{1,5}\s+[A-ZÁÉÍÓÚÑa-záéíóúñ][A-ZÁÉÍÓÚÑa-záéíóúñ\s.]{2,}/i,
  ];

  for (const line of lines) {
    for (const pattern of addressPatterns) {
      const match = line.match(pattern);
      if (match) {
        return cleanText(match[0]);
      }
    }
  }

  // Fallback: look for keyword-based extraction
  for (const line of lines) {
    const keywordMatch = line.match(/(?:Direcci[oó]n|Domicilio|Dir\.?)\s*:?\s*(.+)/i);
    if (keywordMatch) {
      return cleanText(keywordMatch[1]);
    }
  }

  return null;
}

/**
 * Extract city/locality
 */
function extractLocality(text: string): string | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Try keyword-based extraction first
  const keywords = [
    /(?:Localidad|Ciudad|City|Loc\.?)\s*:?\s*([A-ZÁÉÍÓÚÑa-záéíóúñ\s.]{2,})/i,
    /(?:Partido|Depto\.?|Departamento)\s*:?\s*([A-ZÁÉÍÓÚÑa-záéíóúñ\s.]{2,})/i,
  ];

  for (const line of lines) {
    for (const pattern of keywords) {
      const match = line.match(pattern);
      if (match) {
        return cleanText(match[1]);
      }
    }
  }

  return null;
}

/**
 * Extract recipient name
 */
function extractRecipientName(text: string): string | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const patterns = [
    /(?:Destinatario|Receptor|Para|Nombre)\s*:?\s*([A-ZÁÉÍÓÚÑa-záéíóúñ\s.]{2,})/i,
  ];

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        return cleanText(match[1]);
      }
    }
  }

  return null;
}

/**
 * Main parser: extract all data from OCR text
 */
export function parseOCRText(rawText: string): OCRExtractedData {
  const text = rawText.replace(/\r\n/g, '\n');

  return {
    direccion: extractAddress(text),
    localidad: extractLocality(text),
    codigoPostal: extractPostalCode(text),
    nombreDestinatario: extractRecipientName(text),
  };
}
