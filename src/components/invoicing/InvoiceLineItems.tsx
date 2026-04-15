import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';

export interface LineItem {
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidad_medida: string;
  precio_unitario: number;
  bonificacion_pct: number;
  alicuota_iva: number;
}

const UNIDAD_MEDIDA_OPTIONS = [
  { value: 'unidades', label: 'Unidades' },
  { value: 'kg', label: 'Kilogramos' },
  { value: 'litros', label: 'Litros' },
  { value: 'metros', label: 'Metros' },
  { value: 'horas', label: 'Horas' },
  { value: 'servicios', label: 'Servicios' },
];

const ALICUOTA_IVA_OPTIONS = [
  { value: 21, label: '21%' },
  { value: 10.5, label: '10.5%' },
  { value: 27, label: '27%' },
  { value: 5, label: '5%' },
  { value: 2.5, label: '2.5%' },
  { value: 0, label: '0% (Exento)' },
];

export function calcLineSubtotal(item: LineItem) {
  const base = item.cantidad * item.precio_unitario;
  const bonif = base * (item.bonificacion_pct / 100);
  return Math.round((base - bonif) * 100) / 100;
}

export function calcLineSubtotalConIva(item: LineItem) {
  const sub = calcLineSubtotal(item);
  return Math.round(sub * (1 + item.alicuota_iva / 100) * 100) / 100;
}

interface InvoiceLineItemsProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
}

const emptyItem: LineItem = {
  codigo: '',
  descripcion: '',
  cantidad: 1,
  unidad_medida: 'unidades',
  precio_unitario: 0,
  bonificacion_pct: 0,
  alicuota_iva: 21,
};

export function InvoiceLineItems({ items, onChange }: InvoiceLineItemsProps) {
  const addItem = () => onChange([...items, { ...emptyItem }]);
  const removeItem = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof LineItem, value: string | number) => {
    const updated = items.map((item, i) => i === idx ? { ...item, [field]: value } : item);
    onChange(updated);
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Detalle de ítems</span>
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <Plus className="h-3 w-3 mr-1" /> Agregar
        </Button>
      </div>

      {items.length > 0 && (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Código</TableHead>
                <TableHead className="min-w-[150px]">Descripción</TableHead>
                <TableHead className="w-16">Cant.</TableHead>
                <TableHead className="w-24">U. Medida</TableHead>
                <TableHead className="w-24">P. Unit.</TableHead>
                <TableHead className="w-16">% Bonif.</TableHead>
                <TableHead className="w-20">IVA</TableHead>
                <TableHead className="w-24 text-right">Subtotal</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <Input
                      className="h-8 text-xs"
                      value={item.codigo}
                      onChange={e => updateItem(idx, 'codigo', e.target.value)}
                      placeholder="—"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8 text-xs"
                      value={item.descripcion}
                      onChange={e => updateItem(idx, 'descripcion', e.target.value)}
                      placeholder="Descripción"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8 text-xs w-16"
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.cantidad}
                      onChange={e => updateItem(idx, 'cantidad', parseFloat(e.target.value) || 0)}
                    />
                  </TableCell>
                  <TableCell>
                    <Select value={item.unidad_medida} onValueChange={v => updateItem(idx, 'unidad_medida', v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {UNIDAD_MEDIDA_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8 text-xs w-24"
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.precio_unitario}
                      onChange={e => updateItem(idx, 'precio_unitario', parseFloat(e.target.value) || 0)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8 text-xs w-16"
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={item.bonificacion_pct}
                      onChange={e => updateItem(idx, 'bonificacion_pct', parseFloat(e.target.value) || 0)}
                    />
                  </TableCell>
                  <TableCell>
                    <Select value={String(item.alicuota_iva)} onValueChange={v => updateItem(idx, 'alicuota_iva', parseFloat(v))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ALICUOTA_IVA_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right text-xs font-medium">
                    {formatCurrency(calcLineSubtotal(item))}
                  </TableCell>
                  <TableCell>
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeItem(idx)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {items.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-3 border rounded-lg border-dashed">
          Sin ítems de detalle. Opcional: agregá líneas para incluir en la factura impresa.
        </p>
      )}
    </div>
  );
}
