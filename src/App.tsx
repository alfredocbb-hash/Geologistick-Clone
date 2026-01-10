import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PlaceholderPage } from "@/components/PlaceholderPage";

// Pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Shipments from "./pages/Shipments";
import NewShipment from "./pages/NewShipment";
import Tracking from "./pages/Tracking";
import Clients from "./pages/Clients";
import Branches from "./pages/Branches";
import Rates from "./pages/Rates";
import Users from "./pages/Users";
import Cash from "./pages/Cash";
import NotFound from "./pages/NotFound";

// Icons for placeholders
import { Truck, MapPin, ClipboardList, DollarSign, FileText, CreditCard, Users as UsersIcon, Settings } from "lucide-react";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
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
            
            {/* Operaciones */}
            <Route path="/drivers" element={<DashboardLayout><PlaceholderPage title="Choferes Activos" description="Gestión de choferes en ruta" icon={Truck} /></DashboardLayout>} />
            <Route path="/routes" element={<DashboardLayout><PlaceholderPage title="Rutas de Entrega" description="Planificación y asignación de rutas" icon={MapPin} /></DashboardLayout>} />
            <Route path="/my-routes" element={<DashboardLayout><PlaceholderPage title="Mis Rutas" description="Rutas asignadas al chofer" icon={ClipboardList} /></DashboardLayout>} />
            
            {/* Finanzas */}
            <Route path="/cash" element={<DashboardLayout><Cash /></DashboardLayout>} />
            <Route path="/commissions" element={<DashboardLayout><PlaceholderPage title="Comisiones" description="Gestión de comisiones de choferes" icon={DollarSign} /></DashboardLayout>} />
            <Route path="/my-commissions" element={<DashboardLayout><PlaceholderPage title="Mis Comisiones" description="Comisiones del chofer" icon={DollarSign} /></DashboardLayout>} />
            <Route path="/settlements" element={<DashboardLayout><PlaceholderPage title="Liquidaciones" description="Pagos a choferes" icon={FileText} /></DashboardLayout>} />
            <Route path="/payments" element={<DashboardLayout><PlaceholderPage title="Pagos" description="Gestión de pagos de clientes" icon={CreditCard} /></DashboardLayout>} />
            
            {/* Clientes */}
            <Route path="/clients" element={<DashboardLayout><Clients /></DashboardLayout>} />
            
            {/* Administración */}
            <Route path="/admin/branches" element={<DashboardLayout><Branches /></DashboardLayout>} />
            <Route path="/admin/rates" element={<DashboardLayout><Rates /></DashboardLayout>} />
            <Route path="/admin/users" element={<DashboardLayout><Users /></DashboardLayout>} />
            <Route path="/admin/settings" element={<DashboardLayout><PlaceholderPage title="Configuración" description="Ajustes del sistema" icon={Settings} /></DashboardLayout>} />
            
            {/* Profile */}
            <Route path="/profile" element={<DashboardLayout><PlaceholderPage title="Mi Perfil" description="Información personal" icon={Users} /></DashboardLayout>} />
            
            {/* Redirect root to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
