/**
 * OCR text parser for Argentine shipping labels (especially MercadoLibre).
 * Extracts address, city, postal code, recipient, ML shipment ID, referencia, barrio.
 */
import { getBarrioByCP } from './cabaBarriosByCP';

export interface OCRExtractedData {
  direccion: string | null;
  localidad: string | null;
  codigoPostal: string | null;
  nombreDestinatario: string | null;
  mlShipmentId: string | null;
  referencia: string | null;
  barrio: string | null;
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
 * Extract ML shipment ID (e.g. "Envio: 46236169153", "Envío 46236169153")
 */
function extractMLShipmentId(text: string): string | null {
  const patterns = [
    /Env[ií]o\s*:?\s*#?\s*(\d{8,12})/i,
    /N[°º]?\s*env[ií]o\s*:?\s*(\d{8,12})/i,
    /shipment\s*:?\s*#?\s*(\d{8,12})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Extract postal code (4-digit Argentine CP)
 */
function extractPostalCode(text: string): string | null {
  const patterns = [
    /(?:C\.?P\.?\s*:?\s*)(\d{4})/i,
    /(?:Cp\s*:?\s*)(\d{4})/i,
    /\((\d{4})\)/,
    /(?:^|\s)([A-Z]\d{4}[A-Z]{3})(?:\s|$)/i, // CPA format like B1636FDA
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  // Look for standalone 4-digit number that could be a CP
  const standaloneCP = text.match(/(?:^|\s)(\d{4})(?:\s|$)/);
  if (standaloneCP) {
    const num = parseInt(standaloneCP[1]);
    if (num >= 1000 && num <= 9999) return standaloneCP[1];
  }

  return null;
}

/**
 * Extract street address
 */
function extractAddress(text: string): string | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Priority 1: keyword-based (ML labels use "Dirección:")
  for (const line of lines) {
    const keywordMatch = line.match(/(?:Direcci[oó]n|Domicilio|Dir\.?)\s*:?\s*(.+)/i);
    if (keywordMatch) return cleanText(keywordMatch[1]);
  }

  // Priority 2: pattern-based street + number
  const addressPatterns = [
    /(?:Av\.?|Avda\.?|Avenida|Calle|Bv\.?|Blvd\.?|Boulevar|Pasaje|Pje\.?|Diagonal|Diag\.?)\s+[A-ZÁÉÍÓÚÑa-záéíóúñ\s.]+\s+\d{1,5}/i,
    /[A-ZÁÉÍÓÚÑa-záéíóúñ][A-ZÁÉÍÓÚÑa-záéíóúñ\s.]{2,}\s+\d{1,5}(?:\s|$)/i,
    /\d{1,5}\s+[A-ZÁÉÍÓÚÑa-záéíóúñ][A-ZÁÉÍÓÚÑa-záéíóúñ\s.]{2,}/i,
  ];

  for (const line of lines) {
    for (const pattern of addressPatterns) {
      const match = line.match(pattern);
      if (match) return cleanText(match[0]);
    }
  }

  return null;
}

/**
 * Extract city/locality
 */
function extractLocality(text: string): string | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const keywords = [
    /(?:Localidad|Ciudad|City|Loc\.?)\s*:?\s*([A-ZÁÉÍÓÚÑa-záéíóúñ\s.]{2,})/i,
    /(?:Partido|Depto\.?|Departamento)\s*:?\s*([A-ZÁÉÍÓÚÑa-záéíóúñ\s.]{2,})/i,
  ];

  for (const line of lines) {
    for (const pattern of keywords) {
      const match = line.match(pattern);
      if (match) return cleanText(match[1]);
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
    /(?:Destinatario|Dest\.?|Receptor|Para|Nombre)\s*:?\s*([A-ZÁÉÍÓÚÑa-záéíóúñ\s.]{2,})/i,
  ];

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) return cleanText(match[1]);
    }
  }

  return null;
}

/**
 * Extract referencia / observaciones
 */
function extractReferencia(text: string): string | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const match = line.match(/(?:Referencia|Ref\.?|Observaci[oó]n|Obs\.?)\s*:?\s*(.+)/i);
    if (match) return cleanText(match[1]);
  }

  return null;
}

/**
 * Extract barrio / partido
 */
function extractBarrio(text: string): string | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const match = line.match(/(?:Barrio|Partido)\s*:?\s*([A-ZÁÉÍÓÚÑa-záéíóúñ\s.]{2,})/i);
    if (match) return cleanText(match[1]);
  }

  return null;
}

/**
 * Main parser: extract all data from OCR text
 */
export function parseOCRText(rawText: string): OCRExtractedData {
  const text = rawText.replace(/\r\n/g, '\n');

  const codigoPostal = extractPostalCode(text);
  let localidad = extractLocality(text);
  const barrio = extractBarrio(text);

  // Si localidad es genérica de CABA, intentar reemplazar por barrio real (del texto o del CP)
  if (localidad) {
    const norm = localidad.trim().toLowerCase();
    const isGenericCaba =
      norm === 'buenos aires' ||
      norm === 'caba' ||
      norm === 'capital federal' ||
      norm.startsWith('ciudad aut');
    if (isGenericCaba) {
      if (barrio) {
        localidad = barrio;
      } else if (codigoPostal) {
        // Import dinámico evita ciclos si el helper crece
        const { getBarrioByCP } = require('./cabaBarriosByCP') as typeof import('./cabaBarriosByCP');
        const inferred = getBarrioByCP(codigoPostal);
        if (inferred) localidad = inferred;
      }
    }
  }

  return {
    direccion: extractAddress(text),
    localidad,
    codigoPostal,
    nombreDestinatario: extractRecipientName(text),
    mlShipmentId: extractMLShipmentId(text),
    referencia: extractReferencia(text),
    barrio,
  };
}
