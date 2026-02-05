 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
 import { Receipt, CreditCard, Wallet, AlertTriangle } from 'lucide-react';

export interface ConceptoResumen {
  concepto_id: string | null;
  nombre: string;
  ventas: number;
  porcentaje: number;
  comision: number;
   sinConfiguracion?: boolean;
}

export interface ResumenPorTipoPago {
  contado: ConceptoResumen[];
  destino: ConceptoResumen[];
  cta_cte: ConceptoResumen[];
}

interface ConceptBreakdownTableProps {
  resumen: ResumenPorTipoPago;
}

function ConceptTable({ conceptos, title }: { conceptos: ConceptoResumen[]; title: string }) {
  const totales = conceptos.reduce(
    (acc, c) => ({
      ventas: acc.ventas + c.ventas,
      comision: acc.comision + c.comision,
    }),
    { ventas: 0, comision: 0 }
  );

  if (conceptos.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No hay movimientos de {title}
      </div>
    );
  }

  return (
     <TooltipProvider>
       <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40%]">Concepto</TableHead>
          <TableHead className="text-right">Ventas</TableHead>
          <TableHead className="text-right">Comisión %</TableHead>
          <TableHead className="text-right">Total Comisión</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
         {conceptos.map((c, idx) => {
           // Calcular porcentaje efectivo real
           const porcentajeEfectivo = c.ventas > 0 
             ? (c.comision / c.ventas) * 100 
             : 0;
           const sinConfig = c.sinConfiguracion || (porcentajeEfectivo === 0 && c.ventas > 0);
           
           return (
             <TableRow key={c.concepto_id || idx}>
               <TableCell className="font-medium">{c.nombre}</TableCell>
               <TableCell className="text-right">${c.ventas.toFixed(2)}</TableCell>
               <TableCell className="text-right">
                 {sinConfig ? (
                   <Tooltip>
                     <TooltipTrigger asChild>
                       <span className="text-amber-500 flex items-center justify-end gap-1 cursor-help">
                         <AlertTriangle className="h-3 w-3" />
                         sin config
                       </span>
                     </TooltipTrigger>
                     <TooltipContent>
                       <p>Este concepto no tiene comisión configurada para este rol/tipo de pago</p>
                     </TooltipContent>
                   </Tooltip>
                 ) : (
                   <span>{porcentajeEfectivo.toFixed(2)}%</span>
                 )}
               </TableCell>
               <TableCell className="text-right text-warning font-medium">
                 ${c.comision.toFixed(2)}
               </TableCell>
             </TableRow>
           );
         })}
      </TableBody>
      <TableFooter>
        <TableRow className="bg-muted/50">
          <TableCell className="font-bold">SUBTOTAL</TableCell>
          <TableCell className="text-right font-bold">${totales.ventas.toFixed(2)}</TableCell>
          <TableCell className="text-right">-</TableCell>
          <TableCell className="text-right font-bold text-warning">
            ${totales.comision.toFixed(2)}
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
     </TooltipProvider>
  );
}

export function ConceptBreakdownTable({ resumen }: ConceptBreakdownTableProps) {
  const hasContado = resumen.contado.length > 0;
  const hasDestino = resumen.destino.length > 0;
  const hasCtaCte = resumen.cta_cte.length > 0;
  
  const defaultTab = hasContado ? 'contado' : hasDestino ? 'destino' : 'cta_cte';

  const contadoTotal = resumen.contado.reduce((sum, c) => sum + c.comision, 0);
  const destinoTotal = resumen.destino.reduce((sum, c) => sum + c.comision, 0);
  const ctaCteTotal = resumen.cta_cte.reduce((sum, c) => sum + c.comision, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          Resumen por Concepto
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="contado" className="gap-1.5">
              <Wallet className="h-3 w-3" />
              Contado
              {hasContado && (
                <span className="text-xs text-muted-foreground">
                  (${contadoTotal.toFixed(0)})
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="destino" className="gap-1.5">
              <CreditCard className="h-3 w-3" />
              Pago Destino
              {hasDestino && (
                <span className="text-xs text-muted-foreground">
                  (${destinoTotal.toFixed(0)})
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="cta_cte" className="gap-1.5">
              <Receipt className="h-3 w-3" />
              Cta. Cte.
              {hasCtaCte && (
                <span className="text-xs text-muted-foreground">
                  (${ctaCteTotal.toFixed(0)})
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="contado" className="border rounded-md mt-3">
            <ConceptTable conceptos={resumen.contado} title="Contado" />
          </TabsContent>
          <TabsContent value="destino" className="border rounded-md mt-3">
            <ConceptTable conceptos={resumen.destino} title="Pago Destino" />
          </TabsContent>
          <TabsContent value="cta_cte" className="border rounded-md mt-3">
            <ConceptTable conceptos={resumen.cta_cte} title="Cuenta Corriente" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
