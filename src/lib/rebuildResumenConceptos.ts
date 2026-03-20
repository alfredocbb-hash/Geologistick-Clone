/**
 * Rebuilds a ResumenPorTipoPago from liquidacion_sucursal_detalles rows.
 * Used as fallback when the stored resumen_conceptos doesn't have
 * Emisión/Recepción separation.
 */

export interface ConceptoResumen {
  concepto_id: string | null;
  nombre: string;
  ventas: number;
  porcentaje: number;
  comision: number;
  sinConfiguracion?: boolean;
}

export interface ResumenPorTipoPago {
  contado: ConceptoResumen[];
  destino: ConceptoResumen[];
  cta_cte: ConceptoResumen[];
}

interface DetalleRow {
  rol: string | null;
  tipo_pago: string;
  monto_envio: number;
  comision_aplicada: number;
  desglose_conceptos?: Record<string, { venta: number; porcentaje: number; comision: number; nombre?: string }> | null;
}

function normalizeTipoPago(tp: string): 'contado' | 'destino' | 'cta_cte' {
  const lower = tp.toLowerCase();
  if (lower.includes('destino') || lower === 'pago_destino') return 'destino';
  if (lower.includes('cta') || lower.includes('cuenta')) return 'cta_cte';
  return 'contado';
}

/**
 * Returns true if the stored resumen already has role-separated concepts
 * (i.e., contains "(Emisión)" or "(Recepción)" in concept names).
 */
export function resumenHasRoleSeparation(resumen: ResumenPorTipoPago | null | undefined): boolean {
  if (!resumen) return false;
  const all = [...(resumen.contado || []), ...(resumen.destino || []), ...(resumen.cta_cte || [])];
  return all.some(c => c.nombre.includes('(Emisión)') || c.nombre.includes('(Recepción)'));
}

/**
 * Rebuilds resumenConceptos from detail rows, grouping by tipo_pago and concepto+rol.
 */
export function rebuildResumenFromDetalles(detalles: DetalleRow[]): ResumenPorTipoPago {
  const groups: Record<string, Record<string, { ventas: number; comision: number; porcentaje: number; count: number }>> = {
    contado: {},
    destino: {},
    cta_cte: {},
  };

  for (const det of detalles) {
    const tipoPago = normalizeTipoPago(det.tipo_pago);
    const rol = det.rol || 'emision';
    const rolSuffix = rol === 'recepcion' ? 'Recepción' : 'Emisión';
    const desglose = det.desglose_conceptos;

    if (desglose && typeof desglose === 'object' && Object.keys(desglose).length > 0) {
      // Use per-concept breakdown
      for (const [rawKey, values] of Object.entries(desglose)) {
        // rawKey might already have ::rol suffix from new code, or not
        const baseName = rawKey.split('::')[0];
        const key = `${baseName}::${rol}`;
        const displayName = `${baseName} (${rolSuffix})`;

        if (!groups[tipoPago][key]) {
          groups[tipoPago][key] = { ventas: 0, comision: 0, porcentaje: 0, count: 0 };
        }
        groups[tipoPago][key].ventas += values.venta || 0;
        groups[tipoPago][key].comision += values.comision || 0;
        groups[tipoPago][key].porcentaje += values.porcentaje || 0;
        groups[tipoPago][key].count += 1;
      }
    } else {
      // Fallback: no desglose, use totals
      const key = `General::${rol}`;
      if (!groups[tipoPago][key]) {
        groups[tipoPago][key] = { ventas: 0, comision: 0, porcentaje: 0, count: 0 };
      }
      groups[tipoPago][key].ventas += det.monto_envio || 0;
      groups[tipoPago][key].comision += det.comision_aplicada || 0;
      groups[tipoPago][key].count += 1;
    }
  }

  const toArray = (group: Record<string, { ventas: number; comision: number; porcentaje: number; count: number }>): ConceptoResumen[] => {
    return Object.entries(group).map(([key, vals]) => {
      const [baseName, rol] = key.split('::');
      const rolSuffix = rol === 'recepcion' ? 'Recepción' : 'Emisión';
      return {
        concepto_id: null,
        nombre: `${baseName} (${rolSuffix})`,
        ventas: vals.ventas,
        porcentaje: vals.count > 0 ? vals.porcentaje / vals.count : 0,
        comision: vals.comision,
      };
    }).filter(c => c.ventas !== 0 || c.comision !== 0);
  };

  return {
    contado: toArray(groups.contado),
    destino: toArray(groups.destino),
    cta_cte: toArray(groups.cta_cte),
  };
}
