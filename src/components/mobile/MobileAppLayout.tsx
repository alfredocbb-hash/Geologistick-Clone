import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, WifiOff } from 'lucide-react';
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
import { FlexMixtoScreen } from './FlexMixtoScreen';
import { CheckOutScreen } from './CheckOutScreen';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/lib/auth';
import { usePermissions } from '@/hooks/usePermissions';
import { useCheckIn } from '@/hooks/useCheckIn';
import { CheckInScreen } from './CheckInScreen';
import { useTenant } from '@/hooks/useTenant';
import { NotificationPopover } from '@/components/notifications/NotificationPopover';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useSubscriptionBlock } from '@/hooks/useSubscriptionBlock';
import { SubscriptionBlockScreen } from '@/components/subscription/SubscriptionBlockScreen';
import { Progress } from '@/components/ui/progress';

export type UserMobileRole = 'chofer' | 'centro_logistico' | 'sucursal';

// Tab index for animation direction
const TAB_ORDER: MobileTab[] = ['home', 'routes', 'reception', 'deliveries', 'scan', 'earnings', 'history', 'profile'];

export function MobileAppLayout() {
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCheckOut, setShowCheckOut] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [splashProgress, setSplashProgress] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [animDir, setAnimDir] = useState<'left' | 'right' | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { unreadCount } = useNotifications();
  const { hasRole, profile } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const { checkedIn, isLoading: checkInLoading, invalidate: invalidateCheckIn } = useCheckIn();
  const { isBlocked, reason: blockReason } = useSubscriptionBlock();

  const mainRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const isRefreshing = useRef(false);
  const prevTabRef = useRef<MobileTab>('home');

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Pull-to-refresh handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const el = mainRef.current;
    if (el && el.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isRefreshing.current) return;
    const el = mainRef.current;
    if (!el || el.scrollTop > 0) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0 && diff < 150) {
      setPullDistance(diff);
      setIsPulling(true);
    }
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;
    if (pullDistance > 80 && !isRefreshing.current) {
      isRefreshing.current = true;
      setPullDistance(80);
      await queryClient.invalidateQueries();
      isRefreshing.current = false;
    }
    setPullDistance(0);
    setIsPulling(false);
  }, [isPulling, pullDistance, queryClient]);

  // Animated splash
  useEffect(() => {
    const interval = setInterval(() => {
      setSplashProgress(prev => {
        if (prev >= 100) { clearInterval(interval); return 100; }
        return prev + 4;
      });
    }, 50);
    const timer = setTimeout(() => setShowSplash(false), 1500);
    return () => { clearInterval(interval); clearTimeout(timer); };
  }, []);

  // Refresh permissions on resume
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        queryClient.refetchQueries({ queryKey: ['user-permissions'], type: 'active' });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [queryClient]);

  const getUserMobileRole = (): UserMobileRole => {
    if (hasRole('chofer')) return 'chofer';
    if (hasRole('operador') || hasRole('bodega')) return 'centro_logistico';
    return 'sucursal';
  };

  const userRole = getUserMobileRole();

  const handleTabChange = (tab: MobileTab) => {
    if (tab === activeTab) return;
    const prevIdx = TAB_ORDER.indexOf(activeTab);
    const nextIdx = TAB_ORDER.indexOf(tab);
    setAnimDir(nextIdx > prevIdx ? 'left' : 'right');
    setIsTransitioning(true);
    prevTabRef.current = activeTab;
    
    // Brief delay for exit animation, then swap content
    setTimeout(() => {
      setActiveTab(tab);
      setTimeout(() => setIsTransitioning(false), 20);
    }, 120);
  };

  if (showSplash) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-primary/30 rounded-3xl blur-xl animate-pulse" />
          <img 
            src={geologistickLogo} 
            alt="Geologistick" 
            className="relative w-28 h-28 rounded-3xl object-contain shadow-2xl shadow-primary/40 transition-transform duration-700 animate-scale-in"
          />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2 animate-fade-in">ChoferApp</h1>
        <p className="text-slate-400 text-sm mb-6 animate-fade-in">Cargando...</p>
        <div className="w-48">
          <Progress value={splashProgress} className="h-1.5 bg-slate-800" />
        </div>
      </div>
    );
  }

  if (permissionsLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-slate-400 text-sm">Cargando permisos...</p>
      </div>
    );
  }

  if (isBlocked) {
    return <SubscriptionBlockScreen reason={blockReason} />;
  }

  if (userRole === 'chofer' && !checkInLoading && !checkedIn) {
    return <CheckInScreen onCheckInComplete={invalidateCheckIn} />;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'home':
        return <MobileHomeTab onNavigateToRoutes={() => handleTabChange('routes')} onNavigateToHistory={() => handleTabChange('history')} />;
      case 'routes':
        return <MobileRoutesTab />;
      case 'earnings':
        return <MobileEarningsTab />;
      case 'reception':
        return <MobileReceptionTab />;
      case 'deliveries':
        return <MobileDeliveriesTab />;
      case 'scan':
        return tenant?.modo_flex && userRole === 'chofer' ? <FlexScanScreen /> : <MobileScanTab />;
      case 'history':
        return <MobileHistoryTab />;
      case 'profile':
        return <MobileProfileTab onCheckOut={() => setShowCheckOut(true)} />;
      default:
        return <MobileHomeTab onNavigateToRoutes={() => handleTabChange('routes')} onNavigateToHistory={() => handleTabChange('history')} />;
    }
  };

  // Animation classes for tab transition
  const getTransitionClass = () => {
    if (!animDir) return '';
    if (isTransitioning) {
      return animDir === 'left' 
        ? 'translate-x-[-8%] opacity-0' 
        : 'translate-x-[8%] opacity-0';
    }
    return 'translate-x-0 opacity-100';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Offline indicator */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white text-center py-1.5 text-xs font-medium flex items-center justify-center gap-1.5"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.375rem)' }}
        >
          <WifiOff className="h-3.5 w-3.5" />
          Sin conexión a internet
        </div>
      )}

      <MobileHeader 
        onNotificationsClick={() => setShowNotifications(true)}
        onProfileClick={() => handleTabChange('profile')}
      />

      {/* Pull-to-refresh indicator */}
      {isPulling && (
        <div 
          className="flex justify-center items-center transition-all"
          style={{ 
            height: `${Math.min(pullDistance, 80)}px`,
            paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px))',
          }}
        >
          <Loader2 className={`h-5 w-5 text-primary ${pullDistance > 80 ? 'animate-spin' : ''}`} 
            style={{ opacity: Math.min(pullDistance / 80, 1) }}
          />
        </div>
      )}

      {/* Main Content with tab transitions */}
      <main 
        ref={mainRef}
        className={`px-4 min-h-screen transition-all duration-200 ease-out ${getTransitionClass()}`}
        style={{ 
          paddingTop: isPulling ? '0' : 'calc(3.5rem + env(safe-area-inset-top, 0px) + 1rem)',
          paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {import.meta.env.DEV && (
          <p className="text-xs text-slate-500 text-center mb-2 font-mono">
            {window.location.hostname}
          </p>
        )}
        {renderTabContent()}
      </main>

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

      {/* Check-out Screen */}
      {showCheckOut && (
        <CheckOutScreen 
          onClose={() => setShowCheckOut(false)} 
          onCheckOutComplete={() => {
            setShowCheckOut(false);
            invalidateCheckIn();
          }} 
        />
      )}
    </div>
  );
}
