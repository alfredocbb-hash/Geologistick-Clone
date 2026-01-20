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
import { Users, DollarSign, CreditCard, Plus, Minus, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';

type PaymentMethod = Database['public']['Enums']['payment_method'];

interface Cliente {
  id: string;
  nombre: string;
  apellido: string | null;
  saldo_cuenta_corriente: number | null;
  limite_credito: number | null;
}

interface Movimiento {
  id: string;
  cliente_id: string;
  tipo: string;
  monto: number;
  saldo_anterior: number;
  saldo_nuevo: number;
  descripcion: string | null;
  created_at: string;
  envio_id: string | null;
}

export default function ClientSettlements() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCliente, setSelectedCliente] = useState<string>('');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [montoPago, setMontoPago] = useState('');
  const [metodoPago, setMetodoPago] = useState<PaymentMethod>('efectivo');
  const [referenciaPago, setReferenciaPago] = useState('');
  const [descripcion, setDescripcion] = useState('');

  // Fetch clientes con cuenta corriente
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-cuenta-corriente'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nombre, apellido, saldo_cuenta_corriente, limite_credito')
        .eq('tiene_cuenta_corriente', true)
        .order('nombre');
      if (error) throw error;
      return data as Cliente[];
    },
  });

  // Fetch movimientos del cliente seleccionado
  const { data: movimientos = [], isLoading: loadingMovimientos } = useQuery({
    queryKey: ['movimientos-cuenta', selectedCliente],
    queryFn: async () => {
      if (!selectedCliente) return [];
      
      const { data, error } = await supabase
        .from('cliente_cuenta_corriente')
        .select('*')
        .eq('cliente_id', selectedCliente)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Movimiento[];
    },
    enabled: !!selectedCliente,
  });

  const selectedClienteData = clientes.find(c => c.id === selectedCliente);

  // Registrar pago
  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCliente || !montoPago) {
        throw new Error('Complete todos los campos');
      }

      const monto = parseFloat(montoPago);
      if (isNaN(monto) || monto <= 0) {
        throw new Error('Monto inválido');
      }

      const cliente = clientes.find(c => c.id === selectedCliente);
      if (!cliente) throw new Error('Cliente no encontrado');

      const saldoAnterior = cliente.saldo_cuenta_corriente || 0;
      const saldoNuevo = saldoAnterior - monto;

      // Insert movimiento
      const { error: movError } = await supabase
        .from('cliente_cuenta_corriente')
        .insert({
          cliente_id: selectedCliente,
          tipo: 'pago',
          monto: monto,
          saldo_anterior: saldoAnterior,
          saldo_nuevo: saldoNuevo,
          descripcion: descripcion || `Pago recibido - ${metodoPago}${referenciaPago ? ` - Ref: ${referenciaPago}` : ''}`,
          created_by: user?.id,
        });

      if (movError) throw movError;

      // Update cliente saldo
      const { error: clienteError } = await supabase
        .from('clientes')
        .update({ saldo_cuenta_corriente: saldoNuevo })
        .eq('id', selectedCliente);

      if (clienteError) throw clienteError;
    },
    onSuccess: () => {
      toast.success('Pago registrado correctamente');
      queryClient.invalidateQueries({ queryKey: ['clientes-cuenta-corriente'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos-cuenta'] });
      setShowPaymentDialog(false);
      setMontoPago('');
      setReferenciaPago('');
      setDescripcion('');
    },
    onError: (error) => {
      toast.error('Error: ' + error.message);
    },
  });

  const getTipoIcon = (tipo: string) => {
    if (tipo === 'cargo' || tipo === 'envio') {
      return <TrendingUp className="h-4 w-4 text-destructive" />;
    }
    return <TrendingDown className="h-4 w-4 text-success" />;
  };

  const getTipoBadge = (tipo: string) => {
    if (tipo === 'cargo' || tipo === 'envio') {
      return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive">Cargo</Badge>;
    }
    return <Badge variant="outline" className="bg-success/10 text-success border-success">Pago</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cuentas Corrientes de Clientes</h1>
          <p className="text-muted-foreground">Gestiona los saldos y pagos de clientes con crédito</p>
        </div>
      </div>

      {/* Cliente Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Seleccionar Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cliente con Cuenta Corriente</Label>
              <Select value={selectedCliente} onValueChange={setSelectedCliente}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre} {c.apellido} - Saldo: ${(c.saldo_cuenta_corriente || 0).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedClienteData && (
              <div className="flex items-center gap-4">
                <Button onClick={() => setShowPaymentDialog(true)} className="bg-success hover:bg-success/90">
                  <Plus className="h-4 w-4 mr-2" />
                  Registrar Pago
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resumen del Cliente */}
      {selectedClienteData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className={`border-2 ${(selectedClienteData.saldo_cuenta_corriente || 0) > 0 ? 'border-destructive/20 bg-destructive/5' : 'border-success/20 bg-success/5'}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm text-muted-foreground">Saldo Actual</span>
              </div>
              <p className={`text-3xl font-bold ${(selectedClienteData.saldo_cuenta_corriente || 0) > 0 ? 'text-destructive' : 'text-success'}`}>
                ${(selectedClienteData.saldo_cuenta_corriente || 0).toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {(selectedClienteData.saldo_cuenta_corriente || 0) > 0 ? 'Debe al sistema' : 'A favor / Sin deuda'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Límite de Crédito</span>
              </div>
              <p className="text-3xl font-bold">
                ${(selectedClienteData.limite_credito || 0).toFixed(2)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Crédito Disponible</span>
              </div>
              <p className="text-3xl font-bold text-primary">
                ${Math.max(0, (selectedClienteData.limite_credito || 0) - (selectedClienteData.saldo_cuenta_corriente || 0)).toFixed(2)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Movimientos */}
      {selectedCliente && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Movimientos de Cuenta
            </CardTitle>
            <CardDescription>
              Historial de cargos y pagos del cliente
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingMovimientos ? (
              <div className="text-center py-8 text-muted-foreground">Cargando...</div>
            ) : movimientos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay movimientos registrados
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimientos.map((mov) => (
                    <TableRow key={mov.id}>
                      <TableCell>
                        {format(new Date(mov.created_at), 'dd/MM/yy HH:mm', { locale: es })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTipoIcon(mov.tipo)}
                          {getTipoBadge(mov.tipo)}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        {mov.descripcion || '-'}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${mov.tipo === 'pago' ? 'text-success' : 'text-destructive'}`}>
                        {mov.tipo === 'pago' ? '-' : '+'}${mov.monto.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        ${mov.saldo_nuevo.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Clientes Summary */}
      {!selectedCliente && (
        <Card>
          <CardHeader>
            <CardTitle>Resumen de Cuentas Corrientes</CardTitle>
            <CardDescription>
              Clientes con cuenta corriente habilitada
            </CardDescription>
          </CardHeader>
          <CardContent>
            {clientes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay clientes con cuenta corriente habilitada
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Límite</TableHead>
                    <TableHead className="text-right">Disponible</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientes.map((cliente) => {
                    const saldo = cliente.saldo_cuenta_corriente || 0;
                    const limite = cliente.limite_credito || 0;
                    const disponible = Math.max(0, limite - saldo);
                    
                    return (
                      <TableRow 
                        key={cliente.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedCliente(cliente.id)}
                      >
                        <TableCell className="font-medium">
                          {cliente.nombre} {cliente.apellido}
                        </TableCell>
                        <TableCell className={`text-right font-bold ${saldo > 0 ? 'text-destructive' : 'text-success'}`}>
                          ${saldo.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          ${limite.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-primary">
                          ${disponible.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              Registra un pago recibido del cliente {selectedClienteData?.nombre}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Monto del Pago *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={montoPago}
                onChange={(e) => setMontoPago(e.target.value)}
              />
            </div>
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
            <div className="space-y-2">
              <Label>Descripción (opcional)</Label>
              <Textarea
                placeholder="Notas adicionales..."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => paymentMutation.mutate()} 
              disabled={paymentMutation.isPending || !montoPago}
              className="bg-success hover:bg-success/90"
            >
              {paymentMutation.isPending ? 'Procesando...' : 'Registrar Pago'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
