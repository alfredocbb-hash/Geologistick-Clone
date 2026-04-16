import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { TrialBanner } from '@/components/trial/TrialBanner';
import { Loader2 } from 'lucide-react';
import { useSubscriptionBlock } from '@/hooks/useSubscriptionBlock';
import { SubscriptionBlockScreen } from '@/components/subscription/SubscriptionBlockScreen';
import { AdminAssistant } from '@/components/assistant/AdminAssistant';

function getSidebarCookieState(): boolean {
  const match = document.cookie.match(/sidebar:state=(true|false)/);
  return match ? match[1] === 'true' : true;
}

export function DashboardLayout() {
  const { user, loading } = useAuth();
  const { isBlocked, reason } = useSubscriptionBlock();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (isBlocked) {
    return <SubscriptionBlockScreen reason={reason} />;
  }

  return (
    <SidebarProvider defaultOpen={getSidebarCookieState()}>
      <div className="flex min-h-screen w-full overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TrialBanner />
          <AppHeader />
          <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6 lg:p-8">
            <div className="max-w-full">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <AdminAssistant />
    </SidebarProvider>
  );
}
