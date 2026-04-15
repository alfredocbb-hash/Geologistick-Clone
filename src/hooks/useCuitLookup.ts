import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { validateCUIT, formatCUIT } from '@/hooks/useARCAConfig';

export interface CuitMatch {
  source: 'cliente' | 'empresa_terciarizada';
  sourceId: string;
  nombre: string;
  razonSocial: string | null;
  direccion: string | null;
  condicionIva: string | null;
  cuit: string;
}

interface UseCuitLookupOptions {
  tenantId: string | null | undefined;
}

export function useCuitLookup({ tenantId }: UseCuitLookupOptions) {
  const [match, setMatch] = useState<CuitMatch | null>(null);
  const [loading, setLoading] = useState(false);

  const lookup = useCallback(async (rawCuit: string) => {
    if (!tenantId) return;
    const clean = rawCuit.replace(/\D/g, '');
    if (clean.length !== 11 || !validateCUIT(clean)) {
      setMatch(null);
      return;
    }

    setLoading(true);
    try {
      const formatted = formatCUIT(clean);

      // Search clientes first (try both formatted and raw)
      const { data: clientes } = await supabase
        .from('clientes')
        .select('id, nombre, razon_social, direccion, condicion_iva, dni_cuit')
        .eq('tenant_id', tenantId)
        .or(`dni_cuit.eq.${formatted},dni_cuit.eq.${clean}`)
        .limit(1);

      if (clientes && clientes.length > 0) {
        const c = clientes[0];
        setMatch({
          source: 'cliente',
          sourceId: c.id,
          nombre: c.razon_social || c.nombre,
          razonSocial: c.razon_social,
          direccion: c.direccion,
          condicionIva: c.condicion_iva,
          cuit: formatted,
        });
        setLoading(false);
        return;
      }

      // Search empresas_terciarizadas
      const { data: empresas } = await supabase
        .from('empresas_terciarizadas')
        .select('id, nombre, razon_social, direccion, cuit')
        .eq('tenant_id', tenantId)
        .or(`cuit.eq.${formatted},cuit.eq.${clean}`)
        .limit(1);

      if (empresas && empresas.length > 0) {
        const e = empresas[0];
        setMatch({
          source: 'empresa_terciarizada',
          sourceId: e.id,
          nombre: e.razon_social || e.nombre,
          razonSocial: e.razon_social,
          direccion: e.direccion,
          condicionIva: null, // empresas_terciarizadas doesn't have condicion_iva in the same way
          cuit: formatted,
        });
        setLoading(false);
        return;
      }

      setMatch(null);
    } catch {
      setMatch(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const clear = useCallback(() => setMatch(null), []);

  /**
   * Update missing fields in the source record after successful invoice emission.
   */
  const updateSourceRecord = useCallback(async (
    currentMatch: CuitMatch,
    data: { nombre?: string; direccion?: string; condicionIva?: string; razonSocial?: string }
  ) => {
    if (!currentMatch) return;

    if (currentMatch.source === 'cliente') {
      const updates: Record<string, string> = {};
      if (!currentMatch.razonSocial && data.razonSocial) updates.razon_social = data.razonSocial;
      if (!currentMatch.direccion && data.direccion) updates.direccion = data.direccion;
      if (!currentMatch.condicionIva && data.condicionIva) updates.condicion_iva = data.condicionIva;

      if (Object.keys(updates).length > 0) {
        await supabase
          .from('clientes')
          .update(updates)
          .eq('id', currentMatch.sourceId);
      }
    } else if (currentMatch.source === 'empresa_terciarizada') {
      const updates: Record<string, string> = {};
      if (!currentMatch.razonSocial && data.razonSocial) updates.razon_social = data.razonSocial;
      if (!currentMatch.direccion && data.direccion) updates.direccion = data.direccion;

      if (Object.keys(updates).length > 0) {
        await supabase
          .from('empresas_terciarizadas')
          .update(updates)
          .eq('id', currentMatch.sourceId);
      }
    }
  }, []);

  return { match, loading, lookup, clear, updateSourceRecord };
}
