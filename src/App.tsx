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
import { ThemeProvider } from "next-themes";

// Pages
import Index from "./pages/Index";
import Login from "./pages/Login";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Cookies from "./pages/Cookies";
import Support from "./pages/Support";
import TiendanubeConfig from "./pages/TiendanubeConfig";
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
import ThirdPartySettlements from "./pages/ThirdPartySettlements";
import ThirdPartyCompanies from "./pages/ThirdPartyCompanies";
import MyCommissions from "./pages/MyCommissions";
import ScanQR from "./pages/ScanQR";
import Vehicles from "./pages/Vehicles";
import RouteSheets from "./pages/RouteSheets";
import PrintRouteSheet from "./pages/PrintRouteSheet";
import PrintReceipt from "./pages/PrintReceipt";
import PrintPlannedRoute from "./pages/PrintPlannedRoute";
import RoutePlanner from "./pages/RoutePlanner";
import LiveMap from "./pages/LiveMap";
import RouteStart from "./pages/RouteStart";
import ActiveRouteNavigation from "./pages/ActiveRouteNavigation";
import IntegrationSettings from "./pages/IntegrationSettings";
import SystemSettings from "./pages/SystemSettings";
import Payments from "./pages/Payments";
import BrandingSettings from "./pages/BrandingSettings";
import Subscription from "./pages/Subscription";
import SubscriptionPlansAdmin from "./pages/SubscriptionPlansAdmin";
import Profile from "./pages/Profile";
import Tenants from "./pages/Tenants";
import TrackingEmbed from "./pages/TrackingEmbed";
import ShipmentStatusGuide from "./pages/ShipmentStatusGuide";
import LandingContentAdmin from "./pages/LandingContentAdmin";
import TrialRequests from "./pages/TrialRequests";
import NotFound from "./pages/NotFound";
import Reports from "./pages/Reports";
import Incidents from "./pages/Incidents";
import Partners from "./pages/Partners";
import PrintInvoice from "./pages/PrintInvoice";
import PrintSettlement from "./pages/PrintSettlement";
import TiendanubeOAuthResult from "./pages/TiendanubeOAuthResult";
import TiendanubeDocsPublic from "./pages/TiendanubeDocsPublic";
import MercadoLibreOAuthResult from "./pages/MercadoLibreOAuthResult";

// Seller Portal Pages
import { SellerLayout } from "./components/seller/SellerLayout";
import SellerDashboard from "./pages/seller/SellerDashboard";
import SellerOrders from "./pages/seller/SellerOrders";
import SellerShipments from "./pages/seller/SellerShipments";
import SellerAccount from "./pages/seller/SellerAccount";

