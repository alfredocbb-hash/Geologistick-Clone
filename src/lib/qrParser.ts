/**
 * Utility to extract tracking numbers from various QR code formats
 * Supports:
 * - Direct tracking numbers (e.g., "001-ENV-20250118-ABC123")
 * - URLs with ?q= parameter (e.g., "https://example.com/tracking?q=001-ENV-20250118-ABC123")
 * - URLs with path segment (e.g., "https://example.com/tracking/001-ENV-20250118-ABC123")
 * - Route sheet QR codes (e.g., "HR:HR-20250118-0001")
 * - MercadoLibre shipment IDs (e.g., "ML:40070866801" or numeric "40070866801")
 * - MercadoLibre tracking URLs
 */

export interface ParsedQR {
  type: 'tracking' | 'route_sheet' | 'ml_shipment' | 'unknown';
  value: string;
  originalData: string;
}

export function parseQRCode(data: string): ParsedQR {
  if (!data || typeof data !== 'string') {
    return { type: 'unknown', value: '', originalData: data || '' };
  }

  const trimmed = data.trim();
  
  // Check for route sheet format: HR:xxxx
  if (trimmed.startsWith('HR:')) {
    return {
      type: 'route_sheet',
      value: trimmed.substring(3).trim(),
      originalData: data
    };
  }

  // Check for MercadoLibre format with ML: prefix
  if (/^ML:\d{8,}$/i.test(trimmed)) {
    return {
      type: 'ml_shipment',
      value: trimmed.replace(/^ML:/i, ''),
      originalData: data
    };
  }

  // Check for pure numeric ML shipment ID (10+ digits)
  if (/^\d{10,}$/.test(trimmed)) {
    return {
      type: 'ml_shipment',
      value: trimmed,
      originalData: data
    };
  }

  let tracking = trimmed;

  // Check if it's a URL
  if (trimmed.includes('://') || trimmed.startsWith('www.')) {
    try {
      // Add protocol if missing for URL parsing
      const urlString = trimmed.startsWith('www.') ? `https://${trimmed}` : trimmed;
      const url = new URL(urlString);
      
      // Check for MercadoLibre tracking URLs
      if (url.hostname.includes('mercadolibre') || url.hostname.includes('mercadopago')) {
        const idParam = url.searchParams.get('id') || url.searchParams.get('shipment_id');
        if (idParam && /^\d{8,}$/.test(idParam)) {
          return {
            type: 'ml_shipment',
            value: idParam,
            originalData: data
          };
        }
        // Check path for ML shipment ID
        const pathMatch = url.pathname.match(/\/(\d{10,})(?:\/|$)/);
        if (pathMatch) {
          return {
            type: 'ml_shipment',
            value: pathMatch[1],
            originalData: data
          };
        }
      }
      
      // First, try to get 'q' parameter (most common for tracking URLs)
      const qParam = url.searchParams.get('q');
      if (qParam) {
        tracking = qParam.trim();
      } else {
        // Fallback: get last path segment
        const pathParts = url.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) {
          tracking = pathParts[pathParts.length - 1].trim();
        }
      }
    } catch {
      // URL parsing failed, try regex fallback for ?q= parameter
      const qMatch = trimmed.match(/[?&]q=([^&]+)/);
      if (qMatch && qMatch[1]) {
        tracking = decodeURIComponent(qMatch[1]).trim();
      } else if (trimmed.includes('/')) {
        // Last segment fallback
        const parts = trimmed.split('/');
        tracking = parts[parts.length - 1].split('?')[0].trim();
      }
    }
  }

  // Clean up any remaining URL-encoded characters
  try {
    tracking = decodeURIComponent(tracking);
  } catch {
    // Already decoded or not encoded
  }

  // Check if extracted value looks like ML shipment ID
  if (/^\d{10,}$/.test(tracking)) {
    return {
      type: 'ml_shipment',
      value: tracking,
      originalData: data
    };
  }

  // Normalize: remove package suffix like -01, -02 if tracking has format XXX-ENV-YYYYMMDD-HASH-XX
  // Pattern: code-ENV-date-hash-suffix where suffix is 1-2 digits
  if (/^[A-Z0-9]+-ENV-\d{8}-[A-Z0-9]+-\d{1,2}$/i.test(tracking)) {
    tracking = tracking.replace(/-\d{1,2}$/, '');
  }

  // Validate that we have something that looks like a tracking number
  if (tracking && tracking.length >= 5) {
    return {
      type: 'tracking',
      value: tracking,
      originalData: data
    };
  }

  return { type: 'unknown', value: trimmed, originalData: data };
}
