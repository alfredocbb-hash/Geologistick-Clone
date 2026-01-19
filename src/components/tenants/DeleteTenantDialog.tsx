import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: {
    id: string;
    nombre: string;
    usuarios_count: number;
    sucursales_count: number;
  };
  onSuccess: () => void;
}

export function DeleteTenantDialog({
  open,
  onOpenChange,
  tenant,
  onSuccess,
}: DeleteTenantDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const canDelete = confirmText === tenant.nombre;

  const handleDelete = async () => {
    if (!canDelete) return;

    setIsDeleting(true);
    try {
      // Delete in order to respect foreign key constraints
      // 1. Delete tenant branding
      await supabase.from('tenant_branding').delete().eq('tenant_id', tenant.id);

      // 2. Delete route stops (ruta_paradas) via rutas_planificadas
      const { data: rutas } = await supabase
        .from('rutas_planificadas')
        .select('id')
        .eq('tenant_id', tenant.id);
      
      if (rutas && rutas.length > 0) {
        const rutaIds = rutas.map(r => r.id);
        await supabase.from('ruta_paradas').delete().in('ruta_id', rutaIds);
      }

      // 3. Delete planned routes
      await supabase.from('rutas_planificadas').delete().eq('tenant_id', tenant.id);

      // 4. Delete route sheet shipments (hoja_ruta_envios) via hojas_ruta
      const { data: hojas } = await supabase
        .from('hojas_ruta')
        .select('id')
        .eq('tenant_id', tenant.id);
      
      if (hojas && hojas.length > 0) {
        const hojaIds = hojas.map(h => h.id);
        await supabase.from('hoja_ruta_envios').delete().in('hoja_ruta_id', hojaIds);
      }

      // 5. Delete route sheets
      await supabase.from('hojas_ruta').delete().eq('tenant_id', tenant.id);

      // 6. Delete shipment details and history
      const { data: envios } = await supabase
        .from('envios')
        .select('id')
        .eq('tenant_id', tenant.id);
      
      if (envios && envios.length > 0) {
        const envioIds = envios.map(e => e.id);
        await supabase.from('envio_detalles').delete().in('envio_id', envioIds);
        await supabase.from('envio_historial').delete().in('envio_id', envioIds);
      }

      // 7. Delete commissions and settlements
      await supabase.from('comisiones').delete().eq('tenant_id', tenant.id);
      await supabase.from('liquidaciones').delete().eq('tenant_id', tenant.id);
      await supabase.from('liquidaciones_sucursal').delete().eq('tenant_id', tenant.id);

      // 8. Delete payments and invoices
      await supabase.from('pagos').delete().eq('tenant_id', tenant.id);
      await supabase.from('facturas').delete().eq('tenant_id', tenant.id);

      // 9. Delete shipments
      await supabase.from('envios').delete().eq('tenant_id', tenant.id);

      // 10. Delete incidents
      await supabase.from('incidentes').delete().eq('tenant_id', tenant.id);

      // 11. Delete notifications
      await supabase.from('notifications').delete().eq('tenant_id', tenant.id);

      // 12. Delete ARCA config
      await supabase.from('arca_config').delete().eq('tenant_id', tenant.id);

      // 13. Delete cash sessions and movements
      const { data: sucursales } = await supabase
        .from('sucursales')
        .select('id')
        .eq('tenant_id', tenant.id);
      
      if (sucursales && sucursales.length > 0) {
        const sucursalIds = sucursales.map(s => s.id);
        const { data: sesiones } = await supabase
          .from('sesiones_caja')
          .select('id')
          .in('sucursal_id', sucursalIds);
        
        if (sesiones && sesiones.length > 0) {
          const sesionIds = sesiones.map(s => s.id);
          await supabase.from('movimientos_caja').delete().in('sesion_caja_id', sesionIds);
        }
        await supabase.from('sesiones_caja').delete().in('sucursal_id', sucursalIds);
      }

      // 14. Delete client settlements and accounts
      const { data: clientes } = await supabase
        .from('clientes')
        .select('id')
        .eq('tenant_id', tenant.id);
      
      if (clientes && clientes.length > 0) {
        const clienteIds = clientes.map(c => c.id);
        await supabase.from('cliente_cuenta_corriente').delete().in('cliente_id', clienteIds);
        await supabase.from('liquidaciones_cliente').delete().in('cliente_id', clienteIds);
      }

      // 15. Delete clients
      await supabase.from('clientes').delete().eq('tenant_id', tenant.id);

      // 16. Delete branches
      await supabase.from('sucursales').delete().eq('tenant_id', tenant.id);

      // 17. Get user IDs for this tenant
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('tenant_id', tenant.id);

      if (profiles && profiles.length > 0) {
        const userIds = profiles.map(p => p.user_id);
        
        // Delete user roles
        await supabase.from('user_roles').delete().in('user_id', userIds);
        
        // Delete driver locations
        await supabase.from('driver_locations').delete().in('chofer_id', userIds);
      }

      // 18. Delete profiles
      await supabase.from('profiles').delete().eq('tenant_id', tenant.id);

      // 19. Finally delete the tenant
      const { error: tenantError } = await supabase
        .from('tenants')
        .delete()
        .eq('id', tenant.id);

      if (tenantError) throw tenantError;

      toast.success('Empresa eliminada correctamente');
      setConfirmText('');
      onSuccess();
    } catch (error: any) {
      console.error('Error deleting tenant:', error);
      toast.error(`Error al eliminar: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isDeleting) {
      setConfirmText('');
      onOpenChange(newOpen);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle>Eliminar Empresa</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2 space-y-3">
            <p>
              Estás a punto de eliminar permanentemente la empresa{' '}
              <strong className="text-foreground">{tenant.nombre}</strong>.
            </p>
            <div className="rounded-lg bg-destructive/10 p-3 text-sm">
              <p className="font-medium text-destructive">Esta acción eliminará:</p>
              <ul className="mt-2 list-disc pl-5 space-y-1 text-muted-foreground">
                <li>{tenant.usuarios_count} usuario(s)</li>
                <li>{tenant.sucursales_count} sucursal(es)</li>
                <li>Todos los envíos, rutas y datos relacionados</li>
                <li>Configuración y facturación</li>
              </ul>
            </div>
            <p className="text-sm">
              Para confirmar, escribe{' '}
              <strong className="text-foreground">{tenant.nombre}</strong> en el campo de abajo:
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-2">
          <Label htmlFor="confirm-name" className="sr-only">
            Nombre de la empresa
          </Label>
          <Input
            id="confirm-name"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Escribe el nombre de la empresa"
            disabled={isDeleting}
          />
        </div>

        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isDeleting}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete || isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Eliminando...
              </>
            ) : (
              'Eliminar empresa'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
