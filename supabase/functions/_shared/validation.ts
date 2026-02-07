/**
 * Shared input validation helpers for edge functions.
 * Lightweight validators without external dependencies.
 */

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
}

export function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export function isValidPhone(phone: string): boolean {
  return /^\+?[\d\s()-]{6,20}$/.test(phone);
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(slug);
}

export function sanitizeString(str: string, maxLength = 255): string {
  return str.trim().substring(0, maxLength);
}

export function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && value > 0 && isFinite(value);
}

export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180 &&
    isFinite(lat) && isFinite(lng)
  );
}

export function errorResponse(message: string, status = 400, headers: Record<string, string> = {}) {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...headers, "Content-Type": "application/json" } }
  );
}

export function parseJsonSafe(text: string): { ok: true; data: unknown } | { ok: false } {
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/** Validate a set of required string fields exist and are non-empty */
export function validateRequired(
  body: Record<string, unknown>,
  fields: string[]
): string | null {
  for (const field of fields) {
    const val = body[field];
    if (val === undefined || val === null || (typeof val === "string" && val.trim() === "")) {
      return `${field} es requerido`;
    }
  }
  return null;
}

/** Validate password meets minimum requirements */
export function validatePassword(password: string): string | null {
  if (!password || password.length < 8) {
    return "La contraseña debe tener al menos 8 caracteres";
  }
  if (password.length > 128) {
    return "La contraseña es demasiado larga";
  }
  return null;
}

/** Validate an array has reasonable bounds */
export function validateArrayLength(
  arr: unknown[],
  minLength: number,
  maxLength: number,
  fieldName = "array"
): string | null {
  if (!Array.isArray(arr)) {
    return `${fieldName} debe ser un arreglo`;
  }
  if (arr.length < minLength) {
    return `${fieldName} debe tener al menos ${minLength} elementos`;
  }
  if (arr.length > maxLength) {
    return `${fieldName} no puede tener más de ${maxLength} elementos`;
  }
  return null;
}
