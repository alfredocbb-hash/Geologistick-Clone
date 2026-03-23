import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Store, Mail, Phone, MapPin, Calendar, DollarSign, Package, ShoppingCart } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { SellerIntegrationStatus } from './SellerIntegrationStatus';
import { SellerConceptosEditor } from './SellerConceptosEditor';

interface Seller {
  id: string;
  nombre: string;
  razon_social: string | null;
  email: string;
  telefono: string | null;
  direccion: string | null;
  ciudad: string | null;
  plataforma: string;
  store_id: string | null;
  store_url: string | null;
  access_token: string | null;
  token_expires_at: string | null;
  activo: boolean;
  tiene_cuenta_corriente: boolean;
  saldo_cuenta_corriente: number;
  limite_credito: number;
  ultimo_sync: string | null;
  created_at: string;
  cliente_id?: string | null;
}

interface SellerDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seller: Seller;
}

const PLATAFORMA_LABELS: Record<string, string> = {
  tiendanube: 'Tiendanube',
  mercadolibre: 'MercadoLibre',
  shopify: 'Shopify',
  woocommerce: 'WooCommerce',
  manual: 'Manual',
};

export function SellerDetailsDialog({ open, onOpenChange, seller }: SellerDetailsDialogProps) {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch linked client name
  const { data: linkedClient } = useQuery({
    queryKey: ['seller-linked-client', seller.cliente_id],
    queryFn: async () => {
      if (!seller.cliente_id) return null;
      const { data } = await supabase
        .from('clientes')
        .select('id, nombre, apellido')
        .eq('id', seller.cliente_id)
        .maybeSingle();
      return data;
    },
    enabled: open && !!seller.cliente_id,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['seller-stats', seller.id],
    queryFn: async () => {
      const [ordersResult, shipmentsResult] = await Promise.all([
        supabase
          .from('ecommerce_orders')
          .select('id', { count: 'exact', head: true })
          .eq('seller_id', seller.id),
        supabase
          .from('ecommerce_orders')
          .select('id', { count: 'exact', head: true })
          .eq('seller_id', seller.id)
          .not('envio_id', 'is', null),
      ]);

      return {
        totalOrders: ordersResult.count || 0,
        totalShipments: shipmentsResult.count || 0,
      };
    },
    enabled: open,
  });

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error('Sesión expirada');
        return;
      }

      const response = await supabase.functions.invoke('tiendanube-sync', {
        body: { seller_id: seller.id },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;
      if (result.success) {
        toast.success(`Sincronización completada: ${result.created} nuevos, ${result.updated} actualizados`);
        queryClient.invalidateQueries({ queryKey: ['seller-stats', seller.id] });
      } else {
        toast.error(result.error || 'Error en la sincronización');
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Error al sincronizar con Tiendanube');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReconnect = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const authUrl = `${supabaseUrl}/functions/v1/tiendanube-oauth/authorize?seller_id=${seller.id}`;
    window.open(authUrl, '_blank', 'width=600,height=700');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            {seller.nombre}
          </DialogTitle>
          <DialogDescription>
            Detalles del seller e información de cuenta
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status and Platform */}
          <div className="flex items-center gap-2">
            <Badge variant={seller.activo ? 'default' : 'secondary'}>
              {seller.activo ? 'Activo' : 'Inactivo'}
            </Badge>
            <Badge variant="outline">
              {PLATAFORMA_LABELS[seller.plataforma] || seller.plataforma}
            </Badge>
            {seller.tiene_cuenta_corriente && (
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                Cta. Cte.
              </Badge>
            )}
            {seller.cliente_id ? (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Cliente: {linkedClient ? `${linkedClient.nombre}${linkedClient.apellido ? ` ${linkedClient.apellido}` : ''}` : 'Vinculado'}
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                Sin cliente vinculado
              </Badge>
            )}
          </div>

          {/* Contact Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Información de Contacto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{seller.email}</span>
              </div>
              {seller.telefono && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{seller.telefono}</span>
                </div>
              )}
              {seller.direccion && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {seller.direccion}
                    {seller.ciudad && `, ${seller.ciudad}`}
                  </span>
                </div>
              )}
              {seller.store_url && (
                <div className="flex items-center gap-2 text-sm">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  <a 
                    href={seller.store_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {seller.store_url}
                  </a>
                </div>
              )}
              {seller.store_id && (
                <div className="flex items-center gap-2 text-sm">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Store ID:</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {seller.store_id}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <ShoppingCart className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <p className="text-2xl font-bold">{stats?.totalOrders || 0}</p>
                <p className="text-xs text-muted-foreground">Pedidos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Package className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <p className="text-2xl font-bold">{stats?.totalShipments || 0}</p>
                <p className="text-xs text-muted-foreground">Envíos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <DollarSign className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <p className={`text-2xl font-bold ${seller.saldo_cuenta_corriente > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  ${seller.saldo_cuenta_corriente?.toLocaleString() || '0'}
                </p>
                <p className="text-xs text-muted-foreground">Saldo</p>
              </CardContent>
            </Card>
          </div>

          {/* Account Info */}
          {seller.tiene_cuenta_corriente && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Cuenta Corriente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Límite de Crédito:</span>
                    <span className="ml-2 font-medium">${seller.limite_credito?.toLocaleString() || '0'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Saldo Actual:</span>
                    <span className={`ml-2 font-medium ${seller.saldo_cuenta_corriente > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      ${seller.saldo_cuenta_corriente?.toLocaleString() || '0'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Integration Status Panel */}
          {seller.plataforma === 'tiendanube' && (
            <SellerIntegrationStatus
              seller={{
                id: seller.id,
                nombre: seller.nombre,
                store_id: seller.store_id,
                store_url: seller.store_url,
                access_token: seller.access_token,
                token_expires_at: seller.token_expires_at,
                ultimo_sync: seller.ultimo_sync,
                plataforma: seller.plataforma,
                activo: seller.activo,
              }}
              onSync={handleSync}
              onReconnect={handleReconnect}
              isSyncing={isSyncing}
            />
          )}

          {/* Conceptos Adicionales Editor */}
          <SellerConceptosEditor sellerId={seller.id} tarifaId={null} />

          {/* Dates */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>Creado: {format(new Date(seller.created_at), 'dd/MM/yyyy', { locale: es })}</span>
            </div>
            {seller.ultimo_sync && (
              <div>
                Último sync: {format(new Date(seller.ultimo_sync), 'dd/MM/yy HH:mm', { locale: es })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
