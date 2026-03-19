import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Download, Package, TrendingUp, Clock, DollarSign, BarChart3, Users, MapPin, FileText, Loader2, Activity, Wallet, Brain } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { useReportsData, type ReportsFilters } from '@/hooks/useReportsData';
import { useProductividadData } from '@/hooks/useProductividadData';
import { useCostosData } from '@/hooks/useCostosData';
import { useDemandPrediction } from '@/hooks/useDemandPrediction';
import { ProductividadTab } from '@/components/reports/ProductividadTab';
import { CostosTab } from '@/components/reports/CostosTab';
import { DemandPredictionTab } from '@/components/reports/DemandPredictionTab';
import { subDays, subMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { exportReportPDF } from '@/lib/exportReportPDF';
import { exportToExcel } from '@/lib/exportExcel';
import { toast } from 'sonner';

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

  const { enviosPorSucursal, destinos, rendimientoChoferes, resumenGeneral, sucursales } = useReportsData(filters);
  const productividad = useProductividadData(filters);
  const costos = useCostosData(filters);
  const demandPrediction = useDemandPrediction();

  const handleExportPDF = async (
    tab: 'sucursales' | 'destinos' | 'choferes' | 'resumen',
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
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7">
          <TabsTrigger value="sucursales" className="gap-1.5">
            <BarChart3 className="h-4 w-4 hidden sm:block" /> Sucursales
          </TabsTrigger>
          <TabsTrigger value="destinos" className="gap-1.5">
            <MapPin className="h-4 w-4 hidden sm:block" /> Destinos
          </TabsTrigger>
          <TabsTrigger value="choferes" className="gap-1.5">
            <Users className="h-4 w-4 hidden sm:block" /> Choferes
          </TabsTrigger>
          <TabsTrigger value="resumen" className="gap-1.5">
            <FileText className="h-4 w-4 hidden sm:block" /> Resumen
          </TabsTrigger>
          <TabsTrigger value="productividad" className="gap-1.5">
            <Activity className="h-4 w-4 hidden sm:block" /> Productividad
          </TabsTrigger>
          <TabsTrigger value="costos" className="gap-1.5">
            <Wallet className="h-4 w-4 hidden sm:block" /> Costos
          </TabsTrigger>
          <TabsTrigger value="prediccion" className="gap-1.5">
            <Brain className="h-4 w-4 hidden sm:block" /> Predicción
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Envíos por Sucursal */}
        <TabsContent value="sucursales" className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={exporting}
              onClick={() => handleExportPDF('sucursales', 'Envios por Sucursal', [sucursalesChartRef], enviosPorSucursal.data || [])}
            >
              {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Exportar PDF
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
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={exporting}
              onClick={() => handleExportPDF('destinos', 'Destinos mas frecuentes', [destinosChartRef], destinos.data || [])}
            >
              {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Exportar PDF
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
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={exporting}
              onClick={() => handleExportPDF('choferes', 'Rendimiento de Choferes', [choferesChartRef], rendimientoChoferes.data || [])}
            >
              {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Exportar PDF
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

        {/* Tab 4: Resumen General */}
        <TabsContent value="resumen" className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={exporting}
              onClick={() => handleExportPDF('resumen', 'Resumen General', [evolucionChartRef, estadosChartRef], resumenGeneral.data)}
            >
              {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Exportar PDF
            </Button>
          </div>

          {resumenGeneral.isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
            </div>
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Envíos</p>
                        <p className="text-2xl font-bold">{resumenGeneral.data?.totalEnvios || 0}</p>
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
                        <p className="text-sm text-muted-foreground">Tasa Entrega</p>
                        <p className="text-2xl font-bold">{resumenGeneral.data?.tasaEntrega || 0}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
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
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Ingresos</p>
                        <p className="text-2xl font-bold">${(resumenGeneral.data?.ingresosTotales || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

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

        {/* Tab 5: Productividad */}
        <TabsContent value="productividad" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => {
              if (productividad.data) {
                exportToExcel(productividad.data, 'productividad-conductores', 'Productividad');
                toast.success('Excel exportado');
              }
            }}>
              <Download className="h-4 w-4 mr-2" /> Exportar Excel
            </Button>
          </div>
          <ProductividadTab data={productividad} />
        </TabsContent>

        {/* Tab 6: Costos */}
        <TabsContent value="costos" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => {
              if (costos.rutas.data) {
                exportToExcel(costos.rutas.data, 'costos-operativos', 'Costos');
                toast.success('Excel exportado');
              }
            }}>
              <Download className="h-4 w-4 mr-2" /> Exportar Excel
            </Button>
          </div>
          <CostosTab rutas={costos.rutas} resumen={costos.resumen} />
        </TabsContent>

        {/* Tab 7: Predicción de Demanda */}
        <TabsContent value="prediccion" className="space-y-4">
          <DemandPredictionTab data={demandPrediction} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
