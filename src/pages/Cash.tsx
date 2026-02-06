import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Wallet,
  Plus,
  Minus,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  Lock,
  Unlock,
  Calculator,
  Banknote,
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';
import { ReceiveRenditionDialog } from '@/components/renditions/ReceiveRenditionDialog';

type PaymentMethod = Database['public']['Enums']['payment_method'];
type CashSessionStatus = Database['public']['Enums']['cash_session_status'];

interface CashSession {
  id: string;
  sucursal_id: string;
  usuario_id: string;
  monto_inicial: number;
  monto_final: number | null;
  monto_esperado: number | null;
  diferencia: number | null;
  estado: CashSessionStatus | null;
  fecha_apertura: string | null;
  fecha_cierre: string | null;
  notas_apertura: string | null;
  notas_cierre: string | null;
  aprobado_por: string | null;
  created_at: string | null;
}

interface CashMovement {
  id: string;
  sesion_caja_id: string;
  tipo: string;
  concepto: string;
  monto: number;
  metodo_pago: PaymentMethod;
  referencia: string | null;
  envio_id: string | null;
  created_at: string | null;
  created_by: string | null;
}

interface Sucursal {
  id: string;
  nombre: string;
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  mercado_pago: 'Mercado Pago',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
};

const STATUS_CONFIG: Record<CashSessionStatus, { label: string; color: string; icon: typeof Clock }> = {
  abierta: { label: 'Abierta', color: 'bg-success/10 text-success', icon: Unlock },
  cerrada: { label: 'Cerrada', color: 'bg-muted text-muted-foreground', icon: Lock },
  pendiente_aprobacion: { label: 'Pendiente', color: 'bg-warning/10 text-warning', icon: Clock },
};

