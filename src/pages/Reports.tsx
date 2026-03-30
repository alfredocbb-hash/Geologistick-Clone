import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Download, Package, TrendingUp, TrendingDown, Clock, DollarSign, BarChart3, Users, MapPin, FileText, Loader2, FileSpreadsheet, Award, ShieldCheck, Zap, Fuel, Brain } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { useReportsData, type ReportsFilters } from '@/hooks/useReportsData';
import { useProductividadData } from '@/hooks/useProductividadData';
import { useCostosData } from '@/hooks/useCostosData';
import { subDays, subMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { exportReportPDF } from '@/lib/exportReportPDF';
import { exportToExcel } from '@/lib/exportExcel';
import { toast } from 'sonner';
import ProductividadTab from '@/components/reports/ProductividadTab';
import CostosTab from '@/components/reports/CostosTab';
import DemandPredictionTab from '@/components/reports/DemandPredictionTab';

const DATE_PRESETS = [
  { label: 'Hoy', getValue: () => ({ from: new Date(), to: new Date() }) },
  { label: 'Última Semana', getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: 'Último Mes', getValue: () => ({ from: subMonths(new Date(), 1), to: new Date() }) },
  { label: 'Último Trimestre', getValue: () => ({ from: subMonths(new Date(), 3), to: new Date() }) },
];

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 160 60% 45%))',
  'hsl(var(--chart-3, 30 80% 55%))',
  'hsl(var(--chart-4, 280 65% 60%))',
  'hsl(var(--chart-5, 340 75% 55%))',
  'hsl(var(--destructive))',
];

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_bodega: 'En Bodega',
  en_transito: 'En Tránsito',
  en_sucursal: 'En Sucursal',
  en_reparto: 'En Reparto',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  devuelto: 'Devuelto',
  recogido: 'Recogido',
  incidencia: 'Incidencia',
};

// Trend badge component
function TrendBadge({ value, suffix = '%' }: { value: number; suffix?: string }) {
  if (value === 0) return null;
  const isPositive = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isPositive ? '+' : ''}{value}{suffix} vs anterior
    </span>
  );
}

