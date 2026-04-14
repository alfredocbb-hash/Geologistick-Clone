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
import DashboardMiniMap from '@/components/dashboard/DashboardMiniMap';
import { useTranslation } from 'react-i18next';

export default function Dashboard() {
  const { profile, roles } = useAuth();
  const { tenantId } = useTenant();
  const [notifDialogOpen, setNotifDialogOpen] = useState(false);
  const isAdmin = roles.includes('admin') || roles.includes('super_admin');
  const { t } = useTranslation('dashboard');

  return (
    <div className="space-y-8">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-[hsl(var(--primary)/0.05)] to-[hsl(var(--accent)/0.05)] blur-3xl -z-10 pointer-events-none" />

      <div className="flex flex-col gap-2 animate-slide-up">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight gradient-text">
            {t('greeting', { name: profile?.nombre || 'Usuario' })} 👋
          </h1>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setNotifDialogOpen(true)} className="glow-hover">
              <Bell className="h-4 w-4 mr-2" />
              {t('sendNotification')}
            </Button>
          )}
        </div>
        <p className="text-muted-foreground">
          {t('summary')}
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
      <DashboardStatsCards tenantId={tenantId} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DashboardWeeklyChart tenantId={tenantId} />
        </div>
        <DashboardTopDrivers tenantId={tenantId} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <DashboardRecentShipments tenantId={tenantId} />
        <DashboardDaySummary tenantId={tenantId} />
        <DashboardMiniMap tenantId={tenantId} />
      </div>
    </div>
  );
}
