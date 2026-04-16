import React, { lazy, Suspense, useEffect } from "react";
import '@/i18n';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { TenantProvider } from "@/components/providers/TenantProvider";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GoogleMapsProvider } from "@/components/maps/GoogleMapsProvider";
import { MobileAppLayout } from "@/components/mobile/MobileAppLayout";
import { MobileLoginScreen } from "@/components/mobile/MobileLoginScreen";
import { useNativePlatform } from "@/hooks/useNativePlatform";
import { Loader2 } from "lucide-react";
import { ThemeProvider } from "next-themes";
import { ChunkErrorBoundary } from "@/components/ChunkErrorBoundary";

// Eagerly loaded pages (common entry points)
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// Lazy loaded pages
const Index = lazy(() => import("./pages/Index"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Cookies = lazy(() => import("./pages/Cookies"));
const Support = lazy(() => import("./pages/Support"));
const TiendanubeConfig = lazy(() => import("./pages/TiendanubeConfig"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Shipments = lazy(() => import("./pages/Shipments"));
const NewShipment = lazy(() => import("./pages/NewShipment"));
const PrintLabel = lazy(() => import("./pages/PrintLabel"));
const Tracking = lazy(() => import("./pages/Tracking"));
const Clients = lazy(() => import("./pages/Clients"));
const Branches = lazy(() => import("./pages/Branches"));
const Rates = lazy(() => import("./pages/Rates"));
const Users = lazy(() => import("./pages/Users"));
const RolePermissions = lazy(() => import("./pages/RolePermissions"));
const Cash = lazy(() => import("./pages/Cash"));
const Drivers = lazy(() => import("./pages/Drivers"));
const RoutesPage = lazy(() => import("./pages/Routes"));
const MyRoutes = lazy(() => import("./pages/MyRoutes"));
const BranchSettlements = lazy(() => import("./pages/BranchSettlements"));
const DriverSettlements = lazy(() => import("./pages/DriverSettlements"));
const ClientSettlements = lazy(() => import("./pages/ClientSettlements"));
const ThirdPartySettlements = lazy(() => import("./pages/ThirdPartySettlements"));
const ThirdPartyCompanies = lazy(() => import("./pages/ThirdPartyCompanies"));
const MyCommissions = lazy(() => import("./pages/MyCommissions"));
const ScanQR = lazy(() => import("./pages/ScanQR"));
const Vehicles = lazy(() => import("./pages/Vehicles"));
const RouteSheets = lazy(() => import("./pages/RouteSheets"));
const PrintRouteSheet = lazy(() => import("./pages/PrintRouteSheet"));
const PrintReceipt = lazy(() => import("./pages/PrintReceipt"));
const PrintPlannedRoute = lazy(() => import("./pages/PrintPlannedRoute"));
const RoutePlanner = lazy(() => import("./pages/RoutePlanner"));
const LiveMap = lazy(() => import("./pages/LiveMap"));
const RouteStart = lazy(() => import("./pages/RouteStart"));
const ActiveRouteNavigation = lazy(() => import("./pages/ActiveRouteNavigation"));
const IntegrationSettings = lazy(() => import("./pages/IntegrationSettings"));
const SystemSettings = lazy(() => import("./pages/SystemSettings"));
const Payments = lazy(() => import("./pages/Payments"));
const BrandingSettings = lazy(() => import("./pages/BrandingSettings"));
const Subscription = lazy(() => import("./pages/Subscription"));
const SubscriptionPlansAdmin = lazy(() => import("./pages/SubscriptionPlansAdmin"));
const Profile = lazy(() => import("./pages/Profile"));
const Tenants = lazy(() => import("./pages/Tenants"));
const TrackingEmbed = lazy(() => import("./pages/TrackingEmbed"));
const ShipmentStatusGuide = lazy(() => import("./pages/ShipmentStatusGuide"));
const LandingContentAdmin = lazy(() => import("./pages/LandingContentAdmin"));
const TrialRequests = lazy(() => import("./pages/TrialRequests"));
const Reports = lazy(() => import("./pages/Reports"));
const Incidents = lazy(() => import("./pages/Incidents"));
const Partners = lazy(() => import("./pages/Partners"));
const PrintInvoice = lazy(() => import("./pages/PrintInvoice"));
const PrintSettlement = lazy(() => import("./pages/PrintSettlement"));
const MarketingAssets = lazy(() => import("./pages/MarketingAssets"));
const UserActivityAdmin = lazy(() => import("./pages/UserActivityAdmin"));
const TenantApiDocs = lazy(() => import("./pages/TenantApiDocs"));
const TiendanubeOAuthResult = lazy(() => import("./pages/TiendanubeOAuthResult"));
const TiendanubeDocsPublic = lazy(() => import("./pages/TiendanubeDocsPublic"));
const MercadoLibreOAuthResult = lazy(() => import("./pages/MercadoLibreOAuthResult"));
const Facturacion = lazy(() => import("./pages/Facturacion"));
const GastosPage = lazy(() => import("./pages/Gastos"));
const FiscalDashboard = lazy(() => import("./pages/FiscalDashboard"));

// Seller Portal Pages
const SellerLayout = lazy(() => import("./components/seller/SellerLayout").then(m => ({ default: m.SellerLayout })));
const SellerDashboard = lazy(() => import("./pages/seller/SellerDashboard"));
const SellerOrders = lazy(() => import("./pages/seller/SellerOrders"));
const SellerShipments = lazy(() => import("./pages/seller/SellerShipments"));
const SellerAccount = lazy(() => import("./pages/seller/SellerAccount"));

// e-Commerce Pages
const EcommerceDashboard = lazy(() => import("./pages/ecommerce/Dashboard"));
const EcommerceSellers = lazy(() => import("./pages/ecommerce/Sellers"));
const EcommerceOrders = lazy(() => import("./pages/ecommerce/Orders"));
const EcommerceSettlements = lazy(() => import("./pages/ecommerce/Settlements"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

// Page loading fallback
function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    </div>
  );
}

// Native app wrapper - handles native platform detection and auth
function NativeAppWrapper() {
  const { isNative } = useNativePlatform();
  const { user, loading, hasRole } = useAuth();

  if (!isNative) {
    return null;
  }

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

  if (!user) {
    return <MobileLoginScreen />;
  }

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

  return (
    <GoogleMapsProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/route-start" element={<RouteStart />} />
          <Route path="/active-route" element={<ActiveRouteNavigation />} />
          <Route path="/route-planner" element={<RoutePlanner />} />
          <Route path="*" element={<MobileAppLayout />} />
        </Routes>
      </Suspense>
    </GoogleMapsProvider>
  );
}

// Main app routes component
function AppRoutes() {
  const { isNative } = useNativePlatform();

  if (isNative) {
    return <NativeAppWrapper />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
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
        <Route path="/tracking/:code" element={<Tracking />} />
        <Route path="/tracking" element={<Tracking />} />
        <Route path="/tracking-embed" element={<TrackingEmbed />} />
        <Route path="/oauth/tiendanube/result" element={<TiendanubeOAuthResult />} />
        <Route path="/oauth/mercadolibre/result" element={<MercadoLibreOAuthResult />} />
        <Route path="/docs/tiendanube" element={<TiendanubeDocsPublic />} />

        {/* Print pages (no layout) */}
        <Route path="/print-label" element={<PrintLabel />} />
        <Route path="/print-receipt" element={<PrintReceipt />} />
        <Route path="/print-invoice" element={<PrintInvoice />} />
        <Route path="/print-settlement" element={<PrintSettlement />} />
        <Route path="/print-route-sheet" element={<PrintRouteSheet />} />
        <Route path="/print/planned-route" element={<PrintPlannedRoute />} />

        {/* Standalone pages (no dashboard layout) */}
        <Route path="/route-start" element={<RouteStart />} />
        <Route path="/active-route" element={<ActiveRouteNavigation />} />

        {/* Protected Routes with shared DashboardLayout */}
        <Route element={<DashboardLayout />}>
          {/* Dashboard */}
          <Route path="/dashboard" element={<GoogleMapsProvider><Dashboard /></GoogleMapsProvider>} />
          <Route path="/reports" element={<Reports />} />

          {/* Envíos */}
          <Route path="/shipments" element={<Shipments />} />
          <Route path="/shipments/new" element={<GoogleMapsProvider><NewShipment /></GoogleMapsProvider>} />

          {/* Operaciones */}
          <Route path="/scan" element={<ScanQR />} />
          <Route path="/planner" element={<GoogleMapsProvider><RoutePlanner /></GoogleMapsProvider>} />
          <Route path="/route-sheets" element={<RouteSheets />} />
          <Route path="/live-map" element={<GoogleMapsProvider><LiveMap /></GoogleMapsProvider>} />
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/drivers" element={<Drivers />} />
          <Route path="/vehicles" element={<Vehicles />} />
          <Route path="/routes" element={<RoutesPage />} />
          <Route path="/my-routes" element={<MyRoutes />} />

          {/* Finanzas */}
          <Route path="/cash" element={<Cash />} />
          <Route path="/settlements/branches" element={<BranchSettlements />} />
          <Route path="/settlements/drivers" element={<DriverSettlements />} />
          <Route path="/settlements/clients" element={<ClientSettlements />} />
          <Route path="/settlements/third-party" element={<ThirdPartySettlements />} />
          <Route path="/my-commissions" element={<MyCommissions />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/facturacion" element={<Facturacion />} />
          <Route path="/gastos" element={<GastosPage />} />
          <Route path="/fiscal" element={<FiscalDashboard />} />

          {/* Terciarizados */}
          <Route path="/admin/third-party-companies" element={<ThirdPartyCompanies />} />

          {/* Clientes */}
          <Route path="/clients" element={<Clients />} />

          {/* e-Commerce */}
          <Route path="/ecommerce/dashboard" element={<EcommerceDashboard />} />
          <Route path="/ecommerce/sellers" element={<EcommerceSellers />} />
          <Route path="/ecommerce/orders" element={<EcommerceOrders />} />
          <Route path="/ecommerce/settlements" element={<EcommerceSettlements />} />

          {/* Administración */}
          <Route path="/admin/branches" element={<GoogleMapsProvider><Branches /></GoogleMapsProvider>} />
          <Route path="/admin/rates" element={<Rates />} />
          <Route path="/admin/users" element={<Users />} />
          <Route path="/admin/roles" element={<RolePermissions />} />
          <Route path="/admin/settings" element={<SystemSettings />} />
          <Route path="/admin/integrations" element={<IntegrationSettings />} />
          <Route path="/subscription" element={<Subscription />} />
          <Route path="/admin/plans" element={<SubscriptionPlansAdmin />} />
          <Route path="/admin/tenants" element={<Tenants />} />
          <Route path="/admin/status-guide" element={<ShipmentStatusGuide />} />
          <Route path="/admin/partners" element={<Partners />} />
          <Route path="/marketing-assets" element={<MarketingAssets />} />
          <Route path="/admin/api-docs" element={<TenantApiDocs />} />
          <Route path="/admin/activity" element={<UserActivityAdmin />} />

          {/* Profile */}
          <Route path="/profile" element={<Profile />} />
        </Route>

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
    </Suspense>
  );
}

// Global handler to prevent unhandled promise rejections from freezing the app
function GlobalErrorBoundary({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('[GlobalErrorBoundary] Unhandled promise rejection:', event.reason);
      event.preventDefault();
      import('@/lib/errorLogger').then(({ logError }) => {
        const err = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
        logError(err, 'GlobalErrorBoundary:unhandledrejection');
      });
    };
    const handleError = (event: ErrorEvent) => {
      import('@/lib/errorLogger').then(({ logError }) => {
        logError(event.error || new Error(event.message), 'GlobalErrorBoundary:onerror');
      });
    };
    window.addEventListener('unhandledrejection', handleRejection);
    window.addEventListener('error', handleError);
    return () => {
      window.removeEventListener('unhandledrejection', handleRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem themes={['light', 'dark', 'midnight', 'logistics-blue', 'system']}>
      <GlobalErrorBoundary>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <TenantProvider>
                <ChunkErrorBoundary>
                  <AppRoutes />
                </ChunkErrorBoundary>
              </TenantProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </GlobalErrorBoundary>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
