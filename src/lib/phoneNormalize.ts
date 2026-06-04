/**
 * Normaliza un teléfono argentino al mismo formato que la función
 * SQL `public.normalizar_telefono_ar`.
 *
 * Reglas:
 * - Quita todo lo que no sea dígito.
 * - Quita ceros iniciales.
 * - Si no comienza con 54, antepone el código de país.
 * - Quita un 0 inicial después del código de país.
 * - Quita el "15" entre código de área (2-4 dígitos) y número local (6-8 dígitos).
 */
export function normalizePhoneAR(input?: string | null): string | null {
  if (!input) return null;
  let v = String(input).replace(/\D/g, '');
  if (!v) return null;
  v = v.replace(/^0+/, '');
  if (!v) return null;
  if (v.slice(0, 2) !== '54') v = '54' + v;
  v = '54' + v.slice(2).replace(/^0+/, '');
  v = v.replace(/^54(\d{2,4})15(\d{6,8})$/, '54$1$2');
  return v;
}
