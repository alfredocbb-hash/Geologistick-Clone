import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { validateCUIT, formatCUIT } from '@/hooks/useARCAConfig';

export interface CuitMatch {
  source: 'cliente' | 'empresa_terciarizada' | 'afip';
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

// Calcular dígito verificador de CUIT a partir de 10 dígitos (prefijo 2 + DNI 8)
function cuitCheckDigit(prefixDni: string): number | null {
  if (prefixDni.length !== 10 || !/^\d+$/.test(prefixDni)) return null;
  const mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = mult.reduce((acc, m, i) => acc + m * parseInt(prefixDni[i], 10), 0);
  const mod = sum % 11;
  const dv = 11 - mod;
  if (dv === 11) return 0;
  if (dv === 10) return null; // CUIT no válido con este prefijo
  return dv;
}

function candidateCuitsFromDni(dni: string): string[] {
  const clean = dni.replace(/\D/g, '');
  if (clean.length < 7 || clean.length > 8) return [];
  const dni8 = clean.padStart(8, '0');
  const prefixes = ['20', '23', '24', '27']; // masculino / ambos / caso especial / femenino
  const out: string[] = [];
  for (const p of prefixes) {
    const base = p + dni8;
    const dv = cuitCheckDigit(base);
    if (dv !== null) out.push(base + String(dv));
  }
  return out;
}

export function useCuitLookup({ tenantId }: UseCuitLookupOptions) {
  const [match, setMatch] = useState<CuitMatch | null>(null);
  const [loading, setLoading] = useState(false);

  const lookup = useCallback(async (rawInput: string) => {
    if (!tenantId) return;
    const clean = rawInput.replace(/\D/g, '');
    const isCuit = clean.length === 11 && validateCUIT(clean);
    const isDni = clean.length >= 7 && clean.length <= 8;
    if (!isCuit && !isDni) {
      setMatch(null);
      return;
    }

    setLoading(true);
    try {
      // 1) Buscar en clientes por dni_cuit (variantes)
      const variants = new Set<string>([clean]);
      if (isCuit) variants.add(formatCUIT(clean));
      if (isDni) {
        // formato con puntos 12.345.678
        if (clean.length === 8) variants.add(`${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5)}`);
        if (clean.length === 7) variants.add(`${clean.slice(0, 1)}.${clean.slice(1, 4)}.${clean.slice(4)}`);
      }
      const orExpr = Array.from(variants).map((v) => `dni_cuit.eq.${v}`).join(',');

      const { data: clientes } = await supabase
        .from('clientes')
        .select('id, nombre, razon_social, direccion, condicion_iva, dni_cuit')
        .eq('tenant_id', tenantId)
        .or(orExpr)
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
          cuit: isCuit ? formatCUIT(clean) : (c.dni_cuit || clean),
        });
        setLoading(false);
        return;
      }

      // 2) empresas_terciarizadas: solo cuando es CUIT
      if (isCuit) {
        const { data: empresas } = await supabase
          .from('empresas_terciarizadas')
          .select('id, nombre, razon_social, direccion, cuit')
          .eq('tenant_id', tenantId)
          .or(`cuit.eq.${formatCUIT(clean)},cuit.eq.${clean}`)
          .limit(1);

        if (empresas && empresas.length > 0) {
          const e = empresas[0];
          setMatch({
            source: 'empresa_terciarizada',
            sourceId: e.id,
            nombre: e.razon_social || e.nombre,
            razonSocial: e.razon_social,
            direccion: e.direccion,
            condicionIva: null,
            cuit: formatCUIT(clean),
          });
          setLoading(false);
          return;
        }
      }

      // 3) Fallback AFIP padrón
      const cuitsToTry = isCuit ? [clean] : candidateCuitsFromDni(clean);
      for (const cuitCandidate of cuitsToTry) {
        try {
          const { data: padron } = await supabase.functions.invoke('arca-consultar-padron', {
            body: { cuit: cuitCandidate },
          });
          if (padron?.found) {
            setMatch({
              source: 'afip',
              sourceId: cuitCandidate,
              nombre: padron.razon_social || padron.nombre || '',
              razonSocial: padron.razon_social || null,
              direccion: padron.domicilio || null,
              condicionIva: padron.condicion_iva || null,
              cuit: formatCUIT(cuitCandidate),
            });
            setLoading(false);
            return;
          }
        } catch {
          // seguir con el próximo prefijo
        }
      }

      setMatch(null);
    } catch {
      setMatch(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const clear = useCallback(() => setMatch(null), []);

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
        await supabase.from('clientes').update(updates).eq('id', currentMatch.sourceId);
      }
    } else if (currentMatch.source === 'empresa_terciarizada') {
      const updates: Record<string, string> = {};
      if (!currentMatch.razonSocial && data.razonSocial) updates.razon_social = data.razonSocial;
      if (!currentMatch.direccion && data.direccion) updates.direccion = data.direccion;

      if (Object.keys(updates).length > 0) {
        await supabase.from('empresas_terciarizadas').update(updates).eq('id', currentMatch.sourceId);
      }
    }
  }, []);

  return { match, loading, lookup, clear, updateSourceRecord };
}
