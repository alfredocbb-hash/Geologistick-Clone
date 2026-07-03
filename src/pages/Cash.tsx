import { useState, useEffect } from 'react';
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
  Building2,
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
  chofer_id?: string | null;
  categoria?: string | null;
  descontado_en_liquidacion_id?: string | null;
}

interface DriverOption {
  user_id: string;
  nombre: string | null;
  apellido: string | null;
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
  const [selectedSucursalId, setSelectedSucursalId] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<string>('selected'); // 'selected' | 'todas'
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
    categoria: 'otro' as 'adelanto_chofer' | 'gasto_operativo' | 'otro',
    chofer_id: '' as string,
  });

  // Default selectedSucursalId to user's branch
  useEffect(() => {
    if (profile?.sucursal_id && !selectedSucursalId) {
      setSelectedSucursalId(profile.sucursal_id);
    }
  }, [profile?.sucursal_id]);

  const canManageCash = isAdmin() || hasRole('operador') || hasRole('sucursal');

  const effectiveSucursalId = selectedSucursalId || profile?.sucursal_id;

  // Check if the active branch has assigned drivers
  const { data: branchHasDrivers } = useQuery({
    queryKey: ['branch-has-drivers', effectiveSucursalId],
    queryFn: async () => {
      if (!effectiveSucursalId) return false;

      // Get all user_ids with 'chofer' role
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'chofer');

      const driverIds = roles?.map(r => r.user_id) || [];
      if (!driverIds.length) return false;

      // Check if any of them belong to this branch
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('sucursal_id', effectiveSucursalId)
        .in('user_id', driverIds);

      return (count || 0) > 0;
    },
    enabled: !!effectiveSucursalId,
    staleTime: 5 * 60 * 1000,
  });

  const showRenditionButton = isAdmin() || branchHasDrivers === true;

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

  // Fetch current open session - filtered by selectedSucursalId
  const { data: currentSession, isLoading: loadingSession } = useQuery({
    queryKey: ['current-cash-session', selectedSucursalId],
    queryFn: async () => {
      if (!user || !selectedSucursalId) return null;
      
      const { data, error } = await supabase
        .from('sesiones_caja')
        .select('*')
        .eq('estado', 'abierta')
        .eq('sucursal_id', selectedSucursalId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data && data.length > 0 ? data[0] : null) as CashSession | null;
    },
    enabled: !!user && !!selectedSucursalId,
  });

  // Fetch session history - filtered by selected branch or all
  const { data: sessionHistory = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['cash-sessions-history', profile?.tenant_id, historyFilter === 'todas' ? 'todas' : selectedSucursalId],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];
      
      if (historyFilter === 'todas' && isAdmin()) {
        // Admin viewing all branches
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
      }
      
      // Filter by selected branch
      if (!selectedSucursalId) return [];
      
      const { data, error } = await supabase
        .from('sesiones_caja')
        .select('*')
        .eq('sucursal_id', selectedSucursalId)
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
      if (!user || !selectedSucursalId) {
        throw new Error('No hay sucursal seleccionada');
      }

      if (currentSession) {
        throw new Error('Ya existe una sesión de caja abierta en esta sucursal. Ciérrela antes de abrir una nueva.');
      }

      const { error } = await supabase.from('sesiones_caja').insert({
        sucursal_id: selectedSucursalId,
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

  // Drivers list (for adelanto a chofer)
  const { data: drivers = [] } = useQuery({
    queryKey: ['tenant-drivers', profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'chofer');
      const ids = roles?.map(r => r.user_id) || [];
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, nombre, apellido')
        .eq('tenant_id', profile.tenant_id)
        .in('user_id', ids);
      if (error) throw error;
      return (data || []) as DriverOption[];
    },
    enabled: !!profile?.tenant_id,
  });

  const driverName = (id?: string | null) => {
    if (!id) return '';
    const d = drivers.find(x => x.user_id === id);
    if (!d) return 'Chofer';
    return `${d.nombre || ''} ${d.apellido || ''}`.trim() || 'Chofer';
  };

  // Add movement
  const addMovementMutation = useMutation({
    mutationFn: async (data: typeof movementFormData) => {
      if (!currentSession || !user) throw new Error('No hay sesión activa');

      // Validate adelanto a chofer
      if (data.tipo === 'egreso' && data.categoria === 'adelanto_chofer' && !data.chofer_id) {
        throw new Error('Debe seleccionar el chofer al registrar un adelanto');
      }

      const isAdelanto = data.tipo === 'egreso' && data.categoria === 'adelanto_chofer';
      const concepto = data.concepto?.trim()
        ? data.concepto
        : isAdelanto
          ? `Adelanto a ${driverName(data.chofer_id)}`
          : '';

      const { error } = await supabase.from('movimientos_caja').insert({
        sesion_caja_id: currentSession.id,
        tipo: data.tipo,
        concepto,
        monto: parseFloat(data.monto),
        metodo_pago: data.metodo_pago,
        referencia: data.referencia || null,
        created_by: user.id,
        categoria: data.tipo === 'egreso' ? data.categoria : null,
        chofer_id: isAdelanto ? data.chofer_id : null,
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
        categoria: 'otro',
        chofer_id: '',
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
      const key = m.metodo_pago as PaymentMethod;
      if (!acc.porMetodo[key]) acc.porMetodo[key] = { ingresos: 0, egresos: 0 };
      if (m.tipo === 'ingreso') acc.porMetodo[key].ingresos += m.monto;
      else acc.porMetodo[key].egresos += m.monto;
      return acc;
    },
    {
      ingresos: 0,
      egresos: 0,
      ingresosEfectivo: 0,
      egresosEfectivo: 0,
      porMetodo: {} as Record<PaymentMethod, { ingresos: number; egresos: number }>,
    }
  );

  const metodosConMovimiento = (Object.keys(totals.porMetodo) as PaymentMethod[])
    .filter((k) => totals.porMetodo[k].ingresos > 0 || totals.porMetodo[k].egresos > 0);

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
        <div className="flex items-center gap-3">
          {/* Branch selector for admins */}
          {isAdmin() && sucursales.length > 1 && (
            <Select
              value={selectedSucursalId || ''}
              onValueChange={(value) => setSelectedSucursalId(value)}
            >
              <SelectTrigger className="w-[220px]">
                <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Seleccionar sucursal" />
              </SelectTrigger>
              <SelectContent>
                {sucursales.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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

              {/* Totales por método de pago */}
              {metodosConMovimiento.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Totales por método de pago
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {metodosConMovimiento.map((metodo) => {
                      const { ingresos, egresos } = totals.porMetodo[metodo];
                      const neto = ingresos - egresos;
                      return (
                        <div key={metodo} className="p-3 rounded-xl bg-muted/40 border border-border/50">
                          <p className="text-xs text-muted-foreground">
                            {PAYMENT_METHOD_LABELS[metodo] || metodo}
                          </p>
                          <p className={`text-lg font-bold ${neto >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {neto >= 0 ? '+' : ''}{formatCurrency(neto)}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            <span className="text-success">+{formatCurrency(ingresos)}</span>
                            {' · '}
                            <span className="text-destructive">-{formatCurrency(egresos)}</span>
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}


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
                {showRenditionButton && (
                  <Button
                    onClick={() => setIsRenditionDialogOpen(true)}
                    variant="outline"
                    className="border-primary text-primary hover:bg-primary/10"
                  >
                    <Banknote className="h-4 w-4 mr-2" />
                    Rendición COD
                  </Button>
                )}
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

          {/* Categorized Summary */}
          {movements.length > 0 && (
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Resumen por Categoría
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const categorias = {
                    rendiciones: movements.filter(m => m.concepto.toLowerCase().startsWith('rendicion') || m.concepto.toLowerCase().startsWith('rendición')),
                    cobrosDirectos: movements.filter(m => m.concepto.toLowerCase().startsWith('cobro envio') || m.concepto.toLowerCase().startsWith('cobro envío')),
                    liquidaciones: movements.filter(m => m.concepto.toLowerCase().startsWith('pago liquidacion') || m.concepto.toLowerCase().startsWith('pago liquidación')),
                    otros: movements.filter(m => {
                      const c = m.concepto.toLowerCase();
                      return !c.startsWith('rendicion') && !c.startsWith('rendición') &&
                             !c.startsWith('cobro envio') && !c.startsWith('cobro envío') &&
                             !c.startsWith('pago liquidacion') && !c.startsWith('pago liquidación');
                    }),
                  };

                  const sumCategory = (items: CashMovement[]) => {
                    const porMetodo: Record<string, number> = {};
                    for (const m of items) {
                      porMetodo[m.metodo_pago] = (porMetodo[m.metodo_pago] || 0) + m.monto;
                    }
                    return {
                      total: items.reduce((s, m) => s + m.monto, 0),
                      porMetodo,
                      count: items.length,
                    };
                  };

                  const cats = [
                    { key: 'rendiciones', label: 'Rendiciones COD', data: sumCategory(categorias.rendiciones), icon: Banknote, color: 'text-primary', bg: 'bg-primary/10', tipo: 'ingreso' },
                    { key: 'cobros', label: 'Cobros Directos', data: sumCategory(categorias.cobrosDirectos), icon: ArrowUpCircle, color: 'text-success', bg: 'bg-success/10', tipo: 'ingreso' },
                    { key: 'liquidaciones', label: 'Liquidaciones Pagadas', data: sumCategory(categorias.liquidaciones), icon: ArrowDownCircle, color: 'text-destructive', bg: 'bg-destructive/10', tipo: 'egreso' },
                    { key: 'otros', label: 'Otros Movimientos', data: sumCategory(categorias.otros), icon: DollarSign, color: 'text-muted-foreground', bg: 'bg-muted/50', tipo: 'mixto' },
                  ].filter(c => c.data.count > 0);

                  const metodoOrden: PaymentMethod[] = ['efectivo', 'transferencia', 'mercado_pago', 'tarjeta'];

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {cats.map(cat => {
                        const Icon = cat.icon;
                        return (
                          <div key={cat.key} className={`p-4 rounded-xl ${cat.bg}`}>
                            <div className="flex items-center gap-2 mb-2">
                              <Icon className={`h-4 w-4 ${cat.color}`} />
                              <span className="text-sm font-medium">{cat.label}</span>
                            </div>
                            <p className={`text-xl font-bold ${cat.color}`}>
                              {cat.tipo === 'egreso' ? '-' : '+'}{formatCurrency(cat.data.total)}
                            </p>
                            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                              <p>{cat.data.count} movimiento{cat.data.count !== 1 ? 's' : ''}</p>
                              {metodoOrden
                                .filter(m => (cat.data.porMetodo[m] || 0) > 0)
                                .map(m => (
                                  <p key={m} className="flex justify-between gap-2">
                                    <span>{PAYMENT_METHOD_LABELS[m]}:</span>
                                    <span className="font-medium text-foreground">{formatCurrency(cat.data.porMetodo[m])}</span>
                                  </p>
                                ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

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
                            <p className="font-medium flex items-center gap-2">
                              {movement.concepto}
                              {movement.categoria === 'adelanto_chofer' && (
                                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                                  Adelanto {movement.chofer_id ? `· ${driverName(movement.chofer_id)}` : ''}
                                </Badge>
                              )}
                            </p>
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
            {movements.length > 0 && metodosConMovimiento.length > 0 && (
              <div className="px-6 pb-6 pt-2 border-t border-border/50">
                <p className="text-sm font-medium text-muted-foreground mb-3 mt-4">
                  Totales por método (movimientos del día)
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {metodosConMovimiento.map((metodo) => {
                    const { ingresos, egresos } = totals.porMetodo[metodo];
                    const neto = ingresos - egresos;
                    return (
                      <div key={metodo} className="p-3 rounded-xl bg-muted/40 border border-border/50">
                        <p className="text-xs text-muted-foreground">
                          {PAYMENT_METHOD_LABELS[metodo] || metodo}
                        </p>
                        <p className={`text-lg font-bold ${neto >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {neto >= 0 ? '+' : ''}{formatCurrency(neto)}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          <span className="text-success">+{formatCurrency(ingresos)}</span>
                          {' · '}
                          <span className="text-destructive">-{formatCurrency(egresos)}</span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Historial de Sesiones
            </CardTitle>
            {isAdmin() && sucursales.length > 1 && (
              <Select
                value={historyFilter}
                onValueChange={setHistoryFilter}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="selected">Sucursal actual</SelectItem>
                  <SelectItem value="todas">Todas las sucursales</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
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
            {movementFormData.tipo === 'egreso' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Select
                    value={movementFormData.categoria}
                    onValueChange={(value) =>
                      setMovementFormData({
                        ...movementFormData,
                        categoria: value as typeof movementFormData.categoria,
                        // reset chofer si cambia
                        chofer_id: value === 'adelanto_chofer' ? movementFormData.chofer_id : '',
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="adelanto_chofer">Adelanto a Chofer</SelectItem>
                      <SelectItem value="gasto_operativo">Gasto Operativo</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {movementFormData.categoria === 'adelanto_chofer' && (
                  <div className="space-y-2">
                    <Label>Chofer *</Label>
                    <Select
                      value={movementFormData.chofer_id}
                      onValueChange={(value) =>
                        setMovementFormData({
                          ...movementFormData,
                          chofer_id: value,
                          concepto: movementFormData.concepto || `Adelanto a ${driverName(value)}`,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar chofer" />
                      </SelectTrigger>
                      <SelectContent>
                        {drivers.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No hay choferes
                          </div>
                        ) : (
                          drivers.map((d) => (
                            <SelectItem key={d.user_id} value={d.user_id}>
                              {`${d.nombre || ''} ${d.apellido || ''}`.trim() || 'Sin nombre'}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
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
