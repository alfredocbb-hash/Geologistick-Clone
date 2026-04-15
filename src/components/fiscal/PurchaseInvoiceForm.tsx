import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PurchaseInvoiceForm({ open, onOpenChange }: Props) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [proveedorNombre, setProveedorNombre] = useState('');
  const [proveedorCuit, setProveedorCuit] = useState('');
  const [tipoComprobante, setTipoComprobante] = useState('B');
  const [puntoVenta, setPuntoVenta] = useState('');
  const [numeroComprobante, setNumeroComprobante] = useState('');
  const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().split('T')[0]);
  const [importeNeto, setImporteNeto] = useState('');
  const [importeIva, setImporteIva] = useState('');
  const [importeTotal, setImporteTotal] = useState('');
  const [categoria, setCategoria] = useState('');
  const [notas, setNotas] = useState('');

  const resetForm = () => {
    setProveedorNombre('');
    setProveedorCuit('');
    setTipoComprobante('B');
    setPuntoVenta('');
    setNumeroComprobante('');
    setFechaEmision(new Date().toISOString().split('T')[0]);
    setImporteNeto('');
    setImporteIva('');
    setImporteTotal('');
    setCategoria('');
    setNotas('');
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const neto = parseFloat(importeNeto) || 0;
      const iva = parseFloat(importeIva) || 0;
      const total = parseFloat(importeTotal) || (neto + iva);

      const { error } = await supabase.from('facturas_compra').insert({
        tenant_id: profile!.tenant_id,
        proveedor_nombre: proveedorNombre.trim(),
        proveedor_cuit: proveedorCuit.trim() || null,
        tipo_comprobante: tipoComprobante,
        punto_venta: puntoVenta ? parseInt(puntoVenta) : null,
        numero_comprobante: numeroComprobante ? parseInt(numeroComprobante) : null,
        fecha_emision: fechaEmision,
        importe_neto: neto,
        importe_iva: iva,
        importe_total: total,
        categoria: categoria || null,
        notas: notas.trim() || null,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Factura de compra registrada');
      queryClient.invalidateQueries({ queryKey: ['fiscal-compras-mes'] });
      resetForm();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error('Error al registrar', { description: err.message });
    },
  });

  // Auto-calculate total when neto/iva change
  const handleNetoChange = (v: string) => {
    setImporteNeto(v);
    const neto = parseFloat(v) || 0;
    const iva = Math.round(neto * 0.21 * 100) / 100;
    setImporteIva(String(iva));
    setImporteTotal(String(Math.round((neto + iva) * 100) / 100));
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!mutation.isPending) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Agregar Factura de Compra
          </DialogTitle>
          <DialogDescription>
            Registrá las facturas recibidas de proveedores para calcular tu crédito fiscal
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Proveedor *</Label>
              <Input placeholder="Nombre o razón social" value={proveedorNombre} onChange={e => setProveedorNombre(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>CUIT Proveedor</Label>
              <Input placeholder="XX-XXXXXXXX-X" value={proveedorCuit} onChange={e => setProveedorCuit(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="insumos">Insumos</SelectItem>
                  <SelectItem value="servicios">Servicios</SelectItem>
                  <SelectItem value="alquiler">Alquiler</SelectItem>
                  <SelectItem value="combustible">Combustible</SelectItem>
                  <SelectItem value="seguros">Seguros</SelectItem>
                  <SelectItem value="otros">Otros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipoComprobante} onValueChange={setTipoComprobante}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                  <SelectItem value="C">C</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>PV</Label>
              <Input type="number" placeholder="0001" value={puntoVenta} onChange={e => setPuntoVenta(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nro Comp.</Label>
              <Input type="number" placeholder="00000001" value={numeroComprobante} onChange={e => setNumeroComprobante(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Fecha de Emisión *</Label>
            <Input type="date" value={fechaEmision} onChange={e => setFechaEmision(e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Neto Gravado</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={importeNeto} onChange={e => handleNetoChange(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>IVA</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={importeIva} onChange={e => setImporteIva(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Total *</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={importeTotal} onChange={e => setImporteTotal(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Input placeholder="Observaciones (opcional)" value={notas} onChange={e => setNotas(e.target.value)} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !proveedorNombre.trim() || !(parseFloat(importeTotal) > 0)}
          >
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
