import { useAuth } from '@/lib/auth';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronDown, LogOut, User, Settings, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { NotificationPopover } from '@/components/notifications/NotificationPopover';

export function AppHeader() {
  const { profile, roles, signOut } = useAuth();
  const navigate = useNavigate();

  const getInitials = () => {
    if (!profile) return 'U';
    const first = profile.nombre?.charAt(0) || '';
    const last = profile.apellido?.charAt(0) || '';
    return (first + last).toUpperCase() || 'U';
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-admin text-white',
      chofer: 'bg-drivers text-white',
      operador: 'bg-shipments text-white',
      supervisor: 'bg-accent text-white',
      sucursal: 'bg-warning text-white',
      cliente: 'bg-info text-white',
      bodega: 'bg-secondary text-secondary-foreground',
      atencion_cliente: 'bg-payments text-white',
      despachador: 'bg-commissions text-white',
    };
    return colors[role] || 'bg-muted text-muted-foreground';
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-card/80 backdrop-blur-md px-4 md:px-6">
      <SidebarTrigger className="md:hidden" />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Notifications */}
      <NotificationPopover />

      {/* User Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 px-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={profile?.avatar_url || undefined} alt="Avatar" />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:flex flex-col items-start text-left">
              <span className="text-sm font-medium">{profile?.nombre || 'Usuario'}</span>
              <div className="flex gap-1">
                {roles.slice(0, 2).map((role) => (
                  <Badge key={role} variant="secondary" className={`text-[10px] px-1.5 py-0 ${getRoleBadgeColor(role)}`}>
                    {role}
                  </Badge>
                ))}
                {roles.length > 2 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    +{roles.length - 2}
                  </Badge>
                )}
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span>{profile?.nombre} {profile?.apellido}</span>
              <span className="text-xs font-normal text-muted-foreground">{profile?.email}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/profile')}>
            <User className="mr-2 h-4 w-4" />
            Mi Perfil
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/admin/settings')}>
            <Settings className="mr-2 h-4 w-4" />
            Configuración
          </DropdownMenuItem>
          {profile?.sucursal_id && (
            <DropdownMenuItem onClick={() => navigate('/admin/branches')}>
              <Building2 className="mr-2 h-4 w-4" />
              Mi Sucursal
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
