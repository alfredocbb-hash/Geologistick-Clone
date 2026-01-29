import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { TrendingUp, AlertTriangle, Check } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Tarifa {
  id: string;
  nombre: string;
  precio_base: number;
  precio_por_kg: number | null;
  precio_por_km: number | null;
  precio_por_m3: number | null;
  rangos_kg: Array<{ desde: number; hasta: number; precio: number }> | null;
  activa: boolean;
}

interface PreviewItem {
  tarifa: string;
  campo: string;
  actual: number;
  nuevo: number;
}

interface BulkRateUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkRateUpdateDialog({ open, onOpenChange }: BulkRateUpdateDialogProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [porcentaje, setPorcentaje] = useState(10);
  const [motivo, setMotivo] = useState('');
  const [selectionMode, setSelectionMode] = useState<'todas' | 'seleccionar'>('todas');
  const [selectedTarifas, setSelectedTarifas] = useState<string[]>([]);
  const [opciones, setOpciones] = useState({
    precioBase: true,
    rangosKg: true,
    precioM3: true,
    precioKm: true,
    conceptos: true,
  });

  // Fetch tarifas
  const { data: tarifas = [] } = useQuery({
    queryKey: ['tarifas_bulk'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tarifas')
        .select('id, nombre, precio_base, precio_por_kg, precio_por_km, precio_por_m3, rangos_kg, activa')
        .eq('activa', true)
        .order('nombre');
      if (error) throw error;
      return data as Tarifa[];
    },
    enabled: open,
  });

  // Calculate preview
  const calculatePreview = (): PreviewItem[] => {
    const factor = 1 + (porcentaje / 100);
    const items: PreviewItem[] = [];

    const tarifasToUpdate = selectionMode === 'todas' 
      ? tarifas 
      : tarifas.filter(t => selectedTarifas.includes(t.id));

    tarifasToUpdate.forEach(tarifa => {
      if (opciones.precioBase && tarifa.precio_base > 0) {
        items.push({
          tarifa: tarifa.nombre,
          campo: 'Precio base',
          actual: tarifa.precio_base,
          nuevo: Math.round(tarifa.precio_base * factor),
        });
      }

      if (opciones.rangosKg && tarifa.rangos_kg && Array.isArray(tarifa.rangos_kg)) {
        tarifa.rangos_kg.forEach((rango: { desde: number; hasta: number; precio: number }) => {
          items.push({
            tarifa: tarifa.nombre,
            campo: `${rango.desde}-${rango.hasta} kg`,
            actual: rango.precio,
            nuevo: Math.round(rango.precio * factor),
          });
        });
      }

      if (opciones.precioM3 && tarifa.precio_por_m3 && tarifa.precio_por_m3 > 0) {
        items.push({
          tarifa: tarifa.nombre,
          campo: 'Precio por m³',
          actual: tarifa.precio_por_m3,
          nuevo: Math.round(tarifa.precio_por_m3 * factor),
        });
      }

      if (opciones.precioKm && tarifa.precio_por_km && tarifa.precio_por_km > 0) {
        items.push({
          tarifa: tarifa.nombre,
          campo: 'Precio por km',
          actual: tarifa.precio_por_km,
          nuevo: Math.round(tarifa.precio_por_km * factor * 100) / 100,
        });
      }
    });

    return items;
  };

  const preview = calculatePreview();

  // Apply mutation
  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.tenant_id) throw new Error('No tenant');

      const factor = 1 + (porcentaje / 100);
      const tarifasToUpdate = selectionMode === 'todas'
        ? tarifas
        : tarifas.filter(t => selectedTarifas.includes(t.id));

      const tarifaIds = tarifasToUpdate.map(t => t.id);

      // Save history before updating
      const historyData = {
        tenant_id: profile.tenant_id,
        porcentaje_aplicado: porcentaje,
        tarifas_afectadas: tarifasToUpdate.map(t => ({
          id: t.id,
          nombre: t.nombre,
          precio_base_anterior: t.precio_base,
          rangos_kg_anterior: t.rangos_kg,
        })),
        opciones_aplicadas: opciones,
        aplicado_por: profile.id,
        notas: motivo,
      };

      const { error: historyError } = await supabase
        .from('historial_ajustes_tarifas')
        .insert(historyData);
      if (historyError) throw historyError;

      // Update each tarifa
      for (const tarifa of tarifasToUpdate) {
        const updates: Record<string, any> = {};

        if (opciones.precioBase) {
          updates.precio_base = Math.round(tarifa.precio_base * factor);
        }

        if (opciones.rangosKg && tarifa.rangos_kg && Array.isArray(tarifa.rangos_kg)) {
          updates.rangos_kg = tarifa.rangos_kg.map((r: { desde: number; hasta: number; precio: number }) => ({
            ...r,
            precio: Math.round(r.precio * factor),
          }));
        }

        if (opciones.precioM3 && tarifa.precio_por_m3) {
          updates.precio_por_m3 = Math.round(tarifa.precio_por_m3 * factor);
        }

        if (opciones.precioKm && tarifa.precio_por_km) {
          updates.precio_por_km = Math.round(tarifa.precio_por_km * factor * 100) / 100;
        }

        if (Object.keys(updates).length > 0) {
          const { error } = await supabase
            .from('tarifas')
            .update(updates)
            .eq('id', tarifa.id);
          if (error) throw error;
        }
      }

      // Update concepts if selected
      if (opciones.conceptos && tarifaIds.length > 0) {
        const { error: rpcError } = await supabase.rpc('actualizar_conceptos_porcentaje', {
          p_factor: factor,
          p_tarifa_ids: tarifaIds,
        });
        if (rpcError) throw rpcError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarifas'] });
      queryClient.invalidateQueries({ queryKey: ['tarifas_bulk'] });
      queryClient.invalidateQueries({ queryKey: ['tarifa_concepto_precios'] });
      toast.success(`Aumento del ${porcentaje}% aplicado exitosamente`);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error('Error: ' + error.message);
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const toggleTarifa = (id: string) => {
    setSelectedTarifas(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const totalDiferencia = preview.reduce((acc, item) => acc + (item.nuevo - item.actual), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Ajuste Masivo de Tarifas
          </DialogTitle>
          <DialogDescription>
            Actualiza los precios de todas las tarifas aplicando un porcentaje de aumento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Percentage input */}
          <div className="flex items-center gap-4">
            <Label htmlFor="porcentaje" className="whitespace-nowrap">
              Porcentaje de ajuste:
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="porcentaje"
                type="number"
                step="0.5"
                value={porcentaje}
                onChange={(e) => setPorcentaje(parseFloat(e.target.value) || 0)}
                className="w-24"
              />
              <span className="text-lg font-bold">%</span>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <Label className="font-medium">Aplicar a:</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="precioBase"
                  checked={opciones.precioBase}
                  onCheckedChange={(checked) => setOpciones({ ...opciones, precioBase: !!checked })}
                />
                <Label htmlFor="precioBase" className="text-sm">Precio base de tarifas</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rangosKg"
                  checked={opciones.rangosKg}
                  onCheckedChange={(checked) => setOpciones({ ...opciones, rangosKg: !!checked })}
                />
                <Label htmlFor="rangosKg" className="text-sm">Rangos de peso (kg)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="precioM3"
                  checked={opciones.precioM3}
                  onCheckedChange={(checked) => setOpciones({ ...opciones, precioM3: !!checked })}
                />
                <Label htmlFor="precioM3" className="text-sm">Precio por m³</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="precioKm"
                  checked={opciones.precioKm}
                  onCheckedChange={(checked) => setOpciones({ ...opciones, precioKm: !!checked })}
                />
                <Label htmlFor="precioKm" className="text-sm">Precio por km</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="conceptos"
                  checked={opciones.conceptos}
                  onCheckedChange={(checked) => setOpciones({ ...opciones, conceptos: !!checked })}
                />
                <Label htmlFor="conceptos" className="text-sm">Conceptos de tarifa</Label>
              </div>
            </div>
          </div>

          {/* Tarifa selection */}
          <div className="space-y-3">
            <Label className="font-medium">Tarifas a actualizar:</Label>
            <RadioGroup value={selectionMode} onValueChange={(v) => setSelectionMode(v as 'todas' | 'seleccionar')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="todas" id="todas" />
                <Label htmlFor="todas" className="text-sm">
                  Todas las activas ({tarifas.length} tarifas)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="seleccionar" id="seleccionar" />
                <Label htmlFor="seleccionar" className="text-sm">Seleccionar manualmente</Label>
              </div>
            </RadioGroup>

            {selectionMode === 'seleccionar' && (
              <div className="flex flex-wrap gap-2 p-3 border rounded-lg max-h-32 overflow-y-auto">
                {tarifas.map(tarifa => (
                  <div
                    key={tarifa.id}
                    onClick={() => toggleTarifa(tarifa.id)}
                    className={`px-3 py-1 rounded-full text-sm cursor-pointer transition-colors ${
                      selectedTarifas.includes(tarifa.id)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {selectedTarifas.includes(tarifa.id) && <Check className="h-3 w-3 inline mr-1" />}
                    {tarifa.nombre}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo del ajuste</Label>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Ajuste por inflación Enero 2026"
              rows={2}
            />
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="space-y-2">
              <Label className="font-medium">Vista previa de cambios:</Label>
              <ScrollArea className="h-48 border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarifa</TableHead>
                      <TableHead>Campo</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Nuevo</TableHead>
                      <TableHead className="text-right">Diferencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.slice(0, 20).map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{item.tarifa}</TableCell>
                        <TableCell>{item.campo}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.actual)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.nuevo)}</TableCell>
                        <TableCell className="text-right text-green-600">
                          +{formatCurrency(item.nuevo - item.actual)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              {preview.length > 20 && (
                <p className="text-sm text-muted-foreground">
                  Mostrando 20 de {preview.length} cambios...
                </p>
              )}
            </div>
          )}

          {preview.length === 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No hay cambios para mostrar. Verifica que hayas seleccionado opciones y tarifas.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex-1 text-sm text-muted-foreground">
            {preview.length > 0 && (
              <span>Total aumento: <strong className="text-green-600">+{formatCurrency(totalDiferencia)}</strong></span>
            )}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => applyMutation.mutate()}
            disabled={applyMutation.isPending || preview.length === 0}
          >
            {applyMutation.isPending ? 'Aplicando...' : `Aplicar Ajuste +${porcentaje}%`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
