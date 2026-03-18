import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Handshake, Calculator, Loader2, Package, FileText, Ban,
  CreditCard, Eye, Download, AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseDateString } from '@/lib/dateUtils';
import { PartnerSettlementDetailDialog } from './PartnerSettlementDetailDialog';
import { downloadPartnerSettlementPDF } from '@/lib/generateSettlementPDF';

type PaymentMethod = 'efectivo' | 'transferencia' | 'cheque' | 'tarjeta' | 'otro';

const METODOS_PAGO: { value: PaymentMethod; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia Bancaria' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'otro', label: 'Otro' },
];

interface PartnerSettlementsTabProps {
  profile: { user_id: string; tenant_id?: string } | null;
}

interface CalculatedShipment {
  envio_id: string;
  tracking_number: string;
  nombre_destinatario: string | null;
  precio_total: number;
  fecha_entrega: string | null;
  tipo_pago: string | null;
  conceptos: Array<{
    concepto_id: string;
    nombre_concepto: string;
    monto: number;
    porcentaje: number;
    comision: number;
  }>;
  total_comision: number;
}

interface PartnerLiquidacion {
  id: string;
  partnership_id: string;
  partner_tenant_id: string;
  periodo_inicio: string;
  periodo_fin: string;
  monto_total: number;
  monto_comision: number;
  cantidad_envios: number;
  estado: string;
  notas: string | null;
  metodo_pago: string | null;
  referencia_pago: string | null;
  fecha_pago: string | null;
  created_at: string;
  partner_name?: string;
}

