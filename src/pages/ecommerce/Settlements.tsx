import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, DollarSign, TrendingUp, TrendingDown, FileText, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SellerSettlementDialog } from '@/components/ecommerce/SellerSettlementDialog';

interface Seller {
  id: string;
  nombre: string;
  saldo_cuenta_corriente: number;
  tiene_cuenta_corriente: boolean;
}

interface Movement {
  id: string;
  tipo: string;
  monto: number;
  saldo_anterior: number;
  saldo_nuevo: number;
  descripcion: string | null;
  referencia: string | null;
  created_at: string;
  seller: {
    nombre: string;
  };
}

export default function Settlements() {
  const { tenantId } = useTenant();
  const [search, setSearch] = useState('');
  const [selectedSeller, setSelectedSeller] = useState<string>('all');
  const [settlementDialogOpen, setSettlementDialogOpen] = useState(false);
  const [activeSeller, setActiveSeller] = useState<Seller | null>(null);

  // Fetch sellers with account
  const { data: sellers, isLoading: loadingSellers } = useQuery({
    queryKey: ['ecommerce-sellers-cta-cte', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ecommerce_sellers')
        .select('id, nombre, saldo_cuenta_corriente, tiene_cuenta_corriente')
        .eq('tiene_cuenta_corriente', true)
        .order('nombre');

      if (error) throw error;
      return data as Seller[];
    },
    enabled: !!tenantId,
  });

  // Fetch movements
  const { data: movements, isLoading: loadingMovements } = useQuery({
    queryKey: ['seller-movements', tenantId, selectedSeller],
    queryFn: async () => {
      let query = supabase
        .from('seller_cuenta_corriente')
        .select(`
          *,
          seller:ecommerce_sellers(nombre)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (selectedSeller !== 'all') {
        query = query.eq('seller_id', selectedSeller);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Movement[];
    },
    enabled: !!tenantId,
  });

  // Stats
  const stats = {
    totalSaldo: sellers?.reduce((acc, s) => acc + (s.saldo_cuenta_corriente || 0), 0) || 0,
    sellersConDeuda: sellers?.filter(s => s.saldo_cuenta_corriente > 0).length || 0,
    sellersAFavor: sellers?.filter(s => s.saldo_cuenta_corriente < 0).length || 0,
  };

  const filteredMovements = movements?.filter(m =>
    m.descripcion?.toLowerCase().includes(search.toLowerCase()) ||
    m.referencia?.toLowerCase().includes(search.toLowerCase()) ||
    m.seller?.nombre.toLowerCase().includes(search.toLowerCase())
  );

  if (!tenantId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Liquidaciones Sellers</h1>
          <p className="text-muted-foreground">Gestiona los saldos y pagos de sellers e-commerce</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">${stats.totalSaldo.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Saldo Total a Cobrar</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <TrendingUp className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.sellersConDeuda}</p>
                <p className="text-xs text-muted-foreground">Sellers con Deuda</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <TrendingDown className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.sellersAFavor}</p>
                <p className="text-xs text-muted-foreground">Sellers a Favor</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sellers">
        <TabsList>
          <TabsTrigger value="sellers">Saldos por Seller</TabsTrigger>
          <TabsTrigger value="movements">Movimientos</TabsTrigger>
        </TabsList>

        <TabsContent value="sellers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Cuenta Corriente por Seller</CardTitle>
              <CardDescription>Sellers con cuenta corriente habilitada</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSellers ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Seller</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sellers?.map((seller) => (
                      <TableRow key={seller.id}>
                        <TableCell className="font-medium">{seller.nombre}</TableCell>
                        <TableCell className="text-right">
                          <span className={seller.saldo_cuenta_corriente > 0 ? 'text-orange-600 font-semibold' : seller.saldo_cuenta_corriente < 0 ? 'text-green-600 font-semibold' : ''}>
                            ${seller.saldo_cuenta_corriente?.toLocaleString() || '0'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setActiveSeller(seller);
                              setSettlementDialogOpen(true);
                            }}
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            Registrar Pago
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {sellers?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                          No hay sellers con cuenta corriente
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar movimiento..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedSeller} onValueChange={setSelectedSeller}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por seller" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los sellers</SelectItem>
                {sellers?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {loadingMovements ? (
                <div className="p-6 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Seller</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMovements?.map((mov) => (
                      <TableRow key={mov.id}>
                        <TableCell className="text-sm">
                          {format(new Date(mov.created_at), 'dd/MM/yy HH:mm', { locale: es })}
                        </TableCell>
                        <TableCell className="font-medium">{mov.seller?.nombre}</TableCell>
                        <TableCell>
                          <Badge variant={mov.tipo === 'cargo' ? 'default' : mov.tipo === 'pago' ? 'secondary' : 'outline'}>
                            {mov.tipo === 'cargo' ? 'Cargo' : mov.tipo === 'pago' ? 'Pago' : 'Ajuste'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {mov.descripcion || mov.referencia || '-'}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${mov.tipo === 'cargo' ? 'text-orange-600' : 'text-green-600'}`}>
                          {mov.tipo === 'cargo' ? '+' : '-'}${Math.abs(mov.monto).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">${mov.saldo_nuevo?.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {filteredMovements?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No hay movimientos
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Settlement Dialog */}
      {activeSeller && (
        <SellerSettlementDialog
          open={settlementDialogOpen}
          onOpenChange={setSettlementDialogOpen}
          seller={activeSeller}
        />
      )}
    </div>
  );
}
