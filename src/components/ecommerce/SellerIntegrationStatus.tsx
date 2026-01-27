import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Link2, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Seller {
  id: string;
  nombre: string;
  store_id: string | null;
  store_url: string | null;
  access_token: string | null;
  token_expires_at: string | null;
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
  isSyncing = false 
}: SellerIntegrationStatusProps) {
  const isConnected = !!seller.access_token && !!seller.store_id;
  const isTokenExpired = seller.token_expires_at 
    && new Date(seller.token_expires_at) < new Date();
  const isTokenExpiringSoon = seller.token_expires_at 
    && !isTokenExpired
    && new Date(seller.token_expires_at) < new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Only show for Tiendanube sellers
  if (seller.plataforma !== 'tiendanube') {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4" />
          Estado de Conexión Tiendanube
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isConnected ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium text-green-700 dark:text-green-400">Conectado</p>
                  <p className="text-xs text-muted-foreground">
                    Store ID: {seller.store_id}
                  </p>
                </div>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="font-medium text-red-700 dark:text-red-400">Desconectado</p>
                  <p className="text-xs text-muted-foreground">
                    La tienda no está vinculada
                  </p>
                </div>
              </>
            )}
          </div>
          <Badge variant={seller.activo ? 'default' : 'secondary'}>
            {seller.activo ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>

        {/* Token Expiry Warning */}
        {isTokenExpired && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              El token ha expirado. La sincronización automática no funcionará hasta que reconectes la tienda.
            </AlertDescription>
          </Alert>
        )}

        {isTokenExpiringSoon && !isTokenExpired && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              El token expirará pronto. Se renovará automáticamente en la próxima sincronización.
            </AlertDescription>
          </Alert>
        )}

        {/* Token Expiry Info */}
        {seller.token_expires_at && isConnected && !isTokenExpired && (
          <div className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Token expira:</span>
            <span className={isTokenExpiringSoon ? 'text-amber-600 font-medium' : ''}>
              {format(new Date(seller.token_expires_at), 'dd/MM/yyyy HH:mm', { locale: es })}
            </span>
          </div>
        )}

        {/* Last Sync */}
        {seller.ultimo_sync && (
          <div className="text-sm flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Última sincronización:</span>
            <span>
              {formatDistanceToNow(new Date(seller.ultimo_sync), { 
                addSuffix: true, 
                locale: es 
              })}
            </span>
          </div>
        )}

        {/* Store URL */}
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

        {/* Webhooks Status */}
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

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {isConnected && (
            <Button 
              size="sm" 
              onClick={onSync}
              disabled={isSyncing || isTokenExpired}
            >
              <RefreshCw className={`mr-1 h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar Ahora'}
            </Button>
          )}
          {(!isConnected || isTokenExpired) && (
            <Button size="sm" variant={isTokenExpired ? 'destructive' : 'outline'} onClick={onReconnect}>
              <Link2 className="mr-1 h-3 w-3" />
              {isTokenExpired ? 'Reconectar' : 'Conectar'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
