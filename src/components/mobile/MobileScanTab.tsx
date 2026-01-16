import { useState } from 'react';
import { QrCode, Package, Truck, History, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

type ScanMode = 'idle' | 'scanning';

export function MobileScanTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [scanMode, setScanMode] = useState<ScanMode>('idle');

  // Fetch recent scans
  const { data: recentScans } = useQuery({
    queryKey: ['mobile-recent-scans', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('envio_historial')
        .select(`
          *,
          envio:envios(tracking_number, estado, direccion_entrega)
        `)
        .eq('created_by', user?.id)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  const handleScanClick = () => {
    // Navigate to the existing scan page
    navigate('/scan');
  };

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'entregado':
        return 'text-green-400';
      case 'en_transito':
      case 'en_reparto':
        return 'text-blue-400';
      case 'recogido':
      case 'en_bodega':
        return 'text-yellow-400';
      default:
        return 'text-slate-400';
    }
  };

  const getStatusLabel = (estado: string) => {
    switch (estado) {
      case 'entregado':
        return 'Entregado';
      case 'en_transito':
        return 'En tránsito';
      case 'en_reparto':
        return 'En reparto';
      case 'recogido':
        return 'Recogido';
      case 'en_bodega':
        return 'En bodega';
      case 'cancelado':
        return 'Cancelado';
      case 'devuelto':
        return 'Devuelto';
      default:
        return estado;
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Escanear</h1>

      {/* Main Scan Button */}
      <div className="flex flex-col items-center py-8">
        <button
          onClick={handleScanClick}
          className="relative w-40 h-40 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-2xl shadow-primary/30 hover:scale-105 transition-transform active:scale-95"
        >
          <div className="absolute inset-2 rounded-full border-4 border-dashed border-primary-foreground/30 animate-spin" style={{ animationDuration: '10s' }} />
          <div className="flex flex-col items-center">
            <QrCode className="h-16 w-16 text-primary-foreground" />
            <span className="text-primary-foreground font-semibold mt-2">ESCANEAR</span>
          </div>
        </button>
        <p className="text-slate-400 mt-4 text-center">
          Escanea el código QR del envío
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Card 
          className="bg-slate-800/50 border-slate-700 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => navigate('/my-routes')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Truck className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="font-medium text-white">Colectar</p>
              <p className="text-xs text-slate-400">Ruta asignada</p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="bg-slate-800/50 border-slate-700 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => navigate('/my-routes')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Package className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="font-medium text-white">Entregar</p>
              <p className="text-xs text-slate-400">Ruta activa</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Scans */}
      {recentScans && recentScans.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-slate-400" />
            <h2 className="font-semibold text-white">Últimos escaneos</h2>
          </div>

          <div className="space-y-2">
            {recentScans.map((scan) => (
              <Card key={scan.id} className="bg-slate-800/30 border-slate-700/50">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className={`h-5 w-5 ${getStatusColor(scan.envio?.estado || '')}`} />
                    <div>
                      <p className="font-medium text-white text-sm">
                        {scan.envio?.tracking_number}
                      </p>
                      <p className="text-xs text-slate-400 truncate max-w-[180px]">
                        {scan.envio?.direccion_entrega}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs capitalize ${getStatusColor(scan.envio?.estado || '')}`}>
                    {getStatusLabel(scan.estado_nuevo)}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
