import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Comision {
  concepto_id: string;
  concepto_nombre: string;
  concepto_codigo: string;
  porcentaje_contado: number;
  porcentaje_destino: number;
  porcentaje_cta_cte: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnershipId: string;
  partnerName: string;
  tenantId: string;
  readOnly?: boolean;
}

export function PartnerComisionesDialog({ open, onOpenChange, partnershipId, partnerName, tenantId, readOnly }: Props) {
  const [comisiones, setComisiones] = useState<Comision[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !partnershipId) return;
    loadData();
  }, [open, partnershipId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get all active concepts for the tenant
      const { data: conceptos } = await supabase
        .from('tarifa_conceptos')
        .select('id, nombre, codigo')
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
        .eq('activo', true)
        .order('nombre');

      // Get existing commissions
      const { data: existing } = await supabase
        .from('partner_comisiones' as any)
        .select('*')
        .eq('partnership_id', partnershipId);

      const existingMap = new Map((existing || []).map((e: any) => [e.concepto_id, e]));

      setComisiones((conceptos || []).map(c => {
        const ex = existingMap.get(c.id) as any;
        return {
          concepto_id: c.id,
          concepto_nombre: c.nombre,
          concepto_codigo: c.codigo,
          porcentaje_contado: ex?.porcentaje_contado || 0,
          porcentaje_destino: ex?.porcentaje_destino || 0,
          porcentaje_cta_cte: ex?.porcentaje_cta_cte || 0,
        };
      }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const updateComision = (idx: number, field: keyof Comision, value: number) => {
    setComisiones(prev => prev.map((c, i) => i === idx ? { ...c, [field]: Math.min(100, Math.max(0, value)) } : c));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const rows = comisiones
        .filter(c => c.porcentaje_contado > 0 || c.porcentaje_destino > 0 || c.porcentaje_cta_cte > 0)
        .map(c => ({
          partnership_id: partnershipId,
          concepto_id: c.concepto_id,
          porcentaje_contado: c.porcentaje_contado,
          porcentaje_destino: c.porcentaje_destino,
          porcentaje_cta_cte: c.porcentaje_cta_cte,
        }));

      // Delete existing and re-insert
      await supabase.from('partner_comisiones' as any).delete().eq('partnership_id', partnershipId);
      if (rows.length > 0) {
        const { error } = await supabase.from('partner_comisiones' as any).insert(rows);
        if (error) throw error;
      }
      toast.success('Comisiones guardadas');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Comisiones — {partnerName}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Concepto</TableHead>
                <TableHead className="w-24 text-center">% Contado</TableHead>
                <TableHead className="w-24 text-center">% Destino</TableHead>
                <TableHead className="w-24 text-center">% Cta Cte</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comisiones.map((c, i) => (
                <TableRow key={c.concepto_id}>
                  <TableCell className="font-medium text-sm">{c.concepto_nombre} <span className="text-muted-foreground text-xs">({c.concepto_codigo})</span></TableCell>
                  <TableCell>
                    <Input type="number" min={0} max={100} value={c.porcentaje_contado} disabled={readOnly}
                      onChange={e => updateComision(i, 'porcentaje_contado', Number(e.target.value))} className="h-8 text-center" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min={0} max={100} value={c.porcentaje_destino} disabled={readOnly}
                      onChange={e => updateComision(i, 'porcentaje_destino', Number(e.target.value))} className="h-8 text-center" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min={0} max={100} value={c.porcentaje_cta_cte} disabled={readOnly}
                      onChange={e => updateComision(i, 'porcentaje_cta_cte', Number(e.target.value))} className="h-8 text-center" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!readOnly && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Guardar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
