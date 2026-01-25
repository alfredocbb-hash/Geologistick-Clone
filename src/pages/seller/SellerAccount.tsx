import { useState } from 'react';
import { useSellerData } from '@/hooks/useSellerData';
import { RequestWithdrawalDialog } from '@/components/seller/RequestWithdrawalDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Store, 
  Mail, 
  Phone, 
  MapPin, 
  ArrowDownLeft, 
  ArrowUpRight,
  Wallet,
  Download
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const MOVEMENT_TYPE_CONFIG: Record<string, { label: string; icon: typeof ArrowDownLeft; color: string }> = {
  cargo: { label: 'Cargo', icon: ArrowDownLeft, color: 'text-red-600' },
  abono: { label: 'Abono', icon: ArrowUpRight, color: 'text-green-600' },
  pago: { label: 'Pago recibido', icon: ArrowUpRight, color: 'text-green-600' },
  solicitud_retiro: { label: 'Retiro solicitado', icon: ArrowDownLeft, color: 'text-orange-600' },
};

export default function SellerAccount() {
  const { seller, movements, isLoading, isLoadingMovements } = useSellerData();
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 lg:col-span-1" />
          <Skeleton className="h-64 lg:col-span-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mi Cuenta</h1>
        <p className="text-muted-foreground">
          Datos de tu tienda y estado de cuenta
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Store Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Datos de la Tienda
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Nombre</p>
              <p className="font-medium">{seller?.nombre}</p>
            </div>
            
            <Separator />
            
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{seller?.email}</span>
            </div>
            
            {seller?.telefono && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{seller.telefono}</span>
              </div>
            )}
            
            {seller?.direccion && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="text-sm">
                  <p>{seller.direccion}</p>
                  {seller.ciudad && <p>{seller.ciudad}, {seller.provincia}</p>}
                </div>
              </div>
            )}
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Plataforma</span>
              <Badge variant="outline" className="capitalize">
                {seller?.plataforma}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Estado</span>
              <Badge variant={seller?.activo ? 'default' : 'secondary'}>
                {seller?.activo ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Account Balance */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Estado de Cuenta
                </CardTitle>
                <CardDescription>
                  {seller?.tiene_cuenta_corriente 
                    ? 'Movimientos y saldo de tu cuenta corriente'
                    : 'No tienes cuenta corriente habilitada'
                  }
                </CardDescription>
              </div>
              
              {seller?.tiene_cuenta_corriente && seller.saldo_cuenta_corriente > 0 && (
                <Button onClick={() => setWithdrawalOpen(true)}>
                  <Download className="h-4 w-4 mr-2" />
                  Solicitar Retiro
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {seller?.tiene_cuenta_corriente ? (
              <>
                {/* Balance Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">Saldo Actual</p>
                    <p className={`text-2xl font-bold ${
                      seller.saldo_cuenta_corriente > 0 ? 'text-green-600' : 
                      seller.saldo_cuenta_corriente < 0 ? 'text-red-600' : ''
                    }`}>
                      {formatCurrency(seller.saldo_cuenta_corriente)}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">Límite de Crédito</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(seller.limite_credito)}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">Disponible</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(seller.limite_credito + seller.saldo_cuenta_corriente)}
                    </p>
                  </div>
                </div>

                {/* Movements Table */}
                <div>
                  <h4 className="font-medium mb-3">Últimos Movimientos</h4>
                  {isLoadingMovements ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12" />
                      ))}
                    </div>
                  ) : movements.length > 0 ? (
                    <div className="overflow-x-auto">
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
                          {movements.map((movement) => {
                            const config = MOVEMENT_TYPE_CONFIG[movement.tipo] || {
                              label: movement.tipo,
                              icon: ArrowDownLeft,
                              color: 'text-gray-600',
                            };
                            const Icon = config.icon;
                            
                            return (
                              <TableRow key={movement.id}>
                                <TableCell>
                                  {format(new Date(movement.created_at), 'dd/MM/yy', { locale: es })}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Icon className={`h-4 w-4 ${config.color}`} />
                                    <span className="text-sm">{config.label}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {movement.descripcion || '-'}
                                </TableCell>
                                <TableCell className={`text-right font-medium ${
                                  movement.monto > 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {movement.monto > 0 ? '+' : ''}{formatCurrency(movement.monto)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(movement.saldo_nuevo)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Sin movimientos registrados
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Tu tienda no tiene cuenta corriente habilitada.</p>
                <p className="text-sm">Contacta al administrador para más información.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <RequestWithdrawalDialog 
        open={withdrawalOpen} 
        onOpenChange={setWithdrawalOpen} 
      />
    </div>
  );
}
