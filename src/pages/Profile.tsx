import { useState, useEffect } from 'react';
import { useAuth, Profile as ProfileType } from '@/lib/auth';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { PersonalInfoCard } from '@/components/profile/PersonalInfoCard';
import { SecurityCard } from '@/components/profile/SecurityCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Package, TrendingUp, Route, Sun, Moon, Monitor } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export default function Profile() {
  const { profile, roles, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url || null);
  const [localProfile, setLocalProfile] = useState<ProfileType | null>(profile);

  useEffect(() => {
    if (profile) {
      setLocalProfile(profile);
      setAvatarUrl(profile.avatar_url || null);
    }
  }, [profile]);

  // Fetch assigned branch name
  const { data: sucursal } = useQuery({
    queryKey: ['sucursal', profile?.sucursal_id],
    queryFn: async () => {
      if (!profile?.sucursal_id) return null;
      const { data, error } = await supabase
        .from('sucursales')
        .select('nombre')
        .eq('id', profile.sucursal_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.sucursal_id,
  });

  // Fetch driver stats if user is a driver
  const isDriver = roles.includes('chofer');
  const { data: driverStats, isLoading: statsLoading } = useQuery({
    queryKey: ['driver-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Get delivered shipments count
      const { count: deliveredCount } = await supabase
        .from('envios')
        .select('*', { count: 'exact', head: true })
        .eq('chofer_id', user.id)
        .eq('estado', 'entregado');

      // Get total commissions
      const { data: commissions } = await supabase
        .from('comisiones')
        .select('monto')
        .eq('chofer_id', user.id);

      const totalCommissions = commissions?.reduce((sum, c) => sum + (c.monto || 0), 0) || 0;

      // Get completed routes
      const { count: routesCount } = await supabase
        .from('rutas_planificadas')
        .select('*', { count: 'exact', head: true })
        .eq('chofer_id', user.id)
        .eq('estado', 'completada');

      return {
        deliveredCount: deliveredCount || 0,
        totalCommissions,
        routesCount: routesCount || 0,
      };
    },
    enabled: isDriver && !!user?.id,
  });

  const handleAvatarUpdate = (url: string) => {
    setAvatarUrl(url || null);
  };

  const handleProfileUpdate = (updates: Partial<ProfileType>) => {
    if (localProfile) {
      setLocalProfile({ ...localProfile, ...updates });
    }
  };

  if (!localProfile) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold">Mi Perfil</h1>
        <p className="text-muted-foreground">Gestiona tu información personal y seguridad</p>
      </div>

      {/* Profile Header */}
      <ProfileHeader
        profile={localProfile}
        roles={roles}
        avatarUrl={avatarUrl}
        onAvatarUpdate={handleAvatarUpdate}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Personal Info */}
        <PersonalInfoCard
          profile={localProfile}
          sucursalName={sucursal?.nombre}
          onProfileUpdate={handleProfileUpdate}
        />

        {/* Security */}
        <SecurityCard />

        {/* Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Preferencias</CardTitle>
            <CardDescription>Configura tu experiencia de usuario</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tema de la Interfaz</Label>
              <ToggleGroup 
                type="single" 
                value={theme} 
                onValueChange={(value) => value && setTheme(value)}
                className="justify-start"
              >
                <ToggleGroupItem value="light" aria-label="Modo claro">
                  <Sun className="h-4 w-4 mr-2" />
                  Claro
                </ToggleGroupItem>
                <ToggleGroupItem value="dark" aria-label="Modo oscuro">
                  <Moon className="h-4 w-4 mr-2" />
                  Oscuro
                </ToggleGroupItem>
                <ToggleGroupItem value="system" aria-label="Sistema">
                  <Monitor className="h-4 w-4 mr-2" />
                  Sistema
                </ToggleGroupItem>
              </ToggleGroup>
              <p className="text-xs text-muted-foreground">
                Elige entre modo claro, oscuro o usa la configuración de tu sistema
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Driver Stats */}
      {isDriver && (
        <Card>
          <CardHeader>
            <CardTitle>Mis Estadísticas</CardTitle>
            <CardDescription>Tu rendimiento como chofer</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="grid gap-4 md:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-shipments/10 to-shipments/5 rounded-lg border border-shipments/20">
                  <div className="p-3 bg-shipments/20 rounded-full">
                    <Package className="h-6 w-6 text-shipments" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{driverStats?.deliveredCount || 0}</p>
                    <p className="text-sm text-muted-foreground">Entregas realizadas</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-commissions/10 to-commissions/5 rounded-lg border border-commissions/20">
                  <div className="p-3 bg-commissions/20 rounded-full">
                    <TrendingUp className="h-6 w-6 text-commissions" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      ${driverStats?.totalCommissions.toLocaleString('es-AR') || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Comisiones totales</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-routes/10 to-routes/5 rounded-lg border border-routes/20">
                  <div className="p-3 bg-routes/20 rounded-full">
                    <Route className="h-6 w-6 text-routes" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{driverStats?.routesCount || 0}</p>
                    <p className="text-sm text-muted-foreground">Rutas completadas</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
