import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Banknote, User, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type PaymentMethod = Database['public']['Enums']['payment_method'];

interface ReceiveRenditionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ChoferConCobros {
  chofer_id: string;
  nombre: string;
  apellido: string | null;
  total: number;
  cantidad: number;
}

interface CobroPendiente {
  id: string;
  monto: number;
  created_at: string | null;
  envio: {
    tracking_number: string;
    nombre_destinatario: string | null;
    direccion_entrega: string | null;
  } | null;
}

export function ReceiveRenditionDialog({ open, onOpenChange }: ReceiveRenditionDialogProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedChofer, setSelectedChofer] = useState<string>('');
  const [selectedPagos, setSelectedPagos] = useState<Set<string>>(new Set());
  const [metodo, setMetodo] = useState<PaymentMethod>('efectivo');
  const [referencia, setReferencia] = useState('');
  const [notas, setNotas] = useState('');

  // Fetch drivers with pending COD payments
  const { data: choferes, isLoading: loadingChoferes } = useQuery({
    queryKey: ['choferes-con-cobros-pendientes', profile?.tenant_id],
    queryFn: async () => {
      // Get all cobrado_chofer payments for this tenant
      const { data: pagos, error } = await supabase
        .from('pagos')
        .select('created_by, monto')
        .eq('estado', 'cobrado_chofer' as any)
        .eq('tenant_id', profile?.tenant_id);

      if (error) throw error;
      if (!pagos?.length) return [];

      // Group by driver
      const grouped = new Map<string, { total: number; cantidad: number }>();
      for (const p of pagos) {
        if (!p.created_by) continue;
        const current = grouped.get(p.created_by) || { total: 0, cantidad: 0 };
        current.total += p.monto;
        current.cantidad += 1;
        grouped.set(p.created_by, current);
      }

      // Get driver names
      const driverIds = Array.from(grouped.keys());
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, nombre, apellido')
        .in('user_id', driverIds);

      return driverIds.map((id) => {
        const prof = profiles?.find((p) => p.user_id === id);
        const stats = grouped.get(id)!;
        return {
          chofer_id: id,
          nombre: prof?.nombre || 'Sin nombre',
          apellido: prof?.apellido || null,
          total: stats.total,
          cantidad: stats.cantidad,
        } as ChoferConCobros;
      });
    },
    enabled: open && !!profile?.tenant_id,
  });

  // Fetch pending payments for selected driver
  const { data: cobros, isLoading: loadingCobros } = useQuery({
    queryKey: ['cobros-chofer', selectedChofer],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pagos')
        .select(`
          id,
          monto,
          created_at,
          envio:envios(tracking_number, nombre_destinatario, direccion_entrega)
        `)
        .eq('estado', 'cobrado_chofer' as any)
        .eq('created_by', selectedChofer)
        .eq('tenant_id', profile?.tenant_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CobroPendiente[];
    },
    enabled: !!selectedChofer && !!profile?.tenant_id,
  });

  // When driver changes, select all payments by default
  const handleChoferChange = (choferId: string) => {
    setSelectedChofer(choferId);
    setSelectedPagos(new Set());
    // Will auto-select all when cobros load via effect
  };

  // Auto-select all when cobros load
  const allSelected = cobros && selectedPagos.size === cobros.length;
  const selectAll = () => {
    if (cobros) setSelectedPagos(new Set(cobros.map((c) => c.id)));
  };
  const deselectAll = () => setSelectedPagos(new Set());

  const togglePago = (id: string) => {
    const next = new Set(selectedPagos);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedPagos(next);
  };

  const totalSeleccionado = cobros
    ?.filter((c) => selectedPagos.has(c.id))
    .reduce((sum, c) => sum + c.monto, 0) || 0;

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      const pagoIds = Array.from(selectedPagos);
      const { data, error } = await supabase.rpc('receive_rendition', {
        p_chofer_id: selectedChofer,
        p_pago_ids: pagoIds,
        p_metodo_recepcion: metodo as any,
        p_referencia: referencia || null,
        p_notas: notas || null,
      });

      if (error) throw error;
      const result = data as any;
      if (!result?.success) throw new Error(result?.error || 'Error desconocido');
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['choferes-con-cobros-pendientes'] });
      queryClient.invalidateQueries({ queryKey: ['cobros-chofer'] });
      queryClient.invalidateQueries({ queryKey: ['pagos'] });
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['current-cash-session'] });

      const msg = result.caja_impactada
        ? `Rendición recibida: $${result.monto_total.toLocaleString()} (${result.cantidad_cobros} cobros). Movimiento de caja registrado.`
        : `Rendición recibida: $${result.monto_total.toLocaleString()} (${result.cantidad_cobros} cobros). ⚠️ No había caja abierta.`;

      toast.success(msg);
      handleReset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error('Error al recibir rendición: ' + error.message);
    },
  });

  const handleReset = () => {
    setSelectedChofer('');
    setSelectedPagos(new Set());
    setMetodo('efectivo');
    setReferencia('');
    setNotas('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleReset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" />
            Recibir Rendición COD
          </DialogTitle>
          <DialogDescription>
            Registra la recepción del dinero cobrado por el chofer
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Driver selector */}
          <div className="space-y-2">
            <Label>Chofer</Label>
            {loadingChoferes ? (
              <Skeleton className="h-10 w-full" />
            ) : !choferes?.length ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-lg bg-muted/50">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                No hay cobros pendientes de rendir
              </div>
            ) : (
              <Select value={selectedChofer} onValueChange={handleChoferChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar chofer..." />
                </SelectTrigger>
                <SelectContent>
                  {choferes.map((c) => (
                    <SelectItem key={c.chofer_id} value={c.chofer_id}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>{c.nombre} {c.apellido || ''}</span>
                        <Badge variant="outline" className="ml-2">
                          ${c.total.toLocaleString()} ({c.cantidad})
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Payments list */}
          {selectedChofer && (
            <>
              {loadingCobros ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : cobros?.length ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Cobros pendientes</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={allSelected ? deselectAll : selectAll}
                    >
                      {allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                    </Button>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto space-y-1 rounded-lg border p-2">
                    {cobros.map((cobro) => (
                      <label
                        key={cobro.id}
                        className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedPagos.has(cobro.id)}
                          onCheckedChange={() => togglePago(cobro.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {cobro.envio?.tracking_number || 'Sin tracking'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {cobro.envio?.nombre_destinatario || ''} •{' '}
                            {cobro.created_at && format(new Date(cobro.created_at), 'dd/MM HH:mm')}
                          </p>
                        </div>
                        <span className="font-semibold text-sm">
                          ${cobro.monto.toLocaleString()}
                        </span>
                      </label>
                    ))}
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10">
                    <span className="font-medium">Total a recibir</span>
                    <span className="text-xl font-bold text-primary">
                      ${totalSeleccionado.toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Este chofer no tiene cobros pendientes
                </p>
              )}

              {/* Method & reference */}
              {selectedPagos.size > 0 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Método de recepción</Label>
                      <Select value={metodo} onValueChange={(v) => setMetodo(v as PaymentMethod)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="efectivo">Efectivo</SelectItem>
                          <SelectItem value="transferencia">Transferencia</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {metodo === 'transferencia' && (
                      <div className="space-y-2">
                        <Label>Referencia</Label>
                        <Input
                          value={referencia}
                          onChange={(e) => setReferencia(e.target.value)}
                          placeholder="Nro. transferencia"
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Notas (opcional)</Label>
                    <Textarea
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      placeholder="Observaciones..."
                      rows={2}
                    />
                  </div>

                  {/* Cash session warning */}
                  <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      Si hay una caja abierta en tu sucursal, se registrará automáticamente un ingreso.
                      Si no hay caja abierta, la rendición se registra igual pero sin impacto en caja.
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={selectedPagos.size === 0 || submitMutation.isPending}
          >
            {submitMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar Recepción (${totalSeleccionado.toLocaleString()})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
