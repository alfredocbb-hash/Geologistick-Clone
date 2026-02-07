import { useAuth } from '@/lib/auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  User, Mail, Phone, MapPin, Car, LogOut, 
  ChevronRight, Shield, Bell, Moon, HelpCircle,
  Package, TrendingUp, Clock, RefreshCw
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useState } from 'react';

export function MobileProfileTab() {
  const { user, profile, signOut } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['mobile-driver-stats', user?.id],
    queryFn: async () => {
      const { data: deliveries, error } = await supabase
        .from('envios')
        .select('id, estado, distancia_km')
        .eq('chofer_id', user?.id);
      
      if (error) throw error;
      
      const totalDeliveries = deliveries?.filter(d => d.estado === 'entregado').length || 0;
      const totalKm = deliveries?.reduce((sum, d) => sum + (d.distancia_km || 0), 0) || 0;
      
      return { totalDeliveries, totalKm };
    },
    enabled: !!user?.id
  });

  // Fetch assigned vehicle
  const { data: vehiculo } = useQuery({
    queryKey: ['mobile-driver-vehicle', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehiculos')
        .select('*')
        .eq('chofer_asignado_id', user?.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id
  });

  const getInitials = () => {
    if (profile?.nombre) {
      const nombre = profile.nombre;
      const apellido = profile.apellido || '';
      return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
    }
    return user?.email?.charAt(0).toUpperCase() || 'U';
  };

  const handleLogout = async () => {
    try {
      queryClient.clear();
      await signOut();
      toast.success('Sesión cerrada');
    } catch (error) {
      console.error('Error during sign out:', error);
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const handleRefreshApp = async () => {
    setIsRefreshing(true);
    try {
      // Invalidate all cached data including permissions
      await queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
      await queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      await queryClient.invalidateQueries();
      toast.success('App actualizada', {
        description: 'Los datos y permisos se han actualizado'
      });
    } catch (error) {
      toast.error('Error al actualizar');
    } finally {
      setIsRefreshing(false);
    }
  };

  const MenuItem = ({ 
    icon: Icon, 
    label, 
    value, 
    onClick,
    danger = false 
  }: { 
    icon: any; 
    label: string; 
    value?: string; 
    onClick?: () => void;
    danger?: boolean;
  }) => (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors ${
        danger ? 'text-red-400' : 'text-white'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${danger ? 'text-red-400' : 'text-slate-400'}`} />
        <span>{label}</span>
      </div>
      {value ? (
        <span className="text-slate-400 text-sm">{value}</span>
      ) : (
        <ChevronRight className="h-5 w-5 text-slate-500" />
      )}
    </button>
  );

  return (
    <div className="space-y-6 pb-8">
      {/* Profile Header */}
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20 ring-4 ring-primary/20">
          <AvatarImage src={profile?.avatar_url || undefined} />
          <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground text-2xl font-bold">
            {getInitials()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-xl font-bold text-white">
            {profile?.nombre} {profile?.apellido}
          </h1>
          <p className="text-slate-400">{user?.email}</p>
          {profile?.telefono && (
            <p className="text-slate-400 text-sm">{profile.telefono}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-3 text-center">
            <Package className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-white">{stats?.totalDeliveries || 0}</p>
            <p className="text-xs text-slate-400">Entregas</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-3 text-center">
            <TrendingUp className="h-5 w-5 text-green-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-white">{Math.round(stats?.totalKm || 0)}</p>
            <p className="text-xs text-slate-400">Km</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-3 text-center">
            <Clock className="h-5 w-5 text-blue-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-white">4.8</p>
            <p className="text-xs text-slate-400">Rating</p>
          </CardContent>
        </Card>
      </div>

      {/* Vehicle Info */}
      {vehiculo && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Car className="h-6 w-6 text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">{vehiculo.marca} {vehiculo.modelo}</p>
                <p className="text-sm text-slate-400">
                  {vehiculo.patente} • {vehiculo.anio}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Menu Sections */}
      <Card className="bg-slate-800/30 border-slate-700 overflow-hidden">
        <MenuItem 
          icon={User} 
          label="Editar perfil" 
          onClick={() => navigate('/profile')}
        />
        <Separator className="bg-slate-700/50" />
        <MenuItem 
          icon={Bell} 
          label="Notificaciones" 
          onClick={() => {}}
        />
        <Separator className="bg-slate-700/50" />
        <MenuItem 
          icon={Shield} 
          label="Seguridad" 
          onClick={() => navigate('/profile')}
        />
      </Card>

      <Card className="bg-slate-800/30 border-slate-700 overflow-hidden">
        <MenuItem 
          icon={HelpCircle} 
          label="Ayuda y soporte" 
          onClick={() => {}}
        />
      </Card>

      <Card className="bg-slate-800/30 border-slate-700 overflow-hidden">
        <button 
          onClick={handleRefreshApp}
          disabled={isRefreshing}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors text-primary disabled:opacity-50"
        >
          <div className="flex items-center gap-3">
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Actualizar datos y permisos</span>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-500" />
        </button>
      </Card>

      <Card className="bg-slate-800/30 border-slate-700 overflow-hidden">
        <MenuItem 
          icon={LogOut} 
          label="Cerrar sesión" 
          onClick={handleLogout}
          danger
        />
      </Card>

      {/* Version */}
      <p className="text-center text-slate-500 text-xs">
        Versión 1.0.0
      </p>
    </div>
  );
}
