import { Home, Route, QrCode, Wallet, User, Package, Clock, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserMobileRole } from './MobileAppLayout';
import { useTranslation } from 'react-i18next';

export type MobileTab = 'home' | 'routes' | 'scan' | 'earnings' | 'profile' | 'reception' | 'deliveries' | 'history';

interface MobileBottomNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  notificationCount?: number;
  userRole?: UserMobileRole;
  hasPermission?: (key: string) => boolean;
  hidden?: boolean;
}

interface TabConfig {
  id: MobileTab;
  labelKey: string;
  icon: typeof Home;
  isCenter?: boolean;
  permissionKey?: string;
}

const getTabsForRole = (role: UserMobileRole): TabConfig[] => {
  switch (role) {
    case 'chofer':
      return [
        { id: 'home', labelKey: 'mobile.home', icon: Home },
        { id: 'routes', labelKey: 'mobile.routes', icon: Route, permissionKey: 'my_routes.view' },
        { id: 'scan', labelKey: 'mobile.scan', icon: QrCode, isCenter: true, permissionKey: 'shipments.scan' },
        { id: 'earnings', labelKey: 'mobile.earnings', icon: Wallet, permissionKey: 'commissions.view' },
        { id: 'profile', labelKey: 'mobile.profile', icon: User },
      ];
    case 'centro_logistico':
      return [
        { id: 'home', labelKey: 'mobile.home', icon: Home },
        { id: 'reception', labelKey: 'mobile.reception', icon: Package, permissionKey: 'route_sheets.view' },
        { id: 'scan', labelKey: 'mobile.scan', icon: QrCode, isCenter: true, permissionKey: 'shipments.scan' },
        { id: 'history', labelKey: 'mobile.history', icon: Clock },
        { id: 'profile', labelKey: 'mobile.profile', icon: User },
      ];
    case 'sucursal':
    default:
      return [
        { id: 'home', labelKey: 'mobile.home', icon: Home },
        { id: 'deliveries', labelKey: 'mobile.deliveries', icon: Truck, permissionKey: 'delivery.confirm' },
        { id: 'scan', labelKey: 'mobile.scan', icon: QrCode, isCenter: true, permissionKey: 'shipments.scan' },
        { id: 'history', labelKey: 'mobile.history', icon: Clock },
        { id: 'profile', labelKey: 'mobile.profile', icon: User },
      ];
  }
};

export function MobileBottomNav({ activeTab, onTabChange, notificationCount = 0, userRole = 'sucursal', hasPermission, hidden }: MobileBottomNavProps) {
  const allTabs = getTabsForRole(userRole);
  const { t } = useTranslation();
  
  // Filter tabs based on permissions
  const tabs = allTabs.filter(tab => {
    if (!tab.permissionKey) return true;
    if (!hasPermission) return true;
    return hasPermission(tab.permissionKey);
  });

  if (hidden) return null;

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-2xl border-t border-slate-800/50" 
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-18 px-2 py-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          const label = t(tab.labelKey);
          
          if (tab.isCenter) {
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="relative -mt-8 group"
              >
                <div className={cn(
                  "absolute inset-0 rounded-full blur-xl transition-opacity duration-300",
                  "bg-gradient-to-r from-primary to-emerald-500",
                  isActive ? "opacity-50" : "opacity-20 group-hover:opacity-40"
                )} />
                
                <div className={cn(
                  "relative flex flex-col items-center justify-center",
                  "w-16 h-16 rounded-full transition-all duration-300",
                  "bg-gradient-to-br from-primary via-primary to-emerald-500",
                  "shadow-xl shadow-primary/40",
                  "active:scale-95",
                  isActive && "scale-110"
                )}>
                  <Icon className="h-7 w-7 text-white" strokeWidth={2} />
                </div>
                
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-primary whitespace-nowrap">
                  {label}
                </span>
              </button>
            );
          }
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "relative flex flex-col items-center justify-center py-2 px-3 min-w-[56px]",
                "transition-all duration-200 rounded-2xl",
                "active:scale-95",
                isActive && "bg-slate-800/60"
              )}
            >
              {tab.id === 'home' && notificationCount > 0 && (
                <span className="absolute top-0 right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-red-500/30">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
              
              <div className="relative">
                <Icon 
                  className={cn(
                    "h-6 w-6 transition-all duration-300",
                    isActive 
                      ? "text-primary scale-110" 
                      : "text-slate-500"
                  )} 
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </div>
              
              <span 
                className={cn(
                  "text-[10px] mt-1 font-medium transition-all duration-200",
                  isActive ? "text-primary" : "text-slate-500"
                )}
              >
                {label}
              </span>
              
              {isActive && (
                <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-primary shadow-sm shadow-primary" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
