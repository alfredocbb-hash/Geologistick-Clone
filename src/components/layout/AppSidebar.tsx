import { useLocation, useNavigate } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '@/hooks/usePermissions';
import { useBranchConfig } from '@/hooks/useBranchConfig';
import { useTenantContext } from '@/components/providers/TenantProvider';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { LayoutDashboard, Truck, Users, DollarSign, CreditCard, Settings, Building2, Tags, UserCog, Wallet, FileText, PackagePlus, MapPin, ClipboardList, LogOut, ChevronLeft, ChevronRight, QrCode, Route, Map, Car, Plug, Home, Palette, Crown, GitBranch, ShoppingCart, Store, ShoppingBag, Receipt, Package, Globe, AlertTriangle, BarChart3, Handshake, Key, Activity } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import geologistickLogo from '@/assets/geologistick-logo.png';
import { useTranslation } from 'react-i18next';
interface NavItem {
  title: string; // i18n key
  url: string;
  icon: React.ElementType;
  permissionKey?: string;
  requiresBranchDelivery?: boolean;
}
interface NavGroup {
  label: string; // i18n key
  items: NavItem[];
  permissionKeys?: string[];
  superAdminOnly?: boolean;
  requiresEcommerce?: boolean;
}
const navigation: NavGroup[] = [{
  label: 'nav.principal',
  items: [{
    title: 'nav.dashboard',
    url: '/dashboard',
    icon: LayoutDashboard,
    permissionKey: 'dashboard.view'
  }, {
    title: 'nav.reports',
    url: '/reports',
    icon: BarChart3,
    permissionKey: 'reports.view'
  }],
  permissionKeys: ['dashboard.view', 'reports.view']
}, {
  label: 'nav.shipments',
  items: [{
    title: 'nav.allShipments',
    url: '/shipments',
    icon: Package,
    permissionKey: 'shipments.view'
  }, {
    title: 'nav.newShipment',
    url: '/shipments/new',
    icon: PackagePlus,
    permissionKey: 'shipments.create'
  }, {
    title: 'nav.tracking',
    url: '/tracking',
    icon: MapPin,
    permissionKey: 'tracking.view'
  }],
  permissionKeys: ['shipments.view', 'shipments.create', 'tracking.view']
}, {
  label: 'nav.operations',
  items: [{
    title: 'nav.branchDelivery',
    url: '/scan',
    icon: QrCode,
    permissionKey: 'shipments.scan'
  }, {
    title: 'nav.myRoutes',
    url: '/my-routes',
    icon: Route,
    permissionKey: 'my_routes.view'
  }, {
    title: 'nav.homeDelivery',
    url: '/my-routes',
    icon: Home,
    permissionKey: 'my_routes.view',
    requiresBranchDelivery: true
  }, {
    title: 'nav.planner',
    url: '/planner',
    icon: Route,
    permissionKey: 'routes.plan'
  }, {
    title: 'nav.incidents',
    url: '/incidents',
    icon: AlertTriangle,
    permissionKey: 'routes.plan'
  }, {
    title: 'nav.routeSheets',
    url: '/route-sheets',
    icon: FileText,
    permissionKey: 'route_sheets.view'
  }, {
    title: 'nav.liveMap',
    url: '/live-map',
    icon: Map,
    permissionKey: 'live_map.view'
  }, {
    title: 'nav.drivers',
    url: '/drivers',
    icon: Truck,
    permissionKey: 'drivers.manage'
  }, {
    title: 'nav.vehicles',
    url: '/vehicles',
    icon: Car,
    permissionKey: 'vehicles.manage'
  }, {
    title: 'nav.routes',
    url: '/routes',
    icon: MapPin,
    permissionKey: 'my_routes.view',
    requiresBranchDelivery: true
  }],
  permissionKeys: ['shipments.scan', 'routes.plan', 'route_sheets.view', 'live_map.view', 'drivers.manage', 'vehicles.manage', 'my_routes.view']
}, {
  label: 'nav.finance',
  items: [{
    title: 'nav.cash',
    url: '/cash',
    icon: Wallet,
    permissionKey: 'cash.manage'
  }, {
    title: 'nav.branchSettlements',
    url: '/settlements/branches',
    icon: FileText,
    permissionKey: 'settlements.branch.view'
  }, {
    title: 'nav.driverSettlements',
    url: '/settlements/drivers',
    icon: FileText,
    permissionKey: 'settlements.driver.view'
  }, {
    title: 'nav.clientSettlements',
    url: '/settlements/clients',
    icon: FileText,
    permissionKey: 'settlements.client.view'
  }, {
    title: 'nav.thirdPartySettlements',
    url: '/settlements/third-party',
    icon: FileText,
    permissionKey: 'third_party.settlements'
  }, {
    title: 'nav.myCommissions',
    url: '/my-commissions',
    icon: DollarSign,
    permissionKey: 'commissions.view'
  }, {
    title: 'nav.payments',
    url: '/payments',
    icon: CreditCard,
    permissionKey: 'settlements.driver.manage'
  }],
  permissionKeys: ['cash.manage', 'settlements.branch.view', 'settlements.driver.view', 'settlements.client.view', 'commissions.view']
}, {
  label: 'nav.clients',
  items: [{
    title: 'nav.clients',
    url: '/clients',
    icon: Users,
    permissionKey: 'clients.view'
  }],
  permissionKeys: ['clients.view', 'clients.manage']
}, {
  label: 'nav.ecommerce',
  items: [{
    title: 'nav.dashboard',
    url: '/ecommerce/dashboard',
    icon: LayoutDashboard,
    permissionKey: 'ecommerce.sellers.view'
  }, {
    title: 'nav.sellers',
    url: '/ecommerce/sellers',
    icon: Store,
    permissionKey: 'ecommerce.sellers.view'
  }, {
    title: 'nav.orders',
    url: '/ecommerce/orders',
    icon: ShoppingBag,
    permissionKey: 'ecommerce.orders.view'
  }, {
    title: 'nav.ecommerceSettlements',
    url: '/ecommerce/settlements',
    icon: Receipt,
    permissionKey: 'ecommerce.settlements.view'
  }],
  permissionKeys: ['ecommerce.sellers.view', 'ecommerce.orders.view', 'ecommerce.settlements.view'],
  requiresEcommerce: true
}, {
  label: 'nav.outsourced',
  items: [{
    title: 'nav.thirdPartyCompanies',
    url: '/admin/third-party-companies',
    icon: Truck,
    permissionKey: 'third_party.view'
  }],
  permissionKeys: ['third_party.view', 'third_party.manage']
}, {
  label: 'nav.management',
  items: [{
    title: 'nav.branches',
    url: '/admin/branches',
    icon: Building2,
    permissionKey: 'branches.manage'
  }, {
    title: 'nav.rates',
    url: '/admin/rates',
    icon: Tags,
    permissionKey: 'rates.manage'
  }, {
    title: 'nav.users',
    url: '/admin/users',
    icon: UserCog,
    permissionKey: 'users.manage'
  }, {
    title: 'nav.rolePermissions',
    url: '/admin/roles',
    icon: Settings,
    permissionKey: 'roles.manage'
  }, {
    title: 'nav.integrations',
    url: '/admin/integrations',
    icon: Plug,
    permissionKey: 'integrations.manage'
  }, {
    title: 'nav.subscription',
    url: '/subscription',
    icon: Crown,
    permissionKey: 'integrations.manage'
  }, {
    title: 'nav.statusGuide',
    url: '/admin/status-guide',
    icon: GitBranch,
    permissionKey: 'users.manage'
  }, {
    title: 'nav.partners',
    url: '/admin/partners',
    icon: Handshake,
    permissionKey: 'integrations.manage'
  }],
  permissionKeys: ['branches.manage', 'rates.manage', 'users.manage', 'roles.manage', 'integrations.manage']
}, {
  label: 'nav.superAdmin',
  items: [{
    title: 'nav.tenants',
    url: '/admin/tenants',
    icon: Building2,
    permissionKey: 'tenants.view'
  }, {
    title: 'nav.subscriptionPlans',
    url: '/admin/plans',
    icon: Crown,
    permissionKey: 'subscription_plans.manage'
  }, {
    title: 'nav.landingContent',
    url: '/admin/landing',
    icon: Globe,
    permissionKey: 'tenants.manage'
  }, {
    title: 'nav.branding',
    url: '/admin/branding',
    icon: Palette,
    permissionKey: 'tenants.manage'
  }, {
    title: 'nav.apiDocs',
    url: '/admin/api-docs',
    icon: Key,
    permissionKey: 'tenants.manage'
  }, {
    title: 'nav.userActivity',
    url: '/admin/activity',
    icon: Activity,
    permissionKey: 'tenants.manage'
  }],
  superAdminOnly: true
}];
export function AppSidebar() {
  const {
    state,
    toggleSidebar
  } = useSidebar();
  const {
    profile,
    signOut,
    isSuperAdmin
  } = useAuth();
  const {
    hasPermission,
    isLoading,
    permissions
  } = usePermissions();
  const branchConfig = useBranchConfig();
  const realizaEntregas = branchConfig.realizaEntregas;
  const branchLoading = branchConfig.isLoading;
  const { tenant } = useTenantContext();
  const { branding } = useTenantContext();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const collapsed = state === 'collapsed';
  const { t } = useTranslation();

  const handleSignOut = async () => {
    try {
      queryClient.clear();
      await signOut();
    } catch (e) {
      console.error('Error during sign out:', e);
    } finally {
      navigate('/login', { replace: true });
    }
  };

  // Super admin can see everything, but also check for super admin only sections
  const canAccessGroup = (group: NavGroup) => {
    // Super Admin only section
    if (group.superAdminOnly) {
      return isSuperAdmin();
    }
    
    // Super Admin can see everything (moved BEFORE ecommerce check)
    if (isSuperAdmin()) return true;
    
    // e-Commerce section requires tenant to have ecommerce_enabled
    // (only applies to non-super-admin users now)
    if (group.requiresEcommerce && !tenant?.ecommerce_enabled) {
      return false;
    }
    
    if (!group.permissionKeys || group.permissionKeys.length === 0) return true;
    return group.permissionKeys.some(key => hasPermission(key));
  };
  const canAccessItem = (item: NavItem) => {
    if (isSuperAdmin()) return true;

    // Check permission first
    if (item.permissionKey && !hasPermission(item.permissionKey)) return false;

    // Check branch delivery requirement
    if (item.requiresBranchDelivery && !realizaEntregas) return false;
    return true;
  };
  const getInitials = () => {
    if (!profile) return 'U';
    const first = profile.nombre?.charAt(0) || '';
    const last = profile.apellido?.charAt(0) || '';
    return (first + last).toUpperCase() || 'U';
  };

  // Show minimal sidebar while loading permissions or branch config (only on first load, not background refetch)
  const isFirstLoad = (isLoading && permissions.length === 0) || (branchLoading && !branchConfig.sucursal);
  if (isFirstLoad) {
    return <Sidebar collapsible="icon" className="border-r-0">
        <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-lg">
              <Package className="h-5 w-5 text-white" />
            </div>
            {!collapsed && <div className="flex flex-col">
                <span className="text-lg font-bold text-sidebar-foreground">Geologistick</span>
                <span className="text-xs text-sidebar-foreground/60">{t('mobile.loading', 'Cargando...')}</span>
              </div>}
          </div>
        </SidebarHeader>
        <SidebarContent className="px-2 py-4">
          <div className="animate-pulse space-y-4 px-3">
            <div className="h-8 bg-sidebar-accent/50 rounded-lg" />
            <div className="h-8 bg-sidebar-accent/50 rounded-lg" />
            <div className="h-8 bg-sidebar-accent/50 rounded-lg" />
          </div>
        </SidebarContent>
      </Sidebar>;
  }
  return <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className={cn("border-b border-sidebar-border py-4 overflow-hidden", collapsed ? "px-2" : "px-4")}>
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          {(branding?.logo_dark || branding?.logo_light) ? (
            <div className={cn(
              "flex items-center justify-center rounded-lg bg-white/10 p-1.5 transition-all",
              collapsed ? "p-1" : "p-1.5"
            )}>
              <img 
                src={branding.logo_dark || branding.logo_light} 
                alt={branding.nombre_app || 'Logo'} 
                className={cn(
                  "object-contain transition-all rounded",
                  collapsed 
                    ? "h-7 w-7 max-w-[28px]"
                    : "h-9 w-auto max-w-[150px]"
                )}
              />
            </div>
          ) : (
            <>
              <img 
                src={geologistickLogo} 
                alt="Geologistick" 
                className="h-12 w-12 rounded-xl object-contain shadow-lg shrink-0"
              />
              {!collapsed && <div className="flex flex-col">
                  <span className="text-lg font-bold text-sidebar-foreground">{branding?.nombre_app || 'Geologistick'}</span>
                  <span className="text-xs text-sidebar-foreground/60">{t('mobile.logisticsManagement')}</span>
                </div>}
            </>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        {navigation.filter(canAccessGroup).map(group => {
        const accessibleItems = group.items.filter(canAccessItem);
        if (accessibleItems.length === 0) return null;
        return <SidebarGroup key={group.label}>
              {!collapsed && <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50 px-3 mb-2">
                   {t(group.label)}
                </SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {accessibleItems.map(item => {
                const isActive = location.pathname === item.url;
                return <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild>
                          <NavLink to={item.url} className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                            'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                            isActive && 'sidebar-active-indicator bg-sidebar-accent text-sidebar-primary-foreground font-semibold',
                            collapsed && 'justify-center px-0 gap-0'
                          )}>
                            <div className={cn(
                              'flex h-7 w-7 items-center justify-center rounded-md transition-all duration-200 shrink-0',
                              isActive 
                                ? 'bg-gradient-to-br from-[hsl(var(--geo-teal))] to-[hsl(var(--primary))] text-white shadow-sm' 
                                : 'text-sidebar-foreground/70'
                            )}>
                              <item.icon className="h-4 w-4" />
                            </div>
                            {!collapsed && <span>{t(item.title)}</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>;
              })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>;
      })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        {/* Collapse Toggle */}
        <Button variant="ghost" size="sm" onClick={toggleSidebar} className="w-full justify-center mb-4 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span className="ml-2">{t('mobile.closeMenu')}</span>}
        </Button>

        {/* User Info */}
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <Avatar className="h-9 w-9 border-2 border-sidebar-primary">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm font-semibold">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          {!collapsed && <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{profile?.nombre || 'Usuario'}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">{profile?.email}</p>
            </div>}
          {!collapsed && <Button variant="ghost" size="icon" onClick={handleSignOut} className="shrink-0 text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10">
              <LogOut className="h-4 w-4" />
            </Button>}
        </div>
      </SidebarFooter>
    </Sidebar>;
}