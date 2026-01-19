/**
 * Utility to extract tracking numbers from various QR code formats
 * Supports:
 * - Direct tracking numbers (e.g., "001-ENV-20250118-ABC123")
 * - URLs with ?q= parameter (e.g., "https://example.com/tracking?q=001-ENV-20250118-ABC123")
 * - URLs with path segment (e.g., "https://example.com/tracking/001-ENV-20250118-ABC123")
 * - Route sheet QR codes (e.g., "HR:HR-20250118-0001")
 */

export interface ParsedQR {
  type: 'tracking' | 'route_sheet' | 'unknown';
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

  let tracking = trimmed;

  // Check if it's a URL
  if (trimmed.includes('://') || trimmed.startsWith('www.')) {
    try {
      // Add protocol if missing for URL parsing
      const urlString = trimmed.startsWith('www.') ? `https://${trimmed}` : trimmed;
      const url = new URL(urlString);
      
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

  // Validate that we have something that looks like a tracking number
  if (tracking && tracking.length >= 5) {
    return {
      type: 'tracking',
      value: tracking.toUpperCase(),
      originalData: data
    };
  }

  return { type: 'unknown', value: trimmed, originalData: data };
}
