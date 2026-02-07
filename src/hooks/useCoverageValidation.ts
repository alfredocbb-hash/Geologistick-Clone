import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CoverageZone {
  ciudad: string | null;
  provincia: string | null;
  codigo_postal_desde: string | null;
  codigo_postal_hasta: string | null;
}

/** Normalize string for comparison: lowercase, remove accents */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Check if a CP falls within a from–to range (string comparison, works for numeric CPs) */
function cpInRange(cp: string, from: string, to: string): boolean {
  const cpNum = parseInt(cp, 10);
  const fromNum = parseInt(from, 10);
  const toNum = parseInt(to, 10);
  if (!isNaN(cpNum) && !isNaN(fromNum) && !isNaN(toNum)) {
    return cpNum >= fromNum && cpNum <= toNum;
  }
  // Fallback to string comparison
  return cp >= from && cp <= to;
}

export function useCoverageValidation(sucursalId: string | undefined | null) {
  const { data: zones = [], isLoading } = useQuery({
    queryKey: ['sucursal-zonas-activas', sucursalId],
    queryFn: async () => {
      if (!sucursalId) return [];
      const { data, error } = await supabase
        .from('sucursal_zonas')
        .select('ciudad, provincia, codigo_postal_desde, codigo_postal_hasta')
        .eq('sucursal_id', sucursalId)
        .eq('activa', true);
      if (error) throw error;
      return data as CoverageZone[];
    },
    enabled: !!sucursalId,
    staleTime: 5 * 60 * 1000,
  });

  const hasCoverageRestrictions = zones.length > 0;

  /**
   * Validate whether a destination is covered.
   * Returns null if valid, or an error message string if blocked.
   */
  function validateDestination(destino: {
    ciudad?: string | null;
    provincia?: string | null;
    codigo_postal?: string | null;
  }): string | null {
    // No zones configured = no restrictions
    if (zones.length === 0) return null;

    const destCiudad = destino.ciudad ? normalize(destino.ciudad) : '';
    const destProvincia = destino.provincia ? normalize(destino.provincia) : '';
    const destCp = destino.codigo_postal?.trim() || '';

    for (const zone of zones) {
      let matches = false;

      // Check ciudad match
      if (zone.ciudad && destCiudad) {
        const zoneCiudad = normalize(zone.ciudad);
        if (zoneCiudad === destCiudad || 
            destCiudad.includes(zoneCiudad) || 
            zoneCiudad.includes(destCiudad)) {
          matches = true;
        }
      }

      // Check provincia match
      if (!matches && zone.provincia && destProvincia) {
        const zoneProvincia = normalize(zone.provincia);
        if (zoneProvincia === destProvincia || 
            destProvincia.includes(zoneProvincia) || 
            zoneProvincia.includes(destProvincia)) {
          matches = true;
        }
      }

      // Check CP range match
      if (!matches && zone.codigo_postal_desde && destCp) {
        const cpHasta = zone.codigo_postal_hasta || zone.codigo_postal_desde;
        if (cpInRange(destCp, zone.codigo_postal_desde, cpHasta)) {
          matches = true;
        }
      }

      if (matches) return null; // Destination is covered
    }

    // Build descriptive error
    const destDesc = destino.ciudad || destino.codigo_postal || destino.provincia || 'el destino seleccionado';
    return `Sin cobertura en ${destDesc}. Esta sucursal no tiene habilitada esa zona de entrega.`;
  }

  return {
    zones,
    hasCoverageRestrictions,
    isLoading,
    validateDestination,
  };
}
