import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import geologistickLogo from '@/assets/geologistick-logo.png';
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
import { FlexScanScreen } from './FlexScanScreen';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/lib/auth';
import { usePermissions } from '@/hooks/usePermissions';
import { useCheckIn } from '@/hooks/useCheckIn';
import { CheckInScreen } from './CheckInScreen';
import { useTenant } from '@/hooks/useTenant';
import { NotificationPopover } from '@/components/notifications/NotificationPopover';
import { Sheet, SheetContent } from '@/components/ui/sheet';

export type UserMobileRole = 'chofer' | 'centro_logistico' | 'sucursal';

export function MobileAppLayout() {
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const { unreadCount } = useNotifications();
  const { hasRole, profile } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const { checkedIn, isLoading: checkInLoading, invalidate: invalidateCheckIn } = useCheckIn();

  // Show splash screen briefly on first load
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Refresh permissions when app resumes - using refetch instead of invalidate
  // to prevent flash while loading (keeps old data visible)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Soft refetch - doesn't clear cache while loading
        queryClient.refetchQueries({ queryKey: ['user-permissions'], type: 'active' });
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
    return 'sucursal';
  };

  const userRole = getUserMobileRole();

  const handleTabChange = (tab: MobileTab) => {
    setActiveTab(tab);
  };

  // Show splash screen
  if (showSplash) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-primary/30 rounded-3xl blur-xl animate-pulse" />
          <img 
            src={geologistickLogo} 
            alt="Geologistick" 
            className="relative w-28 h-28 rounded-3xl object-contain shadow-2xl shadow-primary/40"
          />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">ChoferApp</h1>
        <p className="text-slate-400 text-sm mb-6">Cargando...</p>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Show loading while permissions are being fetched
  if (permissionsLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-slate-400 text-sm">Cargando permisos...</p>
      </div>
    );
  }

  // Check-in guard for drivers
  if (userRole === 'chofer' && !checkInLoading && !checkedIn) {
    return <CheckInScreen onCheckInComplete={invalidateCheckIn} />;
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
      
      // Common tabs - Modo Flex replaces standard scan
      case 'scan':
        return tenant?.modo_flex && userRole === 'chofer' ? <FlexScanScreen /> : <MobileScanTab />;
      case 'history':
        return <MobileHistoryTab />;
      case 'profile':
        return <MobileProfileTab />;
      
      default:
        return <MobileHomeTab onNavigateToRoutes={() => setActiveTab('routes')} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
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
          paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))'
        }}
      >
        {/* Debug: Domain indicator - helps diagnose APK URL issues */}
        {import.meta.env.DEV && (
          <p className="text-xs text-slate-500 text-center mb-2 font-mono">
            {window.location.hostname}
          </p>
        )}
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
        <SheetContent side="right" className="bg-slate-950 border-slate-800 w-full sm:max-w-md p-0">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-white mb-4">Notificaciones</h2>
            <NotificationPopover />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
