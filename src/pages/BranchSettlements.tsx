import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Building2, Calculator, FileText, Check, DollarSign, Calendar, Eye, CreditCard, Download, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { downloadBranchSettlementPDF } from '@/lib/generateSettlementPDF';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SettlementDetailDialog } from '@/components/settlements/SettlementDetailDialog';
import type { Database } from '@/integrations/supabase/types';

type PaymentMethod = Database['public']['Enums']['payment_method'];

interface Sucursal {
  id: string;
  nombre: string;
}

interface EnvioResumen {
  id: string;
  tracking_number: string;
  precio_total: number;
  tipo_pago: string;
  created_at: string;
  estado: string;
}

interface LiquidacionSucursal {
  id: string;
  sucursal_id: string;
  periodo_inicio: string;
  periodo_fin: string;
  total_cobrado: number | null;
  total_comisiones: number | null;
  saldo: number | null;
  estado: string | null;
  notas: string | null;
  created_at: string | null;
  fecha_pago: string | null;
  metodo_pago: string | null;
  referencia_pago: string | null;
  sucursal?: { nombre: string };
}

export default function BranchSettlements() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSucursal, setSelectedSucursal] = useState<string>('');
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');
  const [calculatedData, setCalculatedData] = useState<{
    envios: EnvioResumen[];
    totalCobrado: number;
    totalComisiones: number;
    saldo: number;
  } | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [notas, setNotas] = useState('');
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detailLiquidacion, setDetailLiquidacion] = useState<LiquidacionSucursal | null>(null);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [payingLiquidacion, setPayingLiquidacion] = useState<string | null>(null);
  const [metodoPago, setMetodoPago] = useState<PaymentMethod>('transferencia');
  const [referenciaPago, setReferenciaPago] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [liquidacionToCancel, setLiquidacionToCancel] = useState<LiquidacionSucursal | null>(null);

  // Fetch sucursales
  const { data: sucursales = [] } = useQuery({
    queryKey: ['sucursales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sucursales')
        .select('id, nombre')
        .eq('activa', true)
        .order('nombre');
      if (error) throw error;
      return data as Sucursal[];
    },
  });

  // Fetch existing liquidaciones
  const { data: liquidaciones = [], isLoading: loadingLiquidaciones } = useQuery({
    queryKey: ['liquidaciones-sucursal'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('liquidaciones_sucursal')
        .select(`
          *,
          sucursal:sucursales(nombre)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as LiquidacionSucursal[];
    },
  });

  // Calculate mutation
  const calculateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSucursal || !fechaInicio || !fechaFin) {
        throw new Error('Seleccione sucursal y período');
      }

      // Fetch sucursal configuration (for IVA settings)
      const { data: sucursalConfig, error: sucursalError } = await supabase
        .from('sucursales')
        .select('incluye_iva, porcentaje_iva')
        .eq('id', selectedSucursal)
        .single();

      if (sucursalError) throw sucursalError;

      // Fetch envíos del período with detalles for flete calculation
      const { data: envios, error: enviosError } = await supabase
        .from('envios')
        .select(`
          id, 
          tracking_number, 
          precio_total, 
          tipo_pago, 
          created_at, 
          estado,
          envio_detalles(concepto_id, monto, nombre_concepto)
        `)
        .eq('sucursal_origen_id', selectedSucursal)
        .gte('created_at', fechaInicio)
        .lte('created_at', fechaFin + 'T23:59:59')
        .in('estado', ['entregado', 'devuelto']);

      if (enviosError) throw enviosError;

      // Fetch comisiones de la sucursal with base_comision
      const { data: comisiones, error: comisionesError } = await supabase
        .from('sucursal_comisiones')
        .select('concepto_id, porcentaje_contado, porcentaje_cta_cte, porcentaje_destino, base_comision')
        .eq('sucursal_id', selectedSucursal);

      if (comisionesError) throw comisionesError;

      // Calculate totals
      let totalCobrado = 0;
      let totalComisiones = 0;

      const ivaMultiplier = sucursalConfig?.incluye_iva 
        ? 1 + ((sucursalConfig?.porcentaje_iva || 21) / 100) 
        : 1;
      const ivaDivisor = 1 + ((sucursalConfig?.porcentaje_iva || 21) / 100);

      const enviosData = (envios || []).map(envio => {
        // Calculate flete (sum of "Flete" concept or fallback to precio_total)
        const detalles = (envio as any).envio_detalles || [];
        const fleteMonto = detalles.find((d: any) => 
          d.nombre_concepto?.toLowerCase().includes('flete')
        )?.monto || envio.precio_total;

        if (envio.tipo_pago === 'contado') {
          totalCobrado += envio.precio_total;
        }
        
        // Calculate commission for each configured concept
        let envioComision = 0;
        (comisiones || []).forEach((comisionConfig) => {
          // Determine base value based on base_comision setting
          let baseCalculo = 0;
          switch (comisionConfig.base_comision || 'total') {
            case 'flete':
              baseCalculo = fleteMonto;
              break;
            case 'neto':
              baseCalculo = envio.precio_total / ivaDivisor;
              break;
            case 'total':
            default:
              baseCalculo = envio.precio_total;
          }

          // Get percentage based on payment type
          let porcentaje = 0;
          switch (envio.tipo_pago) {
            case 'contado':
              porcentaje = comisionConfig.porcentaje_contado || 0;
              break;
            case 'destino':
              porcentaje = comisionConfig.porcentaje_destino || 0;
              break;
            case 'cta_cte':
              porcentaje = comisionConfig.porcentaje_cta_cte || 0;
              break;
            default:
              porcentaje = comisionConfig.porcentaje_contado || 0;
          }

          let comision = baseCalculo * (porcentaje / 100);
          
          // Apply IVA if configured
          if (sucursalConfig?.incluye_iva) {
            comision *= ivaMultiplier;
          }

          envioComision += comision;
        });

        // If no commissions configured, use default 10%
        if (!comisiones || comisiones.length === 0) {
          envioComision = envio.precio_total * 0.10;
        }

        totalComisiones += envioComision;

        return {
          id: envio.id,
          tracking_number: envio.tracking_number,
          precio_total: envio.precio_total,
          tipo_pago: envio.tipo_pago,
          created_at: envio.created_at,
          estado: envio.estado,
        };
      });

      const saldo = totalCobrado - totalComisiones;

      return {
        envios: enviosData,
        totalCobrado,
        totalComisiones,
        saldo,
      };
    },
    onSuccess: (data) => {
      setCalculatedData(data);
      toast.success('Cálculo completado');
    },
    onError: (error) => {
      toast.error('Error: ' + error.message);
    },
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!calculatedData || !selectedSucursal) {
        throw new Error('No hay datos para guardar');
      }

      // Create liquidacion
      const { data: liquidacion, error: liquidacionError } = await supabase
        .from('liquidaciones_sucursal')
        .insert({
          sucursal_id: selectedSucursal,
          periodo_inicio: fechaInicio,
          periodo_fin: fechaFin,
          total_cobrado: calculatedData.totalCobrado,
          total_comisiones: calculatedData.totalComisiones,
          saldo: calculatedData.saldo,
          estado: 'pendiente',
          notas: notas || null,
          created_by: user?.id,
          tenant_id: profile?.tenant_id,
        })
        .select()
        .single();

      if (liquidacionError) throw liquidacionError;

      // Create detalles
      const detalles = calculatedData.envios.map((envio) => ({
        liquidacion_id: liquidacion.id,
        envio_id: envio.id,
        monto_envio: envio.precio_total,
        tipo_pago: envio.tipo_pago || 'contado',
        comision_aplicada: (envio.precio_total * 10) / 100,
      }));

      if (detalles.length > 0) {
        const { error: detallesError } = await supabase
          .from('liquidacion_sucursal_detalles')
          .insert(detalles);

        if (detallesError) throw detallesError;
      }

      return liquidacion;
    },
    onSuccess: () => {
      toast.success('Liquidación guardada');
      queryClient.invalidateQueries({ queryKey: ['liquidaciones-sucursal'] });
      setCalculatedData(null);
      setShowSaveDialog(false);
      setNotas('');
    },
    onError: (error) => {
      toast.error('Error: ' + error.message);
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('liquidaciones_sucursal')
        .update({ 
          estado: 'aprobada',
          aprobado_por: user?.id,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Liquidación aprobada');
      queryClient.invalidateQueries({ queryKey: ['liquidaciones-sucursal'] });
    },
    onError: (error) => {
      toast.error('Error: ' + error.message);
    },
  });

  // Pay mutation
  const payMutation = useMutation({
    mutationFn: async () => {
      if (!payingLiquidacion) throw new Error('No hay liquidación seleccionada');

      const { error } = await supabase
        .from('liquidaciones_sucursal')
        .update({
          estado: 'pagada',
          metodo_pago: metodoPago,
          referencia_pago: referenciaPago || null,
          fecha_pago: new Date().toISOString(),
          aprobado_por: user?.id,
        })
        .eq('id', payingLiquidacion);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pago registrado');
      queryClient.invalidateQueries({ queryKey: ['liquidaciones-sucursal'] });
      setShowPayDialog(false);
      setPayingLiquidacion(null);
      setMetodoPago('transferencia');
      setReferenciaPago('');
    },
    onError: (error) => {
      toast.error('Error: ' + error.message);
    },
  });

  // Cancel/Delete liquidación mutation with optimistic updates
  const cancelMutation = useMutation({
    mutationFn: async (liquidacionId: string) => {
      // 1. Delete detalles first
      const { error: detallesError } = await supabase
        .from('liquidacion_sucursal_detalles')
        .delete()
        .eq('liquidacion_id', liquidacionId);

      if (detallesError) throw detallesError;

      // 2. Delete the liquidación and verify it was actually deleted
      const { data, error } = await supabase
        .from('liquidaciones_sucursal')
        .delete()
        .eq('id', liquidacionId)
        .select('id');

      if (error) throw error;
      
      // Verify that a row was actually deleted
      if (!data || data.length === 0) {
        throw new Error('No se pudo eliminar la liquidación. Puede que no tengas permisos o ya fue eliminada.');
      }
      
      return liquidacionId;
    },
    onMutate: async (liquidacionId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['liquidaciones-sucursal'] });
      
      // Snapshot the previous value
      const previousLiquidaciones = queryClient.getQueryData(['liquidaciones-sucursal']);
      
      // Optimistically remove from the list
      queryClient.setQueryData(['liquidaciones-sucursal'], (old: LiquidacionSucursal[] | undefined) => 
        old?.filter((l) => l.id !== liquidacionId) ?? []
      );
      
      return { previousLiquidaciones };
    },
    onSuccess: () => {
      toast.success('Liquidación cancelada correctamente');
      setShowCancelDialog(false);
      setLiquidacionToCancel(null);
    },
    onError: (error, _liquidacionId, context) => {
      // Rollback to the previous value on error
      if (context?.previousLiquidaciones) {
        queryClient.setQueryData(['liquidaciones-sucursal'], context.previousLiquidaciones);
      }
      toast.error('Error al cancelar: ' + error.message);
      setShowCancelDialog(false);
      setLiquidacionToCancel(null);
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['liquidaciones-sucursal'] });
    },
  });

  const getEstadoBadge = (estado: string | null) => {
    const config: Record<string, { label: string; className: string }> = {
      pendiente: { label: 'Pendiente', className: 'bg-warning/10 text-warning border-warning' },
      aprobada: { label: 'Aprobada', className: 'bg-info/10 text-info border-info' },
      pagada: { label: 'Pagada', className: 'bg-success/10 text-success border-success' },
    };
    const c = config[estado || 'pendiente'] || { label: estado || 'Desconocido', className: '' };
    return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
  };

  const openPayDialog = (id: string) => {
    setPayingLiquidacion(id);
    setShowPayDialog(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Liquidaciones de Sucursales</h1>
        <p className="text-muted-foreground">Calcula y gestiona las liquidaciones por sucursal</p>
      </div>

      {/* Calculator Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Calcular Liquidación
          </CardTitle>
          <CardDescription>
            Selecciona una sucursal y período para calcular el saldo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Sucursal</Label>
              <Select value={selectedSucursal} onValueChange={setSelectedSucursal}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar sucursal" />
                </SelectTrigger>
                <SelectContent>
                  {sucursales.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha Inicio</Label>
              <Input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha Fin</Label>
              <Input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => calculateMutation.mutate()}
                disabled={calculateMutation.isPending || !selectedSucursal || !fechaInicio || !fechaFin}
                className="w-full"
              >
                <Calculator className="h-4 w-4 mr-2" />
                {calculateMutation.isPending ? 'Calculando...' : 'Calcular'}
              </Button>
            </div>
          </div>

          {/* Results */}
          {calculatedData && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-success/5 border-success/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-4 w-4 text-success" />
                      <span className="text-sm text-muted-foreground">Total Cobrado</span>
                    </div>
                    <p className="text-2xl font-bold text-success">
                      ${calculatedData.totalCobrado.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-warning/5 border-warning/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="h-4 w-4 text-warning" />
                      <span className="text-sm text-muted-foreground">Total Comisiones</span>
                    </div>
                    <p className="text-2xl font-bold text-warning">
                      ${calculatedData.totalComisiones.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="text-sm text-muted-foreground">Saldo a Transferir</span>
                    </div>
                    <p className="text-2xl font-bold text-primary">
                      ${calculatedData.saldo.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Envíos incluidos */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tracking</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo Pago</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calculatedData.envios.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No hay envíos en este período
                        </TableCell>
                      </TableRow>
                    ) : (
                      calculatedData.envios.map((envio) => (
                        <TableRow key={envio.id}>
                          <TableCell className="font-mono">{envio.tracking_number}</TableCell>
                          <TableCell>{format(new Date(envio.created_at), 'dd/MM/yy', { locale: es })}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{envio.tipo_pago || 'contado'}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{envio.estado}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ${envio.precio_total.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setShowSaveDialog(true)} className="bg-sucursales hover:bg-sucursales/90">
                  <FileText className="h-4 w-4 mr-2" />
                  Guardar Liquidación
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historial */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Historial de Liquidaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingLiquidaciones ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : liquidaciones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay liquidaciones registradas
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Total Cobrado</TableHead>
                  <TableHead>Comisiones</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liquidaciones.map((liq) => (
                  <TableRow key={liq.id}>
                    <TableCell className="font-medium">{liq.sucursal?.nombre}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(liq.periodo_inicio), 'dd/MM/yy', { locale: es })} -
                        {format(new Date(liq.periodo_fin), 'dd/MM/yy', { locale: es })}
                      </div>
                    </TableCell>
                    <TableCell className="text-success">${(liq.total_cobrado || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-warning">${(liq.total_comisiones || 0).toFixed(2)}</TableCell>
                    <TableCell className="font-bold">${(liq.saldo || 0).toFixed(2)}</TableCell>
                    <TableCell>{getEstadoBadge(liq.estado || 'pendiente')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setDetailLiquidacion(liq);
                            setShowDetailDialog(true);
                          }}
                          title="Ver detalle"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => downloadBranchSettlementPDF(liq)}
                          title="Descargar PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {liq.estado !== 'pagada' && (
                          <>
                            {liq.estado === 'pendiente' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => approveMutation.mutate(liq.id)}
                                disabled={approveMutation.isPending}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Aprobar
                              </Button>
                            )}
                            {liq.estado === 'aprobada' && (
                              <Button
                                size="sm"
                                onClick={() => openPayDialog(liq.id)}
                              >
                                <CreditCard className="h-4 w-4 mr-1" />
                                Pagar
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setLiquidacionToCancel(liq);
                                setShowCancelDialog(true);
                              }}
                              title="Cancelar liquidación"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {liq.estado === 'pagada' && (
                          <Badge variant="outline" className="bg-success/10 text-success">
                            <Check className="h-3 w-3 mr-1" />
                            Pagada
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guardar Liquidación</DialogTitle>
            <DialogDescription>
              ¿Deseas guardar esta liquidación? Podrás aprobarla después.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Notas (opcional)</Label>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Agregar observaciones..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Dialog */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago de Liquidación</DialogTitle>
            <DialogDescription>
              Ingresa los datos del pago realizado a la sucursal
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Método de Pago</Label>
              <Select value={metodoPago} onValueChange={(v) => setMetodoPago(v as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="mercado_pago">Mercado Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Referencia (opcional)</Label>
              <Input
                placeholder="Número de transferencia, recibo, etc."
                value={referenciaPago}
                onChange={(e) => setReferenciaPago(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => payMutation.mutate()} 
              disabled={payMutation.isPending}
              className="bg-success hover:bg-success/90"
            >
              {payMutation.isPending ? 'Procesando...' : 'Confirmar Pago'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <SettlementDetailDialog
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        settlementId={detailLiquidacion?.id || null}
        type="branch"
        settlement={detailLiquidacion}
      />

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar esta liquidación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la liquidación y todos sus detalles asociados.
              {liquidacionToCancel && (
                <div className="mt-4 p-3 bg-muted rounded-lg space-y-1">
                  <p><strong>Sucursal:</strong> {liquidacionToCancel.sucursal?.nombre}</p>
                  <p><strong>Saldo:</strong> ${(liquidacionToCancel.saldo || 0).toFixed(2)}</p>
                  <p><strong>Total Cobrado:</strong> ${(liquidacionToCancel.total_cobrado || 0).toFixed(2)}</p>
                  <p><strong>Período:</strong> {format(new Date(liquidacionToCancel.periodo_inicio), 'dd/MM/yy', { locale: es })} - {format(new Date(liquidacionToCancel.periodo_fin), 'dd/MM/yy', { locale: es })}</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, mantener</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={(e) => {
                e.preventDefault();
                if (liquidacionToCancel) {
                  cancelMutation.mutate(liquidacionToCancel.id);
                }
              }}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Cancelando...' : 'Sí, cancelar liquidación'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
