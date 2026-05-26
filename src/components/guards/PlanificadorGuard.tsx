import { Outlet, useNavigate } from 'react-router-dom';
import { useTenantContext } from '@/components/providers/TenantProvider';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Route, Loader2 } from 'lucide-react';

export function PlanificadorGuard() {
  const { tenant, isLoading } = useTenantContext();
  const { isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Super admin siempre tiene acceso; tenant sin flag (legacy/null) cuenta como habilitado.
  const enabled = isSuperAdmin() || tenant?.planificador_enabled !== false;

  if (!enabled) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Route className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl">Módulo Logístico Avanzado no disponible</CardTitle>
            <CardDescription>
              El Módulo Logístico Avanzado (Planificador de Rutas y Mapa en Vivo) no está habilitado
              para tu organización. Contactá al administrador para activarlo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/dashboard')}>Volver al Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <Outlet />;
}
