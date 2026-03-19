import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Package } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  tenantId: string | null;
}

const getStatusBadge = (status: string) => {
  const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pendiente: { label: 'Pendiente', variant: 'secondary' },
    en_transito: { label: 'En Tránsito', variant: 'default' },
    en_reparto: { label: 'En Reparto', variant: 'outline' },
    entregado: { label: 'Entregado', variant: 'default' },
  };
  const { label, variant } = config[status] || { label: status, variant: 'secondary' as const };
  return <Badge variant={variant}>{label}</Badge>;
};

export default function DashboardRecentShipments({ tenantId }: Props) {
  const { data: recentShipments, isLoading } = useQuery({
    queryKey: ['recent-shipments', tenantId, 'v2'],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from('envios')
        .select('tracking_number, estado, direccion_entrega, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!tenantId,
  });

  return (
    <Card variant="glass" className="glow-hover">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-[hsl(var(--envios))] to-[hsl(var(--geo-cyan))]">
            <Package className="h-4 w-4 text-white" />
          </div>
          Envíos Recientes
        </CardTitle>
        <CardDescription>Los últimos movimientos del sistema</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : recentShipments && recentShipments.length > 0 ? (
          <div className="space-y-3">
            {recentShipments.map((shipment) => (
              <div
                key={shipment.tracking_number}
                className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/60 border border-transparent hover:border-border/50 transition-all duration-200"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-sm font-medium">{shipment.tracking_number}</span>
                  <span className="text-xs text-muted-foreground">{shipment.direccion_entrega}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {getStatusBadge(shipment.estado || 'pendiente')}
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(shipment.created_at), { addSuffix: true, locale: es })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Sin envíos recientes</p>
            <p className="text-sm">Los envíos aparecerán aquí</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
