import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export interface ComisionDraft {
  concepto_id: string;
  concepto_nombre: string;
  porcentaje_contado: number;
  porcentaje_destino: number;
  porcentaje_cta_cte: number;
}

interface Props {
  tenantId: string;
  comisiones: ComisionDraft[];
  onChange: (comisiones: ComisionDraft[]) => void;
}

export function NewPartnershipComisiones({ tenantId, comisiones, onChange }: Props) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('tarifa_conceptos')
        .select('id, nombre, codigo')
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
        .eq('activo', true)
        .order('nombre');

      if (data && data.length > 0 && comisiones.length === 0) {
        onChange(data.map(c => ({
          concepto_id: c.id,
          concepto_nombre: c.nombre,
          porcentaje_contado: 0,
          porcentaje_destino: 0,
          porcentaje_cta_cte: 0,
        })));
      }
      setLoading(false);
    })();
  }, [tenantId]);

  const update = (idx: number, field: keyof ComisionDraft, value: number) => {
    const updated = comisiones.map((c, i) => i === idx ? { ...c, [field]: Math.min(100, Math.max(0, value)) } : c);
    onChange(updated);
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (comisiones.length === 0) return <p className="text-sm text-muted-foreground">No hay conceptos de tarifa configurados.</p>;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Porcentajes de comisión por concepto</p>
      <div className="max-h-48 overflow-auto border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Concepto</TableHead>
              <TableHead className="w-20 text-xs text-center">% Contado</TableHead>
              <TableHead className="w-20 text-xs text-center">% Destino</TableHead>
              <TableHead className="w-20 text-xs text-center">% Cta Cte</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comisiones.map((c, i) => (
              <TableRow key={c.concepto_id}>
                <TableCell className="text-xs py-1">{c.concepto_nombre}</TableCell>
                <TableCell className="py-1">
                  <Input type="number" min={0} max={100} value={c.porcentaje_contado}
                    onChange={e => update(i, 'porcentaje_contado', Number(e.target.value))} className="h-7 text-xs text-center" />
                </TableCell>
                <TableCell className="py-1">
                  <Input type="number" min={0} max={100} value={c.porcentaje_destino}
                    onChange={e => update(i, 'porcentaje_destino', Number(e.target.value))} className="h-7 text-xs text-center" />
                </TableCell>
                <TableCell className="py-1">
                  <Input type="number" min={0} max={100} value={c.porcentaje_cta_cte}
                    onChange={e => update(i, 'porcentaje_cta_cte', Number(e.target.value))} className="h-7 text-xs text-center" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
