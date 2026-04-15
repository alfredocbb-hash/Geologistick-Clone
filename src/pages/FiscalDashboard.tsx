import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useARCAIntegration } from '@/hooks/useARCAConfig';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, TrendingUp, TrendingDown, AlertTriangle, Download, DollarSign, Receipt, Calculator, FileText, Plus } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { exportToExcel } from '@/lib/exportExcel';
import { PurchaseInvoiceForm } from '@/components/fiscal/PurchaseInvoiceForm';

const MONOTRIBUTO_TOPES: Record<string, { label: string; tope: number }> = {
  A: { label: 'A', tope: 2108288 },
  B: { label: 'B', tope: 3133941 },
  C: { label: 'C', tope: 4387591 },
  D: { label: 'D', tope: 5449094 },
  E: { label: 'E', tope: 6416528 },
  F: { label: 'F', tope: 8040721 },
  G: { label: 'G', tope: 9614078 },
  H: { label: 'H', tope: 11916410 },
  I: { label: 'I', tope: 13337213 },
  J: { label: 'J', tope: 15285088 },
  K: { label: 'K', tope: 16957968 },
};

export default function FiscalDashboard() {
  const { profile } = useAuth();
  const { config: arcaConfig } = useARCAIntegration();
  const [condicionManual, setCondicionManual] = useState<string>('');
  const [categoriaMonotributo, setCategoriaMonotributo] = useState('D');
  const [compraFormOpen, setCompraFormOpen] = useState(false);

  const condicionIva = arcaConfig?.condicion_iva || condicionManual;
  const esMonotributo = condicionIva === 'monotributo';
  const esRI = condicionIva === 'responsable_inscripto';

  const now = new Date();
  const mesActualInicio = format(startOfMonth(now), 'yyyy-MM-dd');
  const mesActualFin = format(endOfMonth(now), 'yyyy-MM-dd');

  // Facturas emitidas (ventas) del mes actual
  const { data: facturasMes = [], isLoading: loadingFacturas } = useQuery({
    queryKey: ['fiscal-facturas-mes', profile?.tenant_id, mesActualInicio],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('facturas')
        .select('importe_neto, importe_iva, importe_total, fecha_emision, tipo_comprobante, punto_venta, numero_comprobante, cae, cae_vencimiento, receptor_cuit, receptor_nombre')
        .eq('tenant_id', profile!.tenant_id)
        .eq('estado', 'emitida')
        .gte('fecha_emision', mesActualInicio)
        .lte('fecha_emision', mesActualFin + 'T23:59:59');
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.tenant_id,
  });

  // Facturas de compra del mes actual
  const { data: comprasMes = [], isLoading: loadingCompras } = useQuery({
    queryKey: ['fiscal-compras-mes', profile?.tenant_id, mesActualInicio],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('facturas_compra')
        .select('*')
        .eq('tenant_id', profile!.tenant_id)
        .gte('fecha_emision', mesActualInicio)
        .lte('fecha_emision', mesActualFin);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.tenant_id,
  });

  // Facturas últimos 12 meses (para monotributo)
  const doceAntes = format(startOfMonth(subMonths(now, 11)), 'yyyy-MM-dd');
  const { data: facturas12m = [] } = useQuery({
    queryKey: ['fiscal-facturas-12m', profile?.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('facturas')
        .select('importe_total, fecha_emision')
        .eq('tenant_id', profile!.tenant_id)
        .eq('estado', 'emitida')
        .gte('fecha_emision', doceAntes);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.tenant_id,
  });

  // Current month calculations
  const totalVentas = facturasMes.reduce((s, f) => s + Number(f.importe_total), 0);
  const totalNetoVentas = facturasMes.reduce((s, f) => s + Number(f.importe_neto), 0);
  const ivaDebito = facturasMes.reduce((s, f) => s + Number(f.importe_iva || 0), 0);
  const totalCompras = comprasMes.reduce((s, g) => s + Number(g.importe_total), 0);
  const ivaCredito = comprasMes.reduce((s, g) => s + Number(g.importe_iva || 0), 0);
  const posicionIva = ivaDebito - ivaCredito;
  const estimacionIIBB = Math.round(totalNetoVentas * 0.035 * 100) / 100;

  // Monotributo
  const facturacion12m = facturas12m.reduce((s, f) => s + Number(f.importe_total), 0);
  const topeSeleccionado = MONOTRIBUTO_TOPES[categoriaMonotributo];
  const porcentajeTope = topeSeleccionado ? Math.min((facturacion12m / topeSeleccionado.tope) * 100, 100) : 0;
  const restante = topeSeleccionado ? Math.max(topeSeleccionado.tope - facturacion12m, 0) : 0;
  const alerta80 = porcentajeTope >= 80;

  const isLoading = loadingFacturas || loadingCompras;

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);

  const handleExportIVAVentas = () => {
    exportToExcel({
      filename: `Libro_IVA_Ventas_${format(now, 'yyyy-MM')}`,
      sheetName: 'IVA Ventas',
      columns: [
        { header: 'Fecha', key: 'fecha_emision' },
        { header: 'Tipo', key: 'tipo_comprobante' },
        { header: 'PV', key: 'punto_venta', format: 'number' },
        { header: 'Número', key: 'numero_comprobante', format: 'number' },
        { header: 'CUIT Receptor', key: 'receptor_cuit' },
        { header: 'Nombre Receptor', key: 'receptor_nombre' },
        { header: 'Neto', key: 'importe_neto', format: 'currency' },
        { header: 'IVA', key: 'importe_iva', format: 'currency' },
        { header: 'Total', key: 'importe_total', format: 'currency' },
        { header: 'CAE', key: 'cae' },
        { header: 'Vto CAE', key: 'cae_vencimiento' },
      ],
      data: facturasMes.map(f => ({ ...f, fecha_emision: f.fecha_emision ? format(new Date(f.fecha_emision), 'dd/MM/yyyy') : '' })),
    });
  };

  const handleExportIVACompras = () => {
    exportToExcel({
      filename: `Libro_IVA_Compras_${format(now, 'yyyy-MM')}`,
      sheetName: 'IVA Compras',
      columns: [
        { header: 'Fecha', key: 'fecha_emision' },
        { header: 'Tipo', key: 'tipo_comprobante' },
        { header: 'Proveedor', key: 'proveedor_nombre' },
        { header: 'CUIT', key: 'proveedor_cuit' },
        { header: 'PV', key: 'punto_venta', format: 'number' },
        { header: 'Nro Comprobante', key: 'numero_comprobante', format: 'number' },
        { header: 'Neto', key: 'importe_neto', format: 'currency' },
        { header: 'IVA', key: 'importe_iva', format: 'currency' },
        { header: 'Total', key: 'importe_total', format: 'currency' },
        { header: 'Categoría', key: 'categoria' },
      ],
      data: comprasMes.map(c => ({ ...c, fecha_emision: c.fecha_emision ? format(new Date(c.fecha_emision), 'dd/MM/yyyy') : '' })),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Panel Fiscal</h1>
          <p className="text-muted-foreground">Resumen del mes de {format(now, 'MMMM yyyy')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportIVAVentas} disabled={facturasMes.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Libro IVA Ventas
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportIVACompras} disabled={comprasMes.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Libro IVA Compras
          </Button>
        </div>
      </div>

      {/* Manual IVA condition selector when no ARCA config */}
      {!arcaConfig && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-4">
              <Label className="whitespace-nowrap">¿Cuál es tu condición ante el IVA?</Label>
              <Select value={condicionManual} onValueChange={setCondicionManual}>
                <SelectTrigger className="w-[220px]"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="responsable_inscripto">Responsable Inscripto</SelectItem>
                  <SelectItem value="monotributo">Monotributista</SelectItem>
                  <SelectItem value="exento">Exento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Total Facturado</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalVentas)}</p>
            <p className="text-xs text-muted-foreground">{facturasMes.length} factura(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Total Compras</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalCompras)}</p>
            <p className="text-xs text-muted-foreground">{comprasMes.length} factura(s) de compra</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Resultado</span>
            </div>
            <p className={`text-2xl font-bold ${totalVentas - totalCompras >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalVentas - totalCompras)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Calculator className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Est. IIBB (3.5%)</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(estimacionIIBB)}</p>
          </CardContent>
        </Card>
      </div>

      {/* IVA Digital Report */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt className="h-5 w-5" />
            Reporte IVA Digital — {format(now, 'MMMM yyyy')}
            {esMonotributo && (
              <Badge variant="secondary" className="ml-2 text-xs">Solo informativo</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-700 dark:text-green-300 mb-1">IVA Débito Fiscal (Ventas)</p>
              <p className="text-2xl font-bold text-green-800 dark:text-green-200">{formatCurrency(ivaDebito)}</p>
            </div>
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-300 mb-1">IVA Crédito Fiscal (Compras)</p>
              <p className="text-2xl font-bold text-red-800 dark:text-red-200">{formatCurrency(ivaCredito)}</p>
            </div>
            <div className={`p-4 rounded-lg border ${posicionIva >= 0 ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800' : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'}`}>
              <p className="text-sm text-muted-foreground mb-1">
                {posicionIva >= 0 ? 'Saldo estimado a pagar' : 'Saldo a favor'}
              </p>
              <p className="text-2xl font-bold">{formatCurrency(Math.abs(posicionIva))}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            {esMonotributo ? (
              <>Los monotributistas no liquidan IVA mensualmente. Este reporte es solo a fines informativos.</>
            ) : (
              <>
                Este mes tenés acumulado {formatCurrency(ivaDebito)} de IVA Ventas y {formatCurrency(ivaCredito)} de IVA Compras.
                Tu saldo estimado {posicionIva >= 0 ? 'a pagar' : 'a favor'} es {formatCurrency(Math.abs(posicionIva))}.
              </>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Libro IVA Compras - for Responsable Inscripto */}
      {esRI && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Libro IVA Compras — {format(now, 'MMMM yyyy')}
              </div>
              <Button size="sm" onClick={() => setCompraFormOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar Compra
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {comprasMes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No hay facturas de compra registradas este mes. Agregá tus facturas de proveedores para calcular el crédito fiscal.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>CUIT</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Neto</TableHead>
                    <TableHead className="text-right">IVA</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comprasMes.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.fecha_emision ? format(new Date(c.fecha_emision), 'dd/MM/yyyy') : '—'}</TableCell>
                      <TableCell><Badge variant="outline">{c.tipo_comprobante}</Badge></TableCell>
                      <TableCell className="max-w-[200px] truncate">{c.proveedor_nombre}</TableCell>
                      <TableCell className="font-mono text-xs">{c.proveedor_cuit || '—'}</TableCell>
                      <TableCell className="capitalize">{c.categoria || '—'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(c.importe_neto))}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(c.importe_iva))}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(Number(c.importe_total))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Retenciones / Percepciones - only for Responsable Inscripto */}
      {esRI && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              Retenciones y Percepciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Próximamente podrás cargar y consultar las retenciones y percepciones sufridas para computar como crédito fiscal.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Monotributo Monitor - only for Monotributistas */}
      {(esMonotributo || !condicionIva) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className={`h-5 w-5 ${alerta80 ? 'text-orange-500' : 'text-muted-foreground'}`} />
              Monitor de Monotributo — Facturación últimos 12 meses
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Label className="whitespace-nowrap">Mi Categoría:</Label>
              <Select value={categoriaMonotributo} onValueChange={setCategoriaMonotributo}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MONOTRIBUTO_TOPES).map(([key, val]) => (
                    <SelectItem key={key} value={key}>
                      Cat. {val.label} — {formatCurrency(val.tope)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Facturado: {formatCurrency(facturacion12m)}</span>
                <span>Tope: {formatCurrency(topeSeleccionado?.tope || 0)}</span>
              </div>
              <Progress value={porcentajeTope} className={alerta80 ? '[&>div]:bg-orange-500' : ''} />
              <p className="text-sm text-muted-foreground">
                {porcentajeTope.toFixed(1)}% utilizado
              </p>
            </div>

            {alerta80 && (
              <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/30">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800 dark:text-orange-200">
                  ⚠️ Estás al {porcentajeTope.toFixed(1)}% del tope de la categoría {categoriaMonotributo}.
                  Te quedan <strong>{formatCurrency(restante)}</strong> antes de superar el límite.
                  Considerá diferir facturas al próximo período o recategorizar.
                </AlertDescription>
              </Alert>
            )}

            {!alerta80 && (
              <p className="text-sm text-green-700 dark:text-green-300">
                ✅ Te quedan <strong>{formatCurrency(restante)}</strong> antes de alcanzar el tope de la categoría {categoriaMonotributo}.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Purchase Invoice Form Dialog */}
      <PurchaseInvoiceForm open={compraFormOpen} onOpenChange={setCompraFormOpen} />
    </div>
  );
}
