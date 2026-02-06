import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Package, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import type { FlexPackage } from '@/hooks/useFlexPackages';
import type { Database } from '@/integrations/supabase/types';

type ShipmentStatus = Database['public']['Enums']['shipment_status'];

interface TransferFlexPackagesDialogProps {
  open: boolean;
  packages: FlexPackage[];
  onClose: () => void;
  onSuccess: () => void;
}

interface Driver {
  id: string;
  user_id: string;
  nombre: string;
  apellido: string | null;
  email: string;
}

// Generate a unique route number
function generateRouteNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `FLX-${dateStr}-${random}`;
}

export function TransferFlexPackagesDialog({
  open,
  packages,
  onClose,
  onSuccess,
}: TransferFlexPackagesDialogProps) {
  const { user, profile } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  // Fetch drivers when dialog opens
  useEffect(() => {
    if (open && (profile as any)?.tenant_id) {
      fetchDrivers();
    }
  }, [open, profile]);

  const fetchDrivers = async () => {
    const tenantId = (profile as any)?.tenant_id;
    if (!tenantId) return;
    
    setIsFetching(true);
    try {
      // Get users with chofer role from user_roles
      const { data: choferRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'chofer');

      if (rolesError) throw rolesError;
      
      const choferUserIds = choferRoles?.map(r => r.user_id) || [];
      
      if (choferUserIds.length === 0) {
        setDrivers([]);
        return;
      }

      // Get profiles for these users
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, nombre, apellido, email')
        .eq('tenant_id', tenantId)
        .in('user_id', choferUserIds)
        .neq('user_id', user?.id || '')
        .order('nombre');

      if (error) throw error;
      setDrivers((data || []) as Driver[]);
    } catch (err) {
      console.error('Error fetching drivers:', err);
      toast.error('Error al cargar choferes');
    } finally {
      setIsFetching(false);
    }
  };

  const handleTransfer = async () => {
    const tenantId = (profile as any)?.tenant_id;
    if (!selectedDriver || packages.length === 0 || !tenantId) return;

    setIsLoading(true);
    try {
      // Create a planned route for the selected driver
      const { data: ruta, error: rutaError } = await supabase
        .from('rutas_planificadas')
        .insert({
          chofer_id: selectedDriver,
          tenant_id: tenantId,
          numero: generateRouteNumber(),
          estado: 'pendiente',
          fecha: new Date().toISOString().split('T')[0],
          total_paradas: packages.length,
        })
        .select()
        .single();

      if (rutaError || !ruta) {
        throw new Error('Error al crear la ruta');
      }

      // Add packages to the route
      const paradas = packages.map((pkg, index) => ({
        ruta_id: ruta.id,
        envio_id: pkg.id,
        orden: index + 1,
        estado: 'pendiente',
        tipo: 'entrega',
        direccion: pkg.direccion_entrega,
        lat: pkg.entrega_lat,
        lng: pkg.entrega_lng,
      }));

      const { error: paradasError } = await supabase
        .from('ruta_paradas')
        .insert(paradas);

      if (paradasError) {
        throw new Error('Error al agregar paradas');
      }

      // Update envios with the new driver
      const packageIds = packages.map(p => p.id);
      const { error: updateError } = await supabase
        .from('envios')
        .update({
          chofer_id: selectedDriver,
          chofer_ultima_milla_id: selectedDriver,
          fecha_asignacion_ultima_milla: new Date().toISOString(),
        })
        .in('id', packageIds);

      if (updateError) {
        throw new Error('Error al actualizar envíos');
      }

      // Log in history for each package
      const historyEntries = packages.map(pkg => ({
        envio_id: pkg.id,
        estado_anterior: (pkg.estado || 'pendiente') as ShipmentStatus,
        estado_nuevo: (pkg.estado || 'pendiente') as ShipmentStatus,
        notas: `Asignado a chofer vía Modo Flex`,
        created_by: user?.id,
      }));

      await supabase.from('envio_historial').insert(historyEntries);

      const selectedDriverData = drivers.find(d => d.user_id === selectedDriver);
      const selectedDriverName = selectedDriverData 
        ? `${selectedDriverData.nombre} ${selectedDriverData.apellido || ''}`.trim()
        : 'Chofer';
      
      toast.success('Paquetes asignados', {
        description: `${packages.length} paquetes asignados a ${selectedDriverName}`,
      });

      onSuccess();
    } catch (error: any) {
      console.error('Error transferring packages:', error);
      toast.error('Error al asignar paquetes', { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Asignar a Chofer
          </DialogTitle>
          <DialogDescription>
            Los paquetes escaneados se asignarán como una ruta planificada para el chofer seleccionado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Package Count */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Paquetes a asignar:</span>
            </div>
            <Badge variant="secondary" className="text-base">
              {packages.length}
            </Badge>
          </div>

          {/* Driver Select */}
          <div className="space-y-2">
            <Label>Seleccionar chofer</Label>
            {isFetching ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : drivers.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No hay choferes disponibles
              </div>
            ) : (
              <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar chofer..." />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.user_id} value={driver.user_id}>
                      <div className="flex flex-col">
                        <span>{driver.nombre} {driver.apellido || ''}</span>
                        <span className="text-xs text-muted-foreground">{driver.email}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Info */}
          {selectedDriver && (
            <div className="flex items-start gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5" />
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                El chofer verá esta ruta en su sección "Mis Rutas" y podrá iniciarla cuando esté listo.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={isLoading || !selectedDriver || packages.length === 0}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Asignando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Confirmar Asignación
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
