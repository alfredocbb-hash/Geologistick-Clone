import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Package, QrCode, MapPin, User, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function MobileDeliveriesTab() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  // Fetch shipments ready for delivery at this branch
  const { data: deliveryShipments, isLoading } = useQuery({
    queryKey: ['mobile-deliveries', profile?.sucursal_id],
    queryFn: async () => {
      if (!profile?.sucursal_id) return [];
      
      const { data, error } = await supabase
        .from('envios')
        .select(`
          id,
          tracking_number,
          estado,
          direccion_entrega,
          ciudad_entrega,
          pago_contra_entrega,
          precio_total,
          created_at,
          nombre_destinatario,
          destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido, telefono)
        `)
        .eq('sucursal_entrega_id', profile.sucursal_id)
        .in('estado', ['en_sucursal', 'en_reparto', 'recogido'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.sucursal_id
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'en_sucursal':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">En Sucursal</Badge>;
      case 'recogido':
        return <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">Recogido</Badge>;
      case 'en_reparto':
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">En Reparto</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white mb-4">Entregas Pendientes</h2>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 bg-slate-800" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">Entregas Pendientes</h2>
        <Button 
          size="sm"
          onClick={() => navigate('/scan')}
          className="bg-primary/20 text-primary hover:bg-primary/30"
        >
          <QrCode className="w-4 h-4 mr-2" />
          Escanear
        </Button>
      </div>

      {/* Summary */}
      <Card className="bg-gradient-to-r from-primary/20 to-primary/10 border-primary/30 p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-300">Envíos para entregar hoy</p>
            <p className="text-3xl font-bold text-white">{deliveryShipments?.length || 0}</p>
          </div>
          <Package className="w-12 h-12 text-primary/50" />
        </div>
      </Card>

      {/* Shipments list */}
      {deliveryShipments && deliveryShipments.length > 0 ? (
        <div className="space-y-3">
          {deliveryShipments.map((shipment: any) => (
            <Card 
              key={shipment.id} 
              className="bg-slate-800/50 border-slate-700 p-4 hover:bg-slate-800/70 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm text-white">{shipment.tracking_number}</span>
                    {shipment.pago_contra_entrega && (
                      <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">
                        COD ${shipment.precio_total}
                      </Badge>
                    )}
                  </div>
                  {getStatusBadge(shipment.estado)}
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2 text-slate-400">
                  <User className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    {shipment.nombre_destinatario || `${shipment.destinatario?.nombre || ''} ${shipment.destinatario?.apellido || ''}`.trim() || 'Sin destinatario'}
                  </span>
                </div>
                <div className="flex items-start gap-2 text-slate-400">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                  <span className="truncate">
                    {shipment.direccion_entrega}, {shipment.ciudad_entrega}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700">
                <span className="text-xs text-slate-500">
                  {format(new Date(shipment.created_at), "dd MMM yyyy", { locale: es })}
                </span>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="text-primary hover:bg-primary/10 h-8"
                  onClick={() => navigate('/scan')}
                >
                  Entregar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-slate-800/50 border-slate-700 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No hay entregas pendientes</p>
        </Card>
      )}
    </div>
  );
}
