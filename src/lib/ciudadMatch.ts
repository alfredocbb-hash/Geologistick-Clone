/**
 * Matching de ciudades tolerante al cambio "Buenos Aires" → barrios CABA.
 *
 * Reglas configuradas históricamente como "Buenos Aires" / "CABA" / "Capital Federal"
 * deben seguir matcheando contra envíos cuya ciudad ahora es "Palermo", "Belgrano", etc.
 * Se resuelve con el CP del envío (rango CABA) y el catálogo de barrios.
 */

import { CABA_BARRIO_BY_CP, isCabaCP, isGenericCabaCity } from "./cabaBarriosByCP";

export function normalizeCiudad(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toString()
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const CABA_GENERIC_NORM = new Set(
  [
    "buenos aires",
    "caba",
    "capital federal",
    "ciudad autonoma de buenos aires",
    "ciudad de buenos aires",
    "ciudad autonoma",
  ].map(normalizeCiudad),
);

const CABA_BARRIOS_NORM: Set<string> = new Set(
  Object.values(CABA_BARRIO_BY_CP).map((b) => normalizeCiudad(b)),
);

export function isCabaGeneric(city: string | null | undefined): boolean {
  const n = normalizeCiudad(city);
  if (!n) return false;
  if (CABA_GENERIC_NORM.has(n)) return true;
  // Fallback textual
  return isGenericCabaCity(city);
}

export function isCabaBarrio(city: string | null | undefined): boolean {
  const n = normalizeCiudad(city);
  if (!n) return false;
  return CABA_BARRIOS_NORM.has(n);
}

/**
 * Comparación exacta (con equivalencia CABA).
 */
export function ciudadMatchExact(
  zoneCity: string | null | undefined,
  shipmentCity: string | null | undefined,
  shipmentCP?: string | null,
): boolean {
  const z = normalizeCiudad(zoneCity);
  const s = normalizeCiudad(shipmentCity);
  if (!z || !s) return false;
  if (z === s) return true;
  return cabaEquivalent(z, s, shipmentCP);
}

/**
 * Comparación parcial (substring). Mantiene la equivalencia CABA.
 */
export function ciudadMatchPartial(
  zoneCity: string | null | undefined,
  shipmentCity: string | null | undefined,
  shipmentCP?: string | null,
): boolean {
  const z = normalizeCiudad(zoneCity);
  const s = normalizeCiudad(shipmentCity);
  if (!z || !s) return false;
  if (z.includes(s) || s.includes(z)) return true;
  return cabaEquivalent(z, s, shipmentCP);
}

/**
 * Comparación combinada (exacta o parcial + equivalencia CABA).
 */
export function ciudadMatch(
  zoneCity: string | null | undefined,
  shipmentCity: string | null | undefined,
  shipmentCP?: string | null,
): boolean {
  return ciudadMatchPartial(zoneCity, shipmentCity, shipmentCP);
}

function cabaEquivalent(
  zNorm: string,
  sNorm: string,
  shipmentCP?: string | null,
): boolean {
  const zGeneric = CABA_GENERIC_NORM.has(zNorm) || zNorm.startsWith("ciudad aut");
  const sGeneric = CABA_GENERIC_NORM.has(sNorm) || sNorm.startsWith("ciudad aut");
  const zBarrio = CABA_BARRIOS_NORM.has(zNorm);
  const sBarrio = CABA_BARRIOS_NORM.has(sNorm);
  const cpCaba = isCabaCP(shipmentCP);

  // zona genérica + envío barrio (o CP CABA)
  if (zGeneric && (sBarrio || cpCaba)) return true;
  // zona barrio + envío genérico (con CP CABA cuando está disponible)
  if (zBarrio && (sGeneric || cpCaba)) return true;
  // zona barrio + envío barrio distinto, mismo CP CABA → NO (barrios distintos, se respeta)
  return false;
}
