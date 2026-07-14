/**
 * Matching de ciudades tolerante al cambio "Buenos Aires" → barrios CABA.
 * Versión Deno para edge functions. Mantener sincronizado con src/lib/ciudadMatch.ts.
 */

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

const CABA_BARRIOS_NORM = new Set(
  [
    "Agronomía", "Almagro", "Balvanera", "Barracas", "Belgrano", "Boedo",
    "Caballito", "Chacarita", "Coghlan", "Colegiales", "Constitución",
    "Flores", "Floresta", "La Boca", "La Paternal", "Liniers", "Mataderos",
    "Monserrat", "Nueva Pompeya", "Núñez", "Palermo", "Parque Avellaneda",
    "Parque Chacabuco", "Parque Patricios", "Puerto Madero", "Recoleta",
    "Retiro", "Saavedra", "San Cristóbal", "San Nicolás", "Villa Crespo",
    "Villa Devoto", "Villa General Mitre", "Villa Lugano", "Villa Luro",
    "Villa Ortúzar", "Villa Pueyrredón", "Villa Real", "Villa Riachuelo",
    "Villa Santa Rita", "Villa Soldati", "Villa Urquiza", "Villa del Parque",
    "Vélez Sarsfield",
  ].map(normalizeCiudad),
);

export function isCabaCP(cp: string | null | undefined): boolean {
  if (!cp) return false;
  const raw = cp.toString().trim().toUpperCase();
  const digits = raw.startsWith("C") ? raw.slice(1, 5) : raw.slice(0, 4);
  const num = parseInt(digits, 10);
  if (isNaN(num)) return false;
  return num >= 1000 && num <= 1499;
}

export function isCabaGeneric(city: string | null | undefined): boolean {
  const n = normalizeCiudad(city);
  if (!n) return false;
  return CABA_GENERIC_NORM.has(n) || n.startsWith("ciudad aut");
}

export function isCabaBarrio(city: string | null | undefined): boolean {
  const n = normalizeCiudad(city);
  if (!n) return false;
  return CABA_BARRIOS_NORM.has(n);
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
  if (zGeneric && (sBarrio || cpCaba)) return true;
  if (zBarrio && (sGeneric || cpCaba)) return true;
  return false;
}

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

export function ciudadMatch(
  zoneCity: string | null | undefined,
  shipmentCity: string | null | undefined,
  shipmentCP?: string | null,
): boolean {
  return ciudadMatchPartial(zoneCity, shipmentCity, shipmentCP);
}
