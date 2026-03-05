import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useSellerData } from '@/hooks/useSellerData';
import { SellerHeader } from './SellerHeader';
import { SellerSidebar } from './SellerSidebar';
import { Loader2 } from 'lucide-react';
import { useSubscriptionBlock } from '@/hooks/useSubscriptionBlock';
import { SubscriptionBlockScreen } from '@/components/subscription/SubscriptionBlockScreen';

export function SellerLayout() {
  const { user, loading: authLoading, hasRole } = useAuth();
  const { seller, isLoading: sellerLoading } = useSellerData();
  const { isBlocked, reason } = useSubscriptionBlock();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Loading state
  if (authLoading || sellerLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Subscription/trial expired
  if (isBlocked) {
    return <SubscriptionBlockScreen reason={reason} />;
  }

  // Not a seller
  if (!hasRole('seller')) {
    return <Navigate to="/dashboard" replace />;
  }

  // Seller role but no linked store
  if (!seller) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Loader2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold mb-2">Cuenta no vinculada</h1>
          <p className="text-muted-foreground">
            Tu cuenta de usuario no está vinculada a ninguna tienda. 
            Contacta al administrador para que vincule tu cuenta.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <SellerSidebar 
        open={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        <SellerHeader onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