export function PartnerSettlementsTab({ profile }: PartnerSettlementsTabProps) {
  const queryClient = useQueryClient();
  const tenantId = profile?.tenant_id;

  // State
  const [selectedPartnershipId, setSelectedPartnershipId] = useState<string | null>(null);
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFin, setPeriodoFin] = useState('');
  const [calculatedShipments, setCalculatedShipments] = useState<CalculatedShipment[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [hasCalculated, setHasCalculated] = useState(false);

  // Dialogs
  const [payDialog, setPayDialog] = useState<PartnerLiquidacion | null>(null);
  const [payForm, setPayForm] = useState({ metodo_pago: 'transferencia' as PaymentMethod, referencia_pago: '' });
  const [cancelDialog, setCancelDialog] = useState<PartnerLiquidacion | null>(null);
  const [detailDialog, setDetailDialog] = useState<PartnerLiquidacion | null>(null);

  // Fetch active partnerships
  const { data: partnerships = [] } = useQuery({
    queryKey: ['partner-settlements-partnerships', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('tenant_partners')
        .select('id, tenant_a_id, tenant_b_id, estado')
        .eq('estado', 'activa')
        .or(`tenant_a_id.eq.${tenantId},tenant_b_id.eq.${tenantId}`);
      if (error) throw error;

      // Get partner names
      const partnerTenantIds = (data || []).map(p =>
        p.tenant_a_id === tenantId ? p.tenant_b_id : p.tenant_a_id
      );
      const uniqueIds = [...new Set(partnerTenantIds)];
      let nameMap: Record<string, string> = {};
      if (uniqueIds.length > 0) {
        const { data: tenants } = await supabase
          .from('tenants')
          .select('id, nombre')
          .in('id', uniqueIds);
        nameMap = Object.fromEntries((tenants || []).map(t => [t.id, t.nombre]));
      }

      return (data || []).map(p => {
        const partnerId = p.tenant_a_id === tenantId ? p.tenant_b_id : p.tenant_a_id;
        return { ...p, partner_tenant_id: partnerId, partner_name: nameMap[partnerId] || 'Empresa' };
      });
    },
    enabled: !!tenantId,
  });

  const selectedPartnership = partnerships.find(p => p.id === selectedPartnershipId);

  // Fetch existing liquidaciones for selected partnership
  const { data: liquidaciones = [], isLoading: loadingLiquidaciones } = useQuery({
    queryKey: ['liquidaciones-partner', selectedPartnershipId],
    queryFn: async () => {
      if (!selectedPartnershipId) return [];
      const { data, error } = await (supabase
        .from('liquidaciones_partner') as any)
        .select('*')
        .eq('partnership_id', selectedPartnershipId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((l: any) => ({
        ...l,
        partner_name: selectedPartnership?.partner_name || 'Empresa',
      })) as PartnerLiquidacion[];
    },
    enabled: !!selectedPartnershipId,
  });

  // Calculate
  const handleCalculate = async () => {
    if (!selectedPartnership || !periodoInicio || !periodoFin) {
      toast.error('Selecciona un partner y rango de fechas');
      return;
    }
    setIsCalculating(true);
    try {
      // 1. Get partner shipments (derivados a este partner) accepted/completed
      const { data: partnerShipments, error: psErr } = await supabase
        .from('partner_shipments')
        .select('id, envio_origen_id, envio_destino_id, estado_sync')
        .eq('partnership_id', selectedPartnership.id)
        .eq('tenant_origen_id', tenantId!)
        .in('estado_sync', ['accepted', 'en_curso', 'completado']);
      if (psErr) throw psErr;

      if (!partnerShipments || partnerShipments.length === 0) {
        setCalculatedShipments([]);
        setHasCalculated(true);
        return;
      }

      const envioOrigenIds = partnerShipments.map(ps => ps.envio_origen_id);

      // 2. Get origin envíos within date range
      const { data: envios, error: envErr } = await supabase
        .from('envios')
        .select('id, tracking_number, nombre_destinatario, precio_total, fecha_entrega, tipo_pago')
        .in('id', envioOrigenIds)
        .gte('fecha_entrega', periodoInicio)
        .lte('fecha_entrega', periodoFin + 'T23:59:59');
      if (envErr) throw envErr;

      if (!envios || envios.length === 0) {
        setCalculatedShipments([]);
        setHasCalculated(true);
        return;
      }

      // 3. Filter out already liquidated
      const envioIds = envios.map(e => e.id);
      const { data: yaLiquidados } = await (supabase
        .from('liquidacion_partner_detalles') as any)
        .select('envio_id')
        .in('envio_id', envioIds);
      const liquidadosSet = new Set((yaLiquidados || []).map((d: any) => d.envio_id));
      const filteredEnvios = envios.filter(e => !liquidadosSet.has(e.id));

      if (filteredEnvios.length === 0) {
        setCalculatedShipments([]);
        setHasCalculated(true);
        return;
      }

      // 4. Get envio_detalles for these envíos
      const { data: detalles } = await supabase
        .from('envio_detalles')
        .select('envio_id, concepto_id, nombre_concepto, monto')
        .in('envio_id', filteredEnvios.map(e => e.id));

      // 5. Get partner_comisiones for this partnership
      const { data: comisiones } = await (supabase
        .from('partner_comisiones') as any)
        .select('concepto_id, porcentaje_contado, porcentaje_destino, porcentaje_cta_cte')
        .eq('partnership_id', selectedPartnership.id);

      const comisionMap = new Map<string, any>();
      (comisiones || []).forEach((c: any) => comisionMap.set(c.concepto_id, c));

      // 6. Calculate commissions
      const result: CalculatedShipment[] = filteredEnvios.map(envio => {
        const envioDetalles = (detalles || []).filter(d => d.envio_id === envio.id);
        const tipoPago = envio.tipo_pago || 'contado';

        const conceptos = envioDetalles.map(d => {
          const config = d.concepto_id ? comisionMap.get(d.concepto_id) : null;
          let porcentaje = 0;
          if (config) {
            if (tipoPago === 'destino') porcentaje = Number(config.porcentaje_destino) || 0;
            else if (tipoPago === 'cuenta_corriente') porcentaje = Number(config.porcentaje_cta_cte) || 0;
            else porcentaje = Number(config.porcentaje_contado) || 0;
          }
          const comision = (d.monto || 0) * porcentaje / 100;
          return {
            concepto_id: d.concepto_id || '',
            nombre_concepto: d.nombre_concepto,
            monto: d.monto || 0,
            porcentaje,
            comision,
          };
        });

        const totalComision = conceptos.reduce((sum, c) => sum + c.comision, 0);

        return {
          envio_id: envio.id,
          tracking_number: envio.tracking_number,
          nombre_destinatario: envio.nombre_destinatario,
          precio_total: envio.precio_total,
          fecha_entrega: envio.fecha_entrega,
          tipo_pago: envio.tipo_pago,
          conceptos,
          total_comision: totalComision,
        };
      });

      setCalculatedShipments(result);
      setHasCalculated(true);
    } catch (err: any) {
      toast.error(`Error al calcular: ${err.message}`);
    } finally {
      setIsCalculating(false);
    }
  };

  const totalMonto = calculatedShipments.reduce((s, e) => s + e.precio_total, 0);
  const totalComision = calculatedShipments.reduce((s, e) => s + e.total_comision, 0);

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPartnership || calculatedShipments.length === 0) throw new Error('No hay datos');

      const { data: liq, error: liqErr } = await (supabase
        .from('liquidaciones_partner') as any)
        .insert({
          partnership_id: selectedPartnership.id,
          partner_tenant_id: selectedPartnership.partner_tenant_id,
          periodo_inicio: periodoInicio,
          periodo_fin: periodoFin,
          monto_total: totalMonto,
          monto_comision: totalComision,
          cantidad_envios: calculatedShipments.length,
          estado: 'generada',
          generado_por: profile?.user_id,
          tenant_id: tenantId,
        })
        .select('id')
        .single();
      if (liqErr) throw liqErr;

      // Insert detalles
      const detallesRows: any[] = [];
      calculatedShipments.forEach(s => {
        if (s.conceptos.length > 0) {
          s.conceptos.forEach(c => {
            detallesRows.push({
              liquidacion_id: liq.id,
              envio_id: s.envio_id,
              concepto_id: c.concepto_id || null,
              nombre_concepto: c.nombre_concepto,
              monto_envio: c.monto,
              porcentaje_comision: c.porcentaje,
              monto_comision: c.comision,
              tipo_pago: s.tipo_pago || 'contado',
            });
          });
        } else {
          detallesRows.push({
            liquidacion_id: liq.id,
            envio_id: s.envio_id,
            nombre_concepto: 'Total envío',
            monto_envio: s.precio_total,
            porcentaje_comision: 0,
            monto_comision: 0,
            tipo_pago: s.tipo_pago || 'contado',
          });
        }
      });

      if (detallesRows.length > 0) {
        const { error: detErr } = await (supabase
          .from('liquidacion_partner_detalles') as any)
          .insert(detallesRows);
        if (detErr) throw detErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liquidaciones-partner'] });
      toast.success('Liquidación de partner generada');
      setCalculatedShipments([]);
      setHasCalculated(false);
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  });

  // Pay mutation
  const payMutation = useMutation({
    mutationFn: async () => {
      if (!payDialog) throw new Error('No data');
      const { error } = await (supabase
        .from('liquidaciones_partner') as any)
        .update({
          estado: 'pagada',
          metodo_pago: payForm.metodo_pago,
          referencia_pago: payForm.referencia_pago || null,
          fecha_pago: new Date().toISOString(),
        })
        .eq('id', payDialog.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liquidaciones-partner'] });
      toast.success('Liquidación marcada como pagada');
      setPayDialog(null);
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!cancelDialog) throw new Error('No data');
      const { error } = await (supabase
        .from('liquidaciones_partner') as any)
        .delete()
        .eq('id', cancelDialog.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liquidaciones-partner'] });
      toast.success('Liquidación cancelada');
      setCancelDialog(null);
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  });

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'generada': return <Badge variant="secondary">Generada</Badge>;
      case 'pagada': return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Pagada</Badge>;
      case 'cancelada': return <Badge variant="destructive">Cancelada</Badge>;
      default: return <Badge variant="outline">{estado}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Calculator */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Calculadora de Liquidación - Partners
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Empresa Asociada</Label>
              <Select
                value={selectedPartnershipId || ''}
                onValueChange={(v) => {
                  setSelectedPartnershipId(v || null);
                  setHasCalculated(false);
                  setCalculatedShipments([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar partner..." />
                </SelectTrigger>
                <SelectContent>
                  {partnerships.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <Handshake className="h-4 w-4" />
                        <span>{p.partner_name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Desde</Label>
              <Input type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Hasta</Label>
              <Input type="date" value={periodoFin} onChange={e => setPeriodoFin(e.target.value)} />
            </div>
            <Button onClick={handleCalculate} disabled={isCalculating || !selectedPartnershipId}>
              {isCalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
              Calcular
            </Button>
          </div>

          {hasCalculated && (
            <div className="space-y-4 mt-4">
              {calculatedShipments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
                  <AlertCircle className="h-8 w-8" />
                  <p>No se encontraron envíos derivados sin liquidar en este período</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">Envíos</p>
                        <p className="text-2xl font-bold">{calculatedShipments.length}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">Monto Total</p>
                        <p className="text-2xl font-bold">${totalMonto.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">Comisión Partner</p>
                        <p className="text-2xl font-bold text-primary">${totalComision.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tracking</TableHead>
                        <TableHead>Destinatario</TableHead>
                        <TableHead>Fecha Entrega</TableHead>
                        <TableHead>Tipo Pago</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead className="text-right">Comisión</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calculatedShipments.map(s => (
                        <TableRow key={s.envio_id}>
                          <TableCell className="font-mono text-sm">{s.tracking_number}</TableCell>
                          <TableCell>{s.nombre_destinatario || '-'}</TableCell>
                          <TableCell>
                            {s.fecha_entrega ? format(new Date(s.fecha_entrega), 'dd/MM/yy', { locale: es }) : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs capitalize">{s.tipo_pago || 'contado'}</Badge>
                          </TableCell>
                          <TableCell className="text-right">${s.precio_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right font-medium text-primary">
                            ${s.total_comision.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex justify-end">
                    <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
                      {generateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                      Generar Liquidación
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      {selectedPartnershipId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Historial de Liquidaciones - {selectedPartnership?.partner_name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingLiquidaciones ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : liquidaciones.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No hay liquidaciones generadas</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead>Envíos</TableHead>
                    <TableHead>Monto Total</TableHead>
                    <TableHead>Comisión</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liquidaciones.map(liq => (
                    <TableRow key={liq.id}>
                      <TableCell>
                        {format(parseDateString(liq.periodo_inicio), 'dd/MM/yy')} - {format(parseDateString(liq.periodo_fin), 'dd/MM/yy')}
                      </TableCell>
                      <TableCell>{liq.cantidad_envios}</TableCell>
                      <TableCell>${liq.monto_total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-primary font-medium">
                        ${liq.monto_comision?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>{getEstadoBadge(liq.estado)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setDetailDialog(liq)} title="Ver detalle">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => downloadPartnerSettlementPDF(liq)} title="Descargar PDF">
                            <Download className="h-4 w-4" />
                          </Button>
                          {liq.estado === 'generada' && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => { setPayDialog(liq); setPayForm({ metodo_pago: 'transferencia', referencia_pago: '' }); }} title="Registrar pago">
                                <CreditCard className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setCancelDialog(liq)} title="Cancelar">
                                <Ban className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
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
      )}

      {/* Pay Dialog */}
      <Dialog open={!!payDialog} onOpenChange={(o) => !o && setPayDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago de Liquidación</DialogTitle>
            <DialogDescription>
              Monto: ${payDialog?.monto_comision?.toLocaleString(undefined, { minimumFractionDigits: 2 })} (comisión partner)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Método de Pago</Label>
              <Select value={payForm.metodo_pago} onValueChange={(v) => setPayForm(f => ({ ...f, metodo_pago: v as PaymentMethod }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METODOS_PAGO.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Referencia (opcional)</Label>
              <Input value={payForm.referencia_pago} onChange={e => setPayForm(f => ({ ...f, referencia_pago: e.target.value }))} placeholder="Nro. transferencia, cheque, etc." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(null)}>Cancelar</Button>
            <Button onClick={() => payMutation.mutate()} disabled={payMutation.isPending}>
              {payMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={!!cancelDialog} onOpenChange={(o) => !o && setCancelDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Liquidación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro? Se eliminará la liquidación y los envíos quedarán disponibles para futuras liquidaciones.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog(null)}>No, volver</Button>
            <Button variant="destructive" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
              {cancelMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sí, cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <PartnerSettlementDetailDialog
        open={!!detailDialog}
        onOpenChange={(o) => !o && setDetailDialog(null)}
        liquidacion={detailDialog}
      />
    </div>
  );
}
