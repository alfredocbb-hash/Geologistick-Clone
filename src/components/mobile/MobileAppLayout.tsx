import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { MobileHeader } from './MobileHeader';
import { MobileBottomNav, MobileTab } from './MobileBottomNav';
import { MobileHomeTab } from './MobileHomeTab';
import { MobileRoutesTab } from './MobileRoutesTab';
import { MobileScanTab } from './MobileScanTab';
import { MobileEarningsTab } from './MobileEarningsTab';
import { MobileProfileTab } from './MobileProfileTab';
import { MobileReceptionTab } from './MobileReceptionTab';
import { MobileDeliveriesTab } from './MobileDeliveriesTab';
import { MobileHistoryTab } from './MobileHistoryTab';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/lib/auth';
import { usePermissions } from '@/hooks/usePermissions';
import { NotificationPopover } from '@/components/notifications/NotificationPopover';
import { Sheet, SheetContent } from '@/components/ui/sheet';

export type UserMobileRole = 'chofer' | 'centro_logistico' | 'sucursal';

export function MobileAppLayout() {
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [showNotifications, setShowNotifications] = useState(false);
  const { unreadCount } = useNotifications();
  const { hasRole } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const queryClient = useQueryClient();

  // Refresh permissions when app resumes (comes back to focus)
  // This ensures changes in Gestión de Roles are reflected without reinstalling the APK
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Invalidate permissions cache when app becomes visible again
        queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
        queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [queryClient]);

  // Determine user's mobile role
  const getUserMobileRole = (): UserMobileRole => {
    if (hasRole('chofer')) return 'chofer';
    if (hasRole('operador') || hasRole('bodega')) return 'centro_logistico';
    // Default to sucursal for sucursal, despachador, admin roles
    return 'sucursal';
  };

  const userRole = getUserMobileRole();

  const handleTabChange = (tab: MobileTab) => {
    setActiveTab(tab);
  };

  // Show loading while permissions are being fetched
  if (permissionsLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'home':
        return <MobileHomeTab onNavigateToRoutes={() => setActiveTab('routes')} />;
      
      // Chofer tabs
      case 'routes':
        return <MobileRoutesTab />;
      case 'earnings':
        return <MobileEarningsTab />;
      
      // Centro logístico tabs
      case 'reception':
        return <MobileReceptionTab />;
      
      // Sucursal tabs
      case 'deliveries':
        return <MobileDeliveriesTab />;
      
      // Common tabs
      case 'scan':
        return <MobileScanTab />;
      case 'history':
        return <MobileHistoryTab />;
      case 'profile':
        return <MobileProfileTab />;
      
      default:
        return <MobileHomeTab onNavigateToRoutes={() => setActiveTab('routes')} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <MobileHeader 
        onNotificationsClick={() => setShowNotifications(true)}
        onProfileClick={() => setActiveTab('profile')}
      />

      {/* Main Content - adjusted for safe areas */}
      <main 
        className="px-4 min-h-screen"
        style={{ 
          paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px) + 1rem)',
          paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))'
        }}
      >
        {renderTabContent()}
      </main>

      {/* Bottom Navigation */}
      <MobileBottomNav 
        activeTab={activeTab} 
        onTabChange={handleTabChange}
        notificationCount={unreadCount}
        userRole={userRole}
        hasPermission={hasPermission}
      />

      {/* Notifications Sheet */}
      <Sheet open={showNotifications} onOpenChange={setShowNotifications}>
        <SheetContent side="right" className="bg-slate-900 border-slate-700 w-full sm:max-w-md p-0">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-white mb-4">Notificaciones</h2>
            <NotificationPopover />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
