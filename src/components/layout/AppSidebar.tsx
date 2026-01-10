import { useLocation } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/lib/auth';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Package,
  LayoutDashboard,
  Truck,
  Users,
  DollarSign,
  CreditCard,
  Settings,
  Building2,
  Tags,
  UserCog,
  Wallet,
  FileText,
  PackagePlus,
  MapPin,
  ClipboardList,
  LogOut,
  ChevronLeft,
  ChevronRight,
  QrCode,
  Route,
  Map,
  Car,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  roles?: AppRole[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
  roles?: AppRole[];
}

const navigation: NavGroup[] = [
  {
    label: 'Principal',
    items: [
      { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Envíos',
    items: [
      { title: 'Todos los Envíos', url: '/shipments', icon: Package },
      { title: 'Nuevo Envío', url: '/shipments/new', icon: PackagePlus, roles: ['admin', 'operador', 'atencion_cliente', 'despachador'] },
      { title: 'Tracking', url: '/tracking', icon: MapPin },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { title: 'Escanear QR', url: '/scan', icon: QrCode },
      { title: 'Planificador', url: '/planner', icon: Route, roles: ['admin', 'supervisor', 'operador', 'despachador'] },
      { title: 'Hojas de Ruta', url: '/route-sheets', icon: FileText, roles: ['admin', 'supervisor', 'operador', 'despachador', 'bodega'] },
      { title: 'Mapa en Vivo', url: '/live-map', icon: Map, roles: ['admin', 'supervisor', 'operador'] },
      { title: 'Choferes', url: '/drivers', icon: Truck, roles: ['admin', 'supervisor', 'operador', 'despachador'] },
      { title: 'Vehículos', url: '/vehicles', icon: Car, roles: ['admin', 'supervisor'] },
      { title: 'Rutas de Entrega', url: '/routes', icon: MapPin, roles: ['admin', 'supervisor', 'operador', 'chofer'] },
      { title: 'Mis Rutas', url: '/my-routes', icon: ClipboardList, roles: ['chofer'] },
    ],
    roles: ['admin', 'supervisor', 'operador', 'despachador', 'chofer', 'bodega', 'sucursal'],
  },
  {
    label: 'Finanzas',
    items: [
      { title: 'Control de Caja', url: '/cash', icon: Wallet, roles: ['admin', 'supervisor', 'operador', 'sucursal'] },
      { title: 'Liq. Sucursales', url: '/settlements/branches', icon: FileText, roles: ['admin', 'supervisor'] },
      { title: 'Liq. Choferes', url: '/settlements/drivers', icon: FileText, roles: ['admin', 'supervisor'] },
      { title: 'Liq. Clientes', url: '/settlements/clients', icon: FileText, roles: ['admin', 'supervisor', 'atencion_cliente'] },
      { title: 'Mis Comisiones', url: '/my-commissions', icon: DollarSign, roles: ['chofer'] },
      { title: 'Pagos', url: '/payments', icon: CreditCard, roles: ['admin', 'supervisor', 'operador'] },
    ],
    roles: ['admin', 'supervisor', 'operador', 'sucursal', 'chofer', 'atencion_cliente'],
  },
  {
    label: 'Clientes',
    items: [
      { title: 'Todos los Clientes', url: '/clients', icon: Users, roles: ['admin', 'operador', 'atencion_cliente'] },
    ],
    roles: ['admin', 'operador', 'atencion_cliente'],
  },
  {
    label: 'Administración',
    items: [
      { title: 'Sucursales', url: '/admin/branches', icon: Building2 },
      { title: 'Tarifas', url: '/admin/rates', icon: Tags },
      { title: 'Usuarios', url: '/admin/users', icon: UserCog },
      { title: 'Configuración', url: '/admin/settings', icon: Settings },
    ],
    roles: ['admin'],
  },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const { profile, roles, signOut, isAdmin } = useAuth();
  const location = useLocation();
  const collapsed = state === 'collapsed';

  const canAccessGroup = (group: NavGroup) => {
    if (!group.roles) return true;
    if (isAdmin()) return true;
    return group.roles.some((role) => roles.includes(role));
  };

  const canAccessItem = (item: NavItem) => {
    if (!item.roles) return true;
    if (isAdmin()) return true;
    return item.roles.some((role) => roles.includes(role));
  };

  const getInitials = () => {
    if (!profile) return 'U';
    const first = profile.nombre?.charAt(0) || '';
    const last = profile.apellido?.charAt(0) || '';
    return (first + last).toUpperCase() || 'U';
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-lg">
            <Package className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-lg font-bold text-sidebar-foreground">LogiTrack</span>
              <span className="text-xs text-sidebar-foreground/60">Gestión Logística</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        {navigation.filter(canAccessGroup).map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50 px-3 mb-2">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.filter(canAccessItem).map((item) => {
                  const isActive = location.pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                            'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                            isActive && 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md'
                          )}
                        >
                          <item.icon className={cn('h-5 w-5 shrink-0', isActive && 'text-sidebar-primary-foreground')} />
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        {/* Collapse Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="w-full justify-center mb-4 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span className="ml-2">Colapsar</span>}
        </Button>

        {/* User Info */}
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <Avatar className="h-9 w-9 border-2 border-sidebar-primary">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm font-semibold">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{profile?.nombre || 'Usuario'}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">{profile?.email}</p>
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="shrink-0 text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
