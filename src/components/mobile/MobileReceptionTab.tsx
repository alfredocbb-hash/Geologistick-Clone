import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Package, QrCode, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function MobileReceptionTab() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  // Fetch pending shipments for reception at this branch/logistics center
  const { data: pendingShipments, isLoading } = useQuery({
    queryKey: ['mobile-pending-reception', profile?.sucursal_id],
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
          created_at,
          remitente:clientes!envios_remitente_id_fkey(nombre, apellido),
          destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido)
        `)
        .or(`sucursal_destino_id.eq.${profile.sucursal_id},sucursal_origen_id.eq.${profile.sucursal_id}`)
        .in('estado', ['en_transito', 'pendiente', 'recogido'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.sucursal_id
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendiente':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">Pendiente</Badge>;
      case 'en_transito':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">En Tránsito</Badge>;
      case 'recogido':
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">Recogido</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white mb-4">Recepción de Envíos</h2>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 bg-slate-800" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">Recepción de Envíos</h2>
        <Button 
          size="sm"
          onClick={() => navigate('/scan')}
          className="bg-primary/20 text-primary hover:bg-primary/30"
        >
          <QrCode className="w-4 h-4 mr-2" />
          Escanear
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="bg-slate-800/50 border-slate-700 p-3 text-center">
          <Package className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-white">
            {pendingShipments?.filter(s => s.estado === 'pendiente').length || 0}
          </p>
          <p className="text-xs text-slate-400">Pendientes</p>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700 p-3 text-center">
          <Clock className="w-5 h-5 text-blue-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-white">
            {pendingShipments?.filter(s => s.estado === 'en_transito').length || 0}
          </p>
          <p className="text-xs text-slate-400">En Tránsito</p>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700 p-3 text-center">
          <CheckCircle2 className="w-5 h-5 text-green-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-white">
            {pendingShipments?.length || 0}
          </p>
          <p className="text-xs text-slate-400">Total</p>
        </Card>
      </div>

      {/* Shipments list */}
      {pendingShipments && pendingShipments.length > 0 ? (
        <div className="space-y-3">
          {pendingShipments.map((shipment: any) => (
            <Card 
              key={shipment.id} 
              className="bg-slate-800/50 border-slate-700 p-4 hover:bg-slate-800/70 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  <span className="font-mono text-sm text-white">{shipment.tracking_number}</span>
                </div>
                {getStatusBadge(shipment.estado)}
              </div>
              
              <div className="text-sm text-slate-400 mb-2">
                <p className="truncate">
                  {shipment.direccion_entrega}, {shipment.ciudad_entrega}
                </p>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  De: {shipment.remitente?.nombre} {shipment.remitente?.apellido}
                </span>
                <span>
                  {format(new Date(shipment.created_at), 'dd MMM', { locale: es })}
                </span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-slate-800/50 border-slate-700 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No hay envíos pendientes de recepción</p>
        </Card>
      )}
    </div>
  );
}
