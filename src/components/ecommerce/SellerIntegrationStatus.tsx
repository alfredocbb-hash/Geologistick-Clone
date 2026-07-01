import { CheckCircle2, XCircle, RefreshCw, Link2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface Seller {
  id: string;
  nombre: string;
  store_id: string | null;
  store_url: string | null;
  has_valid_token: boolean | null;
  ultimo_sync: string | null;
  plataforma: string;
  activo: boolean;
}

interface SellerIntegrationStatusProps {
  seller: Seller;
  onSync: () => void;
  onReconnect: () => void;
  isSyncing?: boolean;
}

export function SellerIntegrationStatus({
  seller,
  onSync,
  onReconnect,
  isSyncing = false,
}: SellerIntegrationStatusProps) {
  const isConnected = !!seller.has_valid_token && !!seller.store_id;

  if (seller.plataforma !== 'tiendanube') return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4" />
          Estado de Conexión Tiendanube
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isConnected ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium text-green-700 dark:text-green-400">Conectado</p>
                  <p className="text-xs text-muted-foreground">Store ID: {seller.store_id}</p>
                </div>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="font-medium text-red-700 dark:text-red-400">Desconectado</p>
                  <p className="text-xs text-muted-foreground">La tienda no está vinculada</p>
                </div>
              </>
            )}
          </div>
          <Badge variant={seller.activo ? 'default' : 'secondary'}>
            {seller.activo ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>

        {seller.ultimo_sync && (
          <div className="text-sm flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Última sincronización:</span>
            <span>
              {formatDistanceToNow(new Date(seller.ultimo_sync), { addSuffix: true, locale: es })}
            </span>
          </div>
        )}

        {seller.store_url && (
          <div className="text-sm">
            <a
              href={seller.store_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1"
            >
              <Link2 className="h-3 w-3" />
              {seller.store_url}
            </a>
          </div>
        )}

        {isConnected && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Webhooks registrados:</p>
            <div className="flex flex-wrap gap-1">
              {['order/created', 'order/paid', 'order/fulfilled', 'order/cancelled', 'app/uninstalled'].map((event) => (
                <Badge key={event} variant="outline" className="text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                  {event.split('/')[1]}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {isConnected && (
            <Button size="sm" onClick={onSync} disabled={isSyncing}>
              <RefreshCw className={`mr-1 h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar Ahora'}
            </Button>
          )}
          {!isConnected && (
            <Button size="sm" variant="outline" onClick={onReconnect}>
              <Link2 className="mr-1 h-3 w-3" />
              Conectar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