export default function Reports() {
  const [datePreset, setDatePreset] = useState('Último Mes');
  const [sucursalId, setSucursalId] = useState<string>('all');
  const [exporting, setExporting] = useState(false);

  // Chart refs for PDF capture
  const sucursalesChartRef = useRef<HTMLDivElement>(null);
  const destinosChartRef = useRef<HTMLDivElement>(null);
  const choferesChartRef = useRef<HTMLDivElement>(null);
  const evolucionChartRef = useRef<HTMLDivElement>(null);
  const estadosChartRef = useRef<HTMLDivElement>(null);

  const preset = DATE_PRESETS.find(p => p.label === datePreset) || DATE_PRESETS[2];
  const { from, to } = preset.getValue();
  const dateRange = `${format(from, 'dd/MM/yy')} - ${format(to, 'dd/MM/yy')}`;

  const filters: ReportsFilters = {
    dateFrom: from,
    dateTo: to,
    sucursalId: sucursalId !== 'all' ? sucursalId : undefined,
  };

  const { enviosPorSucursal, destinos, rendimientoChoferes, resumenGeneral, resumenPeriodoAnterior, slaData, sucursales, enviosDetalle } = useReportsData(filters);
  const productividad = useProductividadData(filters);
  const costos = useCostosData(filters);

  // Trend calculation helper
  const calcTrend = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };

  const prev = resumenPeriodoAnterior.data;

  const handleExportPDF = async (
    tab: 'sucursales' | 'destinos' | 'choferes' | 'resumen' | 'envios',
    title: string,
    chartRefs: React.RefObject<HTMLDivElement | null>[],
    data: any
  ) => {
    setExporting(true);
    try {
      await exportReportPDF({
        tab,
        title,
        subtitle: datePreset,
        dateRange,
        chartRefs,
        data,
      });
      toast.success('PDF generado correctamente');
    } catch (e) {
      toast.error('Error al generar el PDF');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reportes y Análisis</h1>
          <p className="text-muted-foreground text-sm">Métricas y estadísticas de tu operación logística</p>
        </div>
      </div>

      {/* Global Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Período</label>
              <Select value={datePreset} onValueChange={setDatePreset}>
                <SelectTrigger>
                  <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_PRESETS.map(p => (
                    <SelectItem key={p.label} value={p.label}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Sucursal</label>
              <Select value={sucursalId} onValueChange={setSucursalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las sucursales" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las sucursales</SelectItem>
                  {(sucursales.data || []).map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Badge variant="secondary" className="h-10 px-3 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {dateRange}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="sucursales" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 md:grid-cols-10">
          <TabsTrigger value="sucursales" className="gap-1.5">
            <BarChart3 className="h-4 w-4 hidden sm:block" /> Sucursales
          </TabsTrigger>
          <TabsTrigger value="ranking" className="gap-1.5">
            <Award className="h-4 w-4 hidden sm:block" /> Ranking
          </TabsTrigger>
          <TabsTrigger value="destinos" className="gap-1.5">
            <MapPin className="h-4 w-4 hidden sm:block" /> Destinos
          </TabsTrigger>
          <TabsTrigger value="choferes" className="gap-1.5">
            <Users className="h-4 w-4 hidden sm:block" /> Choferes
          </TabsTrigger>
          <TabsTrigger value="envios-detalle" className="gap-1.5">
            <Package className="h-4 w-4 hidden sm:block" /> Envíos
          </TabsTrigger>
          <TabsTrigger value="productividad" className="gap-1.5">
            <Zap className="h-4 w-4 hidden sm:block" /> Productividad
          </TabsTrigger>
          <TabsTrigger value="costos" className="gap-1.5">
            <Fuel className="h-4 w-4 hidden sm:block" /> Costos
          </TabsTrigger>
          <TabsTrigger value="demanda" className="gap-1.5">
            <Brain className="h-4 w-4 hidden sm:block" /> Demanda
          </TabsTrigger>
          <TabsTrigger value="sla" className="gap-1.5">
            <ShieldCheck className="h-4 w-4 hidden sm:block" /> SLA
          </TabsTrigger>
          <TabsTrigger value="resumen" className="gap-1.5">
            <FileText className="h-4 w-4 hidden sm:block" /> Resumen
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Envíos por Sucursal */}
        <TabsContent value="sucursales" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToExcel({
                filename: `envios-por-sucursal-${dateRange}`,
                columns: [
                  { header: 'Sucursal', key: 'sucursal_nombre' },
                  { header: 'Total', key: 'total', format: 'number' },
                  { header: 'Entregados', key: 'entregados', format: 'number' },
                  { header: 'Pendientes', key: 'pendientes', format: 'number' },
                  { header: 'Cancelados', key: 'cancelados', format: 'number' },
                  { header: 'Efectividad %', key: 'efectividad', format: 'percent' },
                ],
                data: enviosPorSucursal.data || [],
              })}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={exporting}
              onClick={() => handleExportPDF('sucursales', 'Envios por Sucursal', [sucursalesChartRef], enviosPorSucursal.data || [])}
            >
              {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              PDF
            </Button>
          </div>

          {enviosPorSucursal.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <>
              <Card>
                <CardHeader><CardTitle className="text-base">Envíos por Sucursal</CardTitle></CardHeader>
                <CardContent>
                  <div ref={sucursalesChartRef}>
                    <ResponsiveContainer width="100%" height={Math.max(200, (enviosPorSucursal.data?.length || 0) * 40)}>
                      <BarChart data={enviosPorSucursal.data} layout="vertical" margin={{ left: 100 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="sucursal_nombre" width={90} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="entregados" stackId="a" fill="hsl(var(--primary))" name="Entregados" />
                        <Bar dataKey="pendientes" stackId="a" fill="hsl(var(--chart-2, 160 60% 45%))" name="Pendientes" />
                        <Bar dataKey="cancelados" stackId="a" fill="hsl(var(--destructive))" name="Cancelados" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sucursal</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Entregados</TableHead>
                        <TableHead className="text-right">Pendientes</TableHead>
                        <TableHead className="text-right">Cancelados</TableHead>
                        <TableHead className="text-right">% Efectividad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(enviosPorSucursal.data || []).map(row => (
                        <TableRow key={row.sucursal_id}>
                          <TableCell className="font-medium">{row.sucursal_nombre}</TableCell>
                          <TableCell className="text-right">{row.total}</TableCell>
                          <TableCell className="text-right">{row.entregados}</TableCell>
                          <TableCell className="text-right">{row.pendientes}</TableCell>
                          <TableCell className="text-right">{row.cancelados}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={row.efectividad >= 80 ? 'default' : row.efectividad >= 50 ? 'secondary' : 'destructive'}>
                              {row.efectividad}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(enviosPorSucursal.data || []).length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No hay datos para el período seleccionado</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Tab 2: Destinos */}
        <TabsContent value="destinos" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToExcel({
                filename: `destinos-${dateRange}`,
                columns: [
                  { header: 'Ciudad', key: 'ciudad' },
                  { header: 'Provincia', key: 'provincia' },
                  { header: 'Cantidad', key: 'cantidad', format: 'number' },
                  { header: 'Ingresos', key: 'ingresos', format: 'currency' },
                ],
                data: destinos.data || [],
              })}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={exporting}
              onClick={() => handleExportPDF('destinos', 'Destinos mas frecuentes', [destinosChartRef], destinos.data || [])}
            >
              {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              PDF
            </Button>
          </div>

          {destinos.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <>
              <Card>
                <CardHeader><CardTitle className="text-base">Ciudades más frecuentes (Top 15)</CardTitle></CardHeader>
                <CardContent>
                  <div ref={destinosChartRef}>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={(destinos.data || []).slice(0, 15)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="ciudad" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" height={80} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="cantidad" fill="hsl(var(--primary))" name="Envíos" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ciudad</TableHead>
                        <TableHead>Provincia</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">Ingresos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(destinos.data || []).slice(0, 30).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{row.ciudad}</TableCell>
                          <TableCell>{row.provincia}</TableCell>
                          <TableCell className="text-right">{row.cantidad}</TableCell>
                          <TableCell className="text-right">${row.ingresos.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                      {(destinos.data || []).length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No hay datos para el período seleccionado</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Tab 3: Rendimiento de Choferes */}
        <TabsContent value="choferes" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToExcel({
                filename: `rendimiento-choferes-${dateRange}`,
                columns: [
                  { header: 'Chofer', key: 'chofer_nombre' },
                  { header: 'Total', key: 'total', format: 'number' },
                  { header: 'Entregados', key: 'entregados', format: 'number' },
                  { header: 'No Entregados', key: 'no_entregados', format: 'number' },
                  { header: 'Efectividad %', key: 'efectividad', format: 'percent' },
                ],
                data: rendimientoChoferes.data || [],
              })}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={exporting}
              onClick={() => handleExportPDF('choferes', 'Rendimiento de Choferes', [choferesChartRef], rendimientoChoferes.data || [])}
            >
              {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              PDF
            </Button>
          </div>

          {rendimientoChoferes.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <>
              <Card>
                <CardHeader><CardTitle className="text-base">Comparativo de Choferes</CardTitle></CardHeader>
                <CardContent>
                  <div ref={choferesChartRef}>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={(rendimientoChoferes.data || []).slice(0, 15)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="chofer_nombre" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" height={80} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="entregados" fill="hsl(var(--primary))" name="Entregados" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="no_entregados" fill="hsl(var(--destructive))" name="No Entregados" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Chofer</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Entregados</TableHead>
                        <TableHead className="text-right">No Entregados</TableHead>
                        <TableHead className="text-right">% Efectividad</TableHead>
                        <TableHead className="text-right">T. Promedio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(rendimientoChoferes.data || []).map((row, i) => (
                        <TableRow key={row.chofer_id}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell className="font-medium">{row.chofer_nombre}</TableCell>
                          <TableCell className="text-right">{row.total}</TableCell>
                          <TableCell className="text-right">{row.entregados}</TableCell>
                          <TableCell className="text-right">{row.no_entregados}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={row.efectividad >= 80 ? 'default' : row.efectividad >= 50 ? 'secondary' : 'destructive'}>
                              {row.efectividad}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {row.tiempo_promedio_minutos != null ? `${row.tiempo_promedio_minutos} min` : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(rendimientoChoferes.data || []).length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No hay datos para el período seleccionado</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Tab: Ranking Sucursales */}
        <TabsContent value="ranking" className="space-y-4">
          {enviosPorSucursal.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <>
              <Card>
                <CardHeader><CardTitle className="text-base">Ranking de Sucursales por Efectividad</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(enviosPorSucursal.data || []).map((row, i) => (
                      <div key={row.sucursal_id} className="flex items-center gap-3">
                        <span className={`text-lg font-bold w-8 text-center ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-700' : 'text-muted-foreground'}`}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm truncate">{row.sucursal_nombre}</span>
                            <span className="text-sm text-muted-foreground">{row.total} envíos</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${row.efectividad >= 80 ? 'bg-green-500' : row.efectividad >= 50 ? 'bg-yellow-500' : 'bg-destructive'}`}
                              style={{ width: `${row.efectividad}%` }}
                            />
                          </div>
                        </div>
                        <Badge variant={row.efectividad >= 80 ? 'default' : row.efectividad >= 50 ? 'secondary' : 'destructive'} className="w-14 justify-center">
                          {row.efectividad}%
                        </Badge>
                      </div>
                    ))}
                    {(enviosPorSucursal.data || []).length === 0 && (
                      <p className="text-center text-muted-foreground py-8">No hay datos para el período seleccionado</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Comparative bar chart */}
              {(enviosPorSucursal.data || []).length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Comparativa: Entregados vs Pendientes</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={Math.max(200, (enviosPorSucursal.data?.length || 0) * 50)}>
                      <BarChart data={enviosPorSucursal.data} layout="vertical" margin={{ left: 100 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="sucursal_nombre" width={90} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="entregados" fill="hsl(var(--primary))" name="Entregados" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="pendientes" fill="hsl(var(--chart-2, 160 60% 45%))" name="Pendientes" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Tab: Envíos Detalle */}
        <TabsContent value="envios-detalle" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const data = enviosDetalle.data || [];
                const totals = data.reduce((acc, d) => ({
                  precio_total: acc.precio_total + d.precio_total,
                  comision_chofer: acc.comision_chofer + d.comision_chofer,
                  importe_abonado: acc.importe_abonado + d.importe_abonado,
                  diferencia: acc.diferencia + d.diferencia,
                }), { precio_total: 0, comision_chofer: 0, importe_abonado: 0, diferencia: 0 });
                exportToExcel({
                  filename: `detalle-envios-${dateRange}`,
                  columns: [
                    { header: 'Tracking', key: 'tracking_number' },
                    { header: 'Fecha', key: 'fecha' },
                    { header: 'Remitente / Seller', key: 'nombre_remitente' },
                    { header: 'Destinatario', key: 'nombre_destinatario' },
                    { header: 'Localidad', key: 'ciudad_entrega' },
                    { header: 'Importe', key: 'precio_total', format: 'currency' },
                    { header: 'Est. Liquidación', key: 'estado_liquidacion' },
                    { header: 'Comisión Chofer', key: 'comision_chofer', format: 'currency' },
                    { header: 'Importe Abonado', key: 'importe_abonado', format: 'currency' },
                    { header: 'Diferencia', key: 'diferencia', format: 'currency' },
                  ],
                  data: [
                    ...data,
                    {
                      tracking_number: 'TOTALES',
                      fecha: '',
                      nombre_remitente: '',
                      nombre_destinatario: '',
                      ciudad_entrega: '',
                      precio_total: totals.precio_total,
                      estado_liquidacion: '',
                      comision_chofer: totals.comision_chofer,
                      importe_abonado: totals.importe_abonado,
                      diferencia: totals.diferencia,
                    },
                  ],
                });
              }}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={exporting}
              onClick={() => handleExportPDF('envios', 'Detalle de Envíos', [], enviosDetalle.data || [])}
            >
              {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              PDF
            </Button>
          </div>

          {enviosDetalle.isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
            </div>
          ) : (
            <>
              {/* KPI Cards */}
              {(() => {
                const data = enviosDetalle.data || [];
                const totalEnvios = data.length;
                const totalImporte = data.reduce((s, d) => s + d.precio_total, 0);
                const totalComisiones = data.reduce((s, d) => s + d.comision_chofer, 0);
                const totalDiferencia = data.reduce((s, d) => s + d.diferencia, 0);
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Package className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Total Envíos</p>
                            <p className="text-2xl font-bold">{totalEnvios}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <DollarSign className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Importe Total</p>
                            <p className="text-2xl font-bold">${totalImporte.toLocaleString()}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Total Comisiones</p>
                            <p className="text-2xl font-bold">${totalComisiones.toLocaleString()}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <TrendingUp className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Diferencia Neta</p>
                            <p className="text-2xl font-bold">${totalDiferencia.toLocaleString()}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })()}

              {/* Table */}
              <Card>
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tracking</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Remitente</TableHead>
                        <TableHead>Destinatario</TableHead>
                        <TableHead>Localidad</TableHead>
                        <TableHead className="text-right">Importe</TableHead>
                        <TableHead>Est. Liquidación</TableHead>
                        <TableHead className="text-right">Comisión</TableHead>
                        <TableHead className="text-right">Abonado</TableHead>
                        <TableHead className="text-right">Diferencia</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(enviosDetalle.data || []).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{row.tracking_number}</TableCell>
                          <TableCell className="text-xs">{row.fecha}</TableCell>
                          <TableCell className="max-w-[120px] truncate">{row.nombre_remitente}</TableCell>
                          <TableCell className="max-w-[120px] truncate">{row.nombre_destinatario}</TableCell>
                          <TableCell>{row.ciudad_entrega}</TableCell>
                          <TableCell className="text-right">${row.precio_total.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={row.estado_liquidacion === 'Liquidada' || row.estado_liquidacion === 'Pagada' ? 'default' : 'secondary'}>
                              {row.estado_liquidacion}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">${row.comision_chofer.toLocaleString()}</TableCell>
                          <TableCell className="text-right">${row.importe_abonado.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-medium">${row.diferencia.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                      {(enviosDetalle.data || []).length > 0 && (() => {
                        const data = enviosDetalle.data!;
                        return (
                          <TableRow className="font-bold border-t-2">
                            <TableCell colSpan={5}>TOTALES</TableCell>
                            <TableCell className="text-right">${data.reduce((s, d) => s + d.precio_total, 0).toLocaleString()}</TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-right">${data.reduce((s, d) => s + d.comision_chofer, 0).toLocaleString()}</TableCell>
                            <TableCell className="text-right">${data.reduce((s, d) => s + d.importe_abonado, 0).toLocaleString()}</TableCell>
                            <TableCell className="text-right">${data.reduce((s, d) => s + d.diferencia, 0).toLocaleString()}</TableCell>
                          </TableRow>
                        );
                      })()}
                      {(enviosDetalle.data || []).length === 0 && (
                        <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No hay datos para el período seleccionado</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Tab: Productividad */}
        <TabsContent value="productividad" className="space-y-4">
          <ProductividadTab data={productividad.data} isLoading={productividad.isLoading} />
        </TabsContent>

        {/* Tab: Costos */}
        <TabsContent value="costos" className="space-y-4">
          <CostosTab data={costos.data} isLoading={costos.isLoading} />
        </TabsContent>

        {/* Tab: SLA */}
        <TabsContent value="sla" className="space-y-4">
          {slaData.isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {/* SLA Gauge */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center">
                      <div className="relative h-20 w-20 mb-2">
                        <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
                          <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                          <circle cx="18" cy="18" r="15.5" fill="none"
                            stroke={(slaData.data?.porcentajeATiempo || 0) >= 80 ? 'hsl(var(--primary))' : (slaData.data?.porcentajeATiempo || 0) >= 50 ? 'hsl(var(--chart-3, 30 80% 55%))' : 'hsl(var(--destructive))'}
                            strokeWidth="3"
                            strokeDasharray={`${(slaData.data?.porcentajeATiempo || 0) * 0.974} 97.4`}
                            strokeLinecap="round" />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
                          {slaData.data?.porcentajeATiempo || 0}%
                        </span>
                      </div>
                      <p className="text-sm font-medium">Entregas a Tiempo</p>
                      <p className="text-xs text-muted-foreground">SLA &le; 24h</p>
                    </div>
                  </CardContent>
                </Card>
                {/* A tiempo */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <ShieldCheck className="h-5 w-5 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">A Tiempo</p>
                        <p className="text-2xl font-bold text-green-600">{slaData.data?.aTiempo || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {/* Con demora */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-destructive" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Con Demora</p>
                        <p className="text-2xl font-bold text-destructive">{slaData.data?.conDemora || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Histogram */}
              {slaData.data && slaData.data.totalEntregados > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Distribución de Tiempos de Entrega</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={slaData.data.distribucionHoras}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="rango" tick={{ fontSize: 12 }} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="cantidad" name="Envíos" radius={[4, 4, 0, 0]}>
                          {slaData.data.distribucionHoras.map((entry, i) => (
                            <Cell key={i} fill={i < 3 ? 'hsl(var(--primary))' : i < 5 ? 'hsl(var(--chart-3, 30 80% 55%))' : 'hsl(var(--destructive))'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {slaData.data && slaData.data.totalEntregados === 0 && (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    No hay entregas completadas en el período seleccionado
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Tab 4: Resumen General */}
        <TabsContent value="resumen" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const data = resumenGeneral.data;
                if (!data) return;
                exportToExcel({
                  filename: `resumen-general-${dateRange}`,
                  columns: [
                    { header: 'Fecha', key: 'fecha' },
                    { header: 'Cantidad Envíos', key: 'cantidad', format: 'number' },
                  ],
                  data: data.evolucionDiaria || [],
                });
              }}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={exporting}
              onClick={() => handleExportPDF('resumen', 'Resumen General', [evolucionChartRef, estadosChartRef], resumenGeneral.data)}
            >
              {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              PDF
            </Button>
          </div>

          {resumenGeneral.isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
            </div>
          ) : (
            <>
              {/* KPI Cards with period comparison */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Total Envíos */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Envíos</p>
                        <p className="text-2xl font-bold">{resumenGeneral.data?.totalEnvios || 0}</p>
                        {prev && (
                          <TrendBadge value={calcTrend(resumenGeneral.data?.totalEnvios || 0, prev.totalEnvios)} />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {/* Tasa Entrega with radial progress */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-12">
                        <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
                          <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                          <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--primary))" strokeWidth="3"
                            strokeDasharray={`${(resumenGeneral.data?.tasaEntrega || 0) * 0.974} 97.4`}
                            strokeLinecap="round" />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                          {resumenGeneral.data?.tasaEntrega || 0}%
                        </span>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Tasa Entrega</p>
                        {prev && (
                          <TrendBadge value={calcTrend(resumenGeneral.data?.tasaEntrega || 0, prev.tasaEntrega)} suffix="pp" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {/* T. Promedio */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">T. Promedio</p>
                        <p className="text-2xl font-bold">{resumenGeneral.data?.tiempoPromedio ? `${resumenGeneral.data.tiempoPromedio} min` : 'N/A'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {/* Ingresos */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Ingresos</p>
                        <p className="text-2xl font-bold">${(resumenGeneral.data?.ingresosTotales || 0).toLocaleString()}</p>
                        {prev && (
                          <TrendBadge value={calcTrend(resumenGeneral.data?.ingresosTotales || 0, prev.ingresosTotales)} />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Mini sparkline for daily evolution */}
              {resumenGeneral.data?.evolucionDiaria && resumenGeneral.data.evolucionDiaria.length > 1 && (
                <Card>
                  <CardContent className="pt-4 pb-2">
                    <p className="text-xs text-muted-foreground mb-2">Evolución rápida del período</p>
                    <div className="h-10">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={resumenGeneral.data.evolucionDiaria}>
                          <Line type="monotone" dataKey="cantidad" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Charts */}
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Evolución Diaria</CardTitle></CardHeader>
                  <CardContent>
                    <div ref={evolucionChartRef}>
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={resumenGeneral.data?.evolucionDiaria || []}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="fecha" tick={{ fontSize: 10 }} tickFormatter={v => v.substring(5)} />
                          <YAxis />
                          <Tooltip labelFormatter={v => format(new Date(v + 'T12:00:00'), 'dd MMM yyyy', { locale: es })} />
                          <Line type="monotone" dataKey="cantidad" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Envíos" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-base">Distribución por Estado</CardTitle></CardHeader>
                  <CardContent>
                    <div ref={estadosChartRef}>
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie
                            data={(resumenGeneral.data?.distribucionEstados || []).map(d => ({ ...d, label: STATUS_LABELS[d.estado] || d.estado }))}
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            dataKey="cantidad"
                            nameKey="label"
                            label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            {(resumenGeneral.data?.distribucionEstados || []).map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number, name: string) => [value, STATUS_LABELS[name] || name]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>
        {/* Tab: Demanda IA */}
        <TabsContent value="demanda">
          <DemandPredictionTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
