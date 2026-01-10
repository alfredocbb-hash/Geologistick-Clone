import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { GoogleMapsProvider } from "@/components/maps";

// Pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Shipments from "./pages/Shipments";
import NewShipment from "./pages/NewShipment";
import PrintLabel from "./pages/PrintLabel";
import Tracking from "./pages/Tracking";
import Clients from "./pages/Clients";
import Branches from "./pages/Branches";
import Rates from "./pages/Rates";
import Users from "./pages/Users";
import Cash from "./pages/Cash";
import Drivers from "./pages/Drivers";
import RoutesPage from "./pages/Routes";
import MyRoutes from "./pages/MyRoutes";
import BranchSettlements from "./pages/BranchSettlements";
import DriverSettlements from "./pages/DriverSettlements";
import ClientSettlements from "./pages/ClientSettlements";
import MyCommissions from "./pages/MyCommissions";
import NotFound from "./pages/NotFound";

// Icons for placeholders
import { CreditCard, Users as UsersIcon, Settings } from "lucide-react";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <GoogleMapsProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/tracking" element={<Tracking />} />
            
            {/* Protected Routes */}
            <Route path="/dashboard" element={<DashboardLayout><Dashboard /></DashboardLayout>} />
            
            {/* Envíos */}
            <Route path="/shipments" element={<DashboardLayout><Shipments /></DashboardLayout>} />
            <Route path="/shipments/new" element={<DashboardLayout><NewShipment /></DashboardLayout>} />
            <Route path="/print-label" element={<DashboardLayout><PrintLabel /></DashboardLayout>} />
            
            {/* Operaciones */}
            <Route path="/drivers" element={<DashboardLayout><Drivers /></DashboardLayout>} />
            <Route path="/routes" element={<DashboardLayout><RoutesPage /></DashboardLayout>} />
            <Route path="/my-routes" element={<DashboardLayout><MyRoutes /></DashboardLayout>} />
            
            {/* Finanzas */}
            <Route path="/cash" element={<DashboardLayout><Cash /></DashboardLayout>} />
            <Route path="/settlements/branches" element={<DashboardLayout><BranchSettlements /></DashboardLayout>} />
            <Route path="/settlements/drivers" element={<DashboardLayout><DriverSettlements /></DashboardLayout>} />
            <Route path="/settlements/clients" element={<DashboardLayout><ClientSettlements /></DashboardLayout>} />
            <Route path="/my-commissions" element={<DashboardLayout><MyCommissions /></DashboardLayout>} />
            <Route path="/payments" element={<DashboardLayout><PlaceholderPage title="Pagos" description="Gestión de pagos de clientes" icon={CreditCard} /></DashboardLayout>} />
            
            {/* Clientes */}
            <Route path="/clients" element={<DashboardLayout><Clients /></DashboardLayout>} />
            
            {/* Administración */}
            <Route path="/admin/branches" element={<DashboardLayout><Branches /></DashboardLayout>} />
            <Route path="/admin/rates" element={<DashboardLayout><Rates /></DashboardLayout>} />
            <Route path="/admin/users" element={<DashboardLayout><Users /></DashboardLayout>} />
            <Route path="/admin/settings" element={<DashboardLayout><PlaceholderPage title="Configuración" description="Ajustes del sistema" icon={Settings} /></DashboardLayout>} />
            
            {/* Profile */}
            <Route path="/profile" element={<DashboardLayout><PlaceholderPage title="Mi Perfil" description="Información personal" icon={UsersIcon} /></DashboardLayout>} />
            
            {/* Redirect root to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </GoogleMapsProvider>
  </QueryClientProvider>
);

export default App;
