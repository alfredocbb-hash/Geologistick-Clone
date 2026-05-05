// Motor de resolución de precios para envíos terciarizados
// Match: provincia/ciudad exacta -> substring -> provincia. Tipos: fija | por_zona | por_kg

export interface TarifaTerciarizada {
  id: string;
  nombre: string;
  tipo_tarifa: 'fija' | 'por_zona' | 'por_kg';
  precio_fijo: number | null;
  zonas: Array<{ ciudades?: string[]; provincias?: string[]; precio: number }> | null;
  precio_por_kg: number | null;
  precio_minimo: number | null;
  activa: boolean;
}

export interface EnvioForPricing {
  ciudad_entrega?: string | null;
  ciudad_retiro?: string | null;
  provincia_entrega?: string | null;
  provincia_retiro?: string | null;
  requiere_retiro?: boolean | null;
  peso_kg?: number | null;
}

const norm = (s: string) => s.trim().toLowerCase();

function matchZona(envio: EnvioForPricing, tarifa: TarifaTerciarizada): number | null {
  const ciudad = envio.requiere_retiro ? envio.ciudad_retiro : envio.ciudad_entrega;
  const provincia = envio.requiere_retiro ? envio.provincia_retiro : envio.provincia_entrega;
  const zonas = tarifa.zonas || [];
  if (!zonas.length) return null;

  const cN = ciudad ? norm(ciudad) : '';
  const pN = provincia ? norm(provincia) : '';

  // 1. Ciudad exacta
  for (const z of zonas) {
    if (z.ciudades?.some(c => norm(c) === cN && cN)) return z.precio;
  }
  // 2. Ciudad substring
  for (const z of zonas) {
    if (z.ciudades?.some(c => cN && (norm(c).includes(cN) || cN.includes(norm(c))))) return z.precio;
  }
  // 3. Provincia
  for (const z of zonas) {
    if (z.provincias?.some(p => norm(p) === pN && pN)) return z.precio;
  }
  return null;
}

export function resolveTerciarizadoPrice(
  envio: EnvioForPricing,
  tarifas: TarifaTerciarizada[]
): { precio: number; tarifaId: string | null } {
  const activas = tarifas.filter(t => t.activa);
  if (!activas.length) return { precio: 0, tarifaId: null };

  // Prioridad: por_zona > fija > por_kg
  for (const t of activas.filter(x => x.tipo_tarifa === 'por_zona')) {
    const m = matchZona(envio, t);
    if (m !== null) {
      const precio = Math.max(m, t.precio_minimo || 0);
      return { precio, tarifaId: t.id };
    }
  }
  const fija = activas.find(t => t.tipo_tarifa === 'fija');
  if (fija) {
    const precio = Math.max(fija.precio_fijo || 0, fija.precio_minimo || 0);
    return { precio, tarifaId: fija.id };
  }
  const porKg = activas.find(t => t.tipo_tarifa === 'por_kg');
  if (porKg) {
    const peso = envio.peso_kg || 1;
    const precio = Math.max((porKg.precio_por_kg || 0) * peso, porKg.precio_minimo || 0);
    return { precio, tarifaId: porKg.id };
  }
  return { precio: 0, tarifaId: null };
}
