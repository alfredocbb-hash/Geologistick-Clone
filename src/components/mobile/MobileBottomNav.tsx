import { Home, Route, QrCode, Wallet, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MobileTab = 'home' | 'routes' | 'scan' | 'earnings' | 'profile';

interface MobileBottomNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  notificationCount?: number;
}

const tabs = [
  { id: 'home' as const, label: 'Inicio', icon: Home },
  { id: 'routes' as const, label: 'Rutas', icon: Route },
  { id: 'scan' as const, label: 'Scan', icon: QrCode, isCenter: true },
  { id: 'earnings' as const, label: 'Dinero', icon: Wallet },
  { id: 'profile' as const, label: 'Perfil', icon: User },
];

export function MobileBottomNav({ activeTab, onTabChange, notificationCount = 0 }: MobileBottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-xl border-t border-slate-700/50 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          
          if (tab.isCenter) {
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "relative -mt-6 flex flex-col items-center justify-center",
                  "w-16 h-16 rounded-full transition-all duration-300",
                  "bg-gradient-to-br from-primary to-primary/80",
                  "shadow-lg shadow-primary/30",
                  isActive && "scale-110 shadow-xl shadow-primary/50"
                )}
              >
                <Icon className="h-7 w-7 text-primary-foreground" />
                <span className="text-[10px] font-medium text-primary-foreground mt-0.5">
                  {tab.label}
                </span>
              </button>
            );
          }
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "relative flex flex-col items-center justify-center py-2 px-3",
                "transition-all duration-200 rounded-xl",
                isActive && "bg-slate-800/50"
              )}
            >
              {tab.id === 'home' && notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
              <Icon 
                className={cn(
                  "h-6 w-6 transition-all duration-200",
                  isActive 
                    ? "text-primary scale-110" 
                    : "text-slate-400"
                )} 
              />
              <span 
                className={cn(
                  "text-[10px] mt-1 font-medium transition-colors",
                  isActive ? "text-primary" : "text-slate-500"
                )}
              >
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
