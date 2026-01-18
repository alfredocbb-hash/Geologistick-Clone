import { Bell, Wifi, WifiOff } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { useNotifications } from '@/hooks/useNotifications';
import { useTenant } from '@/hooks/useTenant';
import { useState, useEffect } from 'react';

interface MobileHeaderProps {
  onMenuClick?: () => void;
  onNotificationsClick?: () => void;
  onProfileClick?: () => void;
}

export function MobileHeader({ onMenuClick, onNotificationsClick, onProfileClick }: MobileHeaderProps) {
  const { user, profile } = useAuth();
  const { unreadCount } = useNotifications();
  const { branding } = useTenant();
  const [isOnline, setIsOnline] = useState(true);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getInitials = () => {
    if (profile?.nombre) {
      const nombre = profile.nombre;
      const apellido = profile.apellido || '';
      return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
    }
    return user?.email?.charAt(0).toUpperCase() || 'U';
  };

  return (
    <header 
      className="fixed top-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur-2xl border-b border-slate-800/50" 
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex items-center justify-between h-14 px-4">
        {/* Logo / App Name */}
        <div className="flex items-center gap-3">
          {branding?.logo_dark ? (
            <img 
              src={branding.logo_dark} 
              alt={branding.nombre_app || 'App'} 
              className="h-8 w-auto"
            />
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/30 rounded-xl blur-sm" />
                <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center shadow-lg shadow-primary/20">
                  <span className="text-lg">🚚</span>
                </div>
              </div>
              <span className="font-bold text-white text-lg tracking-tight">
                {branding?.nombre_app || 'ChoferApp'}
              </span>
            </div>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Online Status Indicator */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            isOnline 
              ? 'bg-emerald-500/20 text-emerald-400' 
              : 'bg-red-500/20 text-red-400'
          }`}>
            {isOnline ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="hidden sm:inline">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" />
                <span className="hidden sm:inline">Offline</span>
              </>
            )}
          </div>

          {/* Notifications */}
          <button 
            onClick={onNotificationsClick}
            className="relative p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 transition-all active:scale-95"
          >
            <Bell className="h-5 w-5 text-slate-300" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full shadow-lg shadow-red-500/30">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Profile Avatar */}
          <button 
            onClick={onProfileClick}
            className="relative group"
          >
            <div className="absolute inset-0 bg-primary/30 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
            <Avatar className="h-10 w-10 ring-2 ring-primary/30 group-hover:ring-primary/60 transition-all">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-emerald-500 text-white text-sm font-semibold">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
          </button>
        </div>
      </div>
    </header>
  );
}
