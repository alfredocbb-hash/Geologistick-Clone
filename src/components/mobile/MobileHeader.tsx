import { Bell, Menu } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { useNotifications } from '@/hooks/useNotifications';
import { useTenant } from '@/hooks/useTenant';

interface MobileHeaderProps {
  onMenuClick?: () => void;
  onNotificationsClick?: () => void;
  onProfileClick?: () => void;
}

export function MobileHeader({ onMenuClick, onNotificationsClick, onProfileClick }: MobileHeaderProps) {
  const { user, profile } = useAuth();
  const { unreadCount } = useNotifications();
  const { branding } = useTenant();

  const getInitials = () => {
    if (profile?.nombre) {
      const nombre = profile.nombre;
      const apellido = profile.apellido || '';
      return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
    }
    return user?.email?.charAt(0).toUpperCase() || 'U';
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/50" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
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
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">🚚</span>
              </div>
              <span className="font-semibold text-white text-lg">
                {branding?.nombre_app || 'ChoferApp'}
              </span>
            </div>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Notifications */}
          <button 
            onClick={onNotificationsClick}
            className="relative p-2 rounded-full bg-slate-800/50 hover:bg-slate-800 transition-colors"
          >
            <Bell className="h-5 w-5 text-slate-300" />
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </button>

          {/* Profile Avatar */}
          <button 
            onClick={onProfileClick}
            className="rounded-full ring-2 ring-primary/30 hover:ring-primary/60 transition-all"
          >
            <Avatar className="h-9 w-9">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground text-sm font-medium">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
          </button>
        </div>
      </div>
    </header>
  );
}
