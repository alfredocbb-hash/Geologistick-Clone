import { Navigate } from 'react-router-dom';
import { useTenantFeature } from '@/hooks/useTenantFeature';
import { useAuth } from '@/lib/auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Wallet } from 'lucide-react';
import { LiquidacionesManualesTab } from '@/components/finanzas/LiquidacionesManualesTab';

export default function Finanzas() {
  const { enabled, isLoading } = useTenantFeature('finanzas');
  const { isAdmin, isSuperAdmin, loading: authLoading } = useAuth();

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!enabled) return <Navigate to="/dashboard" replace />;
  if (!isAdmin() && !isSuperAdmin()) return <Navigate to="/dashboard" replace />;

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Wallet className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Finanzas</h1>
          <p className="text-sm text-muted-foreground">Liquidaciones manuales a terciarizados, proveedores y partners</p>
        </div>
      </div>

      <Tabs defaultValue="liquidaciones">
        <TabsList>
          <TabsTrigger value="liquidaciones">Liquidaciones manuales</TabsTrigger>
        </TabsList>
        <TabsContent value="liquidaciones" className="mt-4">
          <LiquidacionesManualesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