// e-Commerce Pages
import EcommerceDashboard from "./pages/ecommerce/Dashboard";
import EcommerceSellers from "./pages/ecommerce/Sellers";
import EcommerceOrders from "./pages/ecommerce/Orders";
import EcommerceSettlements from "./pages/ecommerce/Settlements";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos: datos frescos por más tiempo
      gcTime: 10 * 60 * 1000,   // 10 minutos: mantener en caché
      refetchOnWindowFocus: false, // NO refetch al volver a la ventana
      refetchOnReconnect: true,   // SÍ refetch al reconectar internet
      retry: 1, // Reintentar solo 1 vez en error
    },
  },
});

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

  // Show mobile app layout with internal routes for navigation
  return (
    <Routes>
      <Route path="/route-start" element={<RouteStart />} />
      <Route path="/active-route" element={<ActiveRouteNavigation />} />
      <Route path="*" element={<MobileAppLayout />} />
    </Routes>
  );
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
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/cookies" element={<Cookies />} />
      <Route path="/support" element={<Support />} />
      <Route path="/tiendanube/config" element={<TiendanubeConfig />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/tracking/:code" element={<Tracking />} />
      <Route path="/tracking" element={<Tracking />} />
      <Route path="/tracking-embed" element={<TrackingEmbed />} />
      <Route path="/oauth/tiendanube/result" element={<TiendanubeOAuthResult />} />
      <Route path="/oauth/mercadolibre/result" element={<MercadoLibreOAuthResult />} />
      <Route path="/docs/tiendanube" element={<TiendanubeDocsPublic />} />
      {/* Protected Routes */}
      <Route path="/dashboard" element={<DashboardLayout><Dashboard /></DashboardLayout>} />
      <Route path="/reports" element={<DashboardLayout><Reports /></DashboardLayout>} />
      
      {/* Envíos */}
      <Route path="/shipments" element={<DashboardLayout><Shipments /></DashboardLayout>} />
      <Route path="/shipments/new" element={<DashboardLayout><NewShipment /></DashboardLayout>} />
      <Route path="/print-label" element={<PrintLabel />} />
      <Route path="/print-receipt" element={<PrintReceipt />} />
      <Route path="/print-invoice" element={<PrintInvoice />} />
      <Route path="/print-settlement" element={<PrintSettlement />} />
      
      {/* Operaciones */}
      <Route path="/scan" element={<DashboardLayout><ScanQR /></DashboardLayout>} />
      <Route path="/planner" element={<DashboardLayout><RoutePlanner /></DashboardLayout>} />
      <Route path="/route-sheets" element={<DashboardLayout><RouteSheets /></DashboardLayout>} />
      <Route path="/print-route-sheet" element={<PrintRouteSheet />} />
      <Route path="/print/planned-route" element={<PrintPlannedRoute />} />
      <Route path="/live-map" element={<DashboardLayout><LiveMap /></DashboardLayout>} />
      <Route path="/incidents" element={<DashboardLayout><Incidents /></DashboardLayout>} />
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
      <Route path="/settlements/third-party" element={<DashboardLayout><ThirdPartySettlements /></DashboardLayout>} />
      <Route path="/my-commissions" element={<DashboardLayout><MyCommissions /></DashboardLayout>} />
      <Route path="/payments" element={<DashboardLayout><Payments /></DashboardLayout>} />
      
      {/* Terciarizados */}
      <Route path="/admin/third-party-companies" element={<DashboardLayout><ThirdPartyCompanies /></DashboardLayout>} />
      
      {/* Clientes */}
      <Route path="/clients" element={<DashboardLayout><Clients /></DashboardLayout>} />
      
      {/* e-Commerce */}
      <Route path="/ecommerce/dashboard" element={<DashboardLayout><EcommerceDashboard /></DashboardLayout>} />
      <Route path="/ecommerce/sellers" element={<DashboardLayout><EcommerceSellers /></DashboardLayout>} />
      <Route path="/ecommerce/orders" element={<DashboardLayout><EcommerceOrders /></DashboardLayout>} />
      <Route path="/ecommerce/settlements" element={<DashboardLayout><EcommerceSettlements /></DashboardLayout>} />
      
      {/* Administración */}
      <Route path="/admin/branches" element={<DashboardLayout><Branches /></DashboardLayout>} />
      <Route path="/admin/rates" element={<DashboardLayout><Rates /></DashboardLayout>} />
      <Route path="/admin/users" element={<DashboardLayout><Users /></DashboardLayout>} />
      <Route path="/admin/roles" element={<DashboardLayout><RolePermissions /></DashboardLayout>} />
      <Route path="/admin/settings" element={<DashboardLayout><SystemSettings /></DashboardLayout>} />
      <Route path="/admin/integrations" element={<DashboardLayout><IntegrationSettings /></DashboardLayout>} />
      <Route path="/admin/branding" element={<BrandingSettings />} />
      <Route path="/subscription" element={<DashboardLayout><Subscription /></DashboardLayout>} />
      <Route path="/admin/plans" element={<DashboardLayout><SubscriptionPlansAdmin /></DashboardLayout>} />
      <Route path="/admin/tenants" element={<DashboardLayout><Tenants /></DashboardLayout>} />
      <Route path="/admin/landing" element={<LandingContentAdmin />} />
      <Route path="/admin/trial-requests" element={<TrialRequests />} />
      <Route path="/admin/status-guide" element={<DashboardLayout><ShipmentStatusGuide /></DashboardLayout>} />
      <Route path="/admin/partners" element={<DashboardLayout><Partners /></DashboardLayout>} />
      
      {/* Profile */}
      <Route path="/profile" element={<DashboardLayout><Profile /></DashboardLayout>} />
      
      {/* Seller Portal */}
      <Route path="/seller" element={<SellerLayout />}>
        <Route index element={<SellerDashboard />} />
        <Route path="orders" element={<SellerOrders />} />
        <Route path="shipments" element={<SellerShipments />} />
        <Route path="account" element={<SellerAccount />} />
      </Route>
      
      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
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
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
