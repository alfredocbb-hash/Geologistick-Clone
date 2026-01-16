import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { TenantProvider } from "@/components/providers/TenantProvider";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GoogleMapsProvider } from "@/components/maps";
import { MobileAppLayout } from "@/components/mobile/MobileAppLayout";
import { MobileLoginScreen } from "@/components/mobile/MobileLoginScreen";
import { useNativePlatform } from "@/hooks/useNativePlatform";
import { Loader2 } from "lucide-react";

// Pages
import Index from "./pages/Index";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Shipments from "./pages/Shipments";
import NewShipment from "./pages/NewShipment";
import PrintLabel from "./pages/PrintLabel";
import Tracking from "./pages/Tracking";
import Clients from "./pages/Clients";
import Branches from "./pages/Branches";
import Rates from "./pages/Rates";
import Users from "./pages/Users";
import RolePermissions from "./pages/RolePermissions";
import Cash from "./pages/Cash";
import Drivers from "./pages/Drivers";
import RoutesPage from "./pages/Routes";
import MyRoutes from "./pages/MyRoutes";
import BranchSettlements from "./pages/BranchSettlements";
import DriverSettlements from "./pages/DriverSettlements";
import ClientSettlements from "./pages/ClientSettlements";
import MyCommissions from "./pages/MyCommissions";
import ScanQR from "./pages/ScanQR";
import Vehicles from "./pages/Vehicles";
import RouteSheets from "./pages/RouteSheets";
import PrintRouteSheet from "./pages/PrintRouteSheet";
import RoutePlanner from "./pages/RoutePlanner";
import LiveMap from "./pages/LiveMap";
import RouteStart from "./pages/RouteStart";
import ActiveRouteNavigation from "./pages/ActiveRouteNavigation";
import IntegrationSettings from "./pages/IntegrationSettings";
import SystemSettings from "./pages/SystemSettings";
import Payments from "./pages/Payments";
import BrandingSettings from "./pages/BrandingSettings";
import Subscription from "./pages/Subscription";
import Profile from "./pages/Profile";
import Tenants from "./pages/Tenants";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Native app wrapper - handles native platform detection and auth
function NativeAppWrapper() {
  const { isNative } = useNativePlatform();
  const { user, loading, hasRole } = useAuth();

  // Not native? Return null to show web routes
  if (!isNative) {
    return null;
  }

  // Loading auth state - show splash screen
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center">
        <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary/60 rounded-3xl flex items-center justify-center shadow-2xl shadow-primary/30 mb-6 animate-pulse">
          <Loader2 className="w-10 h-10 text-primary-foreground animate-spin" />
        </div>
        <p className="text-slate-400 text-sm">Cargando...</p>
      </div>
    );
  }

  // Not authenticated - show mobile login
  if (!user) {
    return <MobileLoginScreen />;
  }

  // Check if user has a mobile-compatible role
  const hasMobileRole = hasRole('chofer') || hasRole('operador') || hasRole('bodega') || 
                        hasRole('sucursal') || hasRole('despachador') || hasRole('admin');

  if (!hasMobileRole) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-white text-lg mb-2">Acceso no autorizado</p>
        <p className="text-slate-400 text-sm">Tu rol no tiene acceso a la aplicación móvil</p>
      </div>
    );
  }

  // Show mobile app layout
  return <MobileAppLayout />;
}

// Main app routes component
function AppRoutes() {
  const { isNative } = useNativePlatform();

  // If native platform, show mobile wrapper
  if (isNative) {
    return <NativeAppWrapper />;
  }

  // Web routes
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Login />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/tracking" element={<Tracking />} />
      
      {/* Protected Routes */}
      <Route path="/dashboard" element={<DashboardLayout><Dashboard /></DashboardLayout>} />
      
      {/* Envíos */}
      <Route path="/shipments" element={<DashboardLayout><Shipments /></DashboardLayout>} />
      <Route path="/shipments/new" element={<DashboardLayout><NewShipment /></DashboardLayout>} />
      <Route path="/print-label" element={<DashboardLayout><PrintLabel /></DashboardLayout>} />
      
      {/* Operaciones */}
      <Route path="/scan" element={<DashboardLayout><ScanQR /></DashboardLayout>} />
      <Route path="/planner" element={<DashboardLayout><RoutePlanner /></DashboardLayout>} />
      <Route path="/route-sheets" element={<DashboardLayout><RouteSheets /></DashboardLayout>} />
      <Route path="/print-route-sheet" element={<PrintRouteSheet />} />
      <Route path="/live-map" element={<DashboardLayout><LiveMap /></DashboardLayout>} />
      <Route path="/drivers" element={<DashboardLayout><Drivers /></DashboardLayout>} />
      <Route path="/vehicles" element={<DashboardLayout><Vehicles /></DashboardLayout>} />
      <Route path="/routes" element={<DashboardLayout><RoutesPage /></DashboardLayout>} />
      <Route path="/my-routes" element={<DashboardLayout><MyRoutes /></DashboardLayout>} />
      <Route path="/route-start" element={<RouteStart />} />
      <Route path="/active-route" element={<ActiveRouteNavigation />} />
      
      {/* Finanzas */}
      <Route path="/cash" element={<DashboardLayout><Cash /></DashboardLayout>} />
      <Route path="/settlements/branches" element={<DashboardLayout><BranchSettlements /></DashboardLayout>} />
      <Route path="/settlements/drivers" element={<DashboardLayout><DriverSettlements /></DashboardLayout>} />
      <Route path="/settlements/clients" element={<DashboardLayout><ClientSettlements /></DashboardLayout>} />
      <Route path="/my-commissions" element={<DashboardLayout><MyCommissions /></DashboardLayout>} />
      <Route path="/payments" element={<DashboardLayout><Payments /></DashboardLayout>} />
      
      {/* Clientes */}
      <Route path="/clients" element={<DashboardLayout><Clients /></DashboardLayout>} />
      
      {/* Administración */}
      <Route path="/admin/branches" element={<DashboardLayout><Branches /></DashboardLayout>} />
      <Route path="/admin/rates" element={<DashboardLayout><Rates /></DashboardLayout>} />
      <Route path="/admin/users" element={<DashboardLayout><Users /></DashboardLayout>} />
      <Route path="/admin/roles" element={<DashboardLayout><RolePermissions /></DashboardLayout>} />
      <Route path="/admin/settings" element={<DashboardLayout><SystemSettings /></DashboardLayout>} />
      <Route path="/admin/integrations" element={<DashboardLayout><IntegrationSettings /></DashboardLayout>} />
      <Route path="/admin/branding" element={<BrandingSettings />} />
      <Route path="/subscription" element={<DashboardLayout><Subscription /></DashboardLayout>} />
      <Route path="/admin/tenants" element={<DashboardLayout><Tenants /></DashboardLayout>} />
      
      {/* Profile */}
      <Route path="/profile" element={<DashboardLayout><Profile /></DashboardLayout>} />
      
      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <TenantProvider>
            <GoogleMapsProvider>
              <AppRoutes />
            </GoogleMapsProvider>
          </TenantProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
