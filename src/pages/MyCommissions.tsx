import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, Package, Clock, CheckCircle, Calendar, Truck, Eye, Download, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { toLocalISOStart, toLocalISOEnd, parseDateString } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import { SettlementDetailDialog } from '@/components/settlements/SettlementDetailDialog';
import { downloadDriverSettlementPDF, downloadBranchSettlementPDF } from '@/lib/generateSettlementPDF';

interface Comision {
  id: string;
  envio_id: string;
  monto: number;
  liquidacion_id: string | null;
  created_at: string;
  envio?: {
    tracking_number: string;
    precio_total: number;
    estado: string;
    created_at: string;
  };
}

interface Liquidacion {
  id: string;
  chofer_id: string;
  periodo_inicio: string;
  periodo_fin: string;
  monto_total: number;
  cantidad_envios: number;
  estado: string;
  notas: string | null;
  fecha_pago: string | null;
  metodo_pago: string | null;
  referencia_pago: string | null;
  created_at: string;
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
  fecha_pago: string | null;
  metodo_pago: string | null;
  referencia_pago: string | null;
  created_at: string | null;
  sucursal?: { nombre: string };
}

export default function MyCommissions() {
  const { user, profile } = useAuth();
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedLiquidacion, setSelectedLiquidacion] = useState<Liquidacion | null>(null);
  const [showBranchDetailDialog, setShowBranchDetailDialog] = useState(false);
  const [selectedBranchLiq, setSelectedBranchLiq] = useState<LiquidacionSucursal | null>(null);

  const sucursalId = profile?.sucursal_id;

  // Fetch my commissions
  const { data: comisiones = [], isLoading: loadingComisiones } = useQuery({
    queryKey: ['my-commissions', user?.id, fechaInicio, fechaFin],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('comisiones')
        .select(`
          id, envio_id, monto, liquidacion_id, created_at,
          envio:envios(tracking_number, precio_total, estado, created_at)
        `)
        .eq('chofer_id', user.id)
        .order('created_at', { ascending: false });

      if (fechaInicio) {
        query = query.gte('created_at', toLocalISOStart(fechaInicio));
      }
      if (fechaFin) {
        query = query.lte('created_at', toLocalISOEnd(fechaFin));
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data as Comision[];
    },
    enabled: !!user?.id,
  });

  // Fetch my liquidaciones (driver)
  const { data: liquidaciones = [], isLoading: loadingLiquidaciones } = useQuery({
    queryKey: ['my-liquidaciones', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('liquidaciones')
        .select('*')
        .eq('chofer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as Liquidacion[];
    },
    enabled: !!user?.id,
  });

  // Fetch branch settlements
  const { data: liquidacionesSucursal = [], isLoading: loadingBranchLiq } = useQuery({
    queryKey: ['my-branch-settlements', sucursalId],
    queryFn: async () => {
      if (!sucursalId) return [];

      const { data, error } = await supabase
        .from('liquidaciones_sucursal')
        .select('*, sucursal:sucursales(nombre)')
        .eq('sucursal_id', sucursalId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data || []) as LiquidacionSucursal[];
    },
    enabled: !!sucursalId,
  });

  const comisionesPendientes = comisiones.filter(c => !c.liquidacion_id);
  const comisionesLiquidadas = comisiones.filter(c => c.liquidacion_id);

  const stats = {
    totalPendiente: comisionesPendientes.reduce((sum, c) => sum + c.monto, 0),
    cantidadPendiente: comisionesPendientes.length,
    totalLiquidado: liquidaciones.filter(l => l.estado === 'pagada').reduce((sum, l) => sum + l.monto_total, 0),
    liquidacionesPagadas: liquidaciones.filter(l => l.estado === 'pagada').length,
  };

  const branchStats = {
    pendiente: liquidacionesSucursal
      .filter(l => l.estado !== 'pagada')
      .reduce((sum, l) => sum + (l.saldo || 0), 0),
    cantidadPendiente: liquidacionesSucursal.filter(l => l.estado !== 'pagada').length,
    pagado: liquidacionesSucursal
      .filter(l => l.estado === 'pagada')
      .reduce((sum, l) => sum + (l.saldo || 0), 0),
    cantidadPagada: liquidacionesSucursal.filter(l => l.estado === 'pagada').length,
  };

  const hasBranch = !!sucursalId;
  const tabCount = hasBranch ? 4 : 3;

  const getEstadoBadge = (estado: string) => {
    const config: Record<string, { label: string; className: string }> = {
      generada: { label: 'Pendiente', className: 'bg-warning/10 text-warning border-warning' },
      pendiente: { label: 'Pendiente', className: 'bg-warning/10 text-warning border-warning' },
      enviada: { label: 'En Proceso', className: 'bg-info/10 text-info border-info' },
      aprobada: { label: 'Aprobada', className: 'bg-info/10 text-info border-info' },
      pagada: { label: 'Pagada', className: 'bg-success/10 text-success border-success' },
      rechazada: { label: 'Rechazada', className: 'bg-destructive/10 text-destructive border-destructive' },
    };
    const c = config[estado] || { label: estado, className: '' };
    return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mis Comisiones</h1>
        <p className="text-muted-foreground">Consulta tus comisiones y pagos recibidos</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {hasBranch ? (
          <>
            <Card className="border-warning/30 bg-warning/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Saldo Sucursal Pendiente</CardTitle>
                <Building2 className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">${branchStats.pendiente.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">{branchStats.cantidadPendiente} liquidaciones</p>
              </CardContent>
            </Card>
            <Card className="border-success/30 bg-success/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Saldo Sucursal Pagado</CardTitle>
                <CheckCircle className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">${branchStats.pagado.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">{branchStats.cantidadPagada} liquidaciones</p>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card className="border-warning/30 bg-warning/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pendiente de Cobro</CardTitle>
                <Clock className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">${stats.totalPendiente.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">{stats.cantidadPendiente} entregas</p>
              </CardContent>
            </Card>
            <Card className="border-success/30 bg-success/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Cobrado</CardTitle>
                <CheckCircle className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">${stats.totalLiquidado.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">{stats.liquidacionesPagadas} liquidaciones</p>
              </CardContent>
            </Card>
          </>
        )}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entregas Totales</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{comisiones.length}</div>
            <p className="text-xs text-muted-foreground">con comisión</p>
          </CardContent>
        </Card>
        <Card className="border-chofer/30 bg-chofer/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comisión Promedio</CardTitle>
            <DollarSign className="h-4 w-4 text-chofer" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chofer">
              ${comisiones.length > 0 ? (comisiones.reduce((s, c) => s + c.monto, 0) / comisiones.length).toFixed(2) : '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">por entrega</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={hasBranch ? 'sucursal' : 'pendientes'} className="w-full">
        <TabsList className={`grid w-full grid-cols-${tabCount}`}>
          {hasBranch && (
            <TabsTrigger value="sucursal" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Sucursal
              {branchStats.cantidadPendiente > 0 && (
                <Badge variant="secondary" className="ml-1">{branchStats.cantidadPendiente}</Badge>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="pendientes" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pendientes
            {stats.cantidadPendiente > 0 && (
              <Badge variant="secondary" className="ml-1">{stats.cantidadPendiente}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="historial" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Historial
          </TabsTrigger>
          <TabsTrigger value="liquidaciones" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Pagos
          </TabsTrigger>
        </TabsList>

        {/* Sucursal Tab */}
        {hasBranch && (
          <TabsContent value="sucursal" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Liquidaciones de Sucursal</CardTitle>
                <CardDescription>
                  Liquidaciones generadas para tu sucursal
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingBranchLiq ? (
                  <div className="text-center py-8 text-muted-foreground">Cargando...</div>
                ) : liquidacionesSucursal.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay liquidaciones de sucursal registradas
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Período</TableHead>
                        <TableHead>Cobrado</TableHead>
                        <TableHead>Comisiones</TableHead>
                        <TableHead>Saldo</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Fecha Pago</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {liquidacionesSucursal.map((liq) => (
                        <TableRow key={liq.id}>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-3 w-3" />
                              {format(parseDateString(liq.periodo_inicio), 'dd/MM/yy', { locale: es })} -
                              {format(parseDateString(liq.periodo_fin), 'dd/MM/yy', { locale: es })}
                            </div>
                          </TableCell>
                          <TableCell>${(liq.total_cobrado || 0).toFixed(2)}</TableCell>
                          <TableCell>${(liq.total_comisiones || 0).toFixed(2)}</TableCell>
                          <TableCell className="font-bold text-success">
                            ${(liq.saldo || 0).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {getEstadoBadge(liq.estado || 'pendiente')}
                          </TableCell>
                          <TableCell>
                            {liq.fecha_pago 
                              ? format(new Date(liq.fecha_pago), 'dd/MM/yy', { locale: es })
                              : '-'
                            }
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedBranchLiq(liq);
                                  setShowBranchDetailDialog(true);
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
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Pendientes Tab */}
        <TabsContent value="pendientes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Comisiones Pendientes de Pago</CardTitle>
              <CardDescription>
                Entregas completadas que aún no han sido liquidadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingComisiones ? (
                <div className="text-center py-8 text-muted-foreground">Cargando...</div>
              ) : comisionesPendientes.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">Sin comisiones pendientes</h3>
                  <p className="text-muted-foreground">Todas tus comisiones han sido procesadas</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tracking</TableHead>
                      <TableHead>Fecha Entrega</TableHead>
                      <TableHead>Monto Envío</TableHead>
                      <TableHead className="text-right">Tu Comisión</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comisionesPendientes.map((comision) => (
                      <TableRow key={comision.id}>
                        <TableCell className="font-mono font-medium">
                          {comision.envio?.tracking_number || '-'}
                        </TableCell>
                        <TableCell>
                          {format(new Date(comision.created_at), 'dd/MM/yy HH:mm', { locale: es })}
                        </TableCell>
                        <TableCell>
                          ${(comision.envio?.precio_total || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-success">
                          ${comision.monto.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Historial Tab */}
        <TabsContent value="historial" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle>Historial de Comisiones</CardTitle>
                  <CardDescription>Todas las comisiones generadas</CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Desde</Label>
                    <Input
                      type="date"
                      value={fechaInicio}
                      onChange={(e) => setFechaInicio(e.target.value)}
                      className="w-36"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Hasta</Label>
                    <Input
                      type="date"
                      value={fechaFin}
                      onChange={(e) => setFechaFin(e.target.value)}
                      className="w-36"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingComisiones ? (
                <div className="text-center py-8 text-muted-foreground">Cargando...</div>
              ) : comisiones.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay comisiones en este período
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tracking</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Monto Envío</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Comisión</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comisiones.map((comision) => (
                      <TableRow key={comision.id}>
                        <TableCell className="font-mono font-medium">
                          {comision.envio?.tracking_number || '-'}
                        </TableCell>
                        <TableCell>
                          {format(new Date(comision.created_at), 'dd/MM/yy', { locale: es })}
                        </TableCell>
                        <TableCell>
                          ${(comision.envio?.precio_total || 0).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {comision.liquidacion_id ? (
                            <Badge variant="outline" className="bg-success/10 text-success">Liquidada</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-warning/10 text-warning">Pendiente</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          ${comision.monto.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Liquidaciones Tab */}
        <TabsContent value="liquidaciones" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Mis Pagos Recibidos</CardTitle>
              <CardDescription>
                Historial de liquidaciones y pagos
              </CardDescription>
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
                      <TableHead>Período</TableHead>
                      <TableHead>Entregas</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha Pago</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {liquidaciones.map((liq) => (
                      <TableRow key={liq.id}>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3" />
                            {format(parseDateString(liq.periodo_inicio), 'dd/MM/yy', { locale: es })} -
                            {format(parseDateString(liq.periodo_fin), 'dd/MM/yy', { locale: es })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Truck className="h-4 w-4 text-chofer" />
                            {liq.cantidad_envios}
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-success">
                          ${liq.monto_total.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {getEstadoBadge(liq.estado)}
                        </TableCell>
                        <TableCell>
                          {liq.fecha_pago 
                            ? format(new Date(liq.fecha_pago), 'dd/MM/yy', { locale: es })
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedLiquidacion(liq);
                                setShowDetailDialog(true);
                              }}
                              title="Ver detalle"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => downloadDriverSettlementPDF({
                                ...liq,
                                chofer: { nombre: user?.email?.split('@')[0] || 'Chofer', apellido: null }
                              })}
                              title="Descargar PDF"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Driver Detail Dialog */}
      <SettlementDetailDialog
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        settlementId={selectedLiquidacion?.id || null}
        type="driver"
        settlement={selectedLiquidacion ? {
          ...selectedLiquidacion,
          chofer: { nombre: user?.email?.split('@')[0] || 'Chofer', apellido: null }
        } : null}
      />

      {/* Branch Detail Dialog */}
      <SettlementDetailDialog
        open={showBranchDetailDialog}
        onOpenChange={setShowBranchDetailDialog}
        settlementId={selectedBranchLiq?.id || null}
        type="branch"
        settlement={selectedBranchLiq || null}
      />
    </div>
  );
}
