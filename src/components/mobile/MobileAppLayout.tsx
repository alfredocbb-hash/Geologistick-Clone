import { useState } from 'react';
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
import { NotificationPopover } from '@/components/notifications/NotificationPopover';
import { Sheet, SheetContent } from '@/components/ui/sheet';

export type UserMobileRole = 'chofer' | 'centro_logistico' | 'sucursal';

export function MobileAppLayout() {
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [showNotifications, setShowNotifications] = useState(false);
  const { unreadCount } = useNotifications();
  const { hasRole } = useAuth();

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

      {/* Main Content */}
      <main className="pt-14 pb-20 px-4 min-h-screen">
        <div className="pt-4">
          {renderTabContent()}
        </div>
      </main>

      {/* Bottom Navigation */}
      <MobileBottomNav 
        activeTab={activeTab} 
        onTabChange={handleTabChange}
        notificationCount={unreadCount}
        userRole={userRole}
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
