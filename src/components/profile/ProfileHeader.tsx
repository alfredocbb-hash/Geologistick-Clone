import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { AvatarUploader } from './AvatarUploader';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, Building2, Mail } from 'lucide-react';
import type { Profile } from '@/lib/auth';

interface ProfileHeaderProps {
  profile: Profile;
  roles: string[];
  avatarUrl: string | null;
  onAvatarUpdate: (url: string) => void;
}

export function ProfileHeader({ profile, roles, avatarUrl, onAvatarUpdate }: ProfileHeaderProps) {
  const getInitials = () => {
    const first = profile.nombre?.charAt(0) || '';
    const last = profile.apellido?.charAt(0) || '';
    return (first + last).toUpperCase() || 'U';
  };

  const getRoleBadgeVariant = (role: string) => {
    const variants: Record<string, string> = {
      admin: 'bg-admin text-white',
      super_admin: 'bg-destructive text-white',
      chofer: 'bg-drivers text-white',
      operador: 'bg-shipments text-white',
      supervisor: 'bg-accent text-white',
      sucursal: 'bg-warning text-white',
      cliente: 'bg-info text-white',
    };
    return variants[role] || 'bg-muted text-muted-foreground';
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Administrador',
      super_admin: 'Super Admin',
      chofer: 'Chofer',
      operador: 'Operador',
      supervisor: 'Supervisor',
      sucursal: 'Sucursal',
      cliente: 'Cliente',
      bodega: 'Bodega',
      atencion_cliente: 'Atención al Cliente',
      despachador: 'Despachador',
    };
    return labels[role] || role;
  };

  return (
    <Card className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 h-32 bg-gradient-to-r from-primary via-primary/80 to-primary/60" />
      
      <div className="relative px-6 pb-6">
        {/* Avatar positioned to overlap the gradient */}
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 pt-16">
          <AvatarUploader
            userId={profile.user_id}
            currentAvatarUrl={avatarUrl}
            initials={getInitials()}
            onAvatarUpdate={onAvatarUpdate}
          />
          
          <div className="flex-1 text-center sm:text-left pb-2">
            <h1 className="text-2xl font-bold text-foreground">
              {profile.nombre} {profile.apellido}
            </h1>
            
            <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-2">
              {roles.map((role) => (
                <Badge 
                  key={role} 
                  className={`${getRoleBadgeVariant(role)} font-medium`}
                >
                  {getRoleLabel(role)}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Info row */}
        <div className="flex flex-wrap justify-center sm:justify-start gap-6 mt-4 pt-4 border-t text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span>{profile.email}</span>
          </div>
          
          {profile.sucursal_id && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span>Sucursal asignada</span>
            </div>
          )}
          
          {profile.created_at && (
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              <span>
                Miembro desde {format(new Date(profile.created_at), "MMMM 'de' yyyy", { locale: es })}
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
