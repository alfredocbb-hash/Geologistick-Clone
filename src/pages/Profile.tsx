import { useState, useEffect } from 'react';
import { useAuth, Profile as ProfileType } from '@/lib/auth';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { PersonalInfoCard } from '@/components/profile/PersonalInfoCard';
import { SecurityCard } from '@/components/profile/SecurityCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Package, TrendingUp, Route, Sun, Moon, Monitor, Star, Ship } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '@/components/i18n/LanguageSelector';

export default function Profile() {
  const { profile, roles, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation('auth');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url || null);
  const [localProfile, setLocalProfile] = useState<ProfileType | null>(profile);

  useEffect(() => {
    if (profile) {
      setLocalProfile(profile);
      setAvatarUrl(profile.avatar_url || null);
    }
  }, [profile]);

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

  const isDriver = roles.includes('chofer');
  const { data: driverStats, isLoading: statsLoading } = useQuery({
    queryKey: ['driver-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { count: deliveredCount } = await supabase
        .from('envios')
        .select('*', { count: 'exact', head: true })
        .eq('chofer_id', user.id)
        .eq('estado', 'entregado');
      const { data: commissions } = await supabase
        .from('comisiones')
        .select('monto')
        .eq('chofer_id', user.id);
      const totalCommissions = commissions?.reduce((sum, c) => sum + (c.monto || 0), 0) || 0;
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

  const handleAvatarUpdate = (url: string) => setAvatarUrl(url || null);
  const handleProfileUpdate = (updates: Partial<ProfileType>) => {
    if (localProfile) setLocalProfile({ ...localProfile, ...updates });
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
      <div>
        <h1 className="text-2xl font-bold">{t('profile.title')}</h1>
        <p className="text-muted-foreground">{t('profile.subtitle')}</p>
      </div>

      <ProfileHeader
        profile={localProfile}
        roles={roles}
        avatarUrl={avatarUrl}
        onAvatarUpdate={handleAvatarUpdate}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <PersonalInfoCard
          profile={localProfile}
          sucursalName={sucursal?.nombre}
          onProfileUpdate={handleProfileUpdate}
        />
        <SecurityCard />

        {/* Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>{t('profile.preferences')}</CardTitle>
            <CardDescription>{t('profile.preferencesDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Theme */}
            <div className="space-y-2">
              <Label>{t('profile.theme')}</Label>
              <ToggleGroup 
                type="single" 
                value={theme} 
                onValueChange={(value) => value && setTheme(value)}
                className="justify-start flex-wrap"
              >
                <ToggleGroupItem value="light" aria-label={t('profile.themeLight')}>
                  <Sun className="h-4 w-4 mr-2" />
                  {t('profile.themeLight')}
                </ToggleGroupItem>
                <ToggleGroupItem value="dark" aria-label={t('profile.themeDark')}>
                  <Moon className="h-4 w-4 mr-2" />
                  {t('profile.themeDark')}
                </ToggleGroupItem>
                <ToggleGroupItem value="system" aria-label={t('profile.themeSystem')}>
                  <Monitor className="h-4 w-4 mr-2" />
                  {t('profile.themeSystem')}
                </ToggleGroupItem>
              </ToggleGroup>
              <p className="text-xs text-muted-foreground">{t('profile.themeDescription')}</p>
            </div>

            {/* Language */}
            <div className="space-y-2">
              <Label>{t('profile.language')}</Label>
              <div>
                <LanguageSelector persist variant="outline" />
              </div>
              <p className="text-xs text-muted-foreground">{t('profile.languageDescription')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Driver Stats */}
      {isDriver && (
        <Card>
          <CardHeader>
            <CardTitle>{t('profile.stats')}</CardTitle>
            <CardDescription>{t('profile.statsDescription')}</CardDescription>
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
                    <p className="text-sm text-muted-foreground">{t('profile.deliveries')}</p>
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
                    <p className="text-sm text-muted-foreground">{t('profile.commissions')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-routes/10 to-routes/5 rounded-lg border border-routes/20">
                  <div className="p-3 bg-routes/20 rounded-full">
                    <Route className="h-6 w-6 text-routes" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{driverStats?.routesCount || 0}</p>
                    <p className="text-sm text-muted-foreground">{t('profile.completedRoutes')}</p>
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
