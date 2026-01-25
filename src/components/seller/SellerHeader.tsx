import { LogOut, Wallet, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { useTenantContext } from '@/components/providers/TenantProvider';
import { useSellerData } from '@/hooks/useSellerData';
import { Badge } from '@/components/ui/badge';

interface SellerHeaderProps {
  onMenuClick?: () => void;
}

export function SellerHeader({ onMenuClick }: SellerHeaderProps) {
  const { signOut } = useAuth();
  const { branding } = useTenantContext();
  const { seller } = useSellerData();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(amount);
  };

  return (
    <header className="h-16 border-b bg-background flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        <div className="flex items-center gap-3">
          {branding?.logo_light ? (
            <img 
              src={branding.logo_light} 
              alt={branding.nombre_app || 'Logo'} 
              className="h-8 object-contain"
            />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">
                {branding?.nombre_app?.charAt(0) || 'L'}
              </span>
            </div>
          )}
          <div className="hidden sm:block">
            <p className="font-semibold text-sm">{seller?.nombre || 'Mi Tienda'}</p>
            <p className="text-xs text-muted-foreground">{branding?.nombre_app}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {seller?.tiene_cuenta_corriente && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {formatCurrency(seller.saldo_cuenta_corriente)}
            </span>
            {seller.saldo_cuenta_corriente < 0 && (
              <Badge variant="destructive" className="text-xs">Deuda</Badge>
            )}
            {seller.saldo_cuenta_corriente > 0 && (
              <Badge variant="default" className="text-xs bg-green-600">A favor</Badge>
            )}
          </div>
        )}
        
        <Button variant="ghost" size="icon" onClick={signOut}>
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
