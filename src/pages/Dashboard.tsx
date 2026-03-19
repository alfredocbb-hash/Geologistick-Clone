import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useTenant } from '@/hooks/useTenant';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import SendBranchNotificationDialog from '@/components/notifications/SendBranchNotificationDialog';
import DashboardStatsCards from '@/components/dashboard/DashboardStatsCards';
import DashboardWeeklyChart from '@/components/dashboard/DashboardWeeklyChart';
import DashboardRecentShipments from '@/components/dashboard/DashboardRecentShipments';
import DashboardDaySummary from '@/components/dashboard/DashboardDaySummary';
import DashboardTopDrivers from '@/components/dashboard/DashboardTopDrivers';

export default function Dashboard() {
  const { profile, roles } = useAuth();
  const { tenantId } = useTenant();
  const [notifDialogOpen, setNotifDialogOpen] = useState(false);
  const isAdmin = roles.includes('admin') || roles.includes('super_admin');

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">
            ¡Hola, {profile?.nombre || 'Usuario'}! 👋
          </h1>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setNotifDialogOpen(true)}>
              <Bell className="h-4 w-4 mr-2" />
              Enviar Notificación
            </Button>
          )}
        </div>
        <p className="text-muted-foreground">
          Aquí está el resumen de tu operación logística de hoy.
        </p>
        <div className="flex gap-2 mt-2">
          {roles.map((role) => (
            <Badge key={role} variant="outline" className="capitalize">
              {role.replace('_', ' ')}
            </Badge>
          ))}
        </div>
      </div>

      <SendBranchNotificationDialog open={notifDialogOpen} onOpenChange={setNotifDialogOpen} />

      {/* Stats Grid with trends */}
      <DashboardStatsCards tenantId={tenantId} />

      {/* Weekly Chart + Top Drivers */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DashboardWeeklyChart tenantId={tenantId} />
        </div>
        <DashboardTopDrivers tenantId={tenantId} />
      </div>

      {/* Recent Shipments + Day Summary */}
      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardRecentShipments tenantId={tenantId} />
        <DashboardDaySummary tenantId={tenantId} />
      </div>
    </div>
  );
}
