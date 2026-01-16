import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { TenantProvider } from "@/components/providers/TenantProvider";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { GoogleMapsProvider } from "@/components/maps";
import { MobileAppLayout } from "@/components/mobile/MobileAppLayout";
import { useNativePlatform } from "@/hooks/useNativePlatform";

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

// Icons for placeholders
import { Users as UsersIcon } from "lucide-react";

const queryClient = new QueryClient();

// Mobile driver app wrapper
function MobileDriverWrapper() {
  const { isNative } = useNativePlatform();
  const { userRole } = useAuth();
  
  // Show mobile layout for native drivers
  if (isNative && userRole === 'chofer') {
    return <MobileAppLayout />;
  }
  
  return null;
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
              <Routes>
              {/* Mobile Driver App - Native only */}
              <Route path="/driver/*" element={<MobileAppLayout />} />
              
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
            </GoogleMapsProvider>
          </TenantProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
