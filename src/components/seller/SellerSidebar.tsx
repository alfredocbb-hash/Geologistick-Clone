import { Home, ShoppingBag, Package, Wallet } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useSellerData } from '@/hooks/useSellerData';

const navItems = [
  { to: '/seller', icon: Home, label: 'Inicio', end: true },
  { to: '/seller/orders', icon: ShoppingBag, label: 'Mis Pedidos' },
  { to: '/seller/shipments', icon: Package, label: 'Mis Envíos' },
  { to: '/seller/account', icon: Wallet, label: 'Mi Cuenta' },
];

interface SellerSidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function SellerSidebar({ open, onClose }: SellerSidebarProps) {
  const location = useLocation();
  const { seller } = useSellerData();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(amount);
  };

  const isActive = (path: string, end?: boolean) => {
    if (end) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar border-r transform transition-transform duration-200 ease-in-out lg:transform-none",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Mobile header */}
          <div className="lg:hidden h-16 border-b flex items-center px-4">
            <p className="font-semibold">{seller?.nombre || 'Mi Tienda'}</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive(item.to, item.end)
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Balance indicator for mobile */}
          {seller?.tiene_cuenta_corriente && (
            <div className="lg:hidden p-4 border-t">
              <div className="px-3 py-2 rounded-lg bg-sidebar-accent">
                <p className="text-xs text-muted-foreground mb-1">Saldo</p>
                <p className="font-semibold">
                  {formatCurrency(seller.saldo_cuenta_corriente)}
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
