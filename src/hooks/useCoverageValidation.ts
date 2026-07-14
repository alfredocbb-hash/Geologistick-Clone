import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ciudadMatchPartial } from '@/lib/ciudadMatch';

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

/** Extract numeric portion from Argentine postal codes (e.g. "B7602" -> 7602, "1440" -> 1440) */
function extractNumericCP(cp: string): number {
  const cleaned = cp.replace(/[^0-9]/g, '');
  return cleaned ? parseInt(cleaned, 10) : NaN;
}

/** Check if a CP falls within a from–to range, supporting alphanumeric Argentine CPs */
function cpInRange(cp: string, from: string, to: string): boolean {
  const cpNum = extractNumericCP(cp);
  const fromNum = extractNumericCP(from);
  const toNum = extractNumericCP(to);
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
      let matchesCiudad = false;
      let matchesProvincia = false;
      let matchesCp = false;

      // Check ciudad match (CABA-aware por CP)
      if (zone.ciudad && destino.ciudad) {
        if (ciudadMatchPartial(zone.ciudad, destino.ciudad, destino.codigo_postal)) {
          matchesCiudad = true;
        }
      }

      // Check provincia match
      if (zone.provincia && destProvincia) {
        const zoneProvincia = normalize(zone.provincia);
        if (zoneProvincia === destProvincia || 
            destProvincia.includes(zoneProvincia) || 
            zoneProvincia.includes(destProvincia)) {
          matchesProvincia = true;
        }
      }

      // Check CP range - ALWAYS check, independent of city/province
      if (zone.codigo_postal_desde && destCp) {
        const cpHasta = zone.codigo_postal_hasta || zone.codigo_postal_desde;
        if (cpInRange(destCp, zone.codigo_postal_desde, cpHasta)) {
          matchesCp = true;
        }
      }

      // Any match means destination is covered
      if (matchesCiudad || matchesProvincia || matchesCp) return null;
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