export default function Cash() {
  const { user, profile, isAdmin, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [isOpenDialogOpen, setIsOpenDialogOpen] = useState(false);
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false);
  const [isRenditionDialogOpen, setIsRenditionDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<CashSession | null>(null);
  const [openFormData, setOpenFormData] = useState({
    monto_inicial: '',
    notas_apertura: '',
  });
  const [closeFormData, setCloseFormData] = useState({
    monto_final: '',
    notas_cierre: '',
  });
  const [movementFormData, setMovementFormData] = useState({
    tipo: 'ingreso' as 'ingreso' | 'egreso',
    concepto: '',
    monto: '',
    metodo_pago: 'efectivo' as PaymentMethod,
    referencia: '',
  });

  const canManageCash = isAdmin() || hasRole('operador') || hasRole('sucursal');

  // Fetch sucursales
  const { data: sucursales = [] } = useQuery({
    queryKey: ['sucursales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sucursales')
        .select('id, nombre')
        .eq('activa', true);
      if (error) throw error;
      return data as Sucursal[];
    },
  });

  // Fetch current open session
  const { data: currentSession, isLoading: loadingSession } = useQuery({
    queryKey: ['current-cash-session', user?.id, profile?.tenant_id],
    queryFn: async () => {
      if (!user || !profile?.tenant_id) return null;
      
      // First get branch IDs for current tenant
      const { data: tenantSucursales } = await supabase
        .from('sucursales')
        .select('id')
        .eq('tenant_id', profile.tenant_id);
      
      const sucursalIds = tenantSucursales?.map(s => s.id) || [];
      
      if (sucursalIds.length === 0) return null;
      
      let query = supabase
        .from('sesiones_caja')
        .select('*')
        .eq('estado', 'abierta')
        .in('sucursal_id', sucursalIds);
      
      // If not admin, further filter to user's session or their branch
      if (!isAdmin()) {
        query = query.or(`usuario_id.eq.${user.id},sucursal_id.eq.${profile?.sucursal_id}`);
      }
      
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data as CashSession | null;
    },
    enabled: !!user && !!profile?.tenant_id,
  });

  // Fetch session history
  const { data: sessionHistory = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['cash-sessions-history', profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];
      
      // Get branch IDs for current tenant
      const { data: tenantSucursales } = await supabase
        .from('sucursales')
        .select('id')
        .eq('tenant_id', profile.tenant_id);
      
      const sucursalIds = tenantSucursales?.map(s => s.id) || [];
      
      if (sucursalIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('sesiones_caja')
        .select('*')
        .in('sucursal_id', sucursalIds)
        .order('fecha_apertura', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as CashSession[];
    },
    enabled: !!profile?.tenant_id,
  });

  // Fetch movements for current session
  const { data: movements = [] } = useQuery({
    queryKey: ['cash-movements', currentSession?.id],
    queryFn: async () => {
      if (!currentSession) return [];
      const { data, error } = await supabase
        .from('movimientos_caja')
        .select('*')
        .eq('sesion_caja_id', currentSession.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CashMovement[];
    },
    enabled: !!currentSession,
  });

  // Open cash session
  const openSessionMutation = useMutation({
    mutationFn: async (data: { monto_inicial: number; notas_apertura: string }) => {
      if (!user || !profile?.sucursal_id) {
        throw new Error('Usuario sin sucursal asignada');
      }

      const { error } = await supabase.from('sesiones_caja').insert({
        sucursal_id: profile.sucursal_id,
        usuario_id: user.id,
        monto_inicial: data.monto_inicial,
        notas_apertura: data.notas_apertura || null,
        estado: 'abierta',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-cash-session'] });
      queryClient.invalidateQueries({ queryKey: ['cash-sessions-history'] });
      toast.success('Caja abierta exitosamente');
      setIsOpenDialogOpen(false);
      setOpenFormData({ monto_inicial: '', notas_apertura: '' });
    },
    onError: (error: Error) => {
      toast.error('Error: ' + error.message);
    },
  });

  // Close cash session
  const closeSessionMutation = useMutation({
    mutationFn: async (data: { monto_final: number; notas_cierre: string }) => {
      if (!currentSession) throw new Error('No hay sesión activa');

      // Calculate expected amount
      const ingresos = movements
        .filter((m) => m.tipo === 'ingreso' && m.metodo_pago === 'efectivo')
        .reduce((sum, m) => sum + m.monto, 0);
      const egresos = movements
        .filter((m) => m.tipo === 'egreso' && m.metodo_pago === 'efectivo')
        .reduce((sum, m) => sum + m.monto, 0);
      const montoEsperado = currentSession.monto_inicial + ingresos - egresos;
      const diferencia = data.monto_final - montoEsperado;

      const { error } = await supabase
        .from('sesiones_caja')
        .update({
          monto_final: data.monto_final,
          monto_esperado: montoEsperado,
          diferencia: diferencia,
          notas_cierre: data.notas_cierre || null,
          estado: Math.abs(diferencia) > 0 ? 'pendiente_aprobacion' : 'cerrada',
          fecha_cierre: new Date().toISOString(),
        })
        .eq('id', currentSession.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-cash-session'] });
      queryClient.invalidateQueries({ queryKey: ['cash-sessions-history'] });
      toast.success('Caja cerrada exitosamente');
      setIsCloseDialogOpen(false);
      setCloseFormData({ monto_final: '', notas_cierre: '' });
    },
    onError: (error: Error) => {
      toast.error('Error: ' + error.message);
    },
  });

  // Add movement
  const addMovementMutation = useMutation({
    mutationFn: async (data: typeof movementFormData) => {
      if (!currentSession || !user) throw new Error('No hay sesión activa');

      const { error } = await supabase.from('movimientos_caja').insert({
        sesion_caja_id: currentSession.id,
        tipo: data.tipo,
        concepto: data.concepto,
        monto: parseFloat(data.monto),
        metodo_pago: data.metodo_pago,
        referencia: data.referencia || null,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      toast.success('Movimiento registrado');
      setIsMovementDialogOpen(false);
      setMovementFormData({
        tipo: 'ingreso',
        concepto: '',
        monto: '',
        metodo_pago: 'efectivo',
        referencia: '',
      });
    },
    onError: (error: Error) => {
      toast.error('Error: ' + error.message);
    },
  });

  // Approve session (admin only)
  const approveSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('sesiones_caja')
        .update({
          estado: 'cerrada',
          aprobado_por: user?.id,
        })
        .eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-sessions-history'] });
      toast.success('Sesión aprobada');
    },
    onError: (error: Error) => {
      toast.error('Error: ' + error.message);
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(value);
  };

  const getSucursalName = (id: string) => {
    return sucursales.find((s) => s.id === id)?.nombre || 'Desconocida';
  };

  // Calculate totals
  const totals = movements.reduce(
    (acc, m) => {
      if (m.tipo === 'ingreso') {
        acc.ingresos += m.monto;
        if (m.metodo_pago === 'efectivo') acc.ingresosEfectivo += m.monto;
      } else {
        acc.egresos += m.monto;
        if (m.metodo_pago === 'efectivo') acc.egresosEfectivo += m.monto;
      }
      return acc;
    },
    { ingresos: 0, egresos: 0, ingresosEfectivo: 0, egresosEfectivo: 0 }
  );

  const saldoEsperado = currentSession
    ? currentSession.monto_inicial + totals.ingresosEfectivo - totals.egresosEfectivo
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Control de Caja</h1>
          <p className="text-muted-foreground">
            Gestión de apertura, cierre y movimientos de caja
          </p>
        </div>
        {!currentSession && canManageCash && (
          <Button
            onClick={() => setIsOpenDialogOpen(true)}
            className="bg-caja hover:bg-caja/90"
          >
            <Unlock className="h-4 w-4 mr-2" />
            Abrir Caja
          </Button>
        )}
      </div>

      {/* Active Session */}
      {loadingSession ? (
        <div className="text-center py-8 text-muted-foreground">
          Cargando sesión...
        </div>
      ) : currentSession ? (
        <div className="space-y-6">
          {/* Session Info */}
          <Card className="glass border-caja/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-caja/10">
                    <Wallet className="h-6 w-6 text-caja" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Caja Activa</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {getSucursalName(currentSession.sucursal_id)} •{' '}
                      {currentSession.fecha_apertura &&
                        format(new Date(currentSession.fecha_apertura), "d 'de' MMMM, HH:mm", {
                          locale: es,
                        })}
                    </p>
                  </div>
                </div>
                <Badge className={STATUS_CONFIG[currentSession.estado || 'abierta'].color}>
                  {STATUS_CONFIG[currentSession.estado || 'abierta'].label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                <div className="p-4 rounded-xl bg-muted/50">
                  <p className="text-sm text-muted-foreground">Monto Inicial</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(currentSession.monto_inicial)}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-success/10">
                  <p className="text-sm text-success">Ingresos</p>
                  <p className="text-xl font-bold text-success">
                    +{formatCurrency(totals.ingresos)}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-destructive/10">
                  <p className="text-sm text-destructive">Egresos</p>
                  <p className="text-xl font-bold text-destructive">
                    -{formatCurrency(totals.egresos)}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-caja/10">
                  <p className="text-sm text-caja">Efectivo Esperado</p>
                  <p className="text-xl font-bold text-caja">
                    {formatCurrency(saldoEsperado)}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-primary/10">
                  <p className="text-sm text-primary">Movimientos</p>
                  <p className="text-xl font-bold text-primary">{movements.length}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => {
                    setMovementFormData({ ...movementFormData, tipo: 'ingreso' });
                    setIsMovementDialogOpen(true);
                  }}
                  className="bg-success hover:bg-success/90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ingreso
                </Button>
                <Button
                  onClick={() => {
                    setMovementFormData({ ...movementFormData, tipo: 'egreso' });
                    setIsMovementDialogOpen(true);
                  }}
                  variant="destructive"
                >
                  <Minus className="h-4 w-4 mr-2" />
                  Egreso
                </Button>
                <Button
                  onClick={() => setIsRenditionDialogOpen(true)}
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary/10"
                >
                  <Banknote className="h-4 w-4 mr-2" />
                  Rendición COD
                </Button>
                <div className="flex-1" />
                <Button
                  onClick={() => setIsCloseDialogOpen(true)}
                  variant="outline"
                  className="border-caja text-caja hover:bg-caja/10"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Cerrar Caja
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Movements Table */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Movimientos del Día
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {movements.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No hay movimientos registrados
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hora</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell className="text-muted-foreground">
                          {movement.created_at &&
                            format(new Date(movement.created_at), 'HH:mm')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {movement.tipo === 'ingreso' ? (
                              <ArrowUpCircle className="h-4 w-4 text-success" />
                            ) : (
                              <ArrowDownCircle className="h-4 w-4 text-destructive" />
                            )}
                            <span
                              className={
                                movement.tipo === 'ingreso'
                                  ? 'text-success'
                                  : 'text-destructive'
                              }
                            >
                              {movement.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{movement.concepto}</p>
                            {movement.referencia && (
                              <p className="text-xs text-muted-foreground">
                                Ref: {movement.referencia}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {PAYMENT_METHOD_LABELS[movement.metodo_pago]}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${
                            movement.tipo === 'ingreso'
                              ? 'text-success'
                              : 'text-destructive'
                          }`}
                        >
                          {movement.tipo === 'ingreso' ? '+' : '-'}
                          {formatCurrency(movement.monto)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="glass">
          <CardContent className="p-12 text-center">
            <Wallet className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No hay caja abierta</h3>
            <p className="text-muted-foreground mb-6">
              Abre una caja para comenzar a registrar movimientos
            </p>
            {canManageCash && (
              <Button
                onClick={() => setIsOpenDialogOpen(true)}
                className="bg-caja hover:bg-caja/90"
              >
                <Unlock className="h-4 w-4 mr-2" />
                Abrir Caja
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* History Tab */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Historial de Sesiones
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingHistory ? (
            <div className="p-8 text-center text-muted-foreground">
              Cargando historial...
            </div>
          ) : sessionHistory.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No hay sesiones anteriores
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Inicial</TableHead>
                  <TableHead>Final</TableHead>
                  <TableHead>Diferencia</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessionHistory
                  .filter((s) => s.id !== currentSession?.id)
                  .map((session) => {
                    const statusConfig = STATUS_CONFIG[session.estado || 'abierta'];
                    const StatusIcon = statusConfig.icon;
                    return (
                      <TableRow key={session.id}>
                        <TableCell>
                          {session.fecha_apertura &&
                            format(new Date(session.fecha_apertura), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                        <TableCell>{getSucursalName(session.sucursal_id)}</TableCell>
                        <TableCell>{formatCurrency(session.monto_inicial)}</TableCell>
                        <TableCell>
                          {session.monto_final !== null
                            ? formatCurrency(session.monto_final)
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {session.diferencia !== null ? (
                            <span
                              className={
                                session.diferencia === 0
                                  ? 'text-success'
                                  : session.diferencia > 0
                                  ? 'text-success'
                                  : 'text-destructive'
                              }
                            >
                              {session.diferencia >= 0 ? '+' : ''}
                              {formatCurrency(session.diferencia)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusConfig.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {session.estado === 'pendiente_aprobacion' && isAdmin() && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => approveSessionMutation.mutate(session.id)}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Aprobar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Open Cash Dialog */}
      <Dialog open={isOpenDialogOpen} onOpenChange={setIsOpenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir Caja</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              openSessionMutation.mutate({
                monto_inicial: parseFloat(openFormData.monto_inicial),
                notas_apertura: openFormData.notas_apertura,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Monto Inicial (Efectivo en Caja) *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  value={openFormData.monto_inicial}
                  onChange={(e) =>
                    setOpenFormData({ ...openFormData, monto_inicial: e.target.value })
                  }
                  className="pl-10"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notas de Apertura</Label>
              <Textarea
                value={openFormData.notas_apertura}
                onChange={(e) =>
                  setOpenFormData({ ...openFormData, notas_apertura: e.target.value })
                }
                placeholder="Observaciones al abrir la caja..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpenDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={openSessionMutation.isPending}
                className="bg-caja hover:bg-caja/90"
              >
                {openSessionMutation.isPending ? 'Abriendo...' : 'Abrir Caja'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Close Cash Dialog */}
      <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar Caja</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              closeSessionMutation.mutate({
                monto_final: parseFloat(closeFormData.monto_final),
                notas_cierre: closeFormData.notas_cierre,
              });
            }}
            className="space-y-4"
          >
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Efectivo Esperado:</span>
                <span className="font-bold text-lg">{formatCurrency(saldoEsperado)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Basado en: Inicial ({formatCurrency(currentSession?.monto_inicial || 0)}) +
                Ingresos ({formatCurrency(totals.ingresosEfectivo)}) - Egresos (
                {formatCurrency(totals.egresosEfectivo)})
              </p>
            </div>

            <div className="space-y-2">
              <Label>Monto Final Contado *</Label>
              <div className="relative">
                <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  value={closeFormData.monto_final}
                  onChange={(e) =>
                    setCloseFormData({ ...closeFormData, monto_final: e.target.value })
                  }
                  className="pl-10"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            {closeFormData.monto_final && (
              <div
                className={`p-3 rounded-lg ${
                  parseFloat(closeFormData.monto_final) === saldoEsperado
                    ? 'bg-success/10 text-success'
                    : parseFloat(closeFormData.monto_final) > saldoEsperado
                    ? 'bg-success/10 text-success'
                    : 'bg-destructive/10 text-destructive'
                }`}
              >
                <div className="flex items-center gap-2">
                  {parseFloat(closeFormData.monto_final) === saldoEsperado ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <AlertCircle className="h-5 w-5" />
                  )}
                  <span>
                    Diferencia:{' '}
                    {formatCurrency(parseFloat(closeFormData.monto_final) - saldoEsperado)}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Notas de Cierre</Label>
              <Textarea
                value={closeFormData.notas_cierre}
                onChange={(e) =>
                  setCloseFormData({ ...closeFormData, notas_cierre: e.target.value })
                }
                placeholder="Observaciones al cerrar la caja..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCloseDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={closeSessionMutation.isPending}
                className="bg-caja hover:bg-caja/90"
              >
                {closeSessionMutation.isPending ? 'Cerrando...' : 'Cerrar Caja'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Movement Dialog */}
      <Dialog open={isMovementDialogOpen} onOpenChange={setIsMovementDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {movementFormData.tipo === 'ingreso'
                ? 'Registrar Ingreso'
                : 'Registrar Egreso'}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addMovementMutation.mutate(movementFormData);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Concepto *</Label>
              <Input
                value={movementFormData.concepto}
                onChange={(e) =>
                  setMovementFormData({ ...movementFormData, concepto: e.target.value })
                }
                placeholder="Descripción del movimiento"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monto *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    value={movementFormData.monto}
                    onChange={(e) =>
                      setMovementFormData({ ...movementFormData, monto: e.target.value })
                    }
                    className="pl-10"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Método de Pago</Label>
                <Select
                  value={movementFormData.metodo_pago}
                  onValueChange={(value) =>
                    setMovementFormData({
                      ...movementFormData,
                      metodo_pago: value as PaymentMethod,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="mercado_pago">Mercado Pago</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Referencia (opcional)</Label>
              <Input
                value={movementFormData.referencia}
                onChange={(e) =>
                  setMovementFormData({ ...movementFormData, referencia: e.target.value })
                }
                placeholder="Número de recibo, factura, etc."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsMovementDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={addMovementMutation.isPending}
                className={
                  movementFormData.tipo === 'ingreso'
                    ? 'bg-success hover:bg-success/90'
                    : 'bg-destructive hover:bg-destructive/90'
                }
              >
                {addMovementMutation.isPending ? 'Guardando...' : 'Registrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rendition Dialog */}
      <ReceiveRenditionDialog
        open={isRenditionDialogOpen}
        onOpenChange={setIsRenditionDialogOpen}
      />
    </div>
  );
}
