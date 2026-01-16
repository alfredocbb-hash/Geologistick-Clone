import { useState } from 'react';
import { MobileHeader } from './MobileHeader';
import { MobileBottomNav, MobileTab } from './MobileBottomNav';
import { MobileHomeTab } from './MobileHomeTab';
import { MobileRoutesTab } from './MobileRoutesTab';
import { MobileScanTab } from './MobileScanTab';
import { MobileEarningsTab } from './MobileEarningsTab';
import { MobileProfileTab } from './MobileProfileTab';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationPopover } from '@/components/notifications/NotificationPopover';
import { Sheet, SheetContent } from '@/components/ui/sheet';

export function MobileAppLayout() {
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [showNotifications, setShowNotifications] = useState(false);
  const { unreadCount } = useNotifications();

  const handleTabChange = (tab: MobileTab) => {
    setActiveTab(tab);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'home':
        return <MobileHomeTab onNavigateToRoutes={() => setActiveTab('routes')} />;
      case 'routes':
        return <MobileRoutesTab />;
      case 'scan':
        return <MobileScanTab />;
      case 'earnings':
        return <MobileEarningsTab />;
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
