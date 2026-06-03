import { Building2, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { useSuperAdminTenantFilter } from '@/components/providers/SuperAdminTenantFilterProvider';

/**
 * Indicador read-only del tenant activo para super admin.
 * Mostralo en la barra de filtros de cada módulo para dejar claro
 * qué tenant se está visualizando.
 */
export function TenantFilterChip({ className }: { className?: string }) {
  const { isSuperAdmin } = useAuth();
  const { selectedTenant } = useSuperAdminTenantFilter();

  if (!isSuperAdmin()) return null;

  if (!selectedTenant) {
    return (
      <Badge variant="outline" className={`gap-1 ${className ?? ''}`}>
        <Globe className="h-3 w-3" />
        Todos los tenants
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className={`gap-1 ${className ?? ''}`}>
      <Building2 className="h-3 w-3" />
      {selectedTenant.nombre}
    </Badge>
  );
}
