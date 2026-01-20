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
import { Truck, Calculator, FileText, Check, DollarSign, Calendar, CreditCard, Eye, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';
import { SettlementDetailDialog } from '@/components/settlements/SettlementDetailDialog';

type PaymentMethod = Database['public']['Enums']['payment_method'];

interface Chofer {
  id: string;
  nombre: string;
  apellido: string | null;
  user_id: string;
}

interface Comision {
  id: string;
  envio_id: string;
  monto: number;
  monto_original?: number | null;
  created_at: string;
  envio?: {
    tracking_number: string;
    precio_total: number;
    estado: string;
  };
}

interface Liquidacion {
  id: string;
  chofer_id: string;
  periodo_inicio: string;
  periodo_fin: string;
  monto_total: number;
  cantidad_envios: number | null;
  estado: string | null;
  notas: string | null;
  created_at: string | null;
  fecha_pago: string | null;
  metodo_pago: string | null;
  referencia_pago: string | null;
  chofer?: { nombre: string; apellido: string | null };
}

export default function DriverSettlements() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedChofer, setSelectedChofer] = useState<string>('');
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');
  const [comisionesPendientes, setComisionesPendientes] = useState<Comision[]>([]);
  const [totalPendiente, setTotalPendiente] = useState(0);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [selectedLiquidacion, setSelectedLiquidacion] = useState<string | null>(null);
  const [metodoPago, setMetodoPago] = useState<PaymentMethod>('efectivo');
  const [referenciaPago, setReferenciaPago] = useState('');
  const [notas, setNotas] = useState('');
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detailLiquidacion, setDetailLiquidacion] = useState<Liquidacion | null>(null);
  const [montosEditados, setMontosEditados] = useState<Record<string, number>>({});

  // Fetch choferes - using separate queries to avoid join issues
  const { data: choferes = [] } = useQuery({
    queryKey: ['choferes-for-settlements'],
    queryFn: async () => {
      // First get all user_ids with chofer role
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'chofer');
      
      if (rolesError) throw rolesError;
      if (!roles || roles.length === 0) return [];
      
      const userIds = roles.map(r => r.user_id);
      
      // Then get profiles for those users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nombre, apellido, user_id')
        .in('user_id', userIds)
        .eq('activo', true)
        .order('nombre');
      
      if (profilesError) throw profilesError;
      return (profiles || []) as Chofer[];
    },
  });

  // Fetch existing liquidaciones
  const { data: liquidaciones = [], isLoading: loadingLiquidaciones } = useQuery({
    queryKey: ['liquidaciones-choferes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('liquidaciones')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      
      // Fetch chofer names separately
      const choferIds = [...new Set(data?.map(l => l.chofer_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, nombre, apellido')
        .in('user_id', choferIds);
      
      return (data || []).map(l => ({
        ...l,
        chofer: profiles?.find(p => p.user_id === l.chofer_id),
      })) as Liquidacion[];
    },
  });

  // Calculate pending commissions
  const calculateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedChofer) {
        throw new Error('Seleccione un chofer');
      }

      const chofer = choferes.find(c => c.id === selectedChofer);
      if (!chofer) throw new Error('Chofer no encontrado');

      // Fetch comisiones pendientes (sin liquidacion_id)
      let query = supabase
        .from('comisiones')
        .select(`
          id, envio_id, monto, created_at,
          envio:envios(tracking_number, precio_total, estado)
        `)
        .eq('chofer_id', chofer.user_id)
        .is('liquidacion_id', null);

      if (fechaInicio) {
        query = query.gte('created_at', fechaInicio);
      }
      if (fechaFin) {
        query = query.lte('created_at', fechaFin + 'T23:59:59');
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      const total = (data || []).reduce((sum, c) => sum + c.monto, 0);
      
      // Reset edited amounts when calculating new commissions
      setMontosEditados({});
      
      return { comisiones: data as Comision[], total };
    },
    onSuccess: (data) => {
      setComisionesPendientes(data.comisiones);
      setTotalPendiente(data.total);
      toast.success(`Se encontraron ${data.comisiones.length} comisiones pendientes`);
    },
    onError: (error) => {
      toast.error('Error: ' + error.message);
    },
  });

  // Generate liquidacion
  const generateMutation = useMutation({
    mutationFn: async () => {
      if (comisionesPendientes.length === 0) {
        throw new Error('No hay comisiones para liquidar');
      }

      const chofer = choferes.find(c => c.id === selectedChofer);
      if (!chofer) throw new Error('Chofer no encontrado');

      // Calculate total with edited amounts
      const montoTotalFinal = comisionesPendientes.reduce((sum, c) => {
        return sum + (montosEditados[c.id] ?? c.monto);
      }, 0);

      // Create liquidacion
      const { data: liquidacion, error: liquidacionError } = await supabase
        .from('liquidaciones')
        .insert({
          chofer_id: chofer.user_id,
          periodo_inicio: fechaInicio || format(new Date(comisionesPendientes[comisionesPendientes.length - 1].created_at), 'yyyy-MM-dd'),
          periodo_fin: fechaFin || format(new Date(), 'yyyy-MM-dd'),
          monto_total: montoTotalFinal,
          cantidad_envios: comisionesPendientes.length,
          estado: 'generada',
          notas: notas || null,
          generado_por: user?.id,
          tenant_id: profile?.tenant_id,
        })
        .select()
        .single();

      if (liquidacionError) throw liquidacionError;

      // Update each commission with its final amount and audit fields
      for (const comision of comisionesPendientes) {
        const nuevoMonto = montosEditados[comision.id];
        const wasEdited = nuevoMonto !== undefined && nuevoMonto !== comision.monto;

        await supabase
          .from('comisiones')
          .update({
            liquidacion_id: liquidacion.id,
            ...(wasEdited && {
              monto: nuevoMonto,
              monto_original: comision.monto,
              editado_por: user?.id,
              editado_at: new Date().toISOString(),
            }),
          })
          .eq('id', comision.id);
      }

      return liquidacion;
    },
    onSuccess: () => {
      toast.success('Liquidación generada correctamente');
      queryClient.invalidateQueries({ queryKey: ['liquidaciones-choferes'] });
      setComisionesPendientes([]);
      setTotalPendiente(0);
      setNotas('');
      setMontosEditados({});
    },
    onError: (error) => {
      toast.error('Error: ' + error.message);
    },
  });

  // Pay liquidacion
  const payMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLiquidacion) throw new Error('No hay liquidación seleccionada');

      const { error } = await supabase
        .from('liquidaciones')
        .update({
          estado: 'pagada',
          metodo_pago: metodoPago,
          referencia_pago: referenciaPago || null,
          fecha_pago: new Date().toISOString(),
          aprobado_por: user?.id,
        })
        .eq('id', selectedLiquidacion);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pago registrado');
      queryClient.invalidateQueries({ queryKey: ['liquidaciones-choferes'] });
      setShowPayDialog(false);
      setSelectedLiquidacion(null);
      setMetodoPago('efectivo');
      setReferenciaPago('');
    },
    onError: (error) => {
      toast.error('Error: ' + error.message);
    },
  });

  const getEstadoBadge = (estado: string) => {
    const config: Record<string, { label: string; className: string }> = {
      generada: { label: 'Generada', className: 'bg-warning/10 text-warning border-warning' },
      enviada: { label: 'Enviada', className: 'bg-info/10 text-info border-info' },
      pagada: { label: 'Pagada', className: 'bg-success/10 text-success border-success' },
      rechazada: { label: 'Rechazada', className: 'bg-destructive/10 text-destructive border-destructive' },
    };
    const c = config[estado] || { label: estado, className: '' };
    return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
  };

  const openPayDialog = (id: string) => {
    setSelectedLiquidacion(id);
    setShowPayDialog(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Liquidaciones de Choferes</h1>
        <p className="text-muted-foreground">Gestiona los pagos de comisiones a choferes</p>
      </div>

      {/* Calculator Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Calcular Comisiones Pendientes
          </CardTitle>
          <CardDescription>
            Selecciona un chofer para ver sus comisiones pendientes de pago
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Chofer</Label>
              <Select value={selectedChofer} onValueChange={setSelectedChofer}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar chofer" />
                </SelectTrigger>
                <SelectContent>
                  {choferes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre} {c.apellido}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha Inicio (opcional)</Label>
              <Input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha Fin (opcional)</Label>
              <Input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => calculateMutation.mutate()}
                disabled={calculateMutation.isPending || !selectedChofer}
                className="w-full"
              >
                <Calculator className="h-4 w-4 mr-2" />
                {calculateMutation.isPending ? 'Buscando...' : 'Buscar'}
              </Button>
            </div>
          </div>

          {/* Results */}
          {comisionesPendientes.length > 0 && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Card className="bg-success/5 border-success/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="h-4 w-4 text-success" />
                        <span className="text-sm text-muted-foreground">Total a Pagar</span>
                      </div>
                      <p className="text-2xl font-bold text-success">
                        ${comisionesPendientes.reduce((sum, c) => sum + (montosEditados[c.id] ?? c.monto), 0).toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                  <div className="text-muted-foreground">
                    {comisionesPendientes.length} comisiones pendientes
                  </div>
                </div>
                <Button
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  className="bg-chofer hover:bg-chofer/90"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Generar Liquidación
                </Button>
              </div>

              {/* Comisiones table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tracking</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Monto Envío</TableHead>
                      <TableHead>Monto Original</TableHead>
                      <TableHead className="text-right">Monto Final</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comisionesPendientes.map((comision) => {
                      const montoFinal = montosEditados[comision.id] ?? comision.monto;
                      const wasEdited = montosEditados[comision.id] !== undefined && montosEditados[comision.id] !== comision.monto;
                      
                      return (
                        <TableRow key={comision.id}>
                          <TableCell className="font-mono">
                            {comision.envio?.tracking_number || '-'}
                          </TableCell>
                          <TableCell>
                            {format(new Date(comision.created_at), 'dd/MM/yy', { locale: es })}
                          </TableCell>
                          <TableCell>
                            ${(comision.envio?.precio_total || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className={wasEdited ? 'text-muted-foreground line-through' : ''}>
                            ${comision.monto.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                className={`w-24 text-right font-bold ${wasEdited ? 'border-warning text-warning' : 'text-success'}`}
                                value={montoFinal}
                                onChange={(e) => setMontosEditados(prev => ({
                                  ...prev,
                                  [comision.id]: parseFloat(e.target.value) || 0
                                }))}
                              />
                              {wasEdited && <Edit2 className="h-3 w-3 text-warning" />}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
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
                  <TableHead>Chofer</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Envíos</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liquidaciones.map((liq) => (
                  <TableRow key={liq.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-chofer" />
                        {liq.chofer?.nombre} {liq.chofer?.apellido}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(liq.periodo_inicio), 'dd/MM/yy', { locale: es })} -
                        {format(new Date(liq.periodo_fin), 'dd/MM/yy', { locale: es })}
                      </div>
                    </TableCell>
                    <TableCell>{liq.cantidad_envios}</TableCell>
                    <TableCell className="font-bold text-success">
                      ${liq.monto_total.toFixed(2)}
                    </TableCell>
                    <TableCell>{getEstadoBadge(liq.estado || 'generada')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setDetailLiquidacion(liq);
                            setShowDetailDialog(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {liq.estado === 'generada' && (
                          <Button
                            size="sm"
                            onClick={() => openPayDialog(liq.id)}
                          >
                            <CreditCard className="h-4 w-4 mr-1" />
                            Pagar
                          </Button>
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

      {/* Pay Dialog */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              Ingresa los datos del pago realizado al chofer
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
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
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
        type="driver"
        settlement={detailLiquidacion}
      />
    </div>
  );
}
