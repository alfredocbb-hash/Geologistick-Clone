import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useGoogleMaps } from '@/components/maps/GoogleMapsProvider';

interface Props {
  tenantId: string | null;
}

export default function DashboardMiniMap({ tenantId }: Props) {
  const { apiKey } = useGoogleMaps();

  const { data: sucursales, isLoading } = useQuery({
    queryKey: ['dashboard-map-sucursales', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sucursales')
        .select('id, nombre, direccion, ciudad, lat, lng')
        .eq('tenant_id', tenantId!)
        .eq('activa', true);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  if (isLoading) return <Skeleton className="h-[300px]" />;

  const displaySucursales = sucursales?.filter(s => s.direccion && s.direccion !== 'Por configurar') || [];
  if (displaySucursales.length === 0) return null;

  const first = displaySucursales[0];
  const query = encodeURIComponent(`${first.direccion}, ${first.ciudad || ''}`);
  const embedSrc = apiKey
    ? `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${query}&zoom=12`
    : null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          Sucursales
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative">
          {embedSrc ? (
            <iframe
              title="Mapa de sucursales"
              src={embedSrc}
              width="100%"
              height="250"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="h-[250px] flex items-center justify-center bg-muted text-muted-foreground text-sm">
              Cargando mapa...
            </div>
          )}
        </div>
        <div className="p-3 space-y-1.5">
          {displaySucursales.slice(0, 4).map(s => (
            <div key={s.id} className="flex items-center gap-2 text-sm">
              <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
              <span className="font-medium truncate">{s.nombre}</span>
              <span className="text-muted-foreground truncate text-xs ml-auto">{s.ciudad || s.direccion}</span>
            </div>
          ))}
          {displaySucursales.length > 4 && (
            <p className="text-xs text-muted-foreground">+{displaySucursales.length - 4} más</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
